// The Design panel's presets and colour helpers, shared by the web and the app. Pure: no React, no Lingui.
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { DateFormat } from "@rezumi/schema/resume/dates";
import type { CareerField, Template } from "@rezumi/schema/templates";
import type { WritableDraft } from "immer";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { templateCareerFields, templateLayouts, templateLineup } from "@rezumi/schema/templates";
import { contrastOnWhite } from "@rezumi/utils/color";
import { buildMarkdown } from "./markdown";

type Data = ResumeData | WritableDraft<ResumeData>;
/** The design a resume and a letter share. */
type Metadata = Pick<Data["metadata"], "typography" | "design" | "page">;

/**
 * Five traditional resume faces, set in Regular and Bold. Families that aren't a pairing leave the control with no
 * selection; any other font is chosen in Advanced.
 */
export const FONT_PAIRINGS = [
	{ id: "classic", label: "Classic", heading: "EB Garamond", body: "EB Garamond", headingWeight: "600" },
	{ id: "traditional", label: "Traditional", heading: "Tinos", body: "Tinos", headingWeight: "700" },
	{ id: "balanced", label: "Balanced", heading: "Source Serif 4", body: "Source Sans 3", headingWeight: "600" },
	{ id: "professional", label: "Professional", heading: "Carlito", body: "Carlito", headingWeight: "700" },
	{ id: "clean", label: "Clean", heading: "Lato", body: "Lato", headingWeight: "700" },
] as const;

export type FontPairingId = (typeof FONT_PAIRINGS)[number]["id"];

export function matchFontPairing(metadata: Pick<Metadata, "typography">): FontPairingId | null {
	const { heading, body } = metadata.typography;
	return (
		FONT_PAIRINGS.find((pairing) => pairing.heading === heading.fontFamily && pairing.body === body.fontFamily)?.id ??
		null
	);
}

export function applyFontPairing(metadata: WritableDraft<Metadata>, id: FontPairingId) {
	const pairing = FONT_PAIRINGS.find((candidate) => candidate.id === id);
	if (!pairing) return;
	metadata.typography.heading.fontFamily = pairing.heading;
	metadata.typography.heading.fontWeights = [pairing.headingWeight];
	metadata.typography.body.fontFamily = pairing.body;
	metadata.typography.body.fontWeights = ["400", "700"];
}

/**
 * Density sets the body line height and the gap between entries. "Normal" is today's default, so resumes
 * saved before the redesign show as Normal; the others follow the spec's proportions around it.
 */
const DENSITIES = {
	compact: { lineHeight: 1.35, gapY: 4 },
	normal: { lineHeight: 1.5, gapY: 6 },
	roomy: { lineHeight: 1.65, gapY: 8 },
} as const;

export type DensityId = keyof typeof DENSITIES;

export function matchDensity(metadata: Metadata): DensityId | null {
	const lineHeight = metadata.typography.body.lineHeight;
	const gapY = metadata.page.gapY;
	const match = Object.entries(DENSITIES).find(([, value]) => value.lineHeight === lineHeight && value.gapY === gapY);
	return (match?.[0] as DensityId | undefined) ?? null;
}

export function applyDensity(metadata: WritableDraft<Metadata>, id: DensityId) {
	metadata.typography.body.lineHeight = DENSITIES[id].lineHeight;
	metadata.page.gapY = DENSITIES[id].gapY;
}

/** Page margins in points. "Normal" is today's default; Narrow and Wide scale it by the spec's 30/44/60. */
const MARGINS = {
	narrow: { marginX: 10, marginY: 8 },
	normal: { marginX: 14, marginY: 12 },
	wide: { marginX: 19, marginY: 16 },
} as const;

export type MarginId = keyof typeof MARGINS;

export function matchMargins(metadata: Metadata): MarginId | null {
	const { marginX, marginY } = metadata.page;
	const match = Object.entries(MARGINS).find(([, value]) => value.marginX === marginX && value.marginY === marginY);
	return (match?.[0] as MarginId | undefined) ?? null;
}

export function applyMargins(metadata: WritableDraft<Metadata>, id: MarginId) {
	metadata.page.marginX = MARGINS[id].marginX;
	metadata.page.marginY = MARGINS[id].marginY;
}

export const TEXT_SIZE = { min: 9, max: 12.5, step: 0.5 } as const;

/** Sets the body size and scales the heading with it, keeping their ratio within the schema's 6–24pt bounds. */
export function applyTextSize(metadata: WritableDraft<Pick<Metadata, "typography">>, size: number) {
	const { body, heading } = metadata.typography;
	const ratio = body.fontSize > 0 ? heading.fontSize / body.fontSize : 1.4;
	body.fontSize = size;
	heading.fontSize = Math.min(24, Math.max(6, Math.round(size * ratio * 2) / 2));
}

/** Eight accents, all readable on white. */
export const ACCENTS = [
	{ label: "Moss", hex: "#3E6B4F" },
	{ label: "Ink blue", hex: "#2F5A8A" },
	{ label: "Teal", hex: "#1F6E73" },
	{ label: "Plum", hex: "#6B3E6E" },
	{ label: "Rust", hex: "#A0442A" },
	{ label: "Burgundy", hex: "#8A2C3F" },
	{ label: "Ochre", hex: "#7A5A12" },
	{ label: "Graphite", hex: "#3B3F45" },
] as const;

const HEX = /^#?([0-9a-f]{6})$/i;

export const hexToRgba = (hex: string) => {
	const value = Number.parseInt(HEX.exec(hex.trim())?.[1] ?? "000000", 16);
	return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, 1)`;
};

/** The hex of an `rgba(r, g, b, a)` colour (alpha ignored), or null if it isn't one. */
export function rgbaToHex(color: string): string | null {
	const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
	if (!match) return HEX.test(color) ? `#${HEX.exec(color)?.[1]?.toUpperCase()}` : null;
	return `#${match
		.slice(1, 4)
		.map((channel) => Number(channel).toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase()}`;
}

export const isValidHex = (hex: string) => HEX.test(hex.trim());

type Rgba = { r: number; g: number; b: number; a: number };

/** `rgb(a)(…)` with channels 0–255 and alpha 0–1, else null. */
function parseRgba(value: string): Rgba | null {
	const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i.exec(value.trim());
	if (!match) return null;
	const [r, g, b] = match.slice(1, 4).map(Number) as [number, number, number];
	const a = match[4] === undefined ? 1 : Number(match[4]);
	return [r, g, b].every((channel) => channel <= 255) && a <= 1 ? { r, g, b, a } : null;
}

const toRgba = ({ r, g, b, a }: Rgba) => `rgba(${r}, ${g}, ${b}, ${a})`;

/** Typed colour text as a canonical `rgba(r, g, b, a)`: hex with or without #, or rgb(a) in range. Else null. */
export function parseColorInput(text: string): string | null {
	const value = text.trim();
	if (isValidHex(value)) return hexToRgba(value);
	const rgba = parseRgba(value);
	return rgba ? toRgba(rgba) : null;
}

const toRgb = (color: string): Rgba | null =>
	parseRgba(color) ?? (isValidHex(color) ? parseRgba(hexToRgba(color)) : null);
const over = (top: Rgba, bottom: Rgba): Rgba => ({
	r: top.r * top.a + bottom.r * (1 - top.a),
	g: top.g * top.a + bottom.g * (1 - top.a),
	b: top.b * top.a + bottom.b * (1 - top.a),
	a: 1,
});
const linear = (channel: number) => {
	const value = channel / 255;
	return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const luminance = ({ r, g, b }: Rgba) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/**
 * WCAG contrast of `color` as it prints on `background`: the background is laid over white paper and the colour
 * over the background, so transparency counts. 1 when either can't be read.
 */
export function contrastOver(color: string, background = "#FFFFFF"): number {
	const white = { r: 255, g: 255, b: 255, a: 1 };
	const top = toRgb(color);
	const bottom = toRgb(background);
	if (!top || !bottom) return 1;
	const paper = over(bottom, white);
	const [light, dark] = [luminance(paper), luminance(over(top, paper))].sort((x, y) => y - x) as [number, number];
	return (light + 0.05) / (dark + 0.05);
}

/** Below this the Color group warns (WCAG AA for normal text). */
export const MIN_CONTRAST = 4.5;

/** The same hue, darkened step by step until it reads on white (at least 4.6:1). */
export function darkenForWhite(hex: string): string {
	const value = Number.parseInt(HEX.exec(hex.trim())?.[1] ?? "000000", 16);
	let channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
	for (let step = 0; step < 40; step++) {
		const candidate =
			`#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
		if (contrastOnWhite(candidate) >= 4.6) return candidate;
		channels = channels.map((channel) => channel * 0.93);
	}
	return "#333333";
}

export type FitState = { density: DensityId | null; margins: MarginId | null; size: number };
export type FitStep = { density: DensityId } | { margins: MarginId } | { size: number };

const tighter = <T extends string>(order: readonly T[], current: T | null): T | null => {
	const index = current === null ? -1 : order.indexOf(current);
	const next = index === -1 ? order.at(-1) : order[index + 1];
	return next && next !== current ? next : null;
};

/**
 * The next step of Fit to one page: density first, then margins, then the text size in 0.5 pt steps, never
 * below 9 pt. Null means there is nothing left to tighten.
 */
export function nextFitStep(state: FitState): FitStep | null {
	const density = tighter(["roomy", "normal", "compact"] as const, state.density);
	if (density) return { density };
	const margins = tighter(["wide", "normal", "narrow"] as const, state.margins);
	if (margins) return { margins };
	if (state.size > TEXT_SIZE.min) return { size: Math.max(TEXT_SIZE.min, Math.round((state.size - 0.5) * 2) / 2) };
	return null;
}

/**
 * Runs Fit: applies steps until `measure` says the pages fit or nothing is left to tighten. `apply` sets a
 * step on the resume and `measure` resolves after the page has re-rendered.
 */
export async function fitToPages(
	initial: FitState,
	apply: (step: FitStep) => void,
	measure: () => Promise<boolean>,
): Promise<{ fits: boolean; state: FitState }> {
	let state = initial;
	for (let guard = 0; guard < 16; guard++) {
		if (await measure()) return { fits: true, state };
		const step = nextFitStep(state);
		if (!step) return { fits: false, state };
		apply(step);
		state = { ...state, ...step };
	}
	return { fits: false, state };
}

/** Example labels are dates, not words, so they need no translation. */
export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
	{ value: "short", label: "Mar 2022" },
	{ value: "long", label: "March 2022" },
	{ value: "numeric", label: "03/2022" },
	{ value: "iso", label: "2022-03" },
];

/**
 * Reset design defaults: typography, design, sidebar width and the look's page values. Paper, language, date
 * format, section placement and custom CSS are the user's, not the look's; they stay.
 */
export function resetDesign(metadata: WritableDraft<ResumeData["metadata"]>) {
	const defaults = defaultResumeData.metadata;
	metadata.typography = structuredClone(defaults.typography);
	metadata.design = structuredClone(defaults.design);
	metadata.layout.sidebarWidth = defaults.layout.sidebarWidth;
	const { gapX, gapY, marginX, marginY, hideLinkUnderline } = defaults.page;
	Object.assign(metadata.page, { gapX, gapY, marginX, marginY, hideLinkUnderline });
}

export type TemplateFilter = "all" | "one" | "two" | "ats";

export const TEMPLATES: readonly Template[] = templateLineup;

export const templateName = (id: Template) => id.charAt(0).toUpperCase() + id.slice(1);

export function matchesFilter(id: Template, filter: TemplateFilter) {
	const layout = templateLayouts[id];
	if (filter === "one") return layout.columns === 1;
	if (filter === "two") return layout.columns === 2;
	if (filter === "ats") return layout.atsSafe;
	return true;
}

/** Whether a template suits a field of work (`templateCareerFields`); "all" keeps every template. */
export const suitsCareerField = (id: Template, field: CareerField | "all") =>
	field === "all" || (templateCareerFields[id] as readonly CareerField[]).includes(field);

/**
 * A template's sample PDF and its previews, as server paths (`pnpm --filter @rezumi/tooling templates:previews`). Each
 * sample has an English and an Indonesian version: Indonesian shows the Indonesian one, every other language English.
 */
export const templateSample = (id: Template, locale: string) => {
	const folder = locale.split("-")[0] === "id" ? "id/" : "";
	return {
		pdf: `/templates/pdf/${folder}${id}.pdf`,
		/** 600×848 JPEG: builder and letter cards. */
		image: `/templates/jpg/${folder}${id}.jpg`,
		/** 596×843 and 300×424 WebP: the gallery and the homepage. */
		thumbnail: `/templates/thumb/${folder}${id}.webp`,
		smallThumbnail: `/templates/thumb/${folder}${id}-small.webp`,
	};
};

/**
 * Whether a template preview drawn from this resume shows more than a template's sample would: visible content beyond
 * the account details a new resume inherits, or a visible picture. Galleries show the sample image otherwise.
 */
export const hasTemplatePreviewContent = (data: ResumeData) =>
	Boolean(
		buildMarkdown({ ...data, basics: defaultResumeData.basics }).trim() || (!data.picture.hidden && data.picture.url),
	);
