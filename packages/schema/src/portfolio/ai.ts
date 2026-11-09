import { PORTFOLIO_LIMITS } from "./limits";

const { text: max } = PORTFOLIO_LIMITS;

/** Works one AI draft writes: enough for a whole portfolio on most accounts, and a bound on what one action costs. */
export const PORTFOLIO_AI_DRAFT_WORKS = 12;
/** The note a person may add to a draft: what to stress, what to leave out. */
export const PORTFOLIO_AI_NOTE_LENGTH = 1000;
/** Candidates one search for numbers returns: the page shows at most four metrics in one place. */
export const PORTFOLIO_AI_METRICS = 12;

export const PORTFOLIO_AI_REWRITES = ["shorter", "professional", "translate"] as const;
export type PortfolioAiRewrite = (typeof PORTFOLIO_AI_REWRITES)[number];

/**
 * The fields AI can rewrite. Testimonials aren't here on purpose: they're someone else's words. `rich` fields hold HTML
 * from the Rich Text Editor; the rest are plain text.
 */
export const PORTFOLIO_AI_FIELDS = {
	greeting: { rich: false, max: max.greeting },
	workSummary: { rich: false, max: max.workSummary },
	serviceDescription: { rich: false, max: max.serviceDescription },
	about: { rich: true, max: max.about },
	blockText: { rich: true, max: max.blockText },
	customContent: { rich: true, max: max.customContent },
} as const satisfies Record<string, { rich: boolean; max: number }>;

export type PortfolioAiField = keyof typeof PORTFOLIO_AI_FIELDS;

export const PORTFOLIO_AI_FIELD_KEYS = Object.keys(PORTFOLIO_AI_FIELDS) as [PortfolioAiField, ...PortfolioAiField[]];

/** A place left for the person to fill in, as AI drafts write one: "[add the result]". */
export const PORTFOLIO_AI_PLACEHOLDER = /\[[^[\]\n]{3,60}\]/g;
