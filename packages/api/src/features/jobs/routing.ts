import type { JobEventKind } from "./events";
import type { JobSourceAdapter, ProviderListing } from "./providers";
import type { JobProvider } from "@rezumi/schema/jobs/listing";
import type { JobSearchInput } from "@rezumi/schema/jobs/search";
import { JOB_SEARCH_PAGE_SIZE } from "@rezumi/schema/jobs/search";
import { matchesSearch, spreadCompanies, withoutDuplicates } from "./filters";
import { jobspipeFits } from "./providers/jobspipe";
import { TregError } from "./treg";

/**
 * Which provider answers a page of a search (K1, `02-teknis.md` section 7, step 7). The one place to change it, for
 * instance per country once the cost dashboard shows a reason to.
 *
 * - Hirebase first, for every country and remote: cheaper, and its links go to the employer.
 * - JobsPipe tops the page up to JOB_PAGE_SIZE when Hirebase failed or found fewer than TOP_UP_BELOW fitting jobs, and
 *   is asked only for the missing ones, so a page Hirebase mostly filled isn't topped up. It is left out of searches it
 *   can't answer (`jobspipeFits`: visa sponsorship, junior level).
 * - A page has a time limit: once it passes, a provider still answering is given up on, and the page shows what the
 *   others answered.
 * - No company fills the top of a page (`spreadCompanies`).
 * - Each provider keeps its own place for "load more". A cursor of "" means it has nothing more; a missing one means
 *   it hasn't been asked yet, so JobsPipe can still step in on a later page once Hirebase runs out.
 */

export const JOB_PAGE_SIZE = JOB_SEARCH_PAGE_SIZE;
export const TOP_UP_BELOW = 5;
/** The providers a search may use, in the order they're asked; part of the cache key. */
export const SEARCH_PROVIDERS = ["hirebase", "jobspipe"] as const satisfies readonly JobProvider[];

/** Where each provider continues: its own page token, "" when it has no more, missing when not asked yet. */
export type ProviderCursors = Partial<Record<JobProvider, string>>;

export type RoutedPage = {
	/** Fitting listings to show, without duplicates, Hirebase's first. */
	listings: ProviderListing[];
	/** Everything the providers returned and Rezumi paid for, to store. */
	returned: ProviderListing[];
	cursors: ProviderCursors;
	/** Whether another page may hold more. */
	hasMore: boolean;
	providers: JobProvider[];
	costMicro: number;
	/** A provider failed but another answered. */
	partial: boolean;
};

export type RouteOptions = {
	signal?: AbortSignal | undefined;
	kind?: JobEventKind;
	/** Duplicate keys of jobs already shown on earlier pages. */
	seen?: Set<string>;
	/** The most time the page may take in all, in milliseconds. */
	deadlineMs?: number;
};

const jobspipeAllowed = (input: JobSearchInput, cursors: ProviderCursors) =>
	jobspipeFits(input) && cursors.jobspipe !== "";

export const hasMorePages = (input: JobSearchInput, cursors: ProviderCursors) =>
	cursors.hirebase !== "" || jobspipeAllowed(input, cursors);

/**
 * Fetches one page. Throws the first provider error when no provider answered; a spent treg budget (`budget`) stops
 * at once without trying the other provider.
 */
export async function routeSearch(
	input: JobSearchInput,
	after: ProviderCursors | undefined,
	sources: Record<JobProvider, JobSourceAdapter>,
	options: RouteOptions = {},
): Promise<RoutedPage> {
	const cursors: ProviderCursors = { ...after };
	const seen = new Set(options.seen);
	const returned: ProviderListing[] = [];
	const shown: ProviderListing[] = [];
	const providers: JobProvider[] = [];
	const errors: unknown[] = [];
	let costMicro = 0;
	const deadline = options.deadlineMs === undefined ? undefined : AbortSignal.timeout(options.deadlineMs);
	const signal =
		deadline && options.signal ? AbortSignal.any([options.signal, deadline]) : (deadline ?? options.signal);
	const searchOptions = { kind: options.kind ?? "search", signal } as const;
	/** A caller that went away stops the page; a passed time limit only counts as that provider failing. */
	const failed = (error: unknown) => {
		options.signal?.throwIfAborted();
		errors.push(deadline?.aborted && !(error instanceof TregError) ? new TregError("timeout") : error);
	};

	const ask = async (provider: JobProvider, limit: number) => {
		const cursor = cursors[provider];
		const result = await sources[provider].search(
			{ ...input, ...(cursor ? { cursor } : { cursor: undefined }) },
			{ ...searchOptions, limit },
		);
		providers.push(provider);
		costMicro += result.costMicro;
		returned.push(...result.listings);
		cursors[provider] = result.listings.length > 0 ? (result.cursor ?? "") : "";
		shown.push(
			...withoutDuplicates(
				result.listings.filter((listing) => matchesSearch(listing, input)),
				seen,
			),
		);
	};

	let hirebaseFailed = false;
	if (cursors.hirebase !== "") {
		try {
			await ask("hirebase", JOB_PAGE_SIZE);
		} catch (error) {
			if (error instanceof TregError && error.code === "budget") throw error;
			failed(error);
			hirebaseFailed = true;
		}
	}

	const topUp = hirebaseFailed || shown.length < TOP_UP_BELOW;
	if (topUp && jobspipeAllowed(input, cursors) && !deadline?.aborted) {
		try {
			await ask("jobspipe", JOB_PAGE_SIZE - shown.length);
		} catch (error) {
			if (error instanceof TregError && error.code === "budget" && providers.length === 0) throw error;
			failed(error);
		}
	}

	if (providers.length === 0 && errors.length > 0) throw errors[0];
	return {
		listings: spreadCompanies(shown.slice(0, JOB_PAGE_SIZE)),
		returned,
		cursors,
		hasMore: hasMorePages(input, cursors),
		providers,
		costMicro,
		partial: errors.length > 0,
	};
}
