/**
 * The portfolio's visual QA matrix (`02-teknis.md` section 22, Phase 06 step 5), photographed in the system Chrome:
 *
 * - pages: every theme with three personas (its own and the next two in the lineup), light and dark, at 390 and
 *   1440 px, in variants A–D, full page;
 * - details: each theme's first work on its own page (`<page>.work-<slug>.html`, Phase 13 B2), in variants A and D (right
 *   to left), light and dark, at 390 and 1440 px, full page;
 * - effects: each intro effect the theme supports (`PORTFOLIO_THEME_INFO[theme].effects`) on the theme's persona at
 *   its start, middle and end (5.5 s), the middle again with reduced motion, and Garis vektor on a touch phone, each
 *   cut to the intro around the name. Garis vektor's middle frame points the mouse at the name's first letter.
 *
 * Then one contact sheet per theme for its pages and details, and one for its effects.
 *
 *   pnpm --filter @rezumi/tooling portfolio:matrix [--themes lugas,prima] [--personas own|nadia,bayu]
 *     [--variants a,b,c,d] [--lang id|en] [--parts pages,details,effects] [--scale 1] [--jobs 4] [--only-sheets]
 *     [--out <dir>]
 *
 * Variants: A full (every block type, metrics with change, sparkline and before/after, services, testimonials, clients
 * with and without logos), B minimal (no photo, no work pictures, one Text block per work), C very long (twelve works,
 * a very long name, long work titles), D right to left (`ar-SA`). Each page is scrolled to the bottom and back so lazy
 * pictures load, and every shot is checked for sideways scrolling (`scrollWidth` past the page's width).
 *
 * Writes under `--out` (default `<tmp>/rezumi-portfolio-matrix`): `html/` (the pages and their pictures),
 * `shots/<theme>/<persona>-<variant>-<scheme>-<width>.jpg`, `shots/<theme>/detail-<a|d>-<scheme>-<width>.jpg`,
 * `effects/<theme>/<effect>-<frame>.jpg`, `sheets/<theme>.jpg`, `sheets/<theme>-effects.jpg` and `report.json` (counts
 * and the sideways-scrolling list, which is also printed). `--only-sheets` rebuilds the sheets from the shots on disk.
 */
import type { PersonaId, PersonaLang, PersonaVariant } from "./persona";
import type { BrowserContextOptions, Page } from "@playwright/test";
import type { PortfolioHeroEffect, PortfolioScheme, PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { OverlayOptions } from "sharp";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { PORTFOLIO_THEME_INFO, PORTFOLIO_THEMES, portfolioThemeSchema } from "@rezumi/schema/portfolio/themes";
import { Camera, closePage, freezeAnimations, fullPageShot, horizontalOverflow, loadPictures } from "./browser";
import { isPersonaId, PERSONA_IDS, PERSONA_LANGS, THEME_PERSONAS } from "./persona";
import { writePersonaPage } from "./render";

const VARIANTS = { a: "full", b: "minimal", c: "long", d: "rtl" } as const satisfies Record<string, PersonaVariant>;
type VariantLetter = keyof typeof VARIANTS;
const VARIANT_LABELS: Record<VariantLetter, string> = { a: "A full", b: "B minimal", c: "C very long", d: "D RTL" };
const SCHEMES = ["light", "dark"] as const satisfies readonly PortfolioScheme[];
const WIDTHS = [1440, 390] as const;
type Width = (typeof WIDTHS)[number];
const PARTS = ["pages", "details", "effects"] as const;

/** The intro effects in the order the editor offers them, and a moment inside each (ms) for the middle frame. */
const EFFECT_MIDDLE: Record<Exclude<PortfolioHeroEffect, "none">, number> = {
	"fade-up": 600,
	shimmer: 800,
	gradient: 2500,
	typewriter: 2400,
	scramble: 500,
	"vector-hover": 400,
};
const EFFECT_END = 5500;
const FRAMES = ["start", "middle", "end", "reduced", "touch"] as const;
type Frame = (typeof FRAMES)[number];

const { values } = parseArgs({
	options: {
		themes: { type: "string" },
		personas: { type: "string" },
		variants: { type: "string", default: "a,b,c,d" },
		lang: { type: "string", default: "id" },
		parts: { type: "string", default: PARTS.join(",") },
		scale: { type: "string", default: "1" },
		jobs: { type: "string", default: "4" },
		"only-sheets": { type: "boolean", default: false },
		out: { type: "string", default: join(tmpdir(), "rezumi-portfolio-matrix") },
	},
});

const list = (value: string | undefined) =>
	(value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
const themes = values.themes ? list(values.themes).map((id) => portfolioThemeSchema.parse(id)) : [...PORTFOLIO_THEMES];
const variants = list(values.variants).map((value) => {
	const letter = (Object.entries(VARIANTS).find(([key, name]) => value === key || value === name)?.[0] ??
		null) as VariantLetter | null;
	if (!letter) throw new Error(`Unknown variant "${value}": use a, b, c, d (or full, minimal, long, rtl).`);
	return letter;
});
if (!(PERSONA_LANGS as readonly string[]).includes(values.lang)) throw new Error(`Unknown language "${values.lang}".`);
const lang = values.lang as PersonaLang;
const parts = new Set(list(values.parts));
for (const part of parts)
	if (!(PARTS as readonly string[]).includes(part)) throw new Error(`Unknown part "${part}": use ${PARTS.join(", ")}.`);
const scale = Number(values.scale);
const jobs = Math.max(1, Number(values.jobs) || 1);
const out = values.out;
const folders = {
	html: join(out, "html"),
	shots: join(out, "shots"),
	effects: join(out, "effects"),
	sheets: join(out, "sheets"),
};

/** The theme's own persona first, then the next two in the lineup, unless `--personas` names them. */
function personasFor(theme: PortfolioTheme): PersonaId[] {
	const own = THEME_PERSONAS[theme];
	if (values.personas === "own") return [own];
	if (values.personas) {
		const chosen = list(values.personas);
		for (const id of chosen) if (!isPersonaId(id)) throw new Error(`Unknown persona "${id}".`);
		return chosen as PersonaId[];
	}
	const start = PERSONA_IDS.indexOf(own);
	return [0, 1, 2].map((step) => PERSONA_IDS[(start + step) % PERSONA_IDS.length] as PersonaId);
}

async function pool<T>(items: readonly T[], run: (item: T) => Promise<void>): Promise<void> {
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(jobs, items.length) }, async () => {
			while (next < items.length) {
				const item = items[next++];
				if (item !== undefined) await run(item);
			}
		}),
	);
}

const counts = { pages: 0, details: 0, effects: 0, sheets: 0 };
const overflow: { shot: string; px: number; culprits: string[] }[] = [];
const warnings: string[] = [];

async function saveJpeg(input: Buffer, target: string) {
	await sharp(input, { limitInputPixels: false }).jpeg({ quality: 80 }).toFile(target);
}

function noteOverflow(shot: string, result: { px: number; culprits: string[] }) {
	if (result.px > 0) overflow.push({ shot, ...result });
}

async function photograph(camera: Camera) {
	const device = (width: Width, extra: BrowserContextOptions = {}): BrowserContextOptions => ({
		viewport: width === 390 ? { width: 390, height: 844 } : { width: 1440, height: 900 },
		deviceScaleFactor: scale,
		...(width === 390 ? { isMobile: true, hasTouch: true } : {}),
		...extra,
	});

	for (const theme of themes) {
		await mkdir(join(folders.shots, theme), { recursive: true });
		await mkdir(join(folders.effects, theme), { recursive: true });
		const personas = personasFor(theme);

		if (parts.has("pages")) {
			const tasks = [];
			for (const persona of personas)
				for (const letter of variants)
					for (const scheme of SCHEMES) {
						const page = await writePersonaPage(folders.html, `${theme}-${persona}-${letter}-${scheme}.html`, {
							persona,
							lang,
							variant: VARIANTS[letter],
							theme,
							scheme,
						});
						for (const width of WIDTHS)
							tasks.push({ file: page.file, name: `${persona}-${letter}-${scheme}-${width}`, width });
					}
			await pool(tasks, async ({ file, name, width }) => {
				const tab = await camera.open(device(width), file);
				await loadPictures(tab);
				await tab.clock.runFor(6000);
				noteOverflow(`${theme}/${name}`, await horizontalOverflow(tab));
				await saveJpeg(await fullPageShot(tab, scale), join(folders.shots, theme, `${name}.jpg`));
				await closePage(tab);
				counts.pages++;
			});
			console.log(`${theme}: ${tasks.length} pages`);
		}

		if (parts.has("details")) {
			// Each theme's first work on its own page (Phase 13 B2), left to right (A) and right to left (D).
			const tasks = [];
			for (const letter of ["a", "d"] as const)
				for (const scheme of SCHEMES) {
					const options = { persona: THEME_PERSONAS[theme], lang, variant: VARIANTS[letter], theme, scheme };
					const home = `${theme}-${THEME_PERSONAS[theme]}-${letter}-${scheme}.html`;
					const page = await writePersonaPage(folders.html, home, options);
					if (!page.firstWork) continue;
					const work = await writePersonaPage(folders.html, home, { ...options, work: page.firstWork });
					for (const width of WIDTHS)
						tasks.push({ file: work.file, name: `detail-${letter}-${scheme}-${width}`, width });
				}
			await pool(tasks, async ({ file, name, width }) => {
				const tab = await camera.open(device(width), file);
				await loadPictures(tab);
				await tab.clock.runFor(6000);
				noteOverflow(`${theme}/${name}`, await horizontalOverflow(tab));
				await saveJpeg(await fullPageShot(tab, scale), join(folders.shots, theme, `${name}.jpg`));
				await closePage(tab);
				counts.details++;
			});
			console.log(`${theme}: ${tasks.length} work pages`);
		}

		if (parts.has("effects")) {
			const supported = PORTFOLIO_THEME_INFO[theme].effects;
			const effects = (Object.keys(EFFECT_MIDDLE) as (keyof typeof EFFECT_MIDDLE)[]).filter((id) =>
				supported.includes(id),
			);
			const tasks: { file: string; effect: keyof typeof EFFECT_MIDDLE; frame: Frame }[] = [];
			for (const effect of effects) {
				const page = await writePersonaPage(folders.html, `${theme}-effect-${effect}.html`, {
					persona: THEME_PERSONAS[theme],
					lang,
					theme,
					scheme: PORTFOLIO_THEME_INFO[theme].defaultScheme,
					effect,
				});
				for (const frame of FRAMES)
					if (frame !== "touch" || effect === "vector-hover") tasks.push({ file: page.file, effect, frame });
			}
			await pool(tasks, async ({ file, effect, frame }) => {
				const width = frame === "touch" ? 390 : 1440;
				const tab = await camera.open(device(width, frame === "reduced" ? { reducedMotion: "reduce" } : {}), file);
				if (!(await tab.$("[data-pfx]")) && frame === "start")
					warnings.push(`${theme} ${effect}: no [data-pfx] element in the intro`);
				// The intro's own animations, stopped at their start; time then moves only as far as the frame asks.
				await freezeAnimations(tab, 0);
				const at =
					frame === "start"
						? 0
						: frame === "end"
							? EFFECT_END
							: frame === "touch"
								? EFFECT_MIDDLE["fade-up"]
								: EFFECT_MIDDLE[effect];
				if (effect === "vector-hover" && (frame === "middle" || frame === "reduced") && !(await pointAtName(tab)))
					warnings.push(`${theme} ${effect} ${frame}: no letter of the name to point at`);
				if (at) await tab.clock.runFor(at);
				await freezeAnimations(tab, at);
				const clip = await introClip(tab);
				await saveJpeg(
					await tab.screenshot(clip ? { clip } : {}),
					join(folders.effects, theme, `${effect}-${frame}.jpg`),
				);
				await closePage(tab);
				counts.effects++;
			});
			console.log(`${theme}: ${tasks.length} effect frames`);
		}
	}
}

/**
 * The part of the screen around the intro's name and the element playing the effect (with room for the vector
 * outline's size label below), at least 720 px wide; null when the page has neither.
 */
function introClip(tab: Page): Promise<{ x: number; y: number; width: number; height: number } | null> {
	return tab.evaluate(() => {
		const boxes = [...document.querySelectorAll(".pf-name, [data-pfx]")]
			.map((element) => element.getBoundingClientRect())
			.filter((box) => box.width > 0);
		if (!boxes.length) return null;
		const width = Math.min(720, window.innerWidth);
		let left = Math.max(0, Math.min(...boxes.map((box) => box.left)) - 48);
		let right = Math.min(window.innerWidth, Math.max(...boxes.map((box) => box.right)) + 48);
		if (right - left < width) {
			left = Math.max(0, Math.min(left - (width - (right - left)) / 2, window.innerWidth - width));
			right = left + width;
		}
		const top = Math.max(0, Math.min(...boxes.map((box) => box.top)) - 72);
		const bottom = Math.min(window.innerHeight, Math.max(...boxes.map((box) => box.bottom)) + 72);
		return {
			x: Math.round(left),
			y: Math.round(top),
			width: Math.round(right - left),
			height: Math.round(bottom - top),
		};
	});
}

/** Moves the mouse onto the first letter of the element playing the effect. */
async function pointAtName(tab: Page): Promise<boolean> {
	const point = await tab.evaluate(() => {
		const element = document.querySelector("[data-pfx]");
		if (!element) return null;
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const index = (node.textContent ?? "").search(/\S/);
			if (index < 0) continue;
			const range = document.createRange();
			range.setStart(node, index);
			range.setEnd(node, index + 1);
			const box = range.getBoundingClientRect();
			if (box.width > 0) return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
		}
		return null;
	});
	if (!point) return false;
	await tab.mouse.move(point.x + 80, point.y + 120);
	await tab.mouse.move(point.x, point.y, { steps: 6 });
	return true;
}

type Cell = { file: string; label: string; width: number };
type Row = { title: string; cells: Cell[] };

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const bar = (text: string, width: number, height: number, size: number, fill: string) =>
	Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/><text x="8" y="${Math.round(height * 0.68)}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#0f172a">${escapeXml(text)}</text></svg>`,
	);

/**
 * A contact sheet: each row a title bar over labelled thumbnails, every thumbnail scaled to its cell's width. A
 * thumbnail taller than `columnHeight` is cut into columns set side by side, so a long page stays one cell.
 */
async function contactSheet(rows: readonly Row[], target: string, columnHeight: number): Promise<void> {
	const gap = 16;
	const label = 24;
	const title = 34;
	const composites: OverlayOptions[] = [];
	let top = gap;
	let sheetWidth = 0;
	for (const row of rows) {
		const cells = await Promise.all(
			row.cells.map(async (cell) => {
				const thumb = await sharp(cell.file, { limitInputPixels: false })
					.resize({ width: cell.width })
					.jpeg({ quality: 82 })
					.toBuffer({ resolveWithObject: true });
				const pieces = Math.max(1, Math.ceil(thumb.info.height / columnHeight));
				const pieceHeight = Math.min(thumb.info.height, columnHeight);
				const columns = await Promise.all(
					Array.from({ length: pieces }, (_, index) => {
						const y = index * columnHeight;
						return sharp(thumb.data)
							.extract({
								left: 0,
								top: y,
								width: thumb.info.width,
								height: Math.min(columnHeight, thumb.info.height - y),
							})
							.toBuffer();
					}),
				);
				const width = Math.max(pieces * (thumb.info.width + 6) - 6, Math.round(cell.label.length * 7.4) + 16);
				return { ...cell, columns, thumbWidth: thumb.info.width, height: pieceHeight, boxWidth: width };
			}),
		);
		const rowWidth = cells.reduce((sum, cell) => sum + cell.boxWidth + gap, gap);
		const rowHeight = Math.max(0, ...cells.map((cell) => cell.height));
		composites.push({ input: bar(row.title, rowWidth - 2 * gap, title, 18, "#e2e8f0"), top, left: gap });
		let left = gap;
		for (const cell of cells) {
			composites.push({ input: bar(cell.label, cell.boxWidth, label, 13, "#f8fafc"), top: top + title + 6, left });
			cell.columns.forEach((input, index) =>
				composites.push({ input, top: top + title + 6 + label + 4, left: left + index * (cell.thumbWidth + 6) }),
			);
			left += cell.boxWidth + gap;
		}
		sheetWidth = Math.max(sheetWidth, rowWidth);
		top += title + 6 + label + 4 + rowHeight + gap * 2;
	}
	await sharp({
		create: { width: Math.max(sheetWidth, 400), height: top, channels: 3, background: "#cbd5e1" },
		limitInputPixels: false,
	})
		.composite(composites)
		.jpeg({ quality: 80 })
		.toFile(target);
	counts.sheets++;
}

/** Sheets from the shots on disk: pages and details per theme, then its effect frames. */
async function sheets() {
	await mkdir(folders.sheets, { recursive: true });
	const thumbWidth = (width: string) => (width === "390" ? 130 : 240);
	for (const theme of themes) {
		const shots = await readdir(join(folders.shots, theme)).catch(() => [] as string[]);
		const rows: Row[] = [];
		const order = [...personasFor(theme), ...PERSONA_IDS];
		const pageShots = shots
			.map((file) => /^([a-z]+)-([a-d])-(light|dark)-(\d+)\.jpg$/.exec(file))
			// Work pages (`detail-<letter>-…`) have rows of their own.
			.filter((match): match is RegExpExecArray => match !== null && match[1] !== "detail");
		const keys = [...new Set(pageShots.map(([, persona, letter]) => `${persona}-${letter}`))].sort(
			(a, b) =>
				order.indexOf(a.split("-")[0] as PersonaId) - order.indexOf(b.split("-")[0] as PersonaId) || a.localeCompare(b),
		);
		const cellsOf = (prefix: string) =>
			SCHEMES.flatMap((scheme) =>
				WIDTHS.flatMap((width) => {
					const file = `${prefix}-${scheme}-${width}.jpg`;
					return shots.includes(file)
						? [
								{
									file: join(folders.shots, theme, file),
									label: `${scheme} · ${width}`,
									width: thumbWidth(String(width)),
								},
							]
						: [];
				}),
			);
		for (const key of keys) {
			const [persona, letter] = key.split("-") as [string, VariantLetter];
			rows.push({ title: `${theme} · ${persona} · ${VARIANT_LABELS[letter]} · ${lang}`, cells: cellsOf(key) });
		}
		for (const letter of ["a", "d"] as const) {
			const details = cellsOf(`detail-${letter}`);
			if (details.length)
				rows.push({
					title: `${theme} · ${THEME_PERSONAS[theme]} · first work's page · ${VARIANT_LABELS[letter]}`,
					cells: details,
				});
		}
		if (rows.length) await contactSheet(rows, join(folders.sheets, `${theme}.jpg`), 1400);

		const frames = await readdir(join(folders.effects, theme)).catch(() => [] as string[]);
		const effectRows: Row[] = [];
		for (const effect of Object.keys(EFFECT_MIDDLE) as (keyof typeof EFFECT_MIDDLE)[]) {
			const cells = FRAMES.flatMap((frame) => {
				const file = `${effect}-${frame}.jpg`;
				if (!frames.includes(file)) return [];
				const at =
					frame === "start"
						? "0 ms"
						: frame === "end"
							? `${EFFECT_END} ms`
							: frame === "touch"
								? "touch phone"
								: `${EFFECT_MIDDLE[effect]} ms${effect === "vector-hover" ? ", pointing" : ""}`;
				return [
					{
						file: join(folders.effects, theme, file),
						label: `${frame === "reduced" ? "reduced motion" : frame} · ${at}`,
						width: frame === "touch" ? 280 : 560,
					},
				];
			});
			if (cells.length) effectRows.push({ title: `${theme} · ${THEME_PERSONAS[theme]} · ${effect}`, cells });
		}
		if (effectRows.length) await contactSheet(effectRows, join(folders.sheets, `${theme}-effects.jpg`), 2000);
	}
}

await Promise.all(Object.values(folders).map((folder) => mkdir(folder, { recursive: true })));
if (!values["only-sheets"]) {
	const camera = await Camera.start();
	try {
		await photograph(camera);
	} finally {
		await camera.close();
	}
}
await sheets();

const total = counts.pages + counts.details + counts.effects + counts.sheets;
await writeFile(
	join(out, "report.json"),
	JSON.stringify({ themes, lang, variants, scale, counts, total, overflow, warnings }, null, 2),
);
console.log(
	`Wrote ${total} pictures in ${out}: ${counts.pages} pages, ${counts.details} details, ${counts.effects} effect frames, ${counts.sheets} sheets.`,
);
if (warnings.length) console.log(`Warnings:\n${warnings.map((line) => `  ${line}`).join("\n")}`);
console.log(
	overflow.length
		? `Sideways scrolling in ${overflow.length} shots:\n${overflow
				.map((item) => `  ${item.shot}: ${item.px}px${item.culprits.length ? ` (${item.culprits.join(", ")})` : ""}`)
				.join("\n")}`
		: "No shot scrolls sideways.",
);
