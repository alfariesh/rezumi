import type { JobCounters } from "./counters";
import type { TregDependencies } from "./treg";
import type { JobProvider } from "@rezumi/schema/jobs/listing";
import { and, asc, desc, eq, exists, inArray, isNotNull, isNull, lt, ne, notExists, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { budgetLeft, recordSpend } from "./allowance";
import { jobCounters } from "./counters";
import { recordJobEvent } from "./events";
import { JOBSPIPE_PRICE_USD, mapJobspipeJob } from "./providers/jobspipe";
import { COUNT_MAX_COST_USD, isRecord, maxCostUsd, num, str, validListings } from "./providers/shared";
import { upsertListings } from "./store";
import { callTreg, isTregConfigured, TregError } from "./treg";

/**
 * The daily listing upkeep (`02-teknis.md` sections 10 and 19), run from the scheduler tick every minute and doing its
 * work once a UTC day from 19:00 (02:00 in Jakarta):
 *
 * 1. Hirebase's closed-jobs feed (free) marks its closed listings. The feed holds about 100,000 jobs a day, a thousand
 *    a page, so reading it takes several ticks; the run keeps its page in `job_maintenance`.
 * 2. JobsPipe listings someone tracks or has as an open opportunity are looked up by id when unchecked for 3 days.
 * 3. Applications tracked from a listing that closed are marked, and those not yet applied to get a notice, once.
 * 4. Closed listings go (Hirebase's terms ask for that), with the search answers a day past their expiry and listings
 *    nobody saw for 30 days and nothing uses (K3).
 *
 * Each step is safe to run twice. A lease keeps two ticks from running the day at once. New roles nobody saw for 30
 * days are dismissed, so the listings behind them can go too.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAINTENANCE_HOUR_UTC = 19;
/** How far back the closed-jobs feed answers (14 days), less a day of margin. */
const MAX_FEED_DAYS = 13;
const EXPIRED_TOOL = "hirebase.jobs.expired";
const EXPIRED_PAGE_SIZE = 1000;
/** Time one tick spends reading the feed before leaving the rest to the next tick. */
const TICK_BUDGET_MS = 20_000;
/**
 * Longer than one tick can take (the feed's time, its last call, the JobsPipe lookups and the deletes); a tick only
 * releases a lease it still holds.
 */
const LEASE_MS = 10 * 60_000;
const DETAIL_TOOL = "jobspipe.jobs.detail";
const JOBSPIPE_RECHECK_MS = 3 * DAY_MS;
/** Ids per lookup: treg holds the price of every id asked for until the call ends. */
const JOBSPIPE_BATCH = 25;
const JOBSPIPE_MAX_PER_RUN = 200;
/** Search answers go a day after they expire: until then a provider outage can still serve them as stale. */
const CACHE_GRACE_MS = DAY_MS;
/** Listings nobody's search returned for this long go, unless something uses them (K3). */
const UNUSED_LISTING_MS = 30 * DAY_MS;
const DELETE_BATCH = 2_000;
const DELETE_ROUNDS = 10;

export type JobMaintenanceOptions = {
	now?: Date;
	treg?: TregDependencies;
	counters?: JobCounters;
	configured?: () => boolean;
	/** Milliseconds since some fixed point, for the tick's time budget. */
	clock?: () => number;
	tickBudgetMs?: number;
};

export type JobMaintenanceResult = {
	/** Whether this tick worked on the day's run. */
	ran: boolean;
	completed: boolean;
	/** Listings the closed-jobs feed marked in this tick. */
	closed: number;
	/** JobsPipe listings looked up. */
	checked: number;
	/** Applications marked closed. */
	marked: number;
	removed: { closedListings: number; searches: number; unusedListings: number };
};

const utcDay = (date: Date) => date.toISOString().slice(0, 10);

const idle = (ran: boolean): JobMaintenanceResult => ({
	ran,
	completed: false,
	closed: 0,
	checked: 0,
	marked: 0,
	removed: { closedListings: 0, searches: 0, unusedListings: 0 },
});

/** Where today's feed starts: the day of the last finished run (the feed answers whole days), else yesterday. */
async function feedSince(now: Date): Promise<string> {
	const [last] = await db
		.select({ day: schema.jobMaintenance.day })
		.from(schema.jobMaintenance)
		.where(isNotNull(schema.jobMaintenance.completedAt))
		.orderBy(desc(schema.jobMaintenance.day))
		.limit(1);
	const earliest = utcDay(new Date(now.getTime() - MAX_FEED_DAYS * DAY_MS));
	const since = last?.day ?? utcDay(new Date(now.getTime() - DAY_MS));
	return since < earliest ? earliest : since;
}

/** Today's run, leased to this tick; undefined when it is done or another tick holds it. */
async function claimRun(now: Date) {
	const day = utcDay(now);
	const [existing] = await db
		.select({ day: schema.jobMaintenance.day })
		.from(schema.jobMaintenance)
		.where(eq(schema.jobMaintenance.day, day));
	if (!existing)
		await db
			.insert(schema.jobMaintenance)
			.values({ day, since: await feedSince(now), startedAt: now })
			.onConflictDoNothing();
	const [run] = await db
		.update(schema.jobMaintenance)
		.set({ leaseUntil: new Date(now.getTime() + LEASE_MS) })
		.where(
			and(
				eq(schema.jobMaintenance.day, day),
				isNull(schema.jobMaintenance.completedAt),
				or(isNull(schema.jobMaintenance.leaseUntil), lt(schema.jobMaintenance.leaseUntil, now)),
			),
		)
		.returning();
	return run;
}

/** Marks these provider jobs closed; answers how many open listings that closed. */
async function closeListings(provider: JobProvider, externalIds: string[], now: Date): Promise<number> {
	if (externalIds.length === 0) return 0;
	const rows = await db
		.update(schema.jobListing)
		.set({ closedAt: now })
		.where(
			and(
				eq(schema.jobListing.provider, provider),
				inArray(schema.jobListing.externalId, externalIds),
				isNull(schema.jobListing.closedAt),
			),
		)
		.returning({ id: schema.jobListing.id });
	return rows.length;
}

type FeedAnswer = { jobs?: unknown; total_pages?: unknown };

/**
 * Reads Hirebase's closed-jobs feed from the run's page until it ends or the tick's time is up, saving the page after
 * each one. Answers where to go on (null at the end). A busy or failing feed stops here and is tried again next tick;
 * a refused request (a bad `since`) ends the feed for the day, since asking again can't help. `closed` counts the
 * listings this tick marked.
 */
async function readClosedFeed(
	run: { day: string; since: string; nextPage: number },
	now: Date,
	deadline: number,
	options: Required<Pick<JobMaintenanceOptions, "clock">> & JobMaintenanceOptions,
): Promise<{ nextPage: number | null; closed: number }> {
	let page: number | null = run.nextPage;
	let total = 0;
	while (page !== null && options.clock() < deadline) {
		let answer: Awaited<ReturnType<typeof callTreg<FeedAnswer>>>;
		try {
			answer = await callTreg<FeedAnswer>(
				{
					tool: EXPIRED_TOOL,
					query: { since: run.since, page, limit: EXPIRED_PAGE_SIZE },
					maxCostUsd: COUNT_MAX_COST_USD,
					fresh: true,
					feature: "jobs-maintenance",
					signal: AbortSignal.timeout(20_000),
				},
				options.treg,
			);
		} catch (error) {
			recordJobEvent({
				provider: "hirebase",
				tool: EXPIRED_TOOL,
				outcome: "error",
				kind: "maintenance",
				costMicro: 0,
				ms: 0,
				resultCount: 0,
			});
			if (error instanceof TregError && error.code === "rejected") {
				console.error(`[jobs] Hirebase refused the closed-jobs feed (${error.status ?? "?"}); skipped today.`);
				page = null;
				break;
			}
			console.warn("[jobs] Reading the closed-jobs feed failed; the next tick goes on from the same page.");
			break;
		}
		const jobs = Array.isArray(answer.data.jobs) ? answer.data.jobs.filter(isRecord) : [];
		const ids = jobs.flatMap((job) => str(job._id, 64) ?? []);
		const closed = await closeListings("hirebase", ids, now);
		total += closed;
		recordJobEvent({
			provider: "hirebase",
			tool: EXPIRED_TOOL,
			outcome: "miss",
			kind: "maintenance",
			costMicro: answer.costMicro,
			ms: answer.ms,
			resultCount: ids.length,
		});
		const totalPages = num(answer.data.total_pages);
		page = jobs.length < EXPIRED_PAGE_SIZE || (totalPages !== undefined && page >= totalPages) ? null : page + 1;
		await db
			.update(schema.jobMaintenance)
			.set({ nextPage: page, closed: sql`${schema.jobMaintenance.closed} + ${closed}` })
			.where(eq(schema.jobMaintenance.day, run.day));
	}
	return { nextPage: page, closed: total };
}

/** A listing someone uses: tracked as an application still going, or an opportunity they haven't dismissed. */
const listingInUse = () =>
	or(
		exists(
			db
				.select({ one: sql`1` })
				.from(schema.application)
				.where(and(eq(schema.application.jobListingId, schema.jobListing.id), ne(schema.application.status, "closed"))),
		),
		exists(
			db
				.select({ one: sql`1` })
				.from(schema.careerOpportunity)
				.where(
					and(
						eq(schema.careerOpportunity.listingId, schema.jobListing.id),
						isNull(schema.careerOpportunity.dismissedAt),
					),
				),
		),
	);

type DetailAnswer = { data?: unknown };

/**
 * Looks up JobsPipe listings people use and haven't had checked for three days (`jobspipe.jobs.detail`, open or
 * closed). A job already pulled this month costs nothing; others are paid like a search result, from the same daily
 * budget (K7). Ids JobsPipe no longer knows stay open and are asked about again in three days.
 */
async function checkJobspipeListings(now: Date, options: JobMaintenanceOptions): Promise<number> {
	const counters = options.counters ?? jobCounters;
	const due = await db
		.select({ externalId: schema.jobListing.externalId })
		.from(schema.jobListing)
		.where(
			and(
				eq(schema.jobListing.provider, "jobspipe"),
				isNull(schema.jobListing.closedAt),
				lt(schema.jobListing.lastVerifiedAt, new Date(now.getTime() - JOBSPIPE_RECHECK_MS)),
				listingInUse(),
			),
		)
		.orderBy(asc(schema.jobListing.lastVerifiedAt))
		.limit(JOBSPIPE_MAX_PER_RUN);
	let checked = 0;
	for (let start = 0; start < due.length; start += JOBSPIPE_BATCH) {
		if (!(await budgetLeft(counters, now))) break;
		const ids = due.slice(start, start + JOBSPIPE_BATCH).map((row) => row.externalId);
		try {
			const answer = await callTreg<DetailAnswer>(
				{
					tool: DETAIL_TOOL,
					method: "POST",
					body: { job_id_or: ids, status: "any", limit: ids.length },
					maxCostUsd: maxCostUsd(ids.length, JOBSPIPE_PRICE_USD),
					fresh: true,
					feature: "jobs-maintenance",
					signal: AbortSignal.timeout(20_000),
				},
				options.treg,
			);
			await recordSpend(counters, answer.costMicro, now);
			const jobs = Array.isArray(answer.data.data) ? answer.data.data.filter(isRecord) : [];
			const { listings } = validListings(jobs.map(mapJobspipeJob));
			await upsertListings(listings, now);
			// Ids JobsPipe didn't answer wait their turn again, so they can't hold the front of the queue every day.
			await db
				.update(schema.jobListing)
				.set({ lastVerifiedAt: now })
				.where(and(eq(schema.jobListing.provider, "jobspipe"), inArray(schema.jobListing.externalId, ids)));
			checked += listings.length;
			recordJobEvent({
				provider: "jobspipe",
				tool: DETAIL_TOOL,
				outcome: "miss",
				kind: "maintenance",
				costMicro: answer.costMicro,
				ms: answer.ms,
				resultCount: listings.length,
			});
		} catch (error) {
			const budget = error instanceof TregError && error.code === "budget";
			recordJobEvent({
				provider: "jobspipe",
				tool: DETAIL_TOOL,
				outcome: budget ? "budget" : "error",
				kind: "maintenance",
				costMicro: 0,
				ms: 0,
				resultCount: 0,
			});
			console.warn("[jobs] Checking JobsPipe listings failed; they are checked again tomorrow.");
			break;
		}
	}
	return checked;
}

const workspaceUrl = (applicationId: string) => `/dashboard/applications/${encodeURIComponent(applicationId)}`;

/**
 * Marks applications whose tracked listing closed, keeping the date after the listing goes. Those still Saved (not
 * applied to yet) get a notice, once per application; after applying, a closed posting is normal and says nothing new.
 */
function markClosedApplications(): Promise<number> {
	return db.transaction(async (tx) => {
		const marked = await tx
			.update(schema.application)
			.set({
				postingClosedAt: sql`${schema.jobListing.closedAt}`,
				// Status, not content: AI work written for the application stays current.
				updatedAt: sql`${schema.application.updatedAt}`,
			})
			.from(schema.jobListing)
			.where(
				and(
					eq(schema.application.jobListingId, schema.jobListing.id),
					isNotNull(schema.jobListing.closedAt),
					isNull(schema.application.postingClosedAt),
				),
			)
			.returning({
				id: schema.application.id,
				userId: schema.application.userId,
				company: schema.application.company,
				role: schema.application.role,
				status: schema.application.status,
			});
		const saved = marked.filter((row) => row.status === "saved");
		if (saved.length > 0)
			await tx
				.insert(schema.careerNotification)
				.values(
					saved.map((row) => ({
						userId: row.userId,
						applicationId: row.id,
						key: `posting-closed:${row.id}`,
						notice: { type: "posting-closed" as const, company: row.company, role: row.role },
						url: workspaceUrl(row.id),
					})),
				)
				.onConflictDoNothing();
		return marked.length;
	});
}

/** Deletes rows matching `where` in batches; answers how many went. */
async function deleteListingsWhere(where: ReturnType<typeof and>): Promise<number> {
	let removed = 0;
	for (let round = 0; round < DELETE_ROUNDS; round++) {
		const batch = db.select({ id: schema.jobListing.id }).from(schema.jobListing).where(where).limit(DELETE_BATCH);
		const rows = await db
			.delete(schema.jobListing)
			.where(inArray(schema.jobListing.id, batch))
			.returning({ id: schema.jobListing.id });
		removed += rows.length;
		if (rows.length < DELETE_BATCH) break;
	}
	return removed;
}

/**
 * Removes what the providers' terms and K3 say not to keep: closed listings (their opportunities are dismissed first,
 * so they don't come back without the listing), search answers a day past their expiry, and listings no search has
 * returned for 30 days that nothing uses. New roles no alert found again for 30 days are dismissed first. Applications keep their own copy of the posting.
 */
async function removeOldListings(now: Date): Promise<JobMaintenanceResult["removed"]> {
	// A listing that closed after its applications were marked waits for the next run, so they get marked first.
	const closed = and(
		isNotNull(schema.jobListing.closedAt),
		notExists(
			db
				.select({ one: sql`1` })
				.from(schema.application)
				.where(
					and(eq(schema.application.jobListingId, schema.jobListing.id), isNull(schema.application.postingClosedAt)),
				),
		),
	);
	const closedIds = db.select({ id: schema.jobListing.id }).from(schema.jobListing).where(closed);
	await db
		.update(schema.careerOpportunity)
		.set({ dismissedAt: now, updatedAt: sql`${schema.careerOpportunity.updatedAt}` })
		.where(
			and(
				isNull(schema.careerOpportunity.dismissedAt),
				or(
					inArray(schema.careerOpportunity.listingId, closedIds),
					lt(schema.careerOpportunity.lastSeenAt, new Date(now.getTime() - UNUSED_LISTING_MS)),
				),
			),
		);
	const closedListings = await deleteListingsWhere(closed);
	const searches = (
		await db
			.delete(schema.jobSearchCache)
			.where(lt(schema.jobSearchCache.expiresAt, new Date(now.getTime() - CACHE_GRACE_MS)))
			.returning({ key: schema.jobSearchCache.key })
	).length;
	const unusedListings = await deleteListingsWhere(
		and(lt(schema.jobListing.lastSeenAt, new Date(now.getTime() - UNUSED_LISTING_MS)), sql`not ${listingInUse()}`),
	);
	return { closedListings, searches, unusedListings };
}

/**
 * One scheduler tick's share of the daily upkeep. Before 19:00 UTC, once the day's run is done, or while another tick
 * holds it, it does nothing. Without a treg token the provider steps are skipped and the rest still runs.
 */
export async function runJobListingJobs(options: JobMaintenanceOptions = {}): Promise<JobMaintenanceResult> {
	const now = options.now ?? new Date();
	if (now.getUTCHours() < MAINTENANCE_HOUR_UTC) return idle(false);
	const run = await claimRun(now);
	if (!run) return idle(false);
	const clock = options.clock ?? Date.now;
	const configured = (options.configured ?? isTregConfigured)();
	const result = idle(true);
	try {
		let nextPage = run.nextPage;
		if (nextPage !== null && !configured) nextPage = null;
		else if (nextPage !== null) {
			const feed = await readClosedFeed(
				{ day: run.day, since: run.since, nextPage },
				now,
				clock() + (options.tickBudgetMs ?? TICK_BUDGET_MS),
				{ ...options, clock },
			);
			nextPage = feed.nextPage;
			result.closed = feed.closed;
		}
		if (nextPage !== null) return result;
		if (configured) result.checked = await checkJobspipeListings(now, options);
		result.marked = await markClosedApplications();
		result.removed = await removeOldListings(now);
		await db
			.update(schema.jobMaintenance)
			.set({ nextPage: null, completedAt: new Date() })
			.where(eq(schema.jobMaintenance.day, run.day));
		result.completed = true;
		console.info(`[jobs] Daily listing upkeep done: ${JSON.stringify({ ...result, day: run.day })}`);
		return result;
	} finally {
		// Only this tick's lease: one that ran out may already belong to another tick.
		if (run.leaseUntil)
			await db
				.update(schema.jobMaintenance)
				.set({ leaseUntil: null })
				.where(and(eq(schema.jobMaintenance.day, run.day), eq(schema.jobMaintenance.leaseUntil, run.leaseUntil)))
				.catch(() => undefined);
	}
}
