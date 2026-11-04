import type { HtmlStyleConfig } from "./html-to-docx";
import type {
	CustomSection,
	CustomSectionType,
	EntryHeader,
	ResumeData,
	SectionType,
} from "@rezumi/schema/resume/data";
import type { IBorderOptions, IParagraphOptions } from "docx";
import {
	BorderStyle,
	ExternalHyperlink,
	HeadingLevel,
	Paragraph,
	ShadingType,
	TabStopPosition,
	TabStopType,
	TextRun,
} from "docx";
import { toSafeLink } from "@rezumi/utils/link";
import { htmlToParagraphs } from "./html-to-docx";

type Sections = ResumeData["sections"];

/** A section title's look beyond its colour, after the template (see `DOCX_LOOKS` in the builder). */
export type SectionHeadingStyle = {
	sizeHalfPt: number;
	bold: boolean;
	/** Capitals drawn by Word: the text stays as typed, so ATS still reads the words. */
	allCaps?: boolean;
	/** Letter spacing in twips. */
	characterSpacing?: number;
	/** A rule under the title, over it, or a bar before it. */
	border?: { edge: "top" | "bottom" | "left"; rule: IBorderOptions };
	/** A faint band behind the title. */
	shadingHex?: string;
};

type RenderConfig = {
	headingFont: string;
	headingSizeHalfPt: number;
	bodyFont: string;
	bodySizeHalfPt: number;
	textColorHex: string;
	primaryColorHex: string;
	/** Dates, locations and issuers. Missing means the text colour. */
	mutedColorHex?: string;
	/** Missing means the plain look: heading size × 0.75 with a rule under it. */
	sectionHeading?: SectionHeadingStyle;
	/** Where dates align: the column's right edge, in twips from its start. */
	rightTabTwips?: number;
	/** Publications numbered in order (Cendekia). */
	numberPublications?: boolean;
	/** Entries → Row order. Missing means organization first. */
	lead?: EntryHeader["lead"];
};

/** Module-level typography/color/row-order config, set by the builder before rendering. */
let config: RenderConfig = {
	headingFont: "Calibri",
	headingSizeHalfPt: 28,
	bodyFont: "Calibri",
	bodySizeHalfPt: 20,
	textColorHex: "000000",
	primaryColorHex: "0563C1",
};

/** Configures the typography and colors used by all section renderers. */
export function setRenderConfig(next: RenderConfig): void {
	config = next;
}

const getHtmlStyle = (): HtmlStyleConfig => ({
	font: config.bodyFont,
	size: config.bodySizeHalfPt,
	color: config.textColorHex,
	linkColor: config.primaryColorHex,
});

/** Base TextRun properties (font, size, color) shared across all section renderers. */
const getBaseRun = () => ({ font: config.bodyFont, size: config.bodySizeHalfPt, color: config.textColorHex });

type BaseRun = ReturnType<typeof getBaseRun>;

const mutedColor = () => config.mutedColorHex ?? config.textColorHex;

/** A section heading paragraph in `colorHex`, using the heading typography and the template's title look. */
function sectionHeading(title: string, colorHex: string): Paragraph {
	const color = colorHex.replace("#", "");
	const look = config.sectionHeading ?? {
		sizeHalfPt: Math.round(config.headingSizeHalfPt * 0.75),
		bold: true,
		border: { edge: "bottom", rule: { style: BorderStyle.SINGLE, size: 1, color } },
	};
	const border: IParagraphOptions["border"] = look.border ? { [look.border.edge]: look.border.rule } : undefined;

	return new Paragraph({
		heading: HeadingLevel.HEADING_6,
		// A rule over the title sits higher, so the section keeps its distance from the one above.
		spacing: { before: look.border?.edge === "top" ? 300 : 240, after: 120 },
		keepNext: true,
		...(border ? { border } : {}),
		...(look.shadingHex ? { shading: { type: ShadingType.CLEAR, fill: look.shadingHex, color: "auto" } } : {}),
		children: [
			new TextRun({
				text: title,
				bold: look.bold,
				color,
				size: look.sizeHalfPt,
				font: config.headingFont,
				...(look.allCaps ? { allCaps: true } : {}),
				...(look.characterSpacing ? { characterSpacing: look.characterSpacing } : {}),
			}),
		],
	});
}

const headingOf = (section: { title: string; showHeading?: boolean | undefined }, colorHex: string) =>
	section.showHeading !== false && section.title ? [sectionHeading(section.title, colorHex)] : [];

type RenderableSection<T> = { hidden: boolean; title: string; showHeading?: boolean | undefined; items: T[] };

/** Renders a section's visible items under its heading, or nothing when it is hidden or has no visible items. */
function renderEntries<T extends { hidden: boolean }>(
	section: RenderableSection<T>,
	colorHex: string,
	renderItem: (item: T, baseRun: BaseRun, index: number) => Paragraph[],
): Paragraph[] {
	const items = section.items.filter((item) => !item.hidden);
	if (section.hidden || items.length === 0) return [];

	const baseRun = getBaseRun();
	return [...headingOf(section, colorHex), ...items.flatMap((item, index) => renderItem(item, baseRun, index))];
}

function titleAndSubtitle(primary: string, secondary: string, rightText?: string, bold = true): Paragraph {
	const baseRun = getBaseRun();
	const children: (TextRun | ExternalHyperlink)[] = [new TextRun({ text: primary, bold, ...baseRun })];

	if (secondary) {
		children.push(new TextRun({ text: ` — ${secondary}`, ...baseRun }));
	}

	if (rightText) {
		// Dates are meta: muted, not bold, at the column's right edge.
		children.push(new TextRun({ text: `\t${rightText}`, ...baseRun, color: mutedColor() }));
	}

	return new Paragraph({
		tabStops: [{ type: TabStopType.RIGHT, position: config.rightTabTwips ?? TabStopPosition.MAX }],
		spacing: { before: 120 },
		children,
	});
}

/** Puts the role before the organization when the resume leads with the role and the item has one. */
const byLead = (organization: string, role: string): [string, string] =>
	config.lead === "role" && role.trim() ? [role, organization] : [organization, role];

function locationLine(location: string): Paragraph[] {
	if (!location) return [];

	return [
		new Paragraph({
			children: [
				new TextRun({
					text: location,
					color: mutedColor(),
					font: config.bodyFont,
					size: config.bodySizeHalfPt,
				}),
			],
			spacing: { after: 60 },
		}),
	];
}

function websiteParagraph(url: string, label: string): Paragraph[] {
	const safeUrl = toSafeLink(url);
	if (!safeUrl) return [];

	return [
		new Paragraph({
			children: [
				new ExternalHyperlink({
					link: safeUrl,
					children: [
						new TextRun({
							text: label || safeUrl,
							color: config.primaryColorHex,
							underline: {},
							font: config.bodyFont,
							size: config.bodySizeHalfPt,
						}),
					],
				}),
			],
			spacing: { after: 60 },
		}),
	];
}

/** The description and website paragraphs most entries end with. */
const itemTrailer = (item: { description: string; website: { url: string; label: string } }): Paragraph[] => [
	...(item.description ? htmlToParagraphs(item.description, getHtmlStyle()) : []),
	...websiteParagraph(item.website.url, item.website.label),
];

// --- Section-specific renderers ---

export function renderSummary(summary: ResumeData["summary"], colorHex: string): Paragraph[] {
	if (summary.hidden || !summary.content) return [];

	return [...headingOf(summary, colorHex), ...htmlToParagraphs(summary.content, getHtmlStyle())];
}

const renderExperience = (section: Sections["experience"], colorHex: string) =>
	renderEntries(section, colorHex, (item, baseRun) => {
		const roles = item.roles.filter((role) => role.position.trim());
		if (roles.length === 0)
			return [
				titleAndSubtitle(...byLead(item.company, item.position), item.period),
				...locationLine(item.location),
				...itemTrailer(item),
			];

		return [
			titleAndSubtitle(item.company, "", item.period),
			...locationLine(item.location),
			...roles.flatMap((role) => [
				new Paragraph({
					spacing: { before: 80 },
					children: [
						new TextRun({ text: role.position, bold: true, italics: true, ...baseRun }),
						...(role.period ? [new TextRun({ text: ` — ${role.period}`, italics: true, ...baseRun })] : []),
					],
				}),
				...(role.description ? htmlToParagraphs(role.description, getHtmlStyle()) : []),
			]),
			...itemTrailer(item),
		];
	});

const renderEducation = (section: Sections["education"], colorHex: string) =>
	renderEntries(section, colorHex, (item, baseRun) => [
		titleAndSubtitle(...byLead(item.school, [item.degree, item.area].filter(Boolean).join(", ")), item.period),
		...(item.grade
			? [new Paragraph({ children: [new TextRun({ text: `Grade: ${item.grade}`, italics: true, ...baseRun })] })]
			: []),
		...locationLine(item.location),
		...itemTrailer(item),
	]);

const renderProjects = (section: Sections["projects"], colorHex: string) =>
	renderEntries(section, colorHex, (item) => [titleAndSubtitle(item.name, "", item.period), ...itemTrailer(item)]);

const renderSkills = (section: Sections["skills"], colorHex: string) =>
	renderEntries(section, colorHex, (item, baseRun) => {
		const asList = section.keywordLayout === "list";
		const children: TextRun[] = [new TextRun({ text: item.name, bold: true, ...baseRun })];
		if (item.proficiency) children.push(new TextRun({ text: ` — ${item.proficiency}`, ...baseRun }));
		if (!asList && item.keywords.length > 0)
			children.push(new TextRun({ text: `: ${item.keywords.join(", ")}`, ...baseRun }));

		return [
			new Paragraph({ spacing: { before: 60 }, children }),
			...(asList ? item.keywords : []).map(
				(keyword) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: keyword, ...baseRun })] }),
			),
		];
	});

/** A bold name with an optional suffix, the shape of languages, interests and profiles. */
const nameLine = (name: string, suffix: string, baseRun: BaseRun) =>
	new Paragraph({
		spacing: { before: 60 },
		children: [
			new TextRun({ text: name, bold: true, ...baseRun }),
			...(suffix ? [new TextRun({ text: suffix, ...baseRun })] : []),
		],
	});

const renderLanguages = (section: Sections["languages"], colorHex: string) =>
	renderEntries(section, colorHex, (item, baseRun) => [
		nameLine(item.language, item.fluency ? ` — ${item.fluency}` : "", baseRun),
	]);

const renderInterests = (section: Sections["interests"], colorHex: string) =>
	renderEntries(section, colorHex, (item, baseRun) => [
		nameLine(item.name, item.keywords.length > 0 ? `: ${item.keywords.join(", ")}` : "", baseRun),
	]);

const renderAwards = (section: Sections["awards"], colorHex: string) =>
	renderEntries(section, colorHex, (item) => [
		titleAndSubtitle(item.title, item.awarder, item.date, false),
		...itemTrailer(item),
	]);

const renderCertifications = (section: Sections["certifications"], colorHex: string) =>
	renderEntries(section, colorHex, (item) => [
		titleAndSubtitle(item.title, item.issuer, item.date),
		...itemTrailer(item),
	]);

const renderPublications = (section: Sections["publications"], colorHex: string) =>
	renderEntries(section, colorHex, (item, _baseRun, index) => [
		titleAndSubtitle(config.numberPublications ? `${index + 1}. ${item.title}` : item.title, item.publisher, item.date),
		...itemTrailer(item),
	]);

const renderVolunteer = (section: Sections["volunteer"], colorHex: string) =>
	renderEntries(section, colorHex, (item) => [
		titleAndSubtitle(item.organization, "", item.period),
		...locationLine(item.location),
		...itemTrailer(item),
	]);

const renderReferences = (section: Sections["references"], colorHex: string) =>
	renderEntries(section, colorHex, (item, baseRun) => [
		new Paragraph({
			spacing: { before: 120 },
			children: [
				new TextRun({ text: item.name, bold: true, ...baseRun }),
				...(item.position ? [new TextRun({ text: ` — ${item.position}`, ...baseRun })] : []),
			],
		}),
		...(item.phone ? [new Paragraph({ children: [new TextRun({ text: item.phone, ...baseRun })] })] : []),
		...itemTrailer(item),
	]);

const renderProfiles = (section: Sections["profiles"], colorHex: string) =>
	renderEntries(section, colorHex, (item, baseRun) => [
		nameLine(item.network, item.username ? ` — ${item.username}` : "", baseRun),
		...websiteParagraph(item.website.url, item.website.label),
	]);

/**
 * Mapping from built-in section type to its renderer.
 */
const sectionRenderers: Record<SectionType, (section: Sections[SectionType], colorHex: string) => Paragraph[]> = {
	experience: renderExperience as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	education: renderEducation as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	projects: renderProjects as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	skills: renderSkills as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	languages: renderLanguages as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	interests: renderInterests as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	awards: renderAwards as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	certifications: renderCertifications as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	publications: renderPublications as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	volunteer: renderVolunteer as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	references: renderReferences as (section: Sections[SectionType], colorHex: string) => Paragraph[],
	profiles: renderProfiles as (section: Sections[SectionType], colorHex: string) => Paragraph[],
};

/**
 * Renders a built-in section by type.
 */
export function renderBuiltInSection(type: SectionType, section: Sections[SectionType], colorHex: string): Paragraph[] {
	const renderer = sectionRenderers[type];
	if (!renderer) return [];
	return renderer(section, colorHex);
}

/**
 * Renders a custom section by dispatching to the matching built-in renderer based on its type.
 */
export function renderCustomSection(section: CustomSection, colorHex: string): Paragraph[] {
	if (section.hidden) return [];

	const visibleItems = section.items.filter((item) => !item.hidden);
	if (visibleItems.length === 0) return [];

	const sectionType = section.type as CustomSectionType;

	// Summary-type custom sections render HTML content
	if (sectionType === "summary") {
		const paragraphs = headingOf(section, colorHex);
		for (const item of visibleItems) {
			if ("content" in item && item.content) {
				paragraphs.push(...htmlToParagraphs(item.content, getHtmlStyle()));
			}
		}
		return paragraphs;
	}

	// Cover letter type — render recipient + content
	if (sectionType === "cover-letter") {
		const paragraphs: Paragraph[] = [];
		for (const item of visibleItems) {
			if ("recipient" in item && item.recipient) {
				paragraphs.push(...htmlToParagraphs(item.recipient, getHtmlStyle()));
			}
			if ("content" in item && item.content) {
				paragraphs.push(...htmlToParagraphs(item.content, getHtmlStyle()));
			}
		}
		return paragraphs;
	}

	// Build a synthetic section matching the built-in type for the renderer
	const sectionKey = sectionType as SectionType;
	if (sectionKey in sectionRenderers) {
		const syntheticSection = {
			...(section.type === "skills" ? { keywordLayout: section.keywordLayout } : {}),
			title: section.title,
			columns: section.columns,
			hidden: false,
			showHeading: section.showHeading,
			items: visibleItems,
		} as Sections[SectionType];

		return renderBuiltInSection(sectionKey, syntheticSection, colorHex);
	}

	return [];
}
