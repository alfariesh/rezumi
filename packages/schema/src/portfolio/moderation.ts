/** Why a visitor can report a portfolio (`02-teknis.md` section 14). */
export const PORTFOLIO_REPORT_REASONS = ["fraud", "illegal", "rights", "fake_testimonial", "other"] as const;
export type PortfolioReportReason = (typeof PORTFOLIO_REPORT_REASONS)[number];

/** Open until an administrator acts on it or dismisses it. */
export const PORTFOLIO_REPORT_STATUSES = ["open", "actioned", "dismissed"] as const;
export type PortfolioReportStatus = (typeof PORTFOLIO_REPORT_STATUSES)[number];

export const PORTFOLIO_REPORT_LIMITS = {
	details: 2000,
	email: 254,
	/** An administrator's reason, which the owner of a suspended portfolio reads. */
	reason: 255,
	/** Days a reporter's email is kept once the report is handled. */
	reporterEmailRetentionDays: 90,
} as const;
