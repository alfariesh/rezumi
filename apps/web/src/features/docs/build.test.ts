import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { compile } from "@mdx-js/mdx";
import { docsMdxOptions, imageSize, loadDocsSite } from "./build";

const docsRoot = fileURLToPath(new URL("../../../../../docs", import.meta.url));
const site = loadDocsSite(docsRoot);

const compilePage = async (value: string, path = resolve(docsRoot, "guides/example.mdx")) => {
	const unknown: string[] = [];
	const output = String(
		await compile(
			{ value, path },
			docsMdxOptions(site, (href) => unknown.push(href)),
		),
	);
	return { output, unknown };
};

describe("loadDocsSite", () => {
	it("lists every page in the navigation with its front matter", () => {
		expect(site.groups.length).toBeGreaterThan(0);
		expect(site.pages["getting-started"]).toMatchObject({ title: "Introduction", group: "Getting Started" });
		for (const page of Object.values(site.pages)) expect(page.title).not.toBe("");
	});

	it("reads redirects without their slashes", () => {
		expect(site.redirects["guides/using-ai-agent"]).toBe("guides/using-the-assistant");
	});
});

describe("docs MDX", () => {
	it("compiles every published page, with links to pages that exist and pictures that exist", async () => {
		const unknown: string[] = [];
		for (const slug of site.slugs) {
			const path = resolve(docsRoot, `${slug}.mdx`);
			const value = await readFile(path, "utf8");
			const output = String(
				await compile(
					{ value, path },
					docsMdxOptions(site, (href) => unknown.push(`${slug}: ${href}`)),
				),
			);
			for (const [, source] of output.matchAll(/import _docsImage\d+ from "([^"]+)"/g))
				expect(existsSync(resolve(docsRoot, slug, "..", source ?? "")), `${slug}: ${source}`).toBe(true);
		}
		expect(unknown).toEqual([]);
	});

	it("rewrites links for the app and reports pages that do not exist", async () => {
		const { output, unknown } = await compilePage(
			[
				"[Quickstart](/getting-started/quickstart#next-steps) [Home](/getting-started) [Old](/guides/using-ai-agent)",
				"[Register](https://rezumi.app/auth/register) [API](/api-reference/introduction) [Gone](/guides/missing)",
				'<Card title="Theme" href="/guides/choosing-colors">Colors</Card>',
			].join("\n\n"),
		);
		expect(output).toContain('href: "/docs/getting-started/quickstart#next-steps"');
		expect(output).toContain('href: "/docs"');
		expect(output).toContain('href: "/docs/guides/using-the-assistant"');
		expect(output).toContain('href: "/auth/register"');
		expect(output).toContain('href: "https://docs.rezumi.app/api-reference/introduction"');
		expect(output).toContain('href: "/docs/guides/choosing-colors"');
		expect(unknown).toEqual(["/guides/missing"]);
	});

	it("imports pictures and hands img and kbd to components", async () => {
		const { output } = await compilePage(
			'<Frame>\n  <img src="/images/getting-started/editor-overview.webp" alt="Editor" />\n</Frame>\n\nPress <kbd>K</kbd>.',
		);
		expect(output).toContain('import _docsImage0 from "../images/getting-started/editor-overview.webp"');
		expect(output).toMatch(
			/_jsx\(DocsImage, \{\s+src: _docsImage0,\s+alt: "Editor",\s+width: "1600",\s+height: "1000"/,
		);
		expect(output).toMatch(/_jsx\(Kbd, \{\s+children: "K"/);
	});

	it("gives headings ids and exports the table of contents without headings inside components", async () => {
		const { output } = await compilePage(
			'## Open the bar\n\n### Search for…\n\n#### Deep\n\n<Tab title="x">\n\n## Hidden\n\n</Tab>\n\n## Open the bar',
		);
		expect(output).toContain('id: "open-the-bar"');
		expect(output).toContain('id: "search-for"');
		expect(output).toContain('id: "deep"');
		expect(output).toContain('id: "open-the-bar-1"');
		const toc = /export const toc = (\[[\s\S]*?\]);/.exec(output)?.[1] ?? "[]";
		expect(JSON.parse(toc)).toEqual([
			{ depth: 2, id: "open-the-bar", title: "Open the bar" },
			{ depth: 3, id: "search-for", title: "Search for…" },
			{ depth: 2, id: "open-the-bar-1", title: "Open the bar" },
		]);
	});

	it("highlights code with the theme's variables and names the language", async () => {
		const { output } = await compilePage("```bash\npnpm install\n```");
		expect(output).toContain('"data-language": "bash"');
		expect(output).toContain("var(--code-token-function)");
	});
});

describe("imageSize", () => {
	it("reads WebP, PNG and JPEG headers", () => {
		const image = (path: string) => imageSize(resolve(docsRoot, "images", path));
		expect(image("getting-started/editor-overview.webp")).toEqual({ width: 1600, height: 1000 });
		expect(image("guides/career/story-approval.png")).toEqual({ width: 644, height: 451 });
		expect(image("guides/career/briefing.jpg")).toEqual({ width: 560, height: 398 });
	});
});
