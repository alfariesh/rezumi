import type { CachedSearch } from "./cache";
import type { JobCounters } from "./counters";
import type { JobSourceAdapter } from "./providers";
import type { ProviderCursors } from "./routing";
import type { NormalizedJobSearch } from "./search-key";
import type { JobListing, JobProvider } from "@rezumi/schema/jobs/listing";
import type {
	JobListingCard,
	JobSearchInput,
	JobSearchRequest,
	JobSearchResult,
	JobSearchStatus,
} from "@rezumi/schema/jobs/search";
import { env } from "@rezumi/env/server";
import { jobSearchLimitReached } from "../billing/limits";
import {
	budgetLeft,
	countSearch,
	jobSearchBurstAllowed,
	pageSeenToday,
	quotaDay,
	quotaUsed,
	recordSpend,
} from "./allowance";
import {
	hiddenListingIds,
	listingsByIds,
	readCachedSearch,
	readListing,
	setListingHidden,
	writeCachedSearch,
} from "./cache";
import { jobCounters } from "./counters";
import { recordJobEvent } from "./events";
import { duplicateKey } from "./filters";
import { JOB_SOURCES } from "./providers";
import { hasMorePages, routeSearch, SEARCH_PROVIDERS } from "./routing";
import { jobSearchKey, normalizeJobSearch, stableJson } from "./search-key";
import { upsertListings } from "./store";
import { isTregConfigured, TregError } from "./treg";

/**
 * Job search (`02-teknis.md` section 7): burst limit, the plan's daily searches, the shared cache, one provider call
 * per search at a time (single-flight), the server budget, the provider router, storing listings and answering. A
 * person's hidden and closed listings never show. Cached and live answers look the same apart from their flags.
 */

/** How long a request waits for another one that is already asking the providers the same thing. */
const SINGLE_FLIGHT_WAIT_MS = 8_000;
const SINGLE_FLIGHT_POLL_MS = 300;
/** The lock's life: longer than a provider call with its retries (treg client: 15 s, retries within 10 s). */
const SINGLE_FLIGHT_LOCK_MS = 30_000;

/**
 * `unavailable`: this server can't search (no treg token, searching switched off, or the providers failed without a
 * saved answer). `budget`: today's budget is spent and nothing is saved for this search. `rate-limit`: too many
 * searches in a minute. `cursor`: "load more" from a page that no longer exists or belongs to another search.
 */
export type JobSearchErrorCode = "unavailable" | "budget" | "rate-limit" | "cursor";

export class JobSearchError extends Error {
	readonly code: JobSearchErrorCode;
	constructor(code: JobSearchErrorCode) {
		super(`Job search failed: ${code}`);
		this.name = "JobSearchError";
		this.code = code;
	}
}

export type JobSearchDependencies = {
	sources: Record<JobProvider, JobSourceAdapter>;
	counters: JobCounters;
	now: () => Date;
	wait: (ms: number) => Promise<void>;
	/** Whether a treg token is set. */
	configured: () => boolean;
	/** `FLAG_DISABLE_JOB_SEARCH`: only saved answers. */
	switchedOff: () => boolean;
};

type Answer = {
	entry: CachedSearch;
	fromCache: boolean;
	stale: boolean;
	budgetLimited: boolean;
};

const toCard = ({ description: _description, ...card }: JobListing): JobListingCard => card;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createJobSearchService(overrides: Partial<JobSearchDependencies> = {}) {
	const deps: JobSearchDependencies = {
		sources: JOB_SOURCES,
		counters: jobCounters,
		now: () => new Date(),
		wait: delay,
		configured: () => isTregConfigured(),
		switchedOff: () => Boolean(env.FLAG_DISABLE_JOB_SEARCH),
		...overrides,
	};

	const cacheEvent = (input: JobSearchInput, entry: CachedSearch, outcome: "hit" | "stale", started: number) =>
		recordJobEvent({
			provider: entry.providers[0] ?? "hirebase",
			tool: "cache",
			outcome,
			countryCode: input.country,
			kind: "search",
			costMicro: 0,
			ms: deps.now().getTime() - started,
			resultCount: entry.listingIds.length,
		});

	/** Waits for another request that holds the lock to save its answer; undefined when it doesn't in time. */
	async function waitForAnswer(key: string, before: Date | undefined, signal: AbortSignal | undefined) {
		const deadline = deps.now().getTime() + SINGLE_FLIGHT_WAIT_MS;
		while (deps.now().getTime() < deadline) {
			await deps.wait(SINGLE_FLIGHT_POLL_MS);
			signal?.throwIfAborted();
			const filled = await readCachedSearch(key);
			if (filled && (!before || filled.fetchedAt > before)) return filled;
		}
		return undefined;
	}

	async function answerPage(
		key: string,
		input: JobSearchInput,
		search: NormalizedJobSearch,
		after: ProviderCursors | undefined,
		seen: Set<string> | undefined,
		signal: AbortSignal | undefined,
	): Promise<Answer> {
		const started = deps.now().getTime();
		const cached = await readCachedSearch(key);
		if (cached && cached.expiresAt > deps.now()) {
			cacheEvent(input, cached, "hit", started);
			return { entry: cached, fromCache: true, stale: false, budgetLimited: false };
		}

		const stale = (budgetLimited: boolean, error: JobSearchErrorCode): Answer => {
			if (!cached) throw new JobSearchError(error);
			cacheEvent(input, cached, "stale", started);
			return { entry: cached, fromCache: true, stale: true, budgetLimited };
		};
		if (deps.switchedOff()) return stale(false, "unavailable");
		if (!(await budgetLeft(deps.counters, deps.now()))) {
			recordJobEvent({
				provider: "hirebase",
				tool: "budget",
				outcome: "budget",
				countryCode: input.country,
				kind: "search",
				costMicro: 0,
				ms: 0,
				resultCount: 0,
			});
			return stale(true, "budget");
		}

		// Single-flight: one request asks the providers; the others wait for its answer instead of paying again.
		const lock = await deps.counters.add(`lock:${key}`, 1, { window: SINGLE_FLIGHT_LOCK_MS, max: 1 });
		if (!lock.allowed) {
			const filled = await waitForAnswer(key, cached?.fetchedAt, signal);
			if (filled) {
				cacheEvent(input, filled, "hit", started);
				return { entry: filled, fromCache: true, stale: false, budgetLimited: false };
			}
		}

		let page: Awaited<ReturnType<typeof routeSearch>>;
		try {
			page = await routeSearch(input, after, deps.sources, { signal, kind: "search", ...(seen ? { seen } : {}) });
		} catch (error) {
			signal?.throwIfAborted();
			const spent = error instanceof TregError && error.code === "budget";
			if (!(error instanceof TregError)) console.error("[jobs] Job search failed", error);
			return stale(spent, spent ? "budget" : "unavailable");
		}

		const fetchedAt = deps.now();
		await recordSpend(deps.counters, page.costMicro, fetchedAt);
		const stored = await upsertListings(page.returned, fetchedAt);
		const ids = new Map(stored.map((listing) => [`${listing.provider}:${listing.externalId}`, listing.id]));
		const listingIds = page.listings.flatMap((listing) => ids.get(`${listing.provider}:${listing.externalId}`) ?? []);
		const entry = await writeCachedSearch({
			key,
			providers: page.providers,
			listingIds,
			cursors: page.cursors,
			fetchedAt,
			query: search,
		});
		return { entry, fromCache: false, stale: false, budgetLimited: false };
	}

	/** The page a cursor continues from, with the jobs it showed (to leave out of the next page). */
	async function continuedPage(cursor: string, input: JobSearchInput, search: NormalizedJobSearch) {
		const parent = await readCachedSearch(cursor);
		// A cursor only continues the search it came from, and only while that page is stored.
		if (!parent || stableJson(parent.query) !== stableJson(search) || !hasMorePages(input, parent.cursors))
			throw new JobSearchError("cursor");
		const shown = await listingsByIds(parent.listingIds);
		return { after: parent.cursors, seen: new Set(shown.map(duplicateKey)) };
	}

	return {
		/** Whether this server searches, whether only saved answers are given now, and today's searches. */
		async status(userId: string): Promise<JobSearchStatus> {
			const now = deps.now();
			const quota = await quotaDay(userId, now);
			const [used, budget] = await Promise.all([
				quotaUsed(deps.counters, userId, quota, now),
				deps.configured() ? budgetLeft(deps.counters, now) : Promise.resolve(false),
			]);
			return {
				available: deps.configured(),
				cacheOnly: deps.switchedOff() || !budget,
				quota: { used: Math.min(used, quota.max), max: quota.max, resetsAt: quota.resetsAt.toISOString() },
			};
		},

		async search(userId: string, request: JobSearchRequest, signal?: AbortSignal): Promise<JobSearchResult> {
			if (!deps.configured()) throw new JobSearchError("unavailable");
			if (!(await jobSearchBurstAllowed(userId))) throw new JobSearchError("rate-limit");
			const now = deps.now();
			const { cursor, ...rest } = request;
			const input: JobSearchInput = { ...rest, cursor: undefined };
			const search = normalizeJobSearch(input);
			const continued = cursor ? await continuedPage(cursor, input, search) : undefined;
			const key = await jobSearchKey(search, SEARCH_PROVIDERS, continued?.after);

			const quota = await quotaDay(userId, now);
			const seenToday = await pageSeenToday(deps.counters, userId, quota, key, now);
			if (!seenToday) {
				const used = await quotaUsed(deps.counters, userId, quota, now);
				if (used >= quota.max)
					throw jobSearchLimitReached({ max: quota.max, used, planId: quota.planId, resetsAt: quota.resetsAt });
			}

			const answer = await answerPage(key, input, search, continued?.after, continued?.seen, signal);

			// Counted once the answer is there, so a failed search costs nothing.
			let used: number;
			if (seenToday) used = await quotaUsed(deps.counters, userId, quota, now);
			else {
				const counted = await countSearch(deps.counters, userId, quota, key, now);
				if (!counted.allowed)
					throw jobSearchLimitReached({
						max: quota.max,
						used: counted.used,
						planId: quota.planId,
						resetsAt: quota.resetsAt,
					});
				used = counted.used;
			}

			const listings = await listingsByIds(answer.entry.listingIds);
			const hidden = await hiddenListingIds(
				userId,
				listings.map((listing) => listing.id),
			);
			return {
				listings: listings.filter((listing) => !listing.closedAt && !hidden.has(listing.id)).map(toCard),
				...(hasMorePages(input, answer.entry.cursors) ? { cursor: answer.entry.key } : {}),
				fetchedAt: answer.entry.fetchedAt.toISOString(),
				fromCache: answer.fromCache,
				stale: answer.stale,
				budgetLimited: answer.budgetLimited,
				quota: { used: Math.min(used, quota.max), max: quota.max, resetsAt: quota.resetsAt.toISOString() },
			};
		},

		/** One listing in full, for its detail view; closed ones too, so a saved link still explains itself. */
		listing: (listingId: string) => readListing(listingId),

		/** Hides a listing from the person's results, or shows it again. False when the listing doesn't exist. */
		hide: (userId: string, listingId: string, hidden: boolean) => setListingHidden(userId, listingId, hidden),
	};
}

export type JobSearchService = ReturnType<typeof createJobSearchService>;

export const jobSearchService = createJobSearchService();
