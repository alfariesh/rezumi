import type { AppDestination } from "./app-links";

/** The calls to action an article can end with: the `cta` field of the posts collection (seed/seed.json). */
const CTA_KINDS = ["build-resume", "ats-checker", "templates"] as const;

export type CtaKind = (typeof CTA_KINDS)[number];

export const CTA_DESTINATIONS: Record<CtaKind, AppDestination> = {
	"build-resume": "register",
	"ats-checker": "ats-checker",
	templates: "templates",
};

/** The article's call to action; `none` hides it, and an unknown or missing value falls back to building a resume. */
export function resolveCta(value: unknown): CtaKind | null {
	if (value === "none") return null;
	return CTA_KINDS.find((kind) => kind === value) ?? "build-resume";
}
