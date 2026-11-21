export { isValidSlug, MAX_SLUG_LENGTH, normalizeSlug, SLUG_PATTERN } from "@rezumi/schema/resume/slug";

/** A DNS label: what a username must look like to be a subdomain or a domain of its own. */
export const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** The `.cv` domain to suggest for a username, when the username can be one. */
export const cvDomainFor = (username: string) => (DNS_LABEL.test(username) ? `${username}.cv` : undefined);

/** Where to register a suggested `.cv` domain. */
export const cvDomainRegistrationUrl = (domain: string) => `https://ola.cv/?domain=${encodeURIComponent(domain)}`;

type ResumeAddress = { username: string; slug: string; isPrimary?: boolean | undefined };

/** A resume's web page on the app's domains: `/<username>` for the primary resume, otherwise `/<username>/<slug>`. */
export const publicResumePath = ({ username, slug, isPrimary }: ResumeAddress) =>
	isPrimary ? `/${encodeURIComponent(username)}` : `/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;

/** A resume's web page at `origin` (the app, or its alias). */
export const publicResumeUrl = (origin: string, address: ResumeAddress) => `${origin}${publicResumePath(address)}`;

type DailyStat = { date: string; views: number; downloads: number };

/** Share's numbers: views and downloads over the last 30 days, and each day's views against the peak. */
export function summarizeViews(daily: readonly DailyStat[]) {
	const days = daily.slice(-30);
	const peak = Math.max(0, ...days.map((day) => day.views));
	return {
		views: days.reduce((sum, day) => sum + day.views, 0),
		downloads: days.reduce((sum, day) => sum + day.downloads, 0),
		peak,
		bars: days.map((day) => ({ date: day.date, views: day.views, height: peak > 0 ? day.views / peak : 0 })),
	};
}

const DAY_MS = 24 * 60 * 60 * 1000;
const UNITS = [
	{ unit: "minute", ms: 60 * 1000, below: 60 },
	{ unit: "hour", ms: 60 * 60 * 1000, below: 24 },
	{ unit: "day", ms: DAY_MS, below: 7 },
	{ unit: "week", ms: 7 * DAY_MS, below: 52 },
	{ unit: "year", ms: 365 * DAY_MS, below: Number.POSITIVE_INFINITY },
] as const;

/** Time since a moment in the largest whole unit, written short: "5m", "2h", "3d", "6w", "1y". */
export function formatTimeSince(date: Date, locale: string, now = Date.now()) {
	const elapsed = Math.max(0, now - date.getTime());
	const { unit, ms } = UNITS.find(({ ms, below }) => elapsed / ms < below) ?? UNITS[4];
	return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "narrow" }).format(Math.floor(elapsed / ms));
}

type PortfolioVisibility = { isPublic: boolean; suspendedAt: Date | string | null };

/**
 * Whether visitors can open the portfolio: published and not taken down. The server decides the same way before it
 * serves the page (`portfolioOwnsProfilePath`), so no screen calls a page live that answers "not found".
 */
export function isPortfolioLive(portfolio: PortfolioVisibility | null | undefined): boolean {
	return Boolean(portfolio?.isPublic && !portfolio.suspendedAt);
}

/** `portfolio.status`, the part Share reads. */
type PortfolioState = { enabled: boolean; portfolio: PortfolioVisibility | null } | null;

/**
 * Whether the account's published portfolio holds the short link (`/<username>`) and custom domain, the way the
 * server decides it (`portfolioOwnsProfilePath`): portfolios are open to the account, and its portfolio is live
 * (published and not taken down). While portfolios are switched off this is always false, and Share reads as it
 * always has.
 */
export function portfolioHoldsShortLink(state: PortfolioState | undefined): boolean {
	return Boolean(state?.enabled && isPortfolioLive(state.portfolio));
}
