import type { JobSearchCriteria, JobSearchDefaults, JobSearchRequest } from "@rezumi/schema/jobs/search";
import z from "zod";
import { JOB_SENIORITIES } from "@rezumi/schema/jobs/listing";
import { JOB_SEARCH_POSTED_WITHIN_DAYS } from "@rezumi/schema/jobs/search";

/**
 * The Jobs page's search as the address holds it: what was last searched, so a reload or the back button shows the
 * same results (a page opened again the same day doesn't count again). Nothing is searched until there is a query.
 */

export const JOB_ARRANGEMENTS = ["any", "remote", "hybrid", "onsite"] as const;
export type JobArrangementFilter = (typeof JOB_ARRANGEMENTS)[number];

export const jobsSearchSchema = z.object({
	q: z.string().trim().max(200).default("").catch(""),
	location: z.string().trim().max(200).default("").catch(""),
	/** ISO country code; "" searches anywhere. */
	country: z
		.string()
		.regex(/^[A-Z]{2}$/)
		.or(z.literal(""))
		.default("")
		.catch(""),
	posted: z
		.union(JOB_SEARCH_POSTED_WITHIN_DAYS.map((days) => z.literal(days)))
		.default(30)
		.catch(30),
	arrangement: z.enum(JOB_ARRANGEMENTS).default("any").catch("any"),
	level: z.enum(JOB_SENIORITIES).or(z.literal("")).default("").catch(""),
	minPay: z.number().int().positive().max(100_000_000).optional().catch(undefined),
	currency: z
		.string()
		.regex(/^[A-Z]{3}$/)
		.optional()
		.catch(undefined),
	/** Keep listings that don't state pay when a minimum is set: on unless turned off (K11). */
	noPay: z.boolean().default(true).catch(true),
	visa: z.boolean().default(false).catch(false),
});
export type JobsSearch = z.output<typeof jobsSearchSchema>;

export const JOBS_SEARCH_DEFAULTS = {
	q: "",
	location: "",
	country: "",
	posted: 30,
	arrangement: "any",
	level: "",
	noPay: true,
	visa: false,
} satisfies Partial<JobsSearch>;

/** A search's filters count, for the "More" button and "Clear filters": everything but the role, place and country. */
export function activeFilterCount(search: JobsSearch): number {
	return [
		search.posted !== 30,
		search.arrangement !== "any",
		search.level !== "",
		search.minPay !== undefined,
		search.visa,
	].filter(Boolean).length;
}

/** The same search without its filters. */
export const withoutFilters = (search: JobsSearch): JobsSearch => ({
	...search,
	posted: 30,
	arrangement: "any",
	level: "",
	minPay: undefined,
	currency: undefined,
	noPay: true,
	visa: false,
});

/** The currency pay is usually listed in, by country; others start in US dollars. */
const COUNTRY_CURRENCY: Record<string, string> = {
	AU: "AUD",
	BR: "BRL",
	CA: "CAD",
	CH: "CHF",
	CN: "CNY",
	DE: "EUR",
	ES: "EUR",
	FR: "EUR",
	GB: "GBP",
	ID: "IDR",
	IE: "EUR",
	IN: "INR",
	IT: "EUR",
	JP: "JPY",
	MX: "MXN",
	MY: "MYR",
	NL: "EUR",
	NZ: "NZD",
	PH: "PHP",
	PL: "PLN",
	PT: "EUR",
	SE: "SEK",
	SG: "SGD",
	AE: "AED",
	US: "USD",
	VN: "VND",
	ZA: "ZAR",
};

export const PAY_CURRENCIES = [...new Set([...Object.values(COUNTRY_CURRENCY), "USD", "EUR"])].sort();

export const currencyForCountry = (country: string) => COUNTRY_CURRENCY[country] ?? "USD";

/** What `jobs.search` is asked: a remote arrangement is the remote filter, the others pick an arrangement. */
export function toSearchRequest(search: JobsSearch): Omit<JobSearchRequest, "cursor"> {
	return {
		query: search.q,
		...(search.location ? { location: search.location } : {}),
		...(search.country ? { country: search.country } : {}),
		remote: search.arrangement === "remote" ? "only" : "any",
		...(search.arrangement === "hybrid" || search.arrangement === "onsite"
			? { workArrangement: search.arrangement }
			: {}),
		...(search.level ? { seniority: search.level } : {}),
		postedWithinDays: search.posted,
		...(search.minPay !== undefined
			? { salaryMin: search.minPay, salaryCurrency: search.currency ?? currencyForCountry(search.country) }
			: {}),
		includeNoSalary: search.noPay,
		...(search.visa ? { visaSponsorship: true } : {}),
	};
}

/** The form's first values: the last search, or the role, place and country from the person's preferences. */
export function startingSearch(search: JobsSearch, defaults: JobSearchDefaults | undefined): JobsSearch {
	if (search.q || !defaults) return search;
	return {
		...search,
		q: defaults.query,
		location: defaults.location,
		country: defaults.country,
		arrangement: defaults.remote === "only" ? "remote" : search.arrangement,
	};
}

/** Whether a job alert repeats this search: the same role (any case), place and filters. */
export function sameSearch(a: Partial<JobSearchCriteria>, b: Partial<JobSearchCriteria>): boolean {
	const key = (search: Partial<JobSearchCriteria>) =>
		JSON.stringify([
			search.query?.trim().toLocaleLowerCase() ?? "",
			search.location?.trim().toLocaleLowerCase() ?? "",
			search.country ?? "",
			search.remote ?? "any",
			search.postedWithinDays ?? 30,
			search.workArrangement ?? "",
			search.seniority ?? "",
			search.salaryMin ?? null,
			search.salaryMin === undefined ? "" : (search.salaryCurrency ?? "USD"),
			search.salaryMin === undefined ? true : (search.includeNoSalary ?? true),
			search.visaSponsorship ?? false,
		]);
	return key(a) === key(b);
}
