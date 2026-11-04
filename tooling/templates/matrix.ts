/**
 * The visual QA matrix: every template in five stress variants, as PDFs and contact sheets to check by eye.
 *
 *   pnpm --filter @rezumi/tooling templates:matrix [templates…] [--out <dir>] [--variant a,b] [--dpi 100] [--no-sheets]
 *
 * A: photo, A4, every icon and tool logo on, skill chips, a dark accent. B: no photo, Letter, every icon off, a light
 * accent. C: two to three pages, a very long name, photo, A4. D: right to left (`ar-SA`, Arabic name and summary), long,
 * Letter, every icon on. E: long, every icon and tool logo on, chips, A4. The resumes start from the gallery personas
 * (`personas/`) with their preset look.
 *
 * Writes `<out>/pdf/<variant>/<id>.pdf`, the resume it drew as `<out>/json/<variant>/<id>.json`, the pages as
 * `<out>/png/<variant>/<id>-<page>.png` and the sheets as `<out>/sheets/<id>-<variants>.png`, and prints each PDF's
 * page count and SHA-256, so two runs compare file by file (renders are deterministic). Needs `pdftoppm` (poppler).
 */
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import type { OverlayOptions } from "sharp";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { createResumePdfFile } from "@rezumi/pdf/server";
import { applyTemplatePreset } from "@rezumi/resume/template-preset";
import { templateSchema } from "@rezumi/schema/templates";
import { personas } from "./personas";
import { buildPersonaResume } from "./personas/persona";

type Variant = {
	id: string;
	label: string;
	photo: boolean;
	format: "a4" | "letter";
	locale?: "ar-SA";
	/** How many times Experience repeats (other long sections twice), for two to three pages. */
	long?: number;
	longName?: boolean;
	accent?: string;
	icons?: "on" | "off";
	chips?: boolean;
};

const variants: readonly Variant[] = [
	{
		id: "a",
		label: "A · photo · A4 · every icon + tool logos on · chips · dark accent",
		photo: true,
		format: "a4",
		icons: "on",
		chips: true,
		accent: "rgba(17, 24, 39, 1)",
	},
	{
		id: "b",
		label: "B · no photo · Letter · every icon off · light accent",
		photo: false,
		format: "letter",
		icons: "off",
		accent: "rgba(250, 204, 21, 1)",
	},
	{
		id: "c",
		label: "C · long (2–3 pages) · very long name · photo · A4",
		photo: true,
		format: "a4",
		long: 4,
		longName: true,
	},
	{
		id: "d",
		label: "D · RTL ar-SA · long · Letter · every icon on",
		photo: true,
		format: "letter",
		locale: "ar-SA",
		long: 3,
		icons: "on",
	},
	{
		id: "e",
		label: "E · long · every icon + tool logos on · chips · A4",
		photo: false,
		format: "a4",
		long: 3,
		icons: "on",
		chips: true,
	},
];

const pairs = [["a", "b"], ["c", "d"], ["e"]] as const;

const repo = resolve(import.meta.dirname, "../..");
const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		out: { type: "string", default: join(tmpdir(), "rezumi-matrix") },
		variant: { type: "string" },
		dpi: { type: "string", default: "100" },
		"no-sheets": { type: "boolean", default: false },
	},
});

const templates = positionals.length > 0 ? positionals.map((id) => templateSchema.parse(id)) : templateSchema.options;
const chosen = values.variant ? new Set(values.variant.split(",")) : undefined;
const selected = variants.filter((variant) => !chosen || chosen.has(variant.id));
const iconStyles = ["standard", "rounded", "sharp"] as const;
const samplePhoto = `data:image/jpeg;base64,${(await readFile(join(repo, "apps/web/public/photos/sample-picture.jpg"))).toString("base64")}`;

const LONG_NAME = "Kanjeng Raden Ayu Maharani Kusumawardhani Prameswari Hadiningrat";
const ARABIC = {
	name: "عبد الرحمن بن خالد العتيبي",
	headline: "مهندس برمجيات أول",
	summary:
		"<p>مهندس برمجيات بخبرة تزيد على عشر سنوات في بناء منصات الويب وقيادة الفرق الصغيرة، مع تركيز على الأداء وسهولة الاستخدام.</p>",
};

/** Repeats a section's items `times` over, with ids that stay unique. */
function repeat<K extends keyof ResumeData["sections"]>(data: ResumeData, key: K, times: number) {
	const section = data.sections[key];
	const items = section.items as { id: string }[];
	if (items.length === 0) return;
	const copies = Array.from({ length: times }, (_, round) =>
		items.map((item) => ({ ...structuredClone(item), id: round === 0 ? item.id : `${item.id}-r${round}` })),
	);
	Object.assign(section, { items: copies.flat() });
}

function lengthen(data: ResumeData, times: number) {
	repeat(data, "experience", times);
	repeat(data, "projects", 2);
	repeat(data, "education", 2);
	repeat(data, "skills", 2);
	repeat(data, "interests", 2);
	repeat(data, "awards", 2);
	repeat(data, "certifications", 2);
	repeat(data, "volunteer", 2);
	data.summary.content = `${data.summary.content}${data.summary.content}`;
}

function variantResume(template: Template, variant: Variant, index: number): ResumeData {
	const persona = personas[template];
	const data = buildPersonaResume(persona, template, "en", "");
	applyTemplatePreset(data, template);
	persona.finish?.(data);

	data.picture.url = variant.photo ? samplePhoto : "";
	data.picture.hidden = !variant.photo;
	data.metadata.page.format = variant.format;
	if (variant.locale) data.metadata.page.locale = variant.locale;
	if (variant.accent) data.metadata.design.colors.primary = variant.accent;
	if (variant.chips) data.sections.skills.keywordLayout = "tags";
	if (variant.icons) {
		const on = variant.icons === "on";
		const style = iconStyles[index % iconStyles.length] ?? "standard";
		data.metadata.design.icons = { enabled: on, style, contact: on, sections: on, items: on, logos: on };
	}
	if (variant.long) lengthen(data, variant.long);
	if (variant.longName) data.basics.name = LONG_NAME;
	if (variant.locale === "ar-SA") {
		data.basics.name = ARABIC.name;
		data.basics.headline = ARABIC.headline;
		data.summary.content = ARABIC.summary;
	}
	return data;
}

async function photoFor(template: Template) {
	if (!personas[template].photo) return undefined;
	return `data:image/jpeg;base64,${(await readFile(join(import.meta.dirname, "photos", `${template}.jpg`))).toString("base64")}`;
}

const label = (text: string, width: number) =>
	Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40"><rect width="100%" height="100%" fill="#f1f5f9"/><text x="12" y="27" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="#0f172a">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></svg>`,
	);

/** Lays each variant's pages side by side under its label, wrapping to a new row past four pages. */
async function sheet(template: Template, groups: readonly Variant[], target: string) {
	const thumbWidth = 420;
	const gap = 16;
	const maxColumns = 4;
	const loaded = await Promise.all(
		groups.map(async (variant) => {
			const folder = join(values.out, "png", variant.id);
			const files = (await readdir(folder))
				.filter((file) => file.startsWith(`${template}-`) && file.endsWith(".png"))
				.sort();
			const pages = await Promise.all(
				files.map((file) =>
					sharp(join(folder, file)).resize({ width: thumbWidth }).png().toBuffer({ resolveWithObject: true }),
				),
			);
			return { variant, pages };
		}),
	);
	type Block = (typeof loaded)[number] & { left: number; top: number };
	const blocks: Block[] = [];
	const rowHeights: number[] = [];
	let column = 0;
	let row = 0;
	for (const group of loaded) {
		const span = Math.max(1, group.pages.length);
		if (column > 0 && column + span > maxColumns) {
			row += 1;
			column = 0;
		}
		const pageHeight = Math.max(0, ...group.pages.map((page) => page.info.height));
		rowHeights[row] = Math.max(rowHeights[row] ?? 0, 40 + gap + pageHeight);
		blocks.push({ ...group, left: gap + column * (thumbWidth + gap), top: row });
		column += span;
	}
	const width =
		Math.max(...blocks.map((block) => block.left + Math.max(1, block.pages.length) * (thumbWidth + gap)), 0) + gap;
	const rowTops = rowHeights.map((_, index) =>
		rowHeights.slice(0, index).reduce((sum, height) => sum + height + gap, 0),
	);
	const height = rowHeights.reduce((sum, rowHeight) => sum + rowHeight + gap, 0);
	const composites: OverlayOptions[] = [];
	for (const block of blocks) {
		const top = rowTops[block.top] ?? 0;
		const blockWidth = Math.max(1, block.pages.length) * (thumbWidth + gap) - gap;
		composites.push({ input: label(`${template} · ${block.variant.label}`, blockWidth), top, left: block.left });
		block.pages.forEach((page, index) => {
			composites.push({ input: page.data, top: top + 40 + gap, left: block.left + index * (thumbWidth + gap) });
		});
	}
	await sharp({ create: { width, height, channels: 3, background: "#cbd5e1" } })
		.composite(composites)
		.png()
		.toFile(target);
}

for (const template of templates) {
	// The icon style rotates by the template's place in the lineup, so a run of one template draws what the full run does.
	const index = templateSchema.options.indexOf(template);
	const personaPhoto = await photoFor(template);
	for (const variant of selected) {
		const data = variantResume(template, variant, index);
		if (variant.photo && personaPhoto) data.picture.url = personaPhoto;
		const pdfFolder = join(values.out, "pdf", variant.id);
		const pngFolder = join(values.out, "png", variant.id);
		await mkdir(pdfFolder, { recursive: true });
		await mkdir(pngFolder, { recursive: true });
		const file = await createResumePdfFile({ data, filename: `${template}.pdf` });
		const pdf = Buffer.from(await file.arrayBuffer());
		const target = join(pdfFolder, `${template}.pdf`);
		await writeFile(target, pdf);
		await mkdir(join(values.out, "json", variant.id), { recursive: true });
		await writeFile(join(values.out, "json", variant.id, `${template}.json`), JSON.stringify(data));
		for (const old of (await readdir(pngFolder)).filter((name) => name.startsWith(`${template}-`)))
			await rm(join(pngFolder, old));
		execFileSync("pdftoppm", ["-png", "-r", values.dpi, target, join(pngFolder, template)]);
		const pages = (await readdir(pngFolder)).filter((name) => name.startsWith(`${template}-`)).length;
		const hash = createHash("sha256").update(pdf).digest("hex").slice(0, 16);
		console.log(`${variant.id} ${template.padEnd(9)} ${pages}p ${hash}`);
	}
	if (values["no-sheets"]) continue;
	await mkdir(join(values.out, "sheets"), { recursive: true });
	for (const pair of pairs) {
		const rows = selected.filter((variant) => (pair as readonly string[]).includes(variant.id));
		if (rows.length === 0) continue;
		await sheet(template, rows, join(values.out, "sheets", `${template}-${pair.join("")}.png`));
	}
}

console.log(`Sheets in ${join(values.out, "sheets")}`);
