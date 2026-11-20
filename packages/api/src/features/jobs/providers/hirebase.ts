import type { JobSourceAdapter, MappedJob } from "./shared";
import type { JobSeniority, JobWorkArrangement } from "@rezumi/schema/jobs/listing";
import type { JobSearchInput } from "@rezumi/schema/jobs/search";
import { recordJobEvent } from "../events";
import { callTreg, TregError } from "../treg";
import {
	bool,
	COUNT_MAX_COST_USD,
	countryCode,
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
 * Hirebase (https://www.hirebase.org) through treg: jobs read from employers' own career pages, so the apply link goes
 * to the employer. The primary provider for every country and remote (K1). Mapping: `02-teknis.md` section 5.
 */

export const HIREBASE_SEARCH_TOOL = "hirebase.jobs.search";
export const HIREBASE_COUNT_TOOL = "hirebase.jobs.search.count";
/** treg's price for one job returned by `hirebase.jobs.search` (catalog, 2026-11-20). */
export const HIREBASE_PRICE_USD = 0.0015;

const ARRANGEMENTS: Record<string, JobWorkArrangement> = { remote: "remote", hybrid: "hybrid", "in-person": "onsite" };
const LOCATION_TYPES: Record<JobWorkArrangement, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "In-Person" };
const EXPERIENCE_LEVELS: Record<JobSeniority, string> = {
	entry: "Entry-Level",
	junior: "Junior / Associate",
	mid: "Mid-Level",
	senior: "Senior",
	lead: "Principal / Staff / Lead",
	executive: "Executive",
};
const PERIODS: Record<string, "year" | "month" | "hour"> = {
	year: "year",
	yearly: "year",
	annual: "year",
	annually: "year",
	month: "month",
	monthly: "month",
	hour: "hour",
	hourly: "hour",
};

/** Provider fields kept in `job_listing.raw`. Never `recruiter_emails`, `hiring_team` or other contact details. */
const RAW_FIELDS = [
	"job_board",
	"job_board_link",
	"job_type",
	"location_type",
	"location_raw",
	"experience_level",
	"yoe_range",
	"visa_sponsored",
	"job_categories",
	"technologies",
	"benefits",
	"education_level",
	"offers_equity",
	"recruiter_agency",
	"team",
	"first_ingested",
	"company_slug",
	"job_slug",
] as const;

function companySize(value: unknown): string | undefined {
	if (!isRecord(value)) return undefined;
	const min = num(value.min);
	const max = num(value.max);
	if (min !== undefined && max !== undefined) return `${min}–${max}`;
	if (min !== undefined) return `${min}+`;
	return max === undefined ? undefined : `1–${max}`;
}

function salary(value: unknown) {
	if (!isRecord(value)) return undefined;
	const min = num(value.min);
	const max = num(value.max);
	if (min === undefined && max === undefined) return undefined;
	const currency = str(value.currency, 10)?.toUpperCase() ?? "";
	return {
		...(min === undefined ? {} : { min }),
		...(max === undefined ? {} : { max }),
		currency: /^[A-Z]{3}$/.test(currency) ? currency : "",
		period: PERIODS[str(value.period, 20)?.toLowerCase() ?? ""] ?? "unknown",
	};
}

function location(job: Record<string, unknown>) {
	const first = Array.isArray(job.locations) && isRecord(job.locations[0]) ? job.locations[0] : {};
	const city = str(first.city, 200);
	const region = str(first.region, 200);
	const country = str(first.country, 200);
	const text =
		str(job.location_raw, 500) ?? str(first.address, 500) ?? [city, region, country].filter(Boolean).join(", ");
	return {
		...(city ? { city } : {}),
		...(region ? { region } : {}),
		...(country ? { country } : {}),
		...(countryCode(country) ? { countryCode: countryCode(country) } : {}),
		text,
	};
}

/** One Hirebase job in Rezumi's shape. */
export function mapHirebaseJob(job: Record<string, unknown>): MappedJob {
	const company = isRecord(job.company_data) ? job.company_data : {};
	const applyUrl = httpUrl(job.application_link);
	const listing = {
		provider: "hirebase",
		externalId: str(job._id, 200),
		title: str(job.job_title, 500),
		company: {
			name: str(job.company_name, 300),
			domain: domain(job.company_link),
			logoUrl: httpUrl(job.company_logo),
			size: companySize(company.size_range),
			industry: strings(company.industries, 1)[0],
		},
		location: location(job),
		workArrangement: ARRANGEMENTS[str(job.location_type, 40)?.toLowerCase() ?? ""],
		seniority: seniority(job.experience_level),
		employmentType: str(job.job_type, 100),
		visaSponsorship: bool(job.visa_sponsored),
		salary: salary(job.salary_range),
		description: plainText(job.description),
		requirementsSummary: str(job.requirements_summary, 2_000),
		skills: strings(job.skills),
		// `job_board_link` is the employer's whole job board, so the posting itself is the application link.
		postingUrl: applyUrl ?? httpUrl(job.job_board_link),
		applyUrl,
		source: str(job.job_board, 100)?.toLowerCase(),
		language: str(job.language, 20),
		postedAt: isoDate(job.date_posted),
	};
	const raw = pick(job, RAW_FIELDS);
	if (isRecord(job.company_data)) raw.company_data = pick(job.company_data, ["size_range", "industries", "type"]);
	return { listing, raw };
}

/** The `hirebase.jobs.search` body for a search; only parameters the treg catalog lists (others answer 422). */
export function hirebaseSearchBody(input: JobSearchInput, limit: number, page: number) {
	const place = {
		...(input.location ? { city: input.location } : {}),
		...(input.country ? { country: englishCountryName(input.country) } : {}),
	};
	const locationTypes = input.workArrangement
		? [LOCATION_TYPES[input.workArrangement]]
		: input.remote === "only"
			? ["Remote"]
			: input.remote === "exclude"
				? ["Hybrid", "In-Person"]
				: undefined;
	// Hirebase has no "include jobs without pay" switch: the pay filter is sent only when those jobs are excluded anyway.
	const salaryFilter = input.salaryMin !== undefined && !input.includeNoSalary;
	return {
		job_titles: [input.query],
		...(Object.keys(place).length ? { geo_locations: [place] } : {}),
		...(locationTypes ? { location_types: locationTypes } : {}),
		days_ago: input.postedWithinDays,
		...(input.seniority ? { experience_levels: [EXPERIENCE_LEVELS[input.seniority]] } : {}),
		...(salaryFilter ? { salary: { min: input.salaryMin }, currency: input.salaryCurrency ?? "USD" } : {}),
		limit,
		page,
	};
}

type SearchAnswer = { jobs?: unknown; total_count?: unknown; page?: unknown; total_pages?: unknown };

export const hirebase: JobSourceAdapter = {
	provider: "hirebase",
	pricePerListingUsd: HIREBASE_PRICE_USD,
	async search(input, options) {
		const page = Math.max(1, Number.parseInt(input.cursor ?? "1", 10) || 1);
		const event = {
			provider: "hirebase",
			tool: HIREBASE_SEARCH_TOOL,
			countryCode: input.country,
			kind: options.kind ?? "search",
		} as const;
		try {
			const result = await callTreg<SearchAnswer>(
				{
					tool: HIREBASE_SEARCH_TOOL,
					method: "POST",
					body: hirebaseSearchBody(input, options.limit, page),
					maxCostUsd: maxCostUsd(options.limit, HIREBASE_PRICE_USD),
					feature: `jobs-${options.kind ?? "search"}`,
					...(options.fresh ? { fresh: true } : {}),
					signal: options.signal,
				},
				options.treg,
			);
			const jobs = Array.isArray(result.data.jobs) ? result.data.jobs.filter(isRecord) : [];
			const { listings, dropped } = validListings(jobs.map(mapHirebaseJob));
			const totalPages = num(result.data.total_pages);
			const currentPage = num(result.data.page) ?? page;
			recordJobEvent({
				...event,
				outcome: "miss",
				costMicro: result.costMicro,
				ms: result.ms,
				resultCount: listings.length,
			});
			return {
				provider: "hirebase",
				listings,
				cursor:
					totalPages !== undefined && currentPage < totalPages && jobs.length > 0 ? String(currentPage + 1) : undefined,
				total: num(result.data.total_count),
				costMicro: result.costMicro,
				ms: result.ms,
				dropped,
			};
		} catch (error) {
			const outcome = error instanceof TregError && error.code === "budget" ? "budget" : "error";
			recordJobEvent({ ...event, outcome, costMicro: 0, ms: 0, resultCount: 0 });
			throw error;
		}
	},
	async count(input, options = {}) {
		// `limit: 0` answers the number of matches as `cost`, free.
		const body: Record<string, unknown> = hirebaseSearchBody(input, 0, 1);
		delete body.page;
		const result = await callTreg<{ cost?: unknown }>(
			{
				tool: HIREBASE_COUNT_TOOL,
				method: "POST",
				body,
				maxCostUsd: COUNT_MAX_COST_USD,
				feature: "jobs-count",
				signal: options.signal,
			},
			options.treg,
		);
		return num(result.data.cost);
	},
};
