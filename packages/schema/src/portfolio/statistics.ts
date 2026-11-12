/**
 * What a portfolio counts and what its contact form accepts (`02-teknis.md` sections 9 and 10). The page's beacons, the
 * server that counts them and the dashboard that shows them all read these lists.
 */

/** Clicks counted per day: buttons, service orders, videos played, PDFs opened, embeds opened and contacts saved. */
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
	"embed",
	"vcard",
] as const;

export type PortfolioClickKind = (typeof PORTFOLIO_CLICK_KINDS)[number];

/**
 * What a beacon may report: a click (on a work's page it carries the work's id), or `view`, the visit of a page that was
 * prerendered or prefetched and then shown (the server skips speculative requests, so such a page reports its own
 * visit, with `ref`: where the visitor came from). A `view` counts like the server's own visit count, once an hour per
 * visitor, so a normal load is never counted twice. Opening a work is counted by the work's page (Phase 13), not here.
 */
export const PORTFOLIO_EVENT_KINDS = [...PORTFOLIO_CLICK_KINDS, "view"] as const;

export type PortfolioEventKind = (typeof PORTFOLIO_EVENT_KINDS)[number];

/** Where a visit came from, from its `Referer` and `utm_source`. */
export const PORTFOLIO_VISIT_SOURCES = ["linkedin", "whatsapp", "google", "qr", "direct", "other"] as const;

export type PortfolioVisitSource = (typeof PORTFOLIO_VISIT_SOURCES)[number];

/** Where a work page's visit came from, in Analytics Engine: a visit's sources, or `portfolio` (from the portfolio itself). */
export const PORTFOLIO_WORK_SOURCES = [...PORTFOLIO_VISIT_SOURCES, "portfolio"] as const;

export type PortfolioWorkSource = (typeof PORTFOLIO_WORK_SOURCES)[number];

/** The `utm_source` the business card's QR code adds, read as the source `qr`. */
export const PORTFOLIO_QR_UTM_SOURCE = "qr";

/** Visitor devices, as Analytics Engine records them. */
export const PORTFOLIO_DEVICES = ["mobile", "tablet", "desktop"] as const;

export type PortfolioDevice = (typeof PORTFOLIO_DEVICES)[number];

/**
 * What the dashboard's breakdown (countries, devices, referrers, works per day) is: `locked` without the plan feature,
 * `not-configured` where Analytics Engine isn't bound (Node, local development), `unavailable` when reading it failed,
 * else `ready`.
 */
export const PORTFOLIO_STATISTICS_DETAIL_STATES = ["locked", "not-configured", "unavailable", "ready"] as const;

export type PortfolioStatisticsDetailState = (typeof PORTFOLIO_STATISTICS_DETAIL_STATES)[number];

/** The spans of days the dashboard offers. */
export const PORTFOLIO_STATISTICS_RANGES = [7, 30, 90] as const;

export type PortfolioStatisticsRange = (typeof PORTFOLIO_STATISTICS_RANGES)[number];

/** The days the dashboard shows by default. */
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
