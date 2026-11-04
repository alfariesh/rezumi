import type { SectionHeadingStyle } from "./section-renderers";
import type { LayoutPage, ResumeData, SectionType } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import type { IBorderOptions, IParagraphOptions } from "docx";
import {
	AlignmentType,
	BorderStyle,
	convertMillimetersToTwip,
	Document,
	ExternalHyperlink,
	HeadingLevel,
	PageBorderDisplay,
	PageBorderOffsetFrom,
	Paragraph,
	ShadingType,
	Table,
	TableCell,
	TableRow,
	TextRun,
	WidthType,
} from "docx";
import { isCoverLetterOnlyDocument } from "@rezumi/resume/export-sections";
import { entryHeaderOf } from "@rezumi/schema/resume/data";
import { assertResumeRenderBudget } from "@rezumi/schema/resume/limits";
import { templateLayouts } from "@rezumi/schema/templates";
import { isDarkColor, parseColorString } from "@rezumi/utils/color";
import { toSafeLink } from "@rezumi/utils/link";
import { isRTL } from "@rezumi/utils/locale";
import { renderBuiltInSection, renderCustomSection, renderSummary, setRenderConfig } from "./section-renderers";

// --- Color helpers ---

function rgbToHex(r: number, g: number, b: number): string {
	return [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function getColorHex(rgba: string, fallback: string): string {
	const parsed = parseColorString(rgba);
	if (!parsed) return fallback;
	return rgbToHex(parsed.r, parsed.g, parsed.b);
}

/** `hex` laid over `base` at `amount` (0–1), as one opaque colour, like the PDF's design tokens. */
function mix(hex: string, base: string, amount: number): string {
	const channel = (value: string, at: number) => Number.parseInt(value.slice(at, at + 2), 16);
	const [r, g, b] = [0, 2, 4].map((at) =>
		Math.round(channel(base, at) + (channel(hex, at) - channel(base, at)) * amount),
	) as [number, number, number];
	return rgbToHex(r, g, b);
}

/** The colours one column prints with: the PDF's `ink`, `muted`, `subtle`, `hairline`, `accent` and `accentSoft`. */
type Palette = { ink: string; muted: string; subtle: string; hairline: string; accent: string; wash: string };

const paletteOn = (ink: string, background: string, accent: string): Palette => ({
	ink,
	muted: mix(ink, background, 0.62),
	subtle: mix(ink, background, 0.38),
	hairline: mix(ink, background, 0.16),
	accent,
	wash: mix(accent, background, 0.08),
});

// --- Unit conversion helpers ---

/** Convert pt font size to docx half-points (docx uses half-pt units). */
function ptToHalfPt(pt: number): number {
	return Math.round(pt * 2);
}

/** Convert pt spacing to twips (1pt = 20 twips). */
function ptToTwips(pt: number): number {
	return Math.round(pt * 20);
}

// DOCX has fixed pages; free-form resumes intentionally fall back to A4.
const A4_PAGE_SIZE = { width: 210, height: 297 };
const LETTER_PAGE_SIZE = { width: 215.9, height: 279.4 };

// --- Invisible border preset for table cells ---

const NO_BORDERS = {
	top: { style: BorderStyle.NONE, size: 0 },
	bottom: { style: BorderStyle.NONE, size: 0 },
	left: { style: BorderStyle.NONE, size: 0 },
	right: { style: BorderStyle.NONE, size: 0 },
} as const;

/** A section title's look, after the template's PDF styles (`packages/pdf/src/templates/<id>`). */
type HeadingLook = {
	/** Font size, as a multiple of the body or the heading size. */
	size: readonly ["body" | "heading", number];
	color: "ink" | "muted" | "accent";
	/** Capitals with this letter spacing (em). */
	caps?: number;
	/** A fixed weight; missing follows the heading face's weight. */
	weight?: "regular" | "bold";
	/** A rule under the title, over the section, or a bar before the title (width in pt). */
	rule?: { edge: "top" | "bottom" | "left"; color: "accent" | "hairline"; width: number };
	/** A faint band of the accent behind the title. */
	band?: true;
};

/**
 * How a template's look carries over to Word. Placement (columns, sidebar side, header placement) comes from
 * `templateLayouts`, as in the PDF; this covers what plain paragraphs can carry: the header, the section titles and
 * the sidebar fill. Pictures, icons, chips and timelines stay in the PDF, so the DOCX reads cleanly in ATS.
 */
type DocxLook = {
	header: {
		align?: "center";
		/** Name size, as a multiple of the heading size. */
		name: number;
		/** The name in capitals with this letter spacing (em). */
		nameCaps?: number;
		/** The name in the body face (Vector). */
		nameInBody?: true;
		/** "kicker" prints the headline as small tracked accent capitals. */
		headline: "accent" | "muted" | "kicker";
		/** The headline in the heading face (Vector's monospace). */
		headlineInHeading?: true;
		/** One contact per line, as a personal details list (Wibawa, Purnama's sidebar). */
		contactColumn?: true;
		/** A hairline under the header. */
		rule?: true;
		/** The header on a band of the accent (Horizon). */
		band?: true;
	};
	heading: HeadingLook;
	/** Sidebar titles, when they differ from the main column's. */
	sidebarHeading?: HeadingLook;
	/** "solid" fills the sidebar with the accent (text inverts), "tint" with a faint wash of it. */
	sidebarFill?: "solid" | "tint";
	/** A hairline between the columns (Linen). */
	columnRule?: true;
	/** An accent rule along the top edge of every page (Summit). */
	topRule?: true;
	numberPublications?: true;
};

/** The small tracked capital label most templates title their sections with. */
const label = (color: HeadingLook["color"] = "accent", caps = 0.12): HeadingLook => ({
	size: ["body", 0.8],
	color,
	caps,
});
const hairlineUnder = { edge: "bottom", color: "hairline", width: 0.6 } as const;
const hairlineOver = { edge: "top", color: "hairline", width: 0.6 } as const;

const DOCX_LOOKS: Record<Template, DocxLook> = {
	meridian: { header: { name: 2.1, headline: "accent", rule: true }, heading: { ...label(), rule: hairlineUnder } },
	sterling: {
		header: { align: "center", name: 1.85, nameCaps: 0.14, headline: "muted" },
		heading: {
			size: ["body", 0.98],
			color: "accent",
			caps: 0.1,
			rule: { edge: "bottom", color: "accent", width: 0.75 },
		},
	},
	aksara: {
		header: { name: 2.8, headline: "kicker" },
		heading: { size: ["heading", 1.12], color: "ink", weight: "regular", rule: hairlineOver },
	},
	atlas: { header: { name: 2.05, headline: "muted" }, heading: { ...label("accent", 0.1), rule: hairlineOver } },
	tunas: {
		header: { name: 1.7, headline: "accent", rule: true },
		heading: { size: ["body", 1.02], color: "ink", rule: { edge: "left", color: "accent", width: 3 } },
	},
	summit: {
		header: { name: 2.35, headline: "kicker" },
		heading: { size: ["heading", 0.98], color: "ink", rule: { edge: "bottom", color: "accent", width: 1.5 } },
		topRule: true,
	},
	cendekia: {
		header: { name: 1.9, headline: "muted" },
		heading: { size: ["body", 0.95], color: "accent", caps: 0.08, rule: hairlineUnder },
		numberPublications: true,
	},
	wibawa: {
		header: { name: 1.85, headline: "accent", contactColumn: true },
		heading: { size: ["body", 1], color: "accent", caps: 0.06, rule: { edge: "bottom", color: "accent", width: 1 } },
	},
	tenun: {
		header: { name: 1.75, headline: "muted" },
		heading: { ...label("accent", 0.1), band: true, rule: hairlineUnder },
	},
	vector: {
		header: { name: 2.1, nameInBody: true, headline: "accent", headlineInHeading: true, rule: true },
		heading: { ...label("accent", 0.06), rule: hairlineUnder },
	},
	kirana: {
		header: { name: 2, headline: "accent" },
		heading: { size: ["heading", 1.02], color: "accent" },
		sidebarHeading: label(),
		sidebarFill: "tint",
	},
	linen: {
		header: { name: 2.4, headline: "muted" },
		heading: { size: ["heading", 1.15], color: "ink" },
		sidebarHeading: { ...label("muted", 0.14), weight: "bold" },
		columnRule: true,
	},
	horizon: { header: { name: 2.1, headline: "muted", band: true }, heading: { ...label(), rule: hairlineUnder } },
	jejak: { header: { name: 2.1, headline: "accent" }, heading: label() },
	purnama: {
		header: { name: 1.75, headline: "muted", contactColumn: true },
		heading: { size: ["heading", 1.05], color: "ink", rule: hairlineUnder },
		sidebarHeading: { ...label("muted", 0.14), weight: "bold" },
		sidebarFill: "solid",
	},
	senja: {
		header: { name: 2.6, headline: "kicker" },
		heading: { size: ["heading", 1.05], color: "ink", rule: { edge: "left", color: "accent", width: 4 } },
	},
};

type PagePlan = { kind: "single"; sections: string[] } | { kind: "split" };

/**
 * How a layout page prints, as in the PDF: a full-width page prints no sidebar, a one-column template prints its
 * sidebar sections after the main ones, and only a two-column template with sidebar sections splits the page.
 */
export function planPageColumns(page: LayoutPage, template: Template): PagePlan {
	const sidebar = page.fullWidth ? [] : page.sidebar;
	if (templateLayouts[template].columns === 1 || sidebar.length === 0) {
		return { kind: "single", sections: [...page.main, ...sidebar] };
	}
	return { kind: "split" };
}

// --- Section rendering dispatch ---

/** Resolves a section's (usually empty) stored title from its id — locale-aware, supplied by the caller. */
export type SectionTitleResolver = (sectionId: string) => string | undefined;

function renderSection(
	sectionId: string,
	data: ResumeData,
	colorHex: string,
	resolveTitle?: SectionTitleResolver,
): Paragraph[] {
	const titled = <T extends { title: string }>(section: T): T => ({
		...section,
		title: resolveTitle?.(sectionId)?.trim() || section.title,
	});

	if (sectionId === "summary") {
		return renderSummary(titled(data.summary), colorHex);
	}

	// ponytail: data.sections keys are the source of truth; no need to maintain a parallel Set
	if (sectionId in data.sections) {
		const section = data.sections[sectionId as SectionType];
		if (section) {
			return renderBuiltInSection(sectionId as SectionType, titled(section), colorHex);
		}
		return [];
	}

	const customSection = data.customSections.find((cs) => cs.id === sectionId);
	if (customSection) {
		return renderCustomSection(titled(customSection), colorHex);
	}

	return [];
}

// --- Header ---

/** Letter spacing in twips for `em` at `sizePt`. */
const tracking = (em: number, sizePt: number) => Math.round(em * sizePt * 20);

const ruleOf = (color: string, widthPt: number, space: number): IBorderOptions => ({
	style: BorderStyle.SINGLE,
	size: Math.max(2, Math.round(widthPt * 8)),
	color,
	space,
});

type Typography = { headingFont: string; bodyFont: string; headingPt: number; bodyPt: number; headingBold: boolean };

function buildHeader(data: ResumeData, look: DocxLook["header"], palette: Palette, type: Typography): Paragraph[] {
	const { basics } = data;
	const lines: IParagraphOptions[] = [];
	const alignment = look.align === "center" ? { alignment: AlignmentType.CENTER } : {};

	if (basics.name) {
		const namePt = type.headingPt * look.name;
		lines.push({
			heading: HeadingLevel.TITLE,
			spacing: { after: 60 },
			children: [
				new TextRun({
					text: basics.name,
					bold: type.headingBold,
					size: ptToHalfPt(namePt),
					font: look.nameInBody ? type.bodyFont : type.headingFont,
					color: palette.ink,
					...(look.nameCaps ? { allCaps: true, characterSpacing: tracking(look.nameCaps, namePt) } : {}),
				}),
			],
		});
	}

	if (basics.headline) {
		const kicker = look.headline === "kicker";
		const headlinePt = type.bodyPt * (kicker ? 0.84 : 1.1);
		lines.push({
			spacing: { after: 100 },
			children: [
				new TextRun({
					text: basics.headline,
					size: ptToHalfPt(headlinePt),
					font: look.headlineInHeading ? type.headingFont : type.bodyFont,
					color: look.headline === "muted" ? palette.muted : palette.accent,
					...(kicker ? { bold: true, allCaps: true, characterSpacing: tracking(0.16, headlinePt) } : {}),
				}),
			],
		});
	}

	// A contact column reads like a personal details list: values in ink, labels muted.
	const size = ptToHalfPt(type.bodyPt * 0.92);
	const valueColor = look.contactColumn ? palette.ink : palette.muted;
	const run = (text: string, color = valueColor) => new TextRun({ text, size, font: type.bodyFont, color });
	const contacts: (TextRun | ExternalHyperlink)[][] = [];
	const add = (text: string, link?: string | false | null, label?: string) =>
		contacts.push([
			...(label ? [run(`${label}: `, palette.muted)] : []),
			link ? new ExternalHyperlink({ link, children: [run(text)] }) : run(text),
		]);

	// Email and website entries with an unsafe link are dropped entirely; custom fields fall back to plain text.
	const mailtoLink = basics.email && toSafeLink(`mailto:${basics.email}`);
	if (mailtoLink) add(basics.email, mailtoLink);
	if (basics.phone) add(basics.phone);
	if (basics.location) add(basics.location);
	const websiteLink = basics.website.url && toSafeLink(basics.website.url);
	if (websiteLink) add(basics.website.label || websiteLink, websiteLink);
	for (const field of basics.customFields) {
		if (field.text) add(field.text, field.link && toSafeLink(field.link), field.label?.trim());
	}

	if (look.contactColumn) {
		for (const children of contacts) lines.push({ spacing: { after: 30 }, children });
	} else if (contacts.length > 0) {
		const separator = () => run("   ·   ", palette.subtle);
		lines.push({
			children: contacts.flatMap((children, index) => (index > 0 ? [separator(), ...children] : children)),
		});
	}

	return lines.map(
		(line, index) =>
			new Paragraph({
				...alignment,
				...line,
				...(index === lines.length - 1
					? {
							spacing: { after: look.band ? 0 : 240 },
							...(look.rule ? { border: { bottom: ruleOf(palette.hairline, 0.75, 8) } } : {}),
						}
					: {}),
			}),
	);
}

/** Horizon's header: the header lines on a band of the accent, across the text width. */
function buildHeaderBand(
	paragraphs: Paragraph[],
	fillHex: string,
	padTwips: number,
	widthTwips: number,
): (Table | Paragraph)[] {
	const pad = { top: padTwips, bottom: padTwips, left: padTwips, right: padTwips };
	return [
		new Table({
			width: { size: widthTwips, type: WidthType.DXA },
			columnWidths: [widthTwips],
			borders: { ...NO_BORDERS, insideHorizontal: NO_BORDERS.top, insideVertical: NO_BORDERS.top },
			rows: [
				new TableRow({
					children: [
						new TableCell({
							width: { size: widthTwips, type: WidthType.DXA },
							borders: NO_BORDERS,
							margins: pad,
							shading: { fill: fillHex, type: ShadingType.CLEAR, color: "auto" },
							children: paragraphs.length > 0 ? paragraphs : [new Paragraph({})],
						}),
					],
				}),
			],
		}),
		new Paragraph({ spacing: { after: 120 }, children: [] }),
	];
}

// --- Section titles ---

function headingStyleOf(
	look: HeadingLook,
	palette: Palette,
	type: Typography,
): { colorHex: string; style: SectionHeadingStyle } {
	const sizePt = (look.size[0] === "body" ? type.bodyPt : type.headingPt) * look.size[1];
	const { rule } = look;
	return {
		colorHex: palette[look.color],
		style: {
			sizeHalfPt: ptToHalfPt(sizePt),
			bold: look.weight ? look.weight === "bold" : type.headingBold,
			...(look.caps ? { allCaps: true, characterSpacing: tracking(look.caps, sizePt) } : {}),
			...(rule
				? {
						border: {
							edge: rule.edge,
							// A bar stands clear of the title; a rule over the section sits above its title.
							rule: ruleOf(palette[rule.color], rule.width, rule.edge === "left" ? 6 : rule.edge === "top" ? 10 : 2),
						},
					}
				: {}),
			...(look.band ? { shadingHex: palette.wash } : {}),
		},
	};
}

// --- Two-column table layout ---

type ColumnCell = {
	paragraphs: Paragraph[];
	widthPct: number;
	margins: { top: number; bottom: number; left: number; right: number };
	shadingHex?: string | undefined;
	/** A hairline on the cell's inner edge. */
	ruleHex?: string | undefined;
};

function buildTwoColumnTable(main: ColumnCell, sidebar: ColumnCell, sidebarSide: "left" | "right"): Table {
	const cellOf = (column: ColumnCell, inner: "left" | "right") =>
		new TableCell({
			width: { size: column.widthPct, type: WidthType.PERCENTAGE },
			borders: column.ruleHex
				? { ...NO_BORDERS, [inner]: { style: BorderStyle.SINGLE, size: 4, color: column.ruleHex } }
				: NO_BORDERS,
			margins: column.margins,
			// DOCX table cells require at least one child
			children: column.paragraphs.length > 0 ? column.paragraphs : [new Paragraph({})],
			...(column.shadingHex ? { shading: { fill: column.shadingHex, type: ShadingType.CLEAR, color: "auto" } } : {}),
		});

	const cells =
		sidebarSide === "left"
			? [cellOf(sidebar, "right"), cellOf(main, "left")]
			: [cellOf(main, "right"), cellOf(sidebar, "left")];

	return new Table({
		rows: [new TableRow({ children: cells })],
		width: { size: 100, type: WidthType.PERCENTAGE },
		borders: {
			...NO_BORDERS,
			insideHorizontal: { style: BorderStyle.NONE, size: 0 },
			insideVertical: { style: BorderStyle.NONE, size: 0 },
		},
	});
}

/**
 * Builds a complete docx Document from resume data.
 *
 * Mirrors the resume builder's visual layout:
 * - Header with name, headline, and contact info, placed and styled as the template places it
 * - Two-column table layout (main + sidebar) matching `metadata.layout`
 * - Typography (font family, size, line height) from `metadata.typography`
 * - Section titles, sidebar fill and rules after the template (`DOCX_LOOKS`)
 * - Page margins and fixed DOCX page format from `metadata.page`; free-form exports as A4
 * - Primary, text, and background colors from `metadata.design.colors`
 */
export function buildDocument(data: ResumeData, resolveTitle?: SectionTitleResolver): Document {
	assertResumeRenderBudget(data);
	const colorHex = getColorHex(data.metadata.design.colors.primary, "DC2626");
	const textColorHex = getColorHex(data.metadata.design.colors.text, "000000");
	const bgColorHex = getColorHex(data.metadata.design.colors.background, "FFFFFF");

	const { typography } = data.metadata;
	const bodyFont = typography.body.fontFamily || "Calibri";
	const bodySize = ptToHalfPt(typography.body.fontSize);
	const lineSpacing = Math.round(typography.body.lineHeight * 240);
	const headingFont = typography.heading.fontFamily || "Calibri";
	const type: Typography = {
		headingFont,
		bodyFont,
		headingPt: typography.heading.fontSize,
		bodyPt: typography.body.fontSize,
		headingBold: Number(typography.heading.fontWeights.at(-1) ?? "700") >= 600,
	};

	const { page } = data.metadata;
	const pageSize = page.format === "letter" ? LETTER_PAGE_SIZE : A4_PAGE_SIZE;
	// Margins and gaps are defined in points (pt), not mm
	const marginXTwips = ptToTwips(page.marginX);
	const marginYTwips = ptToTwips(page.marginY);
	const textWidthTwips = convertMillimetersToTwip(pageSize.width) - 2 * marginXTwips;

	const { template } = data.metadata;
	const layout = templateLayouts[template];
	const look = DOCX_LOOKS[template];

	// Colours: the page's own, and the sidebar's, which inverts on a solid fill.
	const mainPalette = paletteOn(textColorHex, bgColorHex, colorHex);
	const onAccentHex = isDarkColor(`#${colorHex}`) ? "FFFFFF" : textColorHex;
	const accentPalette = paletteOn(onAccentHex, colorHex, onAccentHex);
	const sidebarShadingHex =
		look.sidebarFill === "solid" ? colorHex : look.sidebarFill === "tint" ? mainPalette.wash : undefined;
	const sidebarPalette = look.sidebarFill === "solid" ? accentPalette : mainPalette;

	const mainHeading = headingStyleOf(look.heading, mainPalette, type);
	const sidebarHeading = headingStyleOf(look.sidebarHeading ?? look.heading, sidebarPalette, type);

	const columnConfig = (palette: Palette, heading: SectionHeadingStyle, rightTabTwips: number) => ({
		headingFont,
		headingSizeHalfPt: ptToHalfPt(type.headingPt),
		bodyFont,
		bodySizeHalfPt: bodySize,
		textColorHex: palette.ink,
		primaryColorHex: palette.accent,
		mutedColorHex: palette.muted,
		sectionHeading: heading,
		rightTabTwips,
		...(look.numberPublications ? { numberPublications: true } : {}),
		// Only the row order carries over: entry header layouts and accents don't apply to DOCX (plain, ATS-first).
		lead: entryHeaderOf(data.metadata.design).lead,
	});
	const pageConfig = columnConfig(mainPalette, mainHeading.style, textWidthTwips);

	// The sidebar's width and, as in the PDF, a gutter that scales with the type (narrower beside a filled sidebar,
	// whose text gets padding of its own).
	const sidebarPct = data.metadata.layout.sidebarWidth;
	const halfGap = ptToTwips((type.bodyPt * (sidebarShadingHex ? 1.6 : 2.2)) / 2);
	const pad = ptToTwips(type.bodyPt * 1.2);
	const sidebarSide = data.metadata.layout.sidebarSide ?? layout.sidebarSide ?? "left";
	const insetOn = (side: "left" | "right", twips: number) => ({
		top: 0,
		bottom: 0,
		left: side === "left" ? twips : 0,
		right: side === "right" ? twips : 0,
	});
	// Each column keeps half the gutter on the side facing the other one.
	const mainCellMargins = insetOn(sidebarSide, halfGap);
	const sidebarMargins = sidebarShadingHex
		? { top: pad, bottom: pad, left: pad, right: pad }
		: insetOn(sidebarSide === "left" ? "right" : "left", halfGap);
	const columnTextWidth = (pct: number, margins: { left: number; right: number }) =>
		Math.round((textWidthTwips * pct) / 100) - margins.left - margins.right;
	const mainConfig = columnConfig(mainPalette, mainHeading.style, columnTextWidth(100 - sidebarPct, mainCellMargins));
	const sidebarConfig = columnConfig(sidebarPalette, sidebarHeading.style, columnTextWidth(sidebarPct, sidebarMargins));

	// The header prints once, on the first page, where the template places it.
	let showHeader = !isCoverLetterOnlyDocument(data);
	const header = (palette: Palette) => buildHeader(data, look.header, palette, type);

	const documentChildren: (Paragraph | Table)[] = [];

	if (layout.headerPlacement === "full-width" && showHeader) {
		showHeader = false;
		setRenderConfig(pageConfig);
		if (look.header.band) {
			documentChildren.push(
				...buildHeaderBand(header(accentPalette), colorHex, ptToTwips(type.bodyPt * 1.6), textWidthTwips),
			);
		} else {
			documentChildren.push(...header(mainPalette));
		}
	}

	// Process each page in the layout
	for (const layoutPage of data.metadata.layout.pages) {
		const plan = planPageColumns(layoutPage, template);

		if (plan.kind === "single") {
			setRenderConfig(pageConfig);
			if (showHeader) {
				showHeader = false;
				documentChildren.push(...header(mainPalette));
			}
			for (const sectionId of plan.sections) {
				documentChildren.push(...renderSection(sectionId, data, mainHeading.colorHex, resolveTitle));
			}
			continue;
		}

		setRenderConfig(mainConfig);
		const mainParagraphs: Paragraph[] = [];
		if (layout.headerPlacement === "main-only" && showHeader) {
			showHeader = false;
			mainParagraphs.push(...header(mainPalette));
		}
		for (const sectionId of layoutPage.main) {
			mainParagraphs.push(...renderSection(sectionId, data, mainHeading.colorHex, resolveTitle));
		}

		setRenderConfig(sidebarConfig);
		const sidebarParagraphs: Paragraph[] = [];
		if (layout.headerPlacement === "sidebar-only" && showHeader) {
			showHeader = false;
			sidebarParagraphs.push(...header(sidebarPalette));
		}
		for (const sectionId of layoutPage.sidebar) {
			sidebarParagraphs.push(...renderSection(sectionId, data, sidebarHeading.colorHex, resolveTitle));
		}

		if (mainParagraphs.length > 0 || sidebarParagraphs.length > 0) {
			documentChildren.push(
				buildTwoColumnTable(
					{ paragraphs: mainParagraphs, widthPct: 100 - sidebarPct, margins: mainCellMargins },
					{
						paragraphs: sidebarParagraphs,
						widthPct: sidebarPct,
						margins: sidebarMargins,
						shadingHex: sidebarShadingHex,
						ruleHex: look.columnRule ? mainPalette.hairline : undefined,
					},
					sidebarSide,
				),
			);
		}
	}

	return new Document({
		styles: {
			default: {
				document: {
					run: {
						font: bodyFont,
						size: bodySize,
						color: textColorHex,
					},
					paragraph: {
						spacing: { line: lineSpacing },
						...(isRTL(page.locale) ? { bidirectional: true } : {}),
					},
				},
			},
		},
		...(bgColorHex !== "FFFFFF" ? { background: { color: bgColorHex } } : {}),
		sections: [
			{
				properties: {
					page: {
						size: {
							width: convertMillimetersToTwip(pageSize.width),
							height: convertMillimetersToTwip(pageSize.height),
						},
						margin: {
							top: marginYTwips,
							bottom: marginYTwips,
							left: marginXTwips,
							right: marginXTwips,
						},
						...(look.topRule
							? {
									borders: {
										pageBorders: {
											display: PageBorderDisplay.ALL_PAGES,
											offsetFrom: PageBorderOffsetFrom.PAGE,
										},
										pageBorderTop: ruleOf(colorHex, 3, 0),
									},
								}
							: {}),
					},
				},
				children: documentChildren,
			},
		],
	});
}
