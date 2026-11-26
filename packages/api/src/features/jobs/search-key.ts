import type { JobProvider } from "@rezumi/schema/jobs/listing";
import type { JobSearchInput } from "@rezumi/schema/jobs/search";

/**
 * The shared cache key of a search (`02-teknis.md` section 7, step 2): the search with case and spacing evened out and
 * every field that can't change the answer left out, in a fixed key order, hashed with the providers and a version.
 * Two people asking the same thing get the same key, so the second answer is free. No synonyms yet (backlog).
 */

/**
 * Raise when the stored answer of the same search would differ: a new mapping, filter, provider rule or page size.
 * 2: pages of 10, JobsPipe level filter, words such as "jobs" left out of the query.
 */
const JOB_SEARCH_CACHE_VERSION = 2;

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

/** Words before a role that only say "a job": "lowongan admin", "hiring: nurse". */
const LEADING_JOB_WORDS = new Set(["lowongan", "loker", "hiring"]);
/** "kerja" only right after one of them ("lowongan kerja"); alone it can be part of a role. */
const AFTER_LEADING = new Set(["kerja"]);
/** Words after a role that only say "jobs": "HR jobs". Singular "job" stays, as in "job coach". */
const TRAILING_JOB_WORDS = new Set(["jobs", "vacancy", "vacancies", "openings", "lowongan"]);

/**
 * The role as providers are asked for it: the person's words without "jobs", "lowongan kerja" and the like at either
 * end, so "HR jobs" and "hr" are one search (one paid answer, then shared). Falls back to the text as typed when nothing
 * would be left.
 */
export function cleanJobQuery(query: string): string {
	const words = query.normalize("NFKC").replace(/\s+/g, " ").trim().split(" ");
	const plain = (index: number) => (words[index] ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
	let start = 0;
	let end = words.length;
	while (start < end) {
		const word = plain(start);
		const leading = LEADING_JOB_WORDS.has(word);
		if (leading || (start > 0 && AFTER_LEADING.has(word) && LEADING_JOB_WORDS.has(plain(start - 1)))) start++;
		else break;
	}
	while (end > start && TRAILING_JOB_WORDS.has(plain(end - 1))) end--;
	const cleaned = words.slice(start, end).join(" ");
	return cleaned.length >= 2 ? cleaned : query.trim();
}

/** The search as the cache sees it; also what is stored in `job_search_cache.query`. Drops the provider cursor. */
export function normalizeJobSearch(input: JobSearchInput): NormalizedJobSearch {
	const location = input.location ? tidy(input.location) : "";
	return {
		query: tidy(cleanJobQuery(input.query)),
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
