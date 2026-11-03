import type { createBaseTemplateStyles } from "./base-template-styles";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { parseColorString, rgbaStringToHex } from "@rezumi/utils/color";

type Rgb = [number, number, number];

const rgbOf = (color: string): Rgb => {
	const parsed = parseColorString(color) ?? parseColorString(rgbaStringToHex(color));
	return parsed ? [parsed.r, parsed.g, parsed.b] : [0, 0, 0];
};

const hex = ([r, g, b]: Rgb) =>
	`#${[r, g, b]
		.map((channel) =>
			Math.round(Math.max(0, Math.min(255, channel)))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;

/** `color` laid over `base` at `amount` (0–1), as one opaque colour: Forme prints tints as flat colours anyway. */
export const mixColors = (color: string, base: string, amount: number): string => {
	const [r1, g1, b1] = rgbOf(color);
	const [r2, g2, b2] = rgbOf(base);
	return hex([r2 + (r1 - r2) * amount, g2 + (g1 - g2) * amount, b2 + (b1 - b2) * amount]);
};

// WCAG relative luminance of an sRGB colour.
const luminance = (color: string) => {
	const [r, g, b] = rgbOf(color).map((channel) => {
		const value = channel / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	}) as Rgb;
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (light + 0.05) / (dark + 0.05);
};

/** White or the ink colour, whichever reads better on `background`. */
const readableOn = (background: string, ink: string): string =>
	contrast("#ffffff", background) >= contrast(ink, background) ? "#ffffff" : ink;

/**
 * Colour roles and type sizes every template of the November 2026 lineup draws with, derived from the resume's own
 * colours and typography so a user's choices still apply (see `.agents/docs/plans/cv-templates/01-desain.md`).
 */
export type DesignTokens = {
	/** The text colour. */
	ink: string;
	/** Dates, locations, issuers, keywords. */
	muted: string;
	/** Separators and list markers. */
	subtle: string;
	/** Hairline rules. */
	hairline: string;
	accent: string;
	/** A faint wash of the accent, for sidebars and chips. */
	accentSoft: string;
	/** The text colour that reads on the accent. */
	onAccent: string;
	background: string;
	size: {
		body: number;
		/** Dates and other meta text. */
		meta: number;
		/** Keywords and captions. */
		small: number;
		/** Uppercase section labels. */
		label: number;
		heading: number;
	};
	/** Weight of the heading face's boldest stored weight. */
	headingWeight: string;
};

export const createDesignTokens = ({
	metadata,
	foreground,
	background,
	primary,
}: {
	metadata: ResumeData["metadata"];
	foreground: string;
	background: string;
	primary: string;
}): DesignTokens => {
	const body = metadata.typography.body.fontSize;
	return {
		ink: foreground,
		muted: mixColors(foreground, background, 0.62),
		subtle: mixColors(foreground, background, 0.38),
		hairline: mixColors(foreground, background, 0.16),
		accent: primary,
		accentSoft: mixColors(primary, background, 0.08),
		onAccent: readableOn(primary, foreground),
		background,
		size: {
			body,
			meta: body * 0.92,
			small: body * 0.86,
			label: body * 0.8,
			heading: metadata.typography.heading.fontSize,
		},
		headingWeight: metadata.typography.heading.fontWeights.at(-1) ?? "600",
	};
};

type LineupStylesInput = {
	base: ReturnType<typeof createBaseTemplateStyles>;
	tokens: DesignTokens;
};

/**
 * The slots every template of the lineup shares, on top of the base styles: spacing tied to the type size rather
 * than the page gaps (an icon or a bullet keeps its distance whatever the density), and the muted meta text.
 */
export const createLineupStyles = ({ base, tokens }: LineupStylesInput) => {
	const { size } = tokens;
	return {
		inline: { ...base.inline, columnGap: size.body * 0.4 },
		richListItemRow: { ...base.richListItemRow, columnGap: size.body * 0.45 },
		richListItemMarker: { ...base.richListItemMarker, color: tokens.subtle },
		alignEnd: { ...base.alignEnd, color: tokens.muted, fontSize: size.meta },
		small: { fontSize: size.small, color: tokens.muted },
		link: { ...base.link, color: tokens.ink },
		levelItem: { borderColor: tokens.accent },
		levelItemActive: { backgroundColor: tokens.accent },
	};
};
