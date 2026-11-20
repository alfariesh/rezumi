import type { JobProvider } from "@rezumi/schema/jobs/listing";
import type { JobSearchInput } from "@rezumi/schema/jobs/search";

/**
 * The shared cache key of a search (`02-teknis.md` section 7, step 2): the search with case and spacing evened out and
 * every field that can't change the answer left out, in a fixed key order, hashed with the providers and a version.
 * Two people asking the same thing get the same key, so the second answer is free. No synonyms yet (backlog).
 */

/** Raise when the stored answer of the same search would differ: a new mapping, filter or provider rule. */
const JOB_SEARCH_CACHE_VERSION = 1;

export type NormalizedJobSearch = {
	query: string;
	location?: string;
	country?: string;
	remote: JobSearchInput["remote"];
	postedWithinDays: number;
	workArrangement?: string;
	seniority?: string;
	salaryMin?: number;
	salaryCurrency?: string;
	includeNoSalary?: boolean;
	visaSponsorship?: true;
};

const tidy = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** The search as the cache sees it; also what is stored in `job_search_cache.query`. Drops the provider cursor. */
export function normalizeJobSearch(input: JobSearchInput): NormalizedJobSearch {
	const location = input.location ? tidy(input.location) : "";
	return {
		query: tidy(input.query),
		...(location ? { location } : {}),
		...(input.country ? { country: input.country } : {}),
		remote: input.workArrangement ? "any" : input.remote,
		postedWithinDays: input.postedWithinDays,
		...(input.workArrangement ? { workArrangement: input.workArrangement } : {}),
		...(input.seniority ? { seniority: input.seniority } : {}),
		...(input.salaryMin === undefined
			? {}
			: {
					salaryMin: input.salaryMin,
					salaryCurrency: input.salaryCurrency ?? "USD",
					includeNoSalary: input.includeNoSalary,
				}),
		...(input.visaSponsorship ? { visaSponsorship: true as const } : {}),
	};
}

/** JSON with object keys in sorted order at every level, so equal values always give equal text. */
export function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object")
		return `{${Object.entries(value)
			.filter(([, item]) => item !== undefined)
			.toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
			.join(",")}}`;
	return JSON.stringify(value);
}

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The key of one page of a search. The first page has no `after`; a later page is keyed by the provider cursors it
 * continues from, which every reader of the previous page shares, so "load more" is shared too.
 */
export function jobSearchKey(
	search: NormalizedJobSearch,
	providers: readonly JobProvider[],
	after?: Partial<Record<JobProvider, string>>,
): Promise<string> {
	return sha256(
		stableJson({
			v: JOB_SEARCH_CACHE_VERSION,
			search,
			providers: [...providers].toSorted(),
			...(after ? { after } : {}),
		}),
	);
}
