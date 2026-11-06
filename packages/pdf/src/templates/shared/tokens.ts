import type { createBaseTemplateStyles } from "./base-template-styles";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { mixColors, readableOn, readableAccent as sharedReadableAccent } from "@rezumi/utils/contrast";

/** `color` laid over `base` at `amount` (0–1), as one opaque colour: Forme prints tints as flat colours anyway. */
export { mixColors };

/**
 * The accent as a text colour on `background`: the accent itself when it reads, otherwise the accent mixed toward
 * black (or white, on a dark page) just far enough to reach 3:1, WCAG's floor for bold labels and large text. Rules,
 * bars and fills keep the accent the user picked; only text and icons drawn in it take this colour. The rule lives in
 * `@rezumi/utils/contrast`, shared with the portfolio pages (which ask for 4.5:1).
 */
export const readableAccent = (accent: string, background: string): string =>
	sharedReadableAccent(accent, background, 3);

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
	/** The accent as a text colour: darkened only when the accent is too light to read on the page. */
	accentText: string;
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
		accentText: readableAccent(primary, background),
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
