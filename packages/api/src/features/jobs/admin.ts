import type { JobEventSql } from "./events";
import type { TregAccount } from "./treg-account";
import { and, count, desc, eq, gt, isNotNull, isNull } from "drizzle-orm";
import z from "zod";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { dailyBudgetMicro, spentToday } from "./allowance";
import { jobCounters } from "./counters";
import { jobEventSql } from "./events";
import { isTregConfigured } from "./treg";
import { readTregAccount } from "./treg-account";

/**
 * The admin cost dashboard for job search (`02-teknis.md` sections 12 and 21). Three sources, each shown on its own so
 * one failing never hides the others:
 *
 * - today's spending against the server budget (K7), from the shared counter every search checks;
 * - treg's balance and ledger per feature, the money that actually left the balance;
 * - Analytics Engine `job_search_events` (Workers only): cost, cache hits, latency and errors per provider and tool.
 *
 * Plus a few counts from Postgres: stored listings, cache pages, job alerts that are on, and the night's upkeep.
 */

export const JOB_COST_DAYS = [7, 30] as const;
/** Spending past this share of the day's budget is a warning on the dashboard and an email to the owner. */
const BUDGET_WARN_SHARE = 0.8;

const DATASET = 'events.analyticsEngine."job_search_events"';
const DAY_MS = 24 * 60 * 60 * 1000;

const tregUsageSchema = z.object({ feature: z.string(), chargedMicro: z.number(), calls: z.number() });

const toolRowSchema = z.object({
	provider: z.string(),
	tool: z.string(),
	kind: z.string(),
	calls: z.number(),
	costMicro: z.number(),
	results: z.number(),
	errors: z.number(),
	budget: z.number(),
	/** Mean time of the calls that reached the provider, in milliseconds. */
	avgMs: z.number().nullable(),
	p95Ms: z.number().nullable(),
});
export type JobCostToolRow = z.infer<typeof toolRowSchema>;

export const jobCostReportSchema = z.object({
	days: z.number().int(),
	generatedAt: z.date(),
	today: z.object({
		/** The UTC day the budget counts. */
		day: z.string(),
		spentMicro: z.number(),
		budgetMicro: z.number(),
		warn: z.boolean(),
		/** No treg token on this server: nothing can be searched. */
		available: z.boolean(),
		/** `FLAG_DISABLE_JOB_SEARCH`: only saved results are given. */
		switchedOff: z.boolean(),
	}),
	treg: z.discriminatedUnion("status", [
		z.object({
			status: z.literal("ok"),
			balanceMicro: z.number(),
			usage: z.array(tregUsageSchema),
			totalMicro: z.number(),
			unattributedMicro: z.number(),
		}),
		z.object({ status: z.enum(["not-configured", "unavailable"]) }),
	]),
	events: z.discriminatedUnion("status", [
		z.object({
			status: z.literal("ok"),
			daily: z.array(z.object({ date: z.string(), provider: z.string(), costMicro: z.number(), calls: z.number() })),
			tools: z.array(toolRowSchema),
			search: z.object({
				cacheHits: z.number(),
				stale: z.number(),
				providerCalls: z.number(),
				budget: z.number(),
				/** Pages of results the providers answered, what they cost, and the listings paid for and shown on them. */
				pages: z.number(),
				pageCostMicro: z.number(),
				paidListings: z.number(),
				shownListings: z.number(),
			}),
		}),
		z.object({ status: z.enum(["not-configured", "unavailable"]) }),
	]),
	store: z.object({
		openListings: z.number(),
		closedListings: z.number(),
		cachePages: z.number(),
		freshCachePages: z.number(),
		alertsOn: z.number(),
		upkeep: z
			.object({
				day: z.string(),
				completedAt: z.date().nullable(),
				closed: z.number(),
				nextPage: z.number().nullable(),
			})
			.nullable(),
	}),
});
export type JobCostReport = z.infer<typeof jobCostReportSchema>;

const utcDay = (at: Date) => at.toISOString().slice(0, 10);

/** Midnight UTC at the start of the oldest day shown, so `days` days end with today. */
export function reportStart(now: Date, days: number): string {
	return new Date(Date.parse(`${utcDay(now)}T00:00:00Z`) - (days - 1) * DAY_MS).toISOString();
}

/**
 * The queries behind the event figures. One grouped query carries everything but the 95th percentile, which goes on
 * its own: should the service refuse that function, the rest still shows. `SUM` and `COUNT` apply Analytics Engine's
 * sampling weights by themselves; the binding supplies the account.
 */
export function jobCostQueries(start: string) {
	const params = { start };
	return {
		grouped: {
			query: `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY, 'UTC') AS day, blob1 AS provider, blob2 AS tool, blob3 AS outcome, blob5 AS kind, COUNT(*) AS calls, SUM(double1) AS cost, SUM(double2) AS ms, SUM(double3) AS results, SUM(double4) AS paid FROM ${DATASET} WHERE timestamp >= $start GROUP BY day, blob1, blob2, blob3, blob5 ORDER BY day ASC LIMIT 10000`,
			params,
		},
		p95: {
			query: `SELECT blob1 AS provider, blob2 AS tool, blob5 AS kind, quantileWeighted(0.95, double2, sampleInterval) AS p95 FROM ${DATASET} WHERE timestamp >= $start AND blob3 = 'miss' GROUP BY blob1, blob2, blob5 LIMIT 200`,
			params,
		},
	};
}

const number = (value: unknown) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};
const text = (value: unknown) => String(value ?? "");
/** A day bucket as YYYY-MM-DD, whether the service writes it as a date, a timestamp or an ISO instant. */
const bucketDate = (value: unknown) => text(value).slice(0, 10);

type GroupedRow = Record<string, unknown>;

/** Turns the grouped rows (and the percentiles, when they came) into the dashboard's figures. */
export function summarizeJobEvents(rows: GroupedRow[], p95Rows: GroupedRow[] | null) {
	const daily = new Map<string, { date: string; provider: string; costMicro: number; calls: number }>();
	const tools = new Map<string, JobCostToolRow & { reached: number; totalMs: number }>();
	const search = {
		cacheHits: 0,
		stale: 0,
		providerCalls: 0,
		budget: 0,
		pages: 0,
		pageCostMicro: 0,
		paidListings: 0,
		shownListings: 0,
	};
	for (const row of rows) {
		const provider = text(row.provider);
		const tool = text(row.tool);
		const kind = text(row.kind);
		const outcome = text(row.outcome);
		const calls = Math.round(number(row.calls));
		const costMicro = Math.round(number(row.cost));
		if (kind === "search" && tool === "cache") {
			if (outcome === "hit") search.cacheHits += calls;
			if (outcome === "stale") search.stale += calls;
			continue;
		}
		// A page sums its provider calls, which have their own rows: kept out of the daily and per-tool figures.
		if (kind === "search" && tool === "page") {
			search.pages += calls;
			search.pageCostMicro += costMicro;
			search.shownListings += Math.round(number(row.results));
			search.paidListings += Math.round(number(row.paid));
			continue;
		}
		if (kind === "search" && outcome === "miss" && !tool.endsWith(".count")) search.providerCalls += calls;
		if (kind === "search" && outcome === "budget") search.budget += calls;
		const day = `${bucketDate(row.day)}|${provider}`;
		const point = daily.get(day) ?? { date: bucketDate(row.day), provider, costMicro: 0, calls: 0 };
		point.costMicro += costMicro;
		point.calls += calls;
		daily.set(day, point);
		const key = `${provider}|${tool}|${kind}`;
		const entry = tools.get(key) ?? {
			provider,
			tool,
			kind,
			calls: 0,
			costMicro: 0,
			results: 0,
			errors: 0,
			budget: 0,
			avgMs: null,
			p95Ms: null,
			reached: 0,
			totalMs: 0,
		};
		entry.calls += calls;
		entry.costMicro += costMicro;
		if (outcome === "error") entry.errors += calls;
		if (outcome === "budget") entry.budget += calls;
		if (outcome === "miss") {
			entry.reached += calls;
			entry.totalMs += number(row.ms);
			entry.results += Math.round(number(row.results));
		}
		tools.set(key, entry);
	}
	for (const row of p95Rows ?? []) {
		const entry = tools.get(`${text(row.provider)}|${text(row.tool)}|${text(row.kind)}`);
		if (entry && Number.isFinite(Number(row.p95))) entry.p95Ms = Math.round(Number(row.p95));
	}
	return {
		daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date) || a.provider.localeCompare(b.provider)),
		tools: [...tools.values()]
			.map(({ reached, totalMs, ...entry }) => ({ ...entry, avgMs: reached ? Math.round(totalMs / reached) : null }))
			.sort((a, b) => b.costMicro - a.costMicro || b.calls - a.calls),
		search,
	};
}

async function readEvents(sql: JobEventSql | undefined, start: string): Promise<JobCostReport["events"]> {
	if (!sql) return { status: "not-configured" };
	const queries = jobCostQueries(start);
	try {
		const [grouped, p95] = await Promise.all([
			sql.query(queries.grouped),
			sql.query(queries.p95).catch(() => {
				console.error("[jobs] Reading latency percentiles failed; showing averages only.");
				return null;
			}),
		]);
		return { status: "ok", ...summarizeJobEvents(grouped.data, p95?.data ?? null) };
	} catch {
		console.error("[jobs] Reading job search events failed.");
		return { status: "unavailable" };
	}
}

async function readStore(now: Date): Promise<JobCostReport["store"]> {
	const listing = schema.jobListing;
	const cache = schema.jobSearchCache;
	const schedule = schema.careerSchedule;
	const [[open], [closed], [pages], [fresh], [alerts], [upkeep]] = await Promise.all([
		db.select({ value: count() }).from(listing).where(isNull(listing.closedAt)),
		db.select({ value: count() }).from(listing).where(isNotNull(listing.closedAt)),
		db.select({ value: count() }).from(cache),
		db.select({ value: count() }).from(cache).where(gt(cache.expiresAt, now)),
		db
			.select({ value: count() })
			.from(schedule)
			.where(and(eq(schedule.kind, "discovery"), eq(schedule.enabled, true))),
		db
			.select({
				day: schema.jobMaintenance.day,
				completedAt: schema.jobMaintenance.completedAt,
				closed: schema.jobMaintenance.closed,
				nextPage: schema.jobMaintenance.nextPage,
			})
			.from(schema.jobMaintenance)
			.orderBy(desc(schema.jobMaintenance.day))
			.limit(1),
	]);
	return {
		openListings: open?.value ?? 0,
		closedListings: closed?.value ?? 0,
		cachePages: pages?.value ?? 0,
		freshCachePages: fresh?.value ?? 0,
		alertsOn: alerts?.value ?? 0,
		upkeep: upkeep ?? null,
	};
}

type ReportDependencies = {
	sql?: JobEventSql | undefined;
	treg?: (days: number) => Promise<TregAccount | "not-configured" | "unavailable">;
};

export async function jobCostReport(
	input: { days: (typeof JOB_COST_DAYS)[number]; now?: Date },
	dependencies: ReportDependencies = {},
): Promise<JobCostReport> {
	const now = input.now ?? new Date();
	const sql = "sql" in dependencies ? dependencies.sql : jobEventSql();
	const [spentMicro, treg, events, store] = await Promise.all([
		spentToday(jobCounters, now).catch(() => 0),
		(dependencies.treg ?? readTregAccount)(input.days),
		readEvents(sql, reportStart(now, input.days)),
		readStore(now),
	]);
	const budgetMicro = dailyBudgetMicro();
	return {
		days: input.days,
		generatedAt: now,
		today: {
			day: utcDay(now),
			spentMicro,
			budgetMicro,
			warn: budgetMicro > 0 && spentMicro >= budgetMicro * BUDGET_WARN_SHARE,
			available: isTregConfigured(),
			switchedOff: env.FLAG_DISABLE_JOB_SEARCH,
		},
		treg: typeof treg === "string" ? { status: treg } : { status: "ok", ...treg },
		events,
		store,
	};
}
