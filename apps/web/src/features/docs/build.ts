import type { DocsGroup, DocsPageMeta, DocsTocEntry } from "./types";
import type { ProcessorOptions } from "@mdx-js/mdx";
/**
 * The build-time half of the docs, used by `vite.config.ts` only (Node). It compiles the MDX pages in the repository's
 * `docs/` folder into React components and serves the manifest the app lists them from (`virtual:rezumi-docs`).
 *
 * The pages are written for the hosted docs site (Mintlify), so the compiler adapts them here instead of in the files:
 * links move under `/docs`, `<img>` sources become imported assets (hashed, and a missing file fails the build),
 * `<kbd>` becomes HeroUI's Kbd, headings get ids, and each page exports its table of contents.
 */
import type { Program } from "estree";
import type { Heading, Root, RootContent } from "mdast";
import type { ShikiTransformer } from "shiki";
import type { Plugin } from "vite-plus";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { createProcessor } from "@mdx-js/mdx";
import rehypeShiki from "@shikijs/rehype";
import { valueToEstree } from "estree-util-value-to-estree";
import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { createCssVariablesTheme } from "shiki";
import { parse as parseYaml } from "yaml";
import { DOCS_HOME, resolveDocsHref } from "./paths";

type DocsConfig = {
	navigation: { tabs: { groups?: { group: string; pages: string[] }[] }[] };
	redirects?: { source: string; destination: string }[];
};

/** Everything the build knows about the docs folder: its groups, pages and redirects. */
export type DocsSite = {
	root: string;
	groups: DocsGroup[];
	pages: Record<string, DocsPageMeta>;
	redirects: Record<string, string>;
	slugs: ReadonlySet<string>;
};

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

/** A page's YAML front matter: its title and description. */
function readFrontmatter(file: string) {
	const source = readFileSync(file, "utf8");
	const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1];
	const data: unknown = block ? parseYaml(block) : {};
	const { title, description } = (data ?? {}) as { title?: unknown; description?: unknown };
	if (typeof title !== "string" || title.trim() === "") throw new Error(`${file} has no title in its front matter`);
	return { title, description: typeof description === "string" ? description : "" };
}

/**
 * Reads `docs.json` (the hosted site's navigation) and every listed page's front matter. Only pages in the navigation
 * are published; a file left out of it stays unpublished here too.
 */
export function loadDocsSite(root: string): DocsSite {
	const config = JSON.parse(readFileSync(resolve(root, "docs.json"), "utf8")) as DocsConfig;
	const groups = config.navigation.tabs.flatMap((tab) =>
		(tab.groups ?? []).map((group) => ({ title: group.group, slugs: group.pages.map(trimSlashes) })),
	);
	const pages: Record<string, DocsPageMeta> = {};
	for (const group of groups)
		for (const slug of group.slugs)
			pages[slug] = { slug, group: group.title, ...readFrontmatter(resolve(root, `${slug}.mdx`)) };
	if (!pages[DOCS_HOME]) throw new Error(`docs.json must list the docs home page, ${DOCS_HOME}`);

	const redirects = Object.fromEntries(
		(config.redirects ?? []).map(({ source, destination }) => [trimSlashes(source), trimSlashes(destination)]),
	);
	return { root, groups, pages, redirects, slugs: new Set(Object.keys(pages)) };
}

// MDX's JSX nodes (mdast-util-mdx-jsx), as far as these plugins touch them.
type JsxExpression = { type: "mdxJsxAttributeValueExpression"; value: string; data: { estree: Program } };
type JsxAttribute = { type: "mdxJsxAttribute"; name: string; value?: string | JsxExpression | null };
type JsxElement = {
	type: "mdxJsxFlowElement" | "mdxJsxTextElement";
	name: string | null;
	attributes: (JsxAttribute | { type: "mdxJsxExpressionAttribute" })[];
	children: RootContent[];
};
type Node = { type: string; children?: Node[] };

const isJsxElement = (node: Node): node is Node & JsxElement =>
	node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

/** Calls `visit` for every node below `node`, with whether it sits inside a JSX component. */
function walk(node: Node, visit: (node: Node, inComponent: boolean) => void, inComponent = false) {
	for (const child of node.children ?? []) {
		visit(child, inComponent);
		walk(child, visit, inComponent || isJsxElement(child));
	}
}

/** An ESM node MDX hoists to the top of the module. */
const esm = (body: Program["body"]) =>
	({
		type: "mdxjsEsm",
		value: "",
		data: { estree: { type: "Program", sourceType: "module", body } },
	}) as unknown as RootContent;

const identifierExpression = (name: string): JsxExpression => ({
	type: "mdxJsxAttributeValueExpression",
	value: name,
	data: {
		estree: {
			type: "Program",
			sourceType: "module",
			body: [{ type: "ExpressionStatement", expression: { type: "Identifier", name } }],
		},
	},
});

type LinkReport = (href: string, file: string) => void;

/** Rewrites links written for the hosted docs site (see `resolveDocsHref`); reports links to pages that don't exist. */
const remarkDocsLinks = (site: DocsSite, onUnknown: LinkReport) => () => (tree: Root, file: { path: string }) => {
	const rewrite = (href: string) => {
		const resolved = resolveDocsHref(href, site);
		if (resolved && !resolved.known) onUnknown(href, file.path);
		return resolved?.href ?? href;
	};
	walk(tree as Node, (node) => {
		if (node.type === "link" || node.type === "definition") {
			const link = node as Node & { url: string };
			link.url = rewrite(link.url);
		} else if (isJsxElement(node)) {
			for (const attribute of node.attributes)
				if (attribute.type === "mdxJsxAttribute" && attribute.name === "href" && typeof attribute.value === "string")
					attribute.value = rewrite(attribute.value);
		}
	});
};

/**
 * A PNG, JPEG or WebP picture's size in pixels, read from its header, so the page reserves its space before it loads.
 * Undefined for anything else.
 */
export function imageSize(file: string): { width: number; height: number } | undefined {
	const bytes = readFileSync(file);
	const ascii = (start: number, end: number) => bytes.toString("latin1", start, end);
	if (ascii(1, 4) === "PNG") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
	if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
		const chunk = ascii(12, 16);
		if (chunk === "VP8X") return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
		if (chunk === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
		if (chunk === "VP8L") {
			const bits = bytes.readUInt32LE(21);
			return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
		}
		return undefined;
	}
	if (bytes[0] === 0xff && bytes[1] === 0xd8) {
		// JPEG: walk the segments to the frame header (SOF0–SOF2).
		let offset = 2;
		while (offset + 9 < bytes.length) {
			if (bytes[offset] !== 0xff) return undefined;
			const marker = bytes[offset + 1] ?? 0;
			if (marker >= 0xc0 && marker <= 0xc2)
				return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
			offset += 2 + bytes.readUInt16BE(offset + 2);
		}
	}
	return undefined;
}

/** Tags the content writes as HTML that the docs draw with their own components. */
const elementComponents: Record<string, string> = { img: "DocsImage", kbd: "Kbd" };

/**
 * Hands `<img>` and `<kbd>` to components (MDX passes JSX written in lowercase straight to React), and turns each
 * `/images/…` source into an import of the file, so Vite fingerprints it and a missing picture fails the build. A
 * picture without a size gets its file's, so the page doesn't jump as pictures load.
 */
const remarkDocsElements = (site: DocsSite) => () => (tree: Root, file: { path: string }) => {
	const imports = new Map<string, string>();
	const importImage = (src: string) => {
		const target = resolve(site.root, `.${src}`);
		let name = imports.get(target);
		if (!name) {
			name = `_docsImage${imports.size}`;
			imports.set(target, name);
		}
		return name;
	};

	walk(tree as Node, (node) => {
		if (!isJsxElement(node) || !node.name) return;
		const component = elementComponents[node.name];
		if (!component) return;
		node.name = component;
		const named = (name: string) =>
			node.attributes.find(
				(attribute): attribute is JsxAttribute => attribute.type === "mdxJsxAttribute" && attribute.name === name,
			);
		const src = named("src");
		if (typeof src?.value !== "string" || !src.value.startsWith("/images/")) return;
		const size = named("width") || named("height") ? undefined : imageSize(resolve(site.root, `.${src.value}`));
		src.value = identifierExpression(importImage(src.value));
		if (size)
			node.attributes.push(
				{ type: "mdxJsxAttribute", name: "width", value: String(size.width) },
				{ type: "mdxJsxAttribute", name: "height", value: String(size.height) },
			);
	});

	const directory = dirname(file.path);
	tree.children.unshift(
		...[...imports].map(([target, name]) => {
			const path = relative(directory, target);
			return esm([
				{
					type: "ImportDeclaration",
					specifiers: [{ type: "ImportDefaultSpecifier", local: { type: "Identifier", name } }],
					source: { type: "Literal", value: path.startsWith(".") ? path : `./${path}` },
					attributes: [],
				},
			]);
		}),
	);
};

/**
 * Gives every heading an id (GitHub's slugs, as the hosted site uses) and exports the page's table of contents as
 * `toc`: its `h2`s and `h3`s, leaving out headings inside components (a tab or an accordion item) that may be hidden.
 */
const remarkDocsHeadings = () => (tree: Root) => {
	const slugger = new GithubSlugger();
	const toc: DocsTocEntry[] = [];
	walk(tree as Node, (node, inComponent) => {
		if (node.type !== "heading") return;
		const heading = node as unknown as Heading;
		const title = toString(heading).trim();
		const id = slugger.slug(title);
		heading.data = { ...heading.data, hProperties: { ...heading.data?.hProperties, id } };
		if (!inComponent && (heading.depth === 2 || heading.depth === 3)) toc.push({ depth: heading.depth, id, title });
	});
	tree.children.push(
		esm([
			{
				type: "ExportNamedDeclaration",
				specifiers: [],
				attributes: [],
				declaration: {
					type: "VariableDeclaration",
					kind: "const",
					declarations: [
						{ type: "VariableDeclarator", id: { type: "Identifier", name: "toc" }, init: valueToEstree(toc) },
					],
				},
			},
		]),
	);
};

/** Code colors come from CSS variables (`docs.css`), so blocks follow the theme's tokens in light and dark. */
const codeTheme = createCssVariablesTheme({ name: "rezumi-docs", variablePrefix: "--code-", fontStyle: true });

/** Names a block's language, and the file name a page writes after it (```jsonc wrangler.jsonc). */
const codeLabels: ShikiTransformer = {
	pre(node) {
		node.properties["data-language"] = this.options.lang;
		const title = this.options.meta?.__raw?.trim();
		if (title) node.properties["data-title"] = title;
	},
};

/** The languages the pages use; anything else is shown as plain text. */
const codeLanguages = [
	"bash",
	"css",
	"csv",
	"dotenv",
	"http",
	"javascript",
	"json",
	"jsonc",
	"markdown",
	"mermaid",
	"python",
	"shellscript",
	"sql",
	"tsx",
	"typescript",
	"yaml",
] as const;

/** The MDX compiler's plugins, shared by the Vite plugin and the tests. */
export function docsMdxOptions(site: DocsSite, onUnknownLink: LinkReport): ProcessorOptions {
	return {
		remarkPlugins: [
			remarkFrontmatter,
			[remarkMdxFrontmatter, { name: "frontmatter" }],
			remarkGfm,
			remarkDocsLinks(site, onUnknownLink),
			remarkDocsElements(site),
			remarkDocsHeadings,
		],
		rehypePlugins: [
			[
				rehypeShiki,
				{
					theme: codeTheme,
					langs: [...codeLanguages],
					langAlias: { sh: "shellscript", md: "markdown", ts: "typescript" },
					defaultLanguage: "text",
					fallbackLanguage: "text",
					transformers: [codeLabels],
				},
			],
		],
	};
}

const VIRTUAL_ID = "virtual:rezumi-docs";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/** `virtual:rezumi-docs`: the groups, pages and redirects, and a loader per page (one chunk each). */
function manifestModule(site: DocsSite) {
	const loaders = [...site.slugs]
		.map((slug) => `\t${JSON.stringify(slug)}: () => import(${JSON.stringify(resolve(site.root, `${slug}.mdx`))}),`)
		.join("\n");
	return [
		`export const groups = ${JSON.stringify(site.groups)};`,
		`export const pages = ${JSON.stringify(site.pages)};`,
		`export const redirects = ${JSON.stringify(site.redirects)};`,
		`export const loaders = {\n${loaders}\n};`,
	].join("\n");
}

/** The docs' Vite plugins: the MDX compiler and the manifest. */
export function docsPlugins(root: string): Plugin[] {
	const site = loadDocsSite(root);
	const reported = new Set<string>();
	const onUnknownLink: LinkReport = (href, file) => {
		const key = `${file}\0${href}`;
		if (reported.has(key)) return;
		reported.add(key);
		console.warn(`[docs] ${relative(root, file)} links to ${href}, which is not a docs page`);
	};

	const processor = createProcessor(docsMdxOptions(site, onUnknownLink));

	return [
		{
			name: "rezumi-docs-mdx",
			enforce: "pre",
			async transform(code, id) {
				const [path = ""] = id.split("?", 1);
				if (!path.endsWith(".mdx")) return undefined;
				const compiled = await processor.process({ path, value: code });
				return { code: String(compiled.value), map: null };
			},
		},
		{
			name: "rezumi-docs-manifest",
			resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
			load(id) {
				if (id !== RESOLVED_ID) return undefined;
				// Titles come from the pages' front matter: a change to one rebuilds the sidebar.
				const current = loadDocsSite(root);
				this.addWatchFile(resolve(root, "docs.json"));
				for (const slug of current.slugs) this.addWatchFile(resolve(root, `${slug}.mdx`));
				return manifestModule(current);
			},
		},
	];
}
