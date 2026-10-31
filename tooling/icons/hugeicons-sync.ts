import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Rebuilds `packages/icons` from a local Hugeicons Pro SVG export (one folder per style, one subfolder per category).
 * Usage: `pnpm --filter @rezumi/tooling icons:sync <path to the svg export>`, or set HUGEICONS_SVG_DIR.
 *
 * `packages/icons/icons.config.json` decides what is copied:
 *  - `app` icons (stable name -> Hugeicons name) get stroke-standard and duotone-standard SVGs plus the render data in
 *    `src/generated/app-icons.json` that the web and mobile `Icon` components draw.
 *  - `appCategories` are staged as SVG files only, so a new app icon needs a config entry rather than a new export.
 *  - `cv` icons (all brand logos and the resume-related categories) get stroke-rounded, stroke-standard and
 *    stroke-sharp SVGs for the resume icon style.
 * Files land flat as `svg/<style>/<name>.svg`; `catalog.json` records each icon's category, sets and styles.
 */

type Config = {
	app: Record<string, string>;
	appCategories: string[];
	cv: { categories: string[]; names: string[]; phosphor: Record<string, string> };
};
type IconNode = [tag: string, attributes: Record<string, string>];
type CatalogEntry = { category: string; sets: Set<"app" | "app-extra" | "cv">; styles: Set<Style> };

const STYLES = ["stroke-standard", "duotone-standard", "stroke-rounded", "stroke-sharp"] as const;
type Style = (typeof STYLES)[number];

const source = process.argv[2] ?? process.env.HUGEICONS_SVG_DIR;
if (!source) throw new Error("Pass the Hugeicons SVG export directory, or set HUGEICONS_SVG_DIR.");

const packageRoot = fileURLToPath(new URL("../../packages/icons/", import.meta.url));
const config = JSON.parse(await readFile(join(packageRoot, "icons.config.json"), "utf8")) as Config;

// name -> category, per style. Hugeicons names are unique across categories.
const index = {} as Record<Style, Map<string, string>>;
for (const style of STYLES) {
	const names = new Map<string, string>();
	for (const category of await readdir(join(source, style), { withFileTypes: true })) {
		if (!category.isDirectory()) continue;
		for (const file of await readdir(join(source, style, category.name))) {
			if (file.endsWith(".svg")) names.set(file.slice(0, -4), category.name);
		}
	}
	index[style] = names;
}
const strokeIndex = index["stroke-standard"];

const inCategories = (categories: string[]) =>
	[...strokeIndex].filter(([, category]) => categories.includes(category)).map(([name]) => name);

const catalog = new Map<string, CatalogEntry>();
const stage = (name: string, set: "app" | "app-extra" | "cv", styles: readonly Style[]) => {
	const category = strokeIndex.get(name);
	if (!category) throw new Error(`"${name}" is not in the stroke-standard export.`);
	const entry = catalog.get(name) ?? { category, sets: new Set(), styles: new Set() };
	entry.sets.add(set);
	for (const style of styles) {
		if (index[style].has(name)) entry.styles.add(style);
		// A few icons are missing from one style; the app falls back to the stroke glyph, the CV picker skips them.
		else console.warn(`warn: ${name} has no ${style} glyph`);
	}
	catalog.set(name, entry);
};

const APP_STYLES = ["stroke-standard", "duotone-standard"] as const;
const CV_STYLES = ["stroke-standard", "stroke-rounded", "stroke-sharp"] as const;
for (const name of Object.values(config.app)) stage(name, "app", APP_STYLES);
for (const name of inCategories(config.appCategories)) stage(name, "app-extra", APP_STYLES);
for (const name of [...inCategories(config.cv.categories), ...config.cv.names, ...Object.values(config.cv.phosphor)]) {
	stage(name, "cv", CV_STYLES);
}

// Hugeicons SVGs are bare 24px `<path>`, `<circle>`, `<ellipse>` and `<rect>` elements that already set their own
// stroke or fill to `currentColor`; anything else would need new handling in the renderers, so fail loudly.
const ELEMENT = /<(path|circle|ellipse|rect)\s+([^>]*?)\s*\/>/g;
const ATTRIBUTE = /([\w:-]+)="([^"]*)"/g;
const parseNodes = (name: string, svg: string): IconNode[] => {
	const inner = svg
		.replace(/^<svg[^>]*>/, "")
		.replace(/<\/svg>\s*$/, "")
		.trim();
	const nodes: IconNode[] = [];
	for (const match of inner.matchAll(ELEMENT)) {
		const attributes: Record<string, string> = {};
		for (const attribute of (match[2] as string).matchAll(ATTRIBUTE))
			attributes[attribute[1] as string] = attribute[2] as string;
		nodes.push([match[1] as string, attributes]);
	}
	if (inner.replace(ELEMENT, "").trim() !== "" || nodes.length === 0)
		throw new Error(`Unexpected markup in ${name}.svg`);
	return nodes;
};

const svgRoot = join(packageRoot, "svg");
await rm(svgRoot, { recursive: true, force: true });
for (const style of STYLES) await mkdir(join(svgRoot, style), { recursive: true });

const sorted = [...catalog].sort(([a], [b]) => a.localeCompare(b));
const svgs = new Map<string, string>();
for (const [name, entry] of sorted) {
	for (const style of entry.styles) {
		const category = index[style].get(name) as string;
		const svg = await readFile(join(source, style, category, `${name}.svg`), "utf8");
		svgs.set(`${style}/${name}`, svg);
		await writeFile(join(svgRoot, style, `${name}.svg`), svg);
	}
}

const appIcons: Record<string, { stroke: IconNode[]; duotone?: IconNode[] }> = {};
for (const [stable, name] of Object.entries(config.app).sort(([a], [b]) => a.localeCompare(b))) {
	const stroke = svgs.get(`stroke-standard/${name}`) as string;
	const duotone = svgs.get(`duotone-standard/${name}`);
	appIcons[stable] = { stroke: parseNodes(name, stroke), ...(duotone ? { duotone: parseNodes(name, duotone) } : {}) };
}

const json = (value: unknown) => `${JSON.stringify(value, null, "\t")}\n`;
const sourceManifest = JSON.parse(await readFile(join(source, "stroke-standard", "_manifest.json"), "utf8")) as {
	package: string;
};
await mkdir(join(packageRoot, "src", "generated"), { recursive: true });
await writeFile(join(packageRoot, "src", "generated", "app-icons.json"), json(appIcons));
await writeFile(
	join(packageRoot, "catalog.json"),
	json({
		source: sourceManifest.package,
		app: Object.fromEntries(Object.entries(config.app).sort(([a], [b]) => a.localeCompare(b))),
		cvPhosphor: Object.fromEntries(Object.entries(config.cv.phosphor).sort(([a], [b]) => a.localeCompare(b))),
		icons: Object.fromEntries(
			sorted.map(([name, entry]) => [
				name,
				{ category: entry.category, sets: [...entry.sets].sort(), styles: [...entry.styles].sort() },
			]),
		),
	}),
);

const perStyle = Object.fromEntries(
	STYLES.map((style) => [style, sorted.filter(([, e]) => e.styles.has(style)).length]),
);
console.log(`Wrote ${sorted.length} icons to ${svgRoot}`, perStyle, `(${Object.keys(appIcons).length} app icons)`);
