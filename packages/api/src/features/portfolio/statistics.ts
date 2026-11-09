import type { Transaction } from "../billing/account";
import type { DbOrTx } from "@rezumi/db/client";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioClickKind, PortfolioDevice, PortfolioVisitSource } from "@rezumi/schema/portfolio/statistics";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import {
	PORTFOLIO_CLICK_KINDS,
	PORTFOLIO_STATISTICS_DAYS,
	PORTFOLIO_STATISTICS_MAX_WORKS,
	PORTFOLIO_VISIT_SOURCES,
} from "@rezumi/schema/portfolio/statistics";
import { getEntitlements } from "../billing/entitlements";
import { readPortfolioDetails } from "./analytics";
import { lastDays } from "./traffic";

const daily = schema.portfolioStatisticsDaily;
const conflict = { target: [daily.portfolioId, daily.date] };

/** `column` with `key` raised by one. */
const bumped = (column: typeof daily.clicks | typeof daily.works | typeof daily.sources, key: string) =>
	sql`jsonb_set(${column}, array[${key}]::text[], to_jsonb(coalesce((${column}->>${key})::int, 0) + 1))`;

/** One more visit from `source` on `date`. */
export function countVisit(portfolioId: string, date: string, source: PortfolioVisitSource) {
	return db
		.insert(daily)
		.values({ portfolioId, date, views: 1, sources: { [source]: 1 } })
		.onConflictDoUpdate({
			...conflict,
			set: { views: sql`${daily.views} + 1`, sources: bumped(daily.sources, source) },
		});
}

/** One more click of `kind` on `date`. */
export function countClick(portfolioId: string, date: string, kind: PortfolioClickKind) {
	return db
		.insert(daily)
		.values({ portfolioId, date, clicks: { [kind]: 1 } })
		.onConflictDoUpdate({ ...conflict, set: { clicks: bumped(daily.clicks, kind) } });
}

/** One more opening of a work's detail on `date`; a day counts at most `PORTFOLIO_STATISTICS_MAX_WORKS` works. */
export function countWorkOpen(portfolioId: string, date: string, workId: string) {
	return db
		.insert(daily)
		.values({ portfolioId, date, works: { [workId]: 1 } })
		.onConflictDoUpdate({
			...conflict,
			set: {
				works: sql`case when ${daily.works} ? ${workId} or (select count(*) from jsonb_object_keys(${daily.works})) < ${PORTFOLIO_STATISTICS_MAX_WORKS} then ${bumped(daily.works, workId)} else ${daily.works} end`,
			},
		});
}

/** One more message on `date`, in the transaction that stores it. */
export function countMessage(tx: Transaction | DbOrTx, portfolioId: string, date: string) {
	return tx
		.insert(daily)
		.values({ portfolioId, date, messages: 1 })
		.onConflictDoUpdate({ ...conflict, set: { messages: sql`${daily.messages} + 1` } });
}

type Totals<K extends string> = Record<K, number>;
const zeroed = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((key) => [key, 0])) as Totals<K>;

function addTo<K extends string>(totals: Totals<K>, keys: readonly K[], values: Partial<Record<K, number>>) {
	for (const key of keys) totals[key] += values[key] ?? 0;
}

type PortfolioDetails =
	| { state: "locked" }
	| { state: "unavailable" }
	| {
			state: "ready";
			countries: { code: string; views: number }[];
			devices: { device: PortfolioDevice; views: number }[];
			referrers: { domain: string; views: number }[];
			workDays: { date: string; workId: string; title: string; opens: number }[];
	  };

/**
 * The owner's numbers for the last 30 days (`01-desain.md` section 10), in their own time zone. The basic numbers are
 * for every plan; the breakdown from Analytics Engine is for plans with `detailedPortfolioStats` (owner decision #16).
 */
export async function portfolioStatistics(input: {
	portfolio: { id: string; data: PortfolioData };
	userId: string;
	timeZone: string;
	now?: Date;
}) {
	const now = input.now ?? new Date();
	const dates = lastDays(now, input.timeZone, PORTFOLIO_STATISTICS_DAYS);
	const rows = await db
		.select({
			date: daily.date,
			views: daily.views,
			clicks: daily.clicks,
			works: daily.works,
			messages: daily.messages,
			sources: daily.sources,
		})
		.from(daily)
		.where(and(eq(daily.portfolioId, input.portfolio.id), gte(daily.date, dates[0] ?? "")));

	const clicks = zeroed(PORTFOLIO_CLICK_KINDS);
	const sources = zeroed(PORTFOLIO_VISIT_SOURCES);
	const opened = new Map<string, number>();
	let views = 0;
	let messages = 0;
	const viewsByDay = new Map<string, number>();
	for (const row of rows) {
		views += row.views;
		messages += row.messages;
		viewsByDay.set(row.date, row.views);
		addTo(clicks, PORTFOLIO_CLICK_KINDS, row.clicks);
		addTo(sources, PORTFOLIO_VISIT_SOURCES, row.sources);
		for (const [workId, opens] of Object.entries(row.works)) opened.set(workId, (opened.get(workId) ?? 0) + opens);
	}

	const titles = new Map(input.portfolio.data.works.items.map((work) => [work.id, work.title.trim()]));
	const works = [...opened]
		.flatMap(([id, opens]) => (titles.has(id) ? [{ id, title: titles.get(id) ?? "", opens }] : []))
		.sort((a, b) => b.opens - a.opens)
		.slice(0, 10);

	return {
		days: dates.map((date) => ({ date, views: viewsByDay.get(date) ?? 0 })),
		totals: { views, clicks, messages },
		sources,
		works,
		details: await details(input.portfolio.id, input.userId, input.timeZone, titles, now),
	};
}

async function details(
	portfolioId: string,
	userId: string,
	timeZone: string,
	titles: ReadonlyMap<string, string>,
	now: Date,
): Promise<PortfolioDetails> {
	const entitlements = await getEntitlements(userId);
	if (!entitlements.features.detailedPortfolioStats) return { state: "locked" };
	const rows = await readPortfolioDetails(portfolioId, timeZone, now);
	if (!rows) return { state: "unavailable" };
	return {
		state: "ready",
		countries: rows.countries,
		devices: rows.devices,
		referrers: rows.referrers,
		workDays: rows.workDays.flatMap((row) =>
			titles.has(row.workId) ? [{ ...row, title: titles.get(row.workId) ?? "" }] : [],
		),
	};
}
