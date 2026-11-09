/**
 * What a portfolio counts and what its contact form accepts (`02-teknis.md` sections 9 and 10). The page's beacons, the
 * server that counts them and the dashboard that shows them all read these lists.
 */

/** Clicks counted per day: buttons, service orders, videos played and PDFs opened. */
export const PORTFOLIO_CLICK_KINDS = [
	"resume",
	"pdf",
	"whatsapp",
	"email",
	"link",
	"contact",
	"service",
	"video",
	"document",
] as const;

export type PortfolioClickKind = (typeof PORTFOLIO_CLICK_KINDS)[number];

/** What a beacon may report: a click, or a work whose detail was opened. */
export const PORTFOLIO_EVENT_KINDS = [...PORTFOLIO_CLICK_KINDS, "work"] as const;

export type PortfolioEventKind = (typeof PORTFOLIO_EVENT_KINDS)[number];

/** Where a visit came from, from its `Referer` and `utm_source`. */
export const PORTFOLIO_VISIT_SOURCES = ["linkedin", "whatsapp", "google", "direct", "other"] as const;

export type PortfolioVisitSource = (typeof PORTFOLIO_VISIT_SOURCES)[number];

/** Visitor devices, as Analytics Engine records them. */
export const PORTFOLIO_DEVICES = ["mobile", "tablet", "desktop"] as const;

export type PortfolioDevice = (typeof PORTFOLIO_DEVICES)[number];

/** The days the dashboard shows. */
export const PORTFOLIO_STATISTICS_DAYS = 30;

/** Different works one day's row counts; more are dropped, so a row can't grow without limit. */
export const PORTFOLIO_STATISTICS_MAX_WORKS = 50;

/** Limits of the contact form's fields (`01-desain.md` section 9). */
export const PORTFOLIO_MESSAGE_LIMITS = {
	name: 100,
	email: 254,
	body: 2000,
	/** Links a message may hold; spam is mostly links. */
	links: 2,
	/** Days a message is kept before the daily job deletes it (owner decision #7). */
	retentionDays: 90,
} as const;

/** The form's trap field: people never see it, so only a bot fills it in. */
export const PORTFOLIO_MESSAGE_TRAP_FIELD = "website";
