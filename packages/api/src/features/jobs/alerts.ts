import type { JobCounters } from "./counters";
import type { JobSourceAdapter, ProviderListing, ProviderSearchOptions } from "./providers";
import type { CareerDiscoveryState } from "@rezumi/db/schema";
import type { JobProvider } from "@rezumi/schema/jobs/listing";
import type { JobSearchCriteria, JobSearchInput } from "@rezumi/schema/jobs/search";
import { env } from "@rezumi/env/server";
import { budgetLeft, recordSpend } from "./allowance";
import { jobCounters } from "./counters";
import { matchesSearch, withoutDuplicates } from "./filters";
import { JOB_SOURCES } from "./providers";
import { TOP_UP_BELOW } from "./routing";
import { isTregConfigured, TregError } from "./treg";

/**
 * Job alerts (`02-teknis.md` section 9): the listings that appeared for a saved search since its last check. Only new
 * listings are paid for, and a check with nothing new is free:
 *
 * - Hirebase first, with `ingested_after` (newest first): the jobs it first saw since the last check, an interval back
 *   on the first one. The next check overlaps by an hour, since a job can become searchable a little after Hirebase
 *   first saw it; jobs offered already are skipped by the caller.
 * - JobsPipe tops up below TOP_UP_BELOW, as in a search (K1), through `jobspipe.jobs.new` with the delta cursor from its
 *   previous answer. Without a usable cursor (first check, or one older than a JobsPipe month) it runs the search once:
 *   a job it already returned this month costs nothing again, and the answer's last page carries a fresh cursor.
 * - At most ALERT_PAGE_SIZE listings per provider per check; when more appeared, the newest are offered.
 * - The cost counts toward the server's daily budget (K7), not the person's searches. A spent budget postpones the check
 *   to the next UTC day ({@link JobAlertPostponed}); nothing is lost, since the state only moves after a check.
 */

export const ALERT_PAGE_SIZE = 20;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** How far the next Hirebase check reaches back before this one started. */
const HIREBASE_OVERLAP_MS = HOUR_MS;
/** JobsPipe charges a job once a month; an older delta cursor would bring back jobs it charges for again. */
const JOBSPIPE_DELTA_MAX_AGE_MS = 20 * DAY_MS;

/** The check can't run now (the day's budget is spent); run it again at `until`. Not a failure. */
export class JobAlertPostponed extends Error {
	readonly until: Date;
	constructor(until: Date) {
		super("Job alert postponed until the job search budget resets.");
		this.name = "JobAlertPostponed";
		this.until = until;
	}
}

/** Shortly after the next UTC midnight, when the day's budget starts again. */
export const nextBudgetDay = (now: Date) =>
	new Date(Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`) + DAY_MS + 5 * 60_000);

export type JobAlertCheck = {
	/** Open listings that fit the search, without duplicates, Hirebase's first: what may be offered. */
	listings: ProviderListing[];
	/** Everything the providers returned and Rezumi paid for, to store. */
	returned: ProviderListing[];
	/** Where the next check starts. */
	state: CareerDiscoveryState;
	providers: JobProvider[];
	costMicro: number;
};

export type JobAlertOptions = {
	now: Date;
	/** Days between checks: how far back the first check reaches. */
	intervalDays: number;
	signal?: AbortSignal | undefined;
	sources?: Record<JobProvider, JobSourceAdapter>;
	counters?: JobCounters;
	configured?: () => boolean;
	switchedOff?: () => boolean;
};

const isBudget = (error: unknown) => error instanceof TregError && error.code === "budget";

/**
 * Asks the providers what is new for `search` since `state`. Throws {@link JobAlertPostponed} when the budget is spent,
 * and the first provider error when no provider answered. Answers no listings, and keeps `state`, while job search is
 * switched off (`FLAG_DISABLE_JOB_SEARCH`).
 */
export async function checkJobAlert(
	search: JobSearchCriteria,
	state: CareerDiscoveryState | null,
	options: JobAlertOptions,
): Promise<JobAlertCheck> {
	const { now } = options;
	const sources = options.sources ?? JOB_SOURCES;
	const counters = options.counters ?? jobCounters;
	if (!(options.configured ?? isTregConfigured)()) throw new TregError("not-configured");
	const next: CareerDiscoveryState = { ...state };
	const empty: JobAlertCheck = { listings: [], returned: [], state: next, providers: [], costMicro: 0 };
	if ((options.switchedOff ?? (() => Boolean(env.FLAG_DISABLE_JOB_SEARCH)))()) return empty;
	if (!(await budgetLeft(counters, now))) throw new JobAlertPostponed(nextBudgetDay(now));

	const input: JobSearchInput = { ...search, cursor: undefined };
	const base: ProviderSearchOptions = {
		limit: ALERT_PAGE_SIZE,
		kind: "discovery",
		fresh: true,
		signal: options.signal,
	};
	const seen = new Set<string>();
	const shown: ProviderListing[] = [];
	const returned: ProviderListing[] = [];
	const providers: JobProvider[] = [];
	const errors: unknown[] = [];
	let costMicro = 0;

	const take = async (provider: JobProvider, ask: () => ReturnType<JobSourceAdapter["search"]>) => {
		const result = await ask();
		providers.push(provider);
		costMicro += result.costMicro;
		await recordSpend(counters, result.costMicro, now);
		returned.push(...result.listings);
		const open = result.listings.filter((listing) => !listing.closedAt && matchesSearch(listing, input));
		shown.push(...withoutDuplicates(open, seen));
		return result;
	};

	const since = state?.hirebaseAfter ?? new Date(now.getTime() - options.intervalDays * DAY_MS).toISOString();
	try {
		await take("hirebase", () => sources.hirebase.search(input, { ...base, ingestedAfter: since }));
		next.hirebaseAfter = new Date(now.getTime() - HIREBASE_OVERLAP_MS).toISOString();
	} catch (error) {
		if (isBudget(error)) throw new JobAlertPostponed(nextBudgetDay(now));
		options.signal?.throwIfAborted();
		errors.push(error);
	}

	// JobsPipe listings don't say whether a job sponsors visas, so it stays out of those searches, as in a search.
	if ((errors.length > 0 || shown.length < TOP_UP_BELOW) && !input.visaSponsorship) {
		const fresh =
			state?.jobspipeDelta &&
			state.jobspipeDeltaAt &&
			now.getTime() - Date.parse(state.jobspipeDeltaAt) < JOBSPIPE_DELTA_MAX_AGE_MS
				? state.jobspipeDelta
				: undefined;
		const { jobspipe } = sources;
		const limit = Math.max(1, ALERT_PAGE_SIZE - shown.length);
		try {
			const result = await take("jobspipe", () =>
				fresh && jobspipe.newListings
					? jobspipe.newListings(input, fresh, { ...base, limit })
					: jobspipe.search(input, { ...base, limit }),
			);
			if (result.deltaCursor) {
				next.jobspipeDelta = result.deltaCursor;
				next.jobspipeDeltaAt = now.toISOString();
			} else if (!fresh) {
				delete next.jobspipeDelta;
				delete next.jobspipeDeltaAt;
			}
		} catch (error) {
			if (isBudget(error) && providers.length === 0) throw new JobAlertPostponed(nextBudgetDay(now));
			options.signal?.throwIfAborted();
			errors.push(error);
		}
	}

	if (providers.length === 0 && errors.length > 0) throw errors[0];
	return { listings: shown.slice(0, ALERT_PAGE_SIZE), returned, state: next, providers, costMicro };
}
