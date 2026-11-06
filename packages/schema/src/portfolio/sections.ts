import z from "zod";
import { PORTFOLIO_LIMITS } from "./limits";

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

const ITEM_ID_PATTERN = /^[\w-]{1,64}$/;
const STANDARD = new Set<string>(PORTFOLIO_STANDARD_SECTIONS);

export function isPortfolioSectionKey(value: unknown): value is PortfolioSectionKey {
	if (typeof value !== "string") return false;
	if (STANDARD.has(value)) return true;
	const match = /^(custom|resume):(.+)$/.exec(value);
	return Boolean(match?.[2] && ITEM_ID_PATTERN.test(match[2]));
}

export const portfolioSectionKeySchema = z
	.string()
	.max(PORTFOLIO_LIMITS.text.id + 7)
	.refine(isPortfolioSectionKey, "Use a section key such as about, work, custom:<id> or resume:<id>.")
	.transform((value) => value as PortfolioSectionKey)
	.describe(
		"A portfolio section: about, work, services, testimonials, clients, experience, education, skills, languages, certifications, awards, publications, volunteer, interests, profiles, contact, custom:<id> (a portfolio section) or resume:<id> (a custom section of the source resume).",
	);
