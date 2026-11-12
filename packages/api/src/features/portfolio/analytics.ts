import type { PortfolioClickKind, PortfolioDevice, PortfolioWorkSource } from "@rezumi/schema/portfolio/statistics";
import { getCoordination } from "@rezumi/db/coordination";
import { getRedis, redisKey } from "@rezumi/db/redis";
import {
	PORTFOLIO_CLICK_KINDS,
	PORTFOLIO_DEVICES,
	PORTFOLIO_STATISTICS_DAYS,
	PORTFOLIO_STATISTICS_MAX_WORKS,
	PORTFOLIO_WORK_SOURCES,
} from "@rezumi/schema/portfolio/statistics";
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
	/** "view", a click kind, or "work" (a work's page opened). */
	event: string;
	/** The work a work's page visit, or a click on a work's page, belongs to. */
	workId?: string | undefined;
	/** Where a visit came from; a work's page also has `portfolio` (from the portfolio itself). */
	source?: PortfolioWorkSource | undefined;
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
 * The queries behind a breakdown, always limited to one portfolio (`index1`) and the span of days the daily counts show
 * (from the start of its oldest day in the owner's zone, so both cover one span). For the whole portfolio: countries,
 * devices and referrers of visits, and works opened per day. For one work (`workId`, Phase 13 B9): where its page's
 * visits came from (`blob3`, `portfolio` included), referrers, countries, devices, and the clicks on its page. `SUM`
 * applies Analytics Engine's sampling weights by itself; the binding supplies the account, so none is named.
 */
function detailSpan(now: Date, timeZone: string, days: number) {
	const [first = dayInTimeZone(now, timeZone)] = lastDays(now, timeZone, days);
	return {
		start: startOfDayInTimeZone(first, timeZone).toISOString(),
		where: "index1 = $portfolio AND timestamp >= $start",
	};
}

/** The queries of one work page's breakdown (`portfolioDetailQueries` with a work). */
export function portfolioWorkDetailQueries(
	portfolioId: string,
	workId: string,
	now: Date,
	timeZone = "UTC",
	days: number = PORTFOLIO_STATISTICS_DAYS,
) {
	const { start, where } = detailSpan(now, timeZone, days);
	const params = { portfolio: portfolioId, start, work: workId };
	const visits = `${where} AND blob1 = 'work' AND blob2 = $work`;
	return {
		sources: {
			query: `SELECT blob3 AS source, SUM(double1) AS views FROM ${DATASET} WHERE ${visits} GROUP BY blob3 ORDER BY views DESC LIMIT 20`,
			params,
		},
		referrers: {
			query: `SELECT blob4 AS domain, SUM(double1) AS views FROM ${DATASET} WHERE ${visits} AND blob4 != '' GROUP BY blob4 ORDER BY views DESC LIMIT 20`,
			params,
		},
		countries: {
			query: `SELECT blob5 AS code, SUM(double1) AS views FROM ${DATASET} WHERE ${visits} AND blob5 != '' GROUP BY blob5 ORDER BY views DESC LIMIT 250`,
			params,
		},
		devices: {
			query: `SELECT blob6 AS device, SUM(double1) AS views FROM ${DATASET} WHERE ${visits} GROUP BY blob6 ORDER BY views DESC LIMIT 10`,
			params,
		},
		clicks: {
			query: `SELECT blob1 AS kind, SUM(double1) AS views FROM ${DATASET} WHERE ${where} AND blob1 NOT IN ('view', 'work') AND blob2 = $work GROUP BY blob1 ORDER BY views DESC LIMIT 20`,
			params,
		},
	};
}

export function portfolioDetailQueries(
	portfolioId: string,
	now: Date,
	timeZone = "UTC",
	days: number = PORTFOLIO_STATISTICS_DAYS,
) {
	const { start, where } = detailSpan(now, timeZone, days);
	const params = { portfolio: portfolioId, start };
	return {
		countries: {
			query: `SELECT blob5 AS code, SUM(double1) AS views FROM ${DATASET} WHERE ${where} AND blob1 = 'view' AND blob5 != '' GROUP BY blob5 ORDER BY views DESC LIMIT 250`,
			params,
		},
		devices: {
			query: `SELECT blob6 AS device, SUM(double1) AS views FROM ${DATASET} WHERE ${where} AND blob1 = 'view' GROUP BY blob6 ORDER BY views DESC LIMIT 10`,
			params,
		},
		referrers: {
			query: `SELECT blob4 AS domain, SUM(double1) AS views FROM ${DATASET} WHERE ${where} AND blob1 = 'view' AND blob4 != '' GROUP BY blob4 ORDER BY views DESC LIMIT 20`,
			params,
		},
		workDays: {
			query: `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY, '${queryTimeZone(timeZone)}') AS day, blob2 AS workId, SUM(double1) AS opens FROM ${DATASET} WHERE ${where} AND blob1 = 'work' GROUP BY day, blob2 ORDER BY day ASC LIMIT ${Math.max(1500, days * PORTFOLIO_STATISTICS_MAX_WORKS)}`,
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
const cacheKey = (portfolioId: string, timeZone: string, days: number, workId: string | undefined) =>
	redisKey("portfolio-details", "v3", portfolioId, queryTimeZone(timeZone), String(days), workId ?? "all");

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

const countries = (rows: Record<string, unknown>[]) =>
	toRows(rows, "code")
		.filter(({ value }) => /^[A-Z]{2}$/.test(value))
		.map(({ value, total }) => ({ code: value, views: total }));
const devices = (rows: Record<string, unknown>[]) =>
	toRows(rows, "device").flatMap(({ value, total }) => {
		const device = PORTFOLIO_DEVICES.find((name) => name === value);
		return device ? [{ device, views: total }] : [];
	});
const referrers = (rows: Record<string, unknown>[]) =>
	toRows(rows, "domain").map(({ value, total }) => ({ domain: value, views: total }));

/** Reads through the cache: a breakdown is kept for a few minutes per portfolio, zone, span and work. */
async function cachedDetails<T>(key: string, now: Date, read: (sql: AnalyticsSql) => Promise<T>) {
	const sql = adapter?.sql();
	if (!sql) return "not-configured" as const;
	const cached = await readCache(key, now.getTime());
	if (cached) {
		try {
			return JSON.parse(cached) as T;
		} catch {
			// A broken entry is read again below.
		}
	}
	try {
		const rows = await read(sql);
		await writeCache(key, JSON.stringify(rows), now.getTime());
		return rows;
	} catch {
		console.error("[portfolio] Reading analytics details failed.");
		return "unavailable" as const;
	}
}

/**
 * A portfolio's breakdown for the last `days` days, cached for a few minutes; `not-configured` when Analytics Engine
 * isn't bound here, and `unavailable` when reading it failed.
 */
export function readPortfolioDetails(
	portfolioId: string,
	timeZone = "UTC",
	now = new Date(),
	days: number = PORTFOLIO_STATISTICS_DAYS,
): Promise<PortfolioDetailRows | "not-configured" | "unavailable"> {
	return cachedDetails(cacheKey(portfolioId, timeZone, days, undefined), now, async (sql) => {
		const queries = portfolioDetailQueries(portfolioId, now, timeZone, days);
		const [countryRows, deviceRows, referrerRows, workDays] = await Promise.all([
			sql.query(queries.countries),
			sql.query(queries.devices),
			sql.query(queries.referrers),
			sql.query(queries.workDays),
		]);
		return {
			countries: countries(countryRows.data),
			devices: devices(deviceRows.data),
			referrers: referrers(referrerRows.data),
			workDays: workDays.data.map((row) => ({
				date: bucketDay(row.day, timeZone),
				workId: String(row.workId ?? ""),
				opens: count(row.opens),
			})),
		} satisfies PortfolioDetailRows;
	});
}

export type PortfolioWorkDetailRows = {
	sources: { source: PortfolioWorkSource; views: number }[];
	referrers: { domain: string; views: number }[];
	countries: { code: string; views: number }[];
	devices: { device: PortfolioDevice; views: number }[];
	clicks: Partial<Record<PortfolioClickKind, number>>;
};

/** One work page's breakdown for the last `days` days (Phase 13, B9), cached like the portfolio's. */
export function readPortfolioWorkDetails(
	portfolioId: string,
	workId: string,
	timeZone = "UTC",
	now = new Date(),
	days: number = PORTFOLIO_STATISTICS_DAYS,
): Promise<PortfolioWorkDetailRows | "not-configured" | "unavailable"> {
	return cachedDetails(cacheKey(portfolioId, timeZone, days, workId), now, async (sql) => {
		const queries = portfolioWorkDetailQueries(portfolioId, workId, now, timeZone, days);
		const [sourceRows, referrerRows, countryRows, deviceRows, clickRows] = await Promise.all([
			sql.query(queries.sources),
			sql.query(queries.referrers),
			sql.query(queries.countries),
			sql.query(queries.devices),
			sql.query(queries.clicks),
		]);
		const clicks: Partial<Record<PortfolioClickKind, number>> = {};
		for (const { value, total } of toRows(clickRows.data, "kind")) {
			const kind = PORTFOLIO_CLICK_KINDS.find((name) => name === value);
			if (kind) clicks[kind] = total;
		}
		return {
			sources: toRows(sourceRows.data, "source").flatMap(({ value, total }) => {
				const source = PORTFOLIO_WORK_SOURCES.find((name) => name === value);
				return source ? [{ source, views: total }] : [];
			}),
			referrers: referrers(referrerRows.data),
			countries: countries(countryRows.data),
			devices: devices(deviceRows.data),
			clicks,
		} satisfies PortfolioWorkDetailRows;
	});
}
