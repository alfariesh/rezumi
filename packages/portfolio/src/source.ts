import type { ResumeData } from "@rezumi/schema/resume/data";

/**
 * Where a portfolio's career sections and contact details come from: its source resume while it's active (not in
 * Trash), or, for a portfolio without one, the account's Profile as resume data (`resumeDataFromProfile` in
 * `@rezumi/resume/profile`). The Profile holds content only: the page's language, accent and fonts never follow it.
 */
export type PortfolioSource = { data: ResumeData; from?: "resume" | "profile" };

/** The source's data when it's a resume: what may lend the page its language, accent and fonts. */
export const portfolioSourceResume = (source: PortfolioSource | null | undefined): ResumeData | null =>
	source && source.from !== "profile" ? source.data : null;
