import type { PdfDocumentLike } from "@rezumi/resume/ats-pdf";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createElement } from "react";
import { analyzePdfResume, harvestPdfDocument, PDF_OPS } from "@rezumi/resume/ats-pdf";
import { sampleResumeData } from "@rezumi/schema/resume/sample";
import { templateLayouts, templateLineup, templatePresets } from "@rezumi/schema/templates";
import { ResumeDocument } from "./document";
import { renderToBuffer } from "./forme/testing";
import { getResumeSectionTitle } from "./section-title";

const NOW = new Date("2024-06-15T00:00:00Z");

const fixture = (name: string) =>
	new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/ats/${name}`, import.meta.url))));

async function renderResume(data: ResumeData, template: Template = "meridian"): Promise<Uint8Array> {
	const element = createElement(ResumeDocument, { data, template }) as unknown as Parameters<typeof renderToBuffer>[0];
	return new Uint8Array(await renderToBuffer(element));
}

/** Runs the real browser pipeline in Node: pdf.js -> harvest -> analyze. */
async function analyze(bytes: Uint8Array, options: { name?: string } = {}) {
	// PDF.js transfers the buffer it is handed, detaching it — so each run gets its own copy and a
	// caller can analyse the same file twice.
	const loadingTask = getDocument({ data: new Uint8Array(bytes), fontExtraProperties: true });

	try {
		const document = (await loadingTask.promise) as unknown as PdfDocumentLike;
		const raw = await harvestPdfDocument(document, {
			file: { name: options.name ?? "resume.pdf", sizeBytes: bytes.byteLength, magicBytesOk: true },
		});

		return {
			raw,
			report: analyzePdfResume(raw, { now: NOW }),
		};
	} finally {
		await loadingTask.destroy();
	}
}

const failedCodes = (report: Awaited<ReturnType<typeof analyze>>["report"]) =>
	report.checks.filter((check) => check.status === "fail").map((check) => check.code);

describe("PDF operator numbers", () => {
	/**
	 * The engine hardcodes these so the universal package needs no pdf.js dependency. If a release
	 * ever renumbers an operator, this fails here rather than silently mis-reading every file.
	 */
	it("match the installed PDF.js build", () => {
		const actual = OPS as unknown as Record<string, number>;

		for (const [name, value] of Object.entries(PDF_OPS)) {
			expect(actual[name], name).toBe(value);
		}
	});
});

describe("a resume rendered by this app", () => {
	/**
	 * The regression guard for this whole feature: the app's own exports have to come out clean. Anything the checker
	 * reports here, it reports to every user of this app, so a false positive shows up as a failing assertion rather
	 * than as lost trust.
	 *
	 * Single-column templates report nothing. Two-column templates are the "visual" ones and say so in the gallery: the
	 * checker reads their columns line by line across the gutter, so what each reports below is about that geometry
	 * (a gutter with interleaved lines, lines from both columns looking tightly spaced), not about lost text. Kirana's
	 * gutter is narrow enough that a sidebar line and the "Education" title share a line, so the section goes unseen.
	 */
	const expected: Record<Template, { findings: string[]; score: number }> = {
		meridian: { findings: [], score: 100 },
		sterling: { findings: [], score: 100 },
		aksara: { findings: [], score: 100 },
		atlas: { findings: [], score: 100 },
		tunas: { findings: [], score: 100 },
		summit: { findings: [], score: 100 },
		cendekia: { findings: [], score: 100 },
		wibawa: { findings: [], score: 100 },
		tenun: { findings: [], score: 100 },
		vector: { findings: [], score: 100 },
		kirana: { findings: ["MULTI_COLUMN_LAYOUT", "NO_EDUCATION_SECTION"], score: 55 },
		linen: { findings: ["READING_ORDER_RISK", "TIGHT_LINE_SPACING"], score: 96 },
		horizon: { findings: [], score: 100 },
		jejak: { findings: ["READING_ORDER_RISK", "TIGHT_LINE_SPACING"], score: 96 },
		purnama: { findings: ["COLUMN_GUTTER"], score: 97 },
		senja: { findings: ["READING_ORDER_RISK"], score: 97 },
	};

	it.each(templateLineup)("reports only what is known for %s", { timeout: 60_000 }, async (template) => {
		const { raw, report } = await analyzed(template, "sample");

		expect(raw.pages.length).toBeGreaterThan(0);
		expect(raw.operatorsAvailable).toBe(true);
		expect(report.findings.map((finding) => finding.code)).toEqual(expected[template].findings);
		expect(report.score).toBe(expected[template].score);
	});

	it("lists only one-column templates as clean", () => {
		for (const template of templateLineup) {
			if (templateLayouts[template].columns === 1) expect(expected[template].findings, template).toEqual([]);
		}
	});
});

/**
 * The text layer in content order, which is what a parser that does not rebuild the page's geometry reads (and what
 * copy and paste gives): every line as pdf.js emits it, pages one after another.
 */
const contentText = (raw: Awaited<ReturnType<typeof analyze>>["raw"]) =>
	raw.pages.map((page) => page.items.map((item) => item.str + (item.hasEol ? "\n" : "")).join("")).join("\n");

const escapeRegExp = (text: string) => text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where the first line at or after `from` that starts with `title` begins, or -1. A label gutter may put the first entry
 * on the title's line, and a wrapped skill ("Programming / Languages") can start a line with a title's word, which is
 * why titles are looked for one after another rather than anywhere.
 */
const headingOffset = (text: string, title: string, from = 0) => {
	const pattern = new RegExp(`(?:^|\\n)${escapeRegExp(title)}(?=\\s|$)`, "giu");
	pattern.lastIndex = Math.max(0, from - 1);
	return pattern.exec(text)?.index ?? -1;
};

type Variant = "sample" | "preset" | "icons-off" | "icons-on";

const iconStyles = ["standard", "rounded", "sharp"] as const;

/**
 * The sample resume, as each variant prints it. "preset" is the look the gallery and a new resume use (the template's
 * fonts and accent), "icons-on" turns on every icon and the tool logos, in one of the three styles per template.
 */
function variantData(template: Template, variant: Variant): ResumeData {
	const data = structuredClone(sampleResumeData);
	const { design, typography } = data.metadata;

	if (variant === "preset") {
		const preset = templatePresets[template];
		typography.heading = { ...typography.heading, ...preset.heading, fontWeights: [preset.heading.fontWeight] };
		typography.body = { ...typography.body, ...preset.body };
		design.colors.primary = preset.primary;
		if (preset.entry) design.entry = { lead: "organization", accent: "none", ...design.entry, ...preset.entry };
		if (preset.keywordLayout) data.sections.skills.keywordLayout = preset.keywordLayout;
	}

	if (variant === "icons-off" || variant === "icons-on") {
		const on = variant === "icons-on";
		const style = iconStyles[templateLineup.indexOf(template) % iconStyles.length] ?? "standard";
		design.icons = { enabled: on, style, contact: on, sections: on, items: on, logos: on };
	}

	return data;
}

const analyses = new Map<string, ReturnType<typeof analyze>>();

/** Each template and variant is rendered and read once, however many tests look at it. */
function analyzed(template: Template, variant: Variant) {
	const key = `${template}:${variant}`;
	let analysis = analyses.get(key);
	if (!analysis) {
		analysis = renderResume(variantData(template, variant), template).then((bytes) => analyze(bytes));
		analyses.set(key, analysis);
	}
	return analysis;
}

describe("the text of every template", () => {
	const { pages } = sampleResumeData.metadata.layout;
	const titles = (ids: readonly string[]) => ids.map((id) => getResumeSectionTitle(sampleResumeData, id));
	const mainTitles = titles(pages.flatMap((page) => page.main));
	const sidebarTitles = titles(pages.flatMap((page) => page.sidebar));
	// A single column prints each layout page's main sections, then its sidebar ones.
	const oneColumnTitles = titles(pages.flatMap((page) => [...page.main, ...page.sidebar]));
	const { email, phone } = sampleResumeData.basics;

	/** Finds each title as a line after the one before it, and returns where each starts. */
	const expectInOrder = (text: string, sequence: readonly string[]) => {
		const offsets = new Map<string, number>();
		let from = 0;
		for (const title of sequence) {
			const offset = headingOffset(text, title, from);
			const after = [...offsets.keys()].join(", ") || "the start";
			expect(offset, `"${title}" as a line, after ${after}`).toBeGreaterThan(-1);
			offsets.set(title, offset);
			from = offset + 1;
		}
		return offsets;
	};

	describe.each(["sample", "preset"] as const)("in the %s look", (variant) => {
		it.each(templateLineup)("reads %s in order", { timeout: 60_000 }, async (template) => {
			const text = contentText((await analyzed(template, variant)).raw);
			// The name may wrap (Purnama sets it in the narrow sidebar) or print in capitals (Sterling), so the header is
			// looked for with lines joined and case ignored.
			const flat = text.replaceAll("\n", " ").toLowerCase();
			const oneColumn = templateLayouts[template].columns === 1;

			// Letters spaced so far apart that a parser reads each as a word ("E D U C A T I O N").
			expect(text).not.toMatch(/(?:^|\s)(?:\p{Lu} ){3,}\p{Lu}(?:\s|$)/u);
			expect(text).not.toMatch(/[\uE000-\uF8FF\uFFFD]/u);

			const headings = oneColumn
				? expectInOrder(text, oneColumnTitles)
				: new Map([...expectInOrder(text, mainTitles), ...expectInOrder(text, sidebarTitles)]);

			const [name, mail, telephone] = [sampleResumeData.basics.name, email, phone].map((value) =>
				flat.indexOf(value.toLowerCase()),
			);
			expect(name).toBeGreaterThan(-1);
			expect(name).toBeLessThan(mail ?? -1);
			expect(mail).toBeLessThan(telephone ?? -1);
			expect(telephone).toBeLessThan(headings.get(mainTitles[0] ?? "") ?? -1);
			// Forme draws a row's children in tree order, so a sidebar at the start of the line still reads after the name.
			expect(name).toBeLessThan(Math.min(...headings.values()));

			// Each entry's dates sit inside its own section, before whatever title comes next in the text.
			for (const [title, dates] of [
				["Education", "2014 - 2018"],
				["Experience", "March 2022 - Present"],
			] as const) {
				const start = headings.get(title) ?? -1;
				const next = Math.min(...[...headings.values()].filter((offset) => offset > start), flat.length);
				const at = flat.indexOf(dates.toLowerCase(), start);
				expect(at, `${dates} under ${title}`).toBeGreaterThan(start);
				expect(at, `${dates} under ${title}`).toBeLessThan(next);
			}
		});
	});

	/**
	 * Icons and logos are drawings, never glyphs: turning every one of them on must not add a single character to the
	 * text layer. Characters are compared as a multiset, since icons can move a line break or a page break.
	 */
	it.each(templateLineup)("adds no text for icons or logos in %s", { timeout: 60_000 }, async (template) => {
		const characters = async (variant: Variant) =>
			[...contentText((await analyzed(template, variant)).raw).replaceAll(/\s/g, "")].toSorted().join("");

		expect(await characters("icons-on")).toBe(await characters("icons-off"));
	});
});

describe("adversarial files", () => {
	it("calls a scan what it is", { timeout: 30_000 }, async () => {
		const { report } = await analyze(fixture("image-only-scan.pdf"), { name: "scan.pdf" });
		const codes = failedCodes(report);

		expect(codes).toContain("NO_TEXT_LAYER");
		expect(codes).toContain("IMAGE_ONLY_DOCUMENT");
		expect(report.score).toBeLessThanOrEqual(10);
	});

	it("reads a Type 3 font off the font object", { timeout: 30_000 }, async () => {
		const { raw, report } = await analyze(fixture("type3-font.pdf"), { name: "type3.pdf" });

		expect(raw.fonts.some((font) => font.isType3)).toBe(true);
		expect(failedCodes(report)).toContain("TYPE3_FONT");
		expect(report.score).toBeLessThanOrEqual(25);
	});

	it("sees nothing in text that was converted to outlines", { timeout: 30_000 }, async () => {
		const { raw, report } = await analyze(fixture("outlined-text.pdf"), { name: "outlined.pdf" });

		expect(raw.pages[0]?.items).toHaveLength(0);
		// The page is dense with drawing operations and empty of words — exactly the trap.
		expect(raw.pages[0]?.operators?.pathOpCount ?? 0).toBeGreaterThan(0);
		expect(failedCodes(report)).toContain("NO_TEXT_LAYER");
	});
});
