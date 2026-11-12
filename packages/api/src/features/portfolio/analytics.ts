import type { PortfolioDevice, PortfolioVisitSource } from "@rezumi/schema/portfolio/statistics";
import { getCoordination } from "@rezumi/db/coordination";
import { getRedis, redisKey } from "@rezumi/db/redis";
import { PORTFOLIO_DEVICES, PORTFOLIO_STATISTICS_DAYS } from "@rezumi/schema/portfolio/statistics";
import { dayInTimeZone, lastDays, normalizeCountry, startOfDayInTimeZone } from "./traffic";

/**
 * Visitor breakdowns from Cloudflare Workers Analytics Engine (`02-teknis.md` section 9): country, device, referring
 * site and works per day, next to the Postgres daily rows that stay the source of the core numbers. Written only on
 * Workers; everywhere else the adapter is missing and this module does nothing. A data point never holds an IP address,
 * a raw user agent or a visitor ID.
 */

/** Blob positions, also used by the queries: `blob1` is `event`, `blob2` is `workId`, and so on. */
export type PortfolioDataPoint = {
	indexes: [string];
	blobs: [event: string, workId: string, source: string, referrerDomain: string, country: string, device: string];
	doubles: [number];
};

export type PortfolioAnalyticsEvent = {
	portfolioId: string;
	/** "view", a click kind, or "work". */
	event: string;
	workId?: string | undefined;
	source?: PortfolioVisitSource | undefined;
	referrerDomain?: string | undefined;
	device: PortfolioDevice;
};

export function portfolioDataPoint(
	input: PortfolioAnalyticsEvent & { country?: string | null | undefined },
): PortfolioDataPoint {
	return {
		indexes: [input.portfolioId],
		blobs: [
			input.event,
			input.workId ?? "",
			input.source ?? "",
			input.referrerDomain ?? "",
			normalizeCountry(input.country),
			input.device,
		],
		doubles: [1],
	};
}

type AnalyticsDataset = { writeDataPoint: (point: PortfolioDataPoint) => void };
type SqlRequest = { query: string; params: Record<string, string> };
export type AnalyticsSql = { query: (request: SqlRequest) => Promise<{ data: Record<string, unknown>[] }> };
type AnalyticsAdapter = {
	dataset: () => AnalyticsDataset | undefined;
	sql: () => AnalyticsSql | undefined;
	country: () => string | undefined;
};

let adapter: AnalyticsAdapter | undefined;

/** Set once by the Workers entry point, reading the bindings of the running request. */
export function configurePortfolioAnalytics(value: AnalyticsAdapter | undefined): void {
	adapter = value;
}

/** Writes an event, without waiting for it. Never throws: statistics must not break a page. */
export function writePortfolioEvent(input: PortfolioAnalyticsEvent): void {
	const dataset = adapter?.dataset();
	if (!dataset) return;
	try {
		dataset.writeDataPoint(portfolioDataPoint({ ...input, country: adapter?.country() }));
	} catch {
		console.error("[portfolio] Writing an analytics event failed.");
	}
}

export type PortfolioDetailRows = {
	countries: { code: string; views: number }[];
	devices: { device: PortfolioDevice; views: number }[];
	referrers: { domain: string; views: number }[];
	workDays: { date: string; workId: string; opens: number }[];
};

const DATASET = 'events.analyticsEngine."portfolio_events"';

/** A time zone safe to write into a query, which can't take it as a parameter; anything unusual is read as UTC. */
const queryTimeZone = (timeZone: string) => (/^[A-Za-z0-9_+/-]+$/.test(timeZone) ? timeZone : "UTC");

/**
 * The four queries behind a portfolio's breakdown, always limited to that portfolio (`index1`) and the last 30 days.
 * `SUM` applies Analytics Engine's sampling weights by itself. The binding supplies the account, so none is named. Days
 * are the owner's, like the daily counts'.
 */
export function portfolioDetailQueries(portfolioId: string, now: Date, timeZone = "UTC") {
	// From the start of the oldest of the 30 days the daily counts show, in the owner's zone, so both cover one span.
	const [first = dayInTimeZone(now, timeZone)] = lastDays(now, timeZone, PORTFOLIO_STATISTICS_DAYS);
	const params = { portfolio: portfolioId, start: startOfDayInTimeZone(first, timeZone).toISOString() };
	const scope = "index1 = $portfolio AND timestamp >= $start";
	return {
		countries: {
			query: `SELECT blob5 AS code, SUM(double1) AS views FROM ${DATASET} WHERE ${scope} AND blob1 = 'view' AND blob5 != '' GROUP BY blob5 ORDER BY views DESC LIMIT 250`,
			params,
		},
		devices: {
			query: `SELECT blob6 AS device, SUM(double1) AS views FROM ${DATASET} WHERE ${scope} AND blob1 = 'view' GROUP BY blob6 ORDER BY views DESC LIMIT 10`,
			params,
		},
		referrers: {
			query: `SELECT blob4 AS domain, SUM(double1) AS views FROM ${DATASET} WHERE ${scope} AND blob1 = 'view' AND blob4 != '' GROUP BY blob4 ORDER BY views DESC LIMIT 20`,
			params,
		},
		workDays: {
			query: `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY, '${queryTimeZone(timeZone)}') AS day, blob2 AS workId, SUM(double1) AS opens FROM ${DATASET} WHERE ${scope} AND blob1 = 'work' GROUP BY day, blob2 ORDER BY day ASC LIMIT 1500`,
			params,
		},
	};
}

const count = (value: unknown) => Math.max(0, Math.round(Number(value)) || 0);

/** A numeric cell, which ClickHouse may send as text; anything else counts as zero. */
function toRows(rows: Record<string, unknown>[], key: string): { value: string; total: number }[] {
	return rows.map((row) => ({ value: String(row[key] ?? ""), total: count(row.views) }));
}

/**
 * The date of a day bucket: midnight in the owner's zone reads as that date, and an instant written in UTC is converted.
 * The documentation doesn't say which of the two the service answers with, so either is read correctly.
 */
function bucketDay(value: unknown, timeZone: string): string {
	const text = String(value ?? "");
	const [date = "", time = ""] = text.replace("Z", "").split(/[ T]/);
	if (/^00:00(:00)?/.test(time) || !time) return date;
	const instant = new Date(`${date}T${time}Z`);
	return Number.isNaN(instant.getTime()) ? date : dayInTimeZone(instant, timeZone);
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MEMORY_CACHE_LIMIT = 500;
const memoryCache = new Map<string, { value: string; expires: number }>();
// The zone is part of the key: days bucketed in an old zone shouldn't outlive the owner moving.
const cacheKey = (portfolioId: string, timeZone: string) =>
	redisKey("portfolio-details", "v2", portfolioId, queryTimeZone(timeZone));

async function readCache(key: string, now: number): Promise<string | null> {
	try {
		const redis = getRedis();
		if (redis) return await redis.get(key);
		const coordination = getCoordination();
		if (coordination) return await coordination.get(key);
	} catch {
		return null;
	}
	const hit = memoryCache.get(key);
	if (hit && hit.expires > now) return hit.value;
	memoryCache.delete(key);
	return null;
}

async function writeCache(key: string, value: string, now: number): Promise<void> {
	try {
		const redis = getRedis();
		if (redis) {
			await redis.set(key, value, "PX", CACHE_TTL_MS);
			return;
		}
		const coordination = getCoordination();
		if (coordination) {
			await coordination.set(key, value, CACHE_TTL_MS);
			return;
		}
	} catch {
		return;
	}
	if (memoryCache.size >= MEMORY_CACHE_LIMIT) memoryCache.clear();
	memoryCache.set(key, { value, expires: now + CACHE_TTL_MS });
}

function parseRows(value: string): PortfolioDetailRows | null {
	try {
		return JSON.parse(value) as PortfolioDetailRows;
	} catch {
		return null;
	}
}

/**
 * A portfolio's breakdown, cached for a few minutes; `not-configured` when Analytics Engine isn't bound here, and
 * `unavailable` when reading it failed.
 */
export async function readPortfolioDetails(
	portfolioId: string,
	timeZone = "UTC",
	now = new Date(),
): Promise<PortfolioDetailRows | "not-configured" | "unavailable"> {
	const sql = adapter?.sql();
	if (!sql) return "not-configured";
	const key = cacheKey(portfolioId, timeZone);
	const cached = await readCache(key, now.getTime());
	const parsed = cached ? parseRows(cached) : null;
	if (parsed) return parsed;
	const queries = portfolioDetailQueries(portfolioId, now, timeZone);
	try {
		const [countries, devices, referrers, workDays] = await Promise.all([
			sql.query(queries.countries),
			sql.query(queries.devices),
			sql.query(queries.referrers),
			sql.query(queries.workDays),
		]);
		const rows: PortfolioDetailRows = {
			countries: toRows(countries.data, "code")
				.filter(({ value }) => /^[A-Z]{2}$/.test(value))
				.map(({ value, total }) => ({ code: value, views: total })),
			devices: toRows(devices.data, "device").flatMap(({ value, total }) => {
				const device = PORTFOLIO_DEVICES.find((name) => name === value);
				return device ? [{ device, views: total }] : [];
			}),
			referrers: toRows(referrers.data, "domain").map(({ value, total }) => ({ domain: value, views: total })),
			workDays: workDays.data.map((row) => ({
				date: bucketDay(row.day, timeZone),
				workId: String(row.workId ?? ""),
				opens: count(row.opens),
			})),
		};
		await writeCache(key, JSON.stringify(rows), now.getTime());
		return rows;
	} catch {
		console.error("[portfolio] Reading analytics details failed.");
		return "unavailable";
	}
}
