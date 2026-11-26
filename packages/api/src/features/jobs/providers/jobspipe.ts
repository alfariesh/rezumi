import type { JobSourceAdapter, MappedJob, ProviderSearchOptions, ProviderSearchResult } from "./shared";
import type { JobSeniority, JobWorkArrangement } from "@rezumi/schema/jobs/listing";
import type { JobSearchInput } from "@rezumi/schema/jobs/search";
import { recordJobEvent } from "../events";
import { callTreg, TregError } from "../treg";
import {
	bool,
	COUNT_MAX_COST_USD,
	domain,
	englishCountryName,
	httpUrl,
	isoDate,
	isRecord,
	maxCostUsd,
	num,
	pick,
	plainText,
	seniority,
	str,
	strings,
	validListings,
} from "./shared";

/**
 * JobsPipe (https://jobspipe.dev) through treg: jobs gathered from LinkedIn, Indeed and job boards. Tops up Hirebase
 * when it finds fewer than 10 (K1). Mapping: `02-teknis.md` section 5.
 */

const JOBSPIPE_SEARCH_TOOL = "jobspipe.jobs.search";
const JOBSPIPE_COUNT_TOOL = "jobspipe.jobs.search.count";
/**
 * What treg charges for one job returned by `jobspipe.jobs.search`: one JobsPipe credit (ledger, 2026-11-26; the catalog's
 * $0.00392 is the price with `include_technologies`, which isn't sent). A job already returned this month is free.
 */
export const JOBSPIPE_PRICE_USD = 0.00196;

/**
 * JobsPipe's levels for `job_seniority_or` (measured with the free count endpoint, 2026-11-26). It has no junior level:
 * "associate" falls in `mid_level`.
 */
const SENIORITY_FILTERS: Record<Exclude<JobSeniority, "junior">, string> = {
	entry: "entry_level",
	mid: "mid_level",
	senior: "senior",
	lead: "director",
	executive: "executive",
};

/**
 * Whether JobsPipe can answer a search at all. Its listings never say whether a job sponsors visas, and it has no junior
 * level, so for those searches every listing it returned would be paid for and then left out.
 */
export const jobspipeFits = (input: Pick<JobSearchInput, "visaSponsorship" | "seniority">) =>
	!input.visaSponsorship && input.seniority !== "junior";

const ARRANGEMENTS: Record<string, JobWorkArrangement> = {
	remote: "remote",
	hybrid: "hybrid",
	onsite: "onsite",
	on_site: "onsite",
	"on-site": "onsite",
	in_person: "onsite",
};

/** Provider fields kept in `job_listing.raw`. Never a contact person, hiring team or email. */
const RAW_FIELDS = [
	"status",
	"seniority",
	"work_arrangement",
	"remote",
	"occupation_code",
	"occupation_label",
	"ghost_score",
	"applicant_count",
	"discovered_at",
	"last_seen_at",
	"closed_at",
] as const;

function salary(job: Record<string, unknown>) {
	// Only pay the posting lists: `estimated_*` is the provider's guess and is never shown as pay.
	const min = num(job.min_annual_salary_usd);
	const max = num(job.max_annual_salary_usd);
	if (min === undefined && max === undefined) return undefined;
	return {
		...(min === undefined ? {} : { min }),
		...(max === undefined ? {} : { max }),
		currency: "USD",
		period: "year",
	};
}

function location(job: Record<string, unknown>) {
	const text = str(job.location, 500);
	const code = str(job.country_code, 2)?.toUpperCase();
	const countryCode = code && /^[A-Z]{2}$/.test(code) ? code : undefined;
	const country = countryCode ? englishCountryName(countryCode) : undefined;
	// "Rochester, NY 14607" → "Rochester"; a single word such as "Remote" or a country is not a city.
	const parts = text?.split(",").map((part) => part.trim()) ?? [];
	const city =
		str(job.normalized_city, 200) ??
		str(job.city, 200) ??
		(parts.length > 1 && parts[0] && parts[0] !== country ? parts[0] : undefined);
	const region = str(job.normalized_region, 200);
	return {
		...(city ? { city } : {}),
		...(region ? { region } : {}),
		...(country ? { country } : {}),
		...(countryCode ? { countryCode } : {}),
		text: text ?? country ?? "",
	};
}

function workArrangement(job: Record<string, unknown>): JobWorkArrangement | undefined {
	const named = ARRANGEMENTS[str(job.work_arrangement, 40)?.toLowerCase() ?? ""];
	if (named) return named;
	if (bool(job.remote) === true) return "remote";
	if (bool(job.hybrid) === true) return "hybrid";
	return undefined;
}

function closedAt(job: Record<string, unknown>): string | null | undefined {
	const status = str(job.status, 20)?.toLowerCase();
	if (status === "active") return null;
	if (!status) return undefined;
	return isoDate(job.closed_at) ?? isoDate(job.last_seen_at);
}

/** One JobsPipe job in Rezumi's shape. */
export function mapJobspipeJob(job: Record<string, unknown>): MappedJob {
	const sources = Array.isArray(job.sources) ? job.sources.filter(isRecord) : [];
	const postingUrl = httpUrl(job.url) ?? httpUrl(job.source_url) ?? httpUrl(sources[0]?.url);
	const finalUrl = httpUrl(job.final_url);
	const company = isRecord(job.company_object) ? job.company_object : {};
	const listing = {
		provider: "jobspipe",
		externalId: str(job.id, 200),
		title: str(job.job_title, 500),
		company: {
			name: str(job.company, 300),
			domain: domain(job.company_domain),
			logoUrl: httpUrl(company.logo_url ?? company.logo),
			industry: str(company.industry, 200),
		},
		location: location(job),
		workArrangement: workArrangement(job),
		seniority: seniority(job.seniority),
		employmentType: str(job.employment_type, 100),
		visaSponsorship: bool(job.visa_sponsorship),
		salary: salary(job),
		description: plainText(job.description),
		skills: strings(job.technology_slugs),
		postingUrl,
		applyUrl: finalUrl && finalUrl !== postingUrl ? finalUrl : undefined,
		source: str(sources[0]?.provider, 100)?.toLowerCase(),
		language: str(job.language, 20),
		postedAt: isoDate(job.date_posted),
		closedAt: closedAt(job),
	};
	const raw = pick(job, RAW_FIELDS);
	if (sources.length) raw.sources = sources.slice(0, 10).map((source) => pick(source, ["provider", "url", "seen_at"]));
	return { listing, raw };
}

/** The `jobspipe.jobs.search` body for a search; only parameters the treg catalog lists. */
export function jobspipeSearchBody(input: JobSearchInput, limit: number) {
	const remote = input.workArrangement
		? input.workArrangement === "remote"
		: input.remote === "only"
			? true
			: input.remote === "exclude"
				? false
				: undefined;
	// A job without listed pay never matches `min_salary_usd`, so it is sent only when those jobs are excluded anyway.
	const salaryFilter =
		input.salaryMin !== undefined && !input.includeNoSalary && (input.salaryCurrency ?? "USD") === "USD";
	return {
		job_title_or: [input.query],
		...(input.country ? { job_country_code_or: [input.country] } : {}),
		...(input.location ? { city_or: [input.location] } : {}),
		...(remote === undefined ? {} : { remote }),
		...(input.seniority && input.seniority !== "junior"
			? { job_seniority_or: [SENIORITY_FILTERS[input.seniority]] }
			: {}),
		posted_at_max_age_days: input.postedWithinDays,
		...(salaryFilter ? { min_salary_usd: input.salaryMin } : {}),
		status: "active",
		limit,
		...(input.cursor ? { cursor: input.cursor } : {}),
	};
}

type SearchAnswer = { data?: unknown; metadata?: unknown };

const JOBSPIPE_NEW_TOOL = "jobspipe.jobs.new";

/** One call to `jobspipe.jobs.search` or `jobspipe.jobs.new`, mapped; both answer the same shape. */
async function fetchJobs(
	tool: typeof JOBSPIPE_SEARCH_TOOL | typeof JOBSPIPE_NEW_TOOL,
	body: Record<string, unknown>,
	input: JobSearchInput,
	options: ProviderSearchOptions,
): Promise<ProviderSearchResult> {
	const event = { provider: "jobspipe", tool, countryCode: input.country, kind: options.kind ?? "search" } as const;
	try {
		const result = await callTreg<SearchAnswer>(
			{
				tool,
				method: "POST",
				body,
				maxCostUsd: maxCostUsd(options.limit, JOBSPIPE_PRICE_USD),
				feature: `jobs-${options.kind ?? "search"}`,
				...(options.fresh ? { fresh: true } : {}),
				signal: options.signal,
			},
			options.treg,
		);
		const jobs = Array.isArray(result.data.data) ? result.data.data.filter(isRecord) : [];
		const metadata = isRecord(result.data.metadata) ? result.data.metadata : {};
		const { listings, dropped } = validListings(jobs.map(mapJobspipeJob));
		recordJobEvent({
			...event,
			outcome: "miss",
			costMicro: result.costMicro,
			ms: result.ms,
			resultCount: listings.length,
		});
		return {
			provider: "jobspipe",
			listings,
			cursor: jobs.length > 0 ? str(metadata.next_cursor, 2_000) : undefined,
			total: num(metadata.total_results),
			costMicro: result.costMicro,
			ms: result.ms,
			dropped,
			deltaCursor: str(metadata.next_delta_cursor, 2_000),
		};
	} catch (error) {
		const outcome = error instanceof TregError && error.code === "budget" ? "budget" : "error";
		recordJobEvent({ ...event, outcome, costMicro: 0, ms: 0, resultCount: 0 });
		throw error;
	}
}

export const jobspipe: JobSourceAdapter = {
	provider: "jobspipe",
	pricePerListingUsd: JOBSPIPE_PRICE_USD,
	search: (input, options) => fetchJobs(JOBSPIPE_SEARCH_TOOL, jobspipeSearchBody(input, options.limit), input, options),
	newListings(input, deltaCursor, options) {
		// The same filters as the search that issued the cursor; a page cursor never goes with a delta cursor.
		const { cursor: _cursor, ...search } = input;
		return fetchJobs(
			JOBSPIPE_NEW_TOOL,
			{ ...jobspipeSearchBody(search, options.limit), delta_cursor: deltaCursor },
			input,
			options,
		);
	},
	async count(input, options = {}) {
		const { cursor: _cursor, ...search } = input;
		const body: Record<string, unknown> = jobspipeSearchBody(search, 1);
		delete body.limit;
		const result = await callTreg<{ rows?: unknown }>(
			{
				tool: JOBSPIPE_COUNT_TOOL,
				method: "POST",
				body,
				maxCostUsd: COUNT_MAX_COST_USD,
				feature: "jobs-count",
				signal: options.signal,
			},
			options.treg,
		);
		return num(result.data.rows);
	},
};
