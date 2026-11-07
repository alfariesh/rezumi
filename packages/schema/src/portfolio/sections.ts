import z from "zod";
import { isResumeReferenceId, PORTFOLIO_ITEM_ID_PATTERN } from "./limits";

/**
 * The sections a portfolio page can show below the intro, which is always first and has no key. Portfolio-owned ones
 * (about, work, services, testimonials, clients, contact) and the ones read live from the source resume. Projects
 * become works and references never show, so neither is here.
 */
export const PORTFOLIO_STANDARD_SECTIONS = [
	"about",
	"work",
	"services",
	"testimonials",
	"clients",
	"experience",
	"education",
	"skills",
	"languages",
	"certifications",
	"awards",
	"publications",
	"volunteer",
	"interests",
	"profiles",
	"contact",
] as const;

export type PortfolioStandardSection = (typeof PORTFOLIO_STANDARD_SECTIONS)[number];

/** The standard sections whose items come from the source resume. */
export const PORTFOLIO_RESUME_SECTIONS = [
	"experience",
	"education",
	"skills",
	"languages",
	"certifications",
	"awards",
	"publications",
	"volunteer",
	"interests",
	"profiles",
] as const satisfies readonly PortfolioStandardSection[];

export type PortfolioResumeSection = (typeof PORTFOLIO_RESUME_SECTIONS)[number];

/**
 * A section's key: a standard section, `custom:<id>` for one of the portfolio's own free-form sections, or
 * `resume:<id>` for a custom section of the source resume.
 */
export type PortfolioSectionKey = PortfolioStandardSection | `custom:${string}` | `resume:${string}`;

const STANDARD = new Set<string>(PORTFOLIO_STANDARD_SECTIONS);
const CUSTOM_PREFIX = "custom:";
const RESUME_PREFIX = "resume:";

/**
 * Whether a value is a section key. A `custom:` key holds one of the portfolio's own IDs; a `resume:` key holds the
 * resume custom section's ID as the resume has it (`isResumeReferenceId`), which can be any text. Either ID is at most
 * `PORTFOLIO_LIMITS.text.id` long, so this also bounds a key's length.
 */
export function isPortfolioSectionKey(value: unknown): value is PortfolioSectionKey {
	if (typeof value !== "string") return false;
	if (STANDARD.has(value)) return true;
	if (value.startsWith(CUSTOM_PREFIX)) return PORTFOLIO_ITEM_ID_PATTERN.test(value.slice(CUSTOM_PREFIX.length));
	return value.startsWith(RESUME_PREFIX) && isResumeReferenceId(value.slice(RESUME_PREFIX.length));
}

export const portfolioSectionKeySchema = z
	.string()
	.refine(isPortfolioSectionKey, "Use a section key such as about, work, custom:<id> or resume:<id>.")
	.transform((value) => value as PortfolioSectionKey)
	.describe(
		"A portfolio section: about, work, services, testimonials, clients, experience, education, skills, languages, certifications, awards, publications, volunteer, interests, profiles, contact, custom:<id> (a portfolio section) or resume:<id> (a custom section of the source resume).",
	);
