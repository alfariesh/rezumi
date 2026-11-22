import type {
	JobListingCard,
	JobSearchCriteria,
	JobSearchDefaults,
	JobSearchRequest,
} from "@rezumi/schema/jobs/search";
import z from "zod";
import { JOB_SENIORITIES } from "@rezumi/schema/jobs/listing";
import { JOB_SEARCH_POSTED_WITHIN_DAYS, MAX_JOB_SEARCH_SALARY } from "@rezumi/schema/jobs/search";

/**
 * Job search as the web's Jobs page and the app's Jobs screen hold it: the form's values (what the web keeps in its
 * address), what they ask `jobs.search`, a saved search read back, and the provider's place and pay as they read on a
 * listing. Words around them ("a year", "via LinkedIn") are each app's own translations.
 *
 * The web keeps the last search in the address, so a reload or the back button shows the same results (a page opened
 * again the same day doesn't count again). Nothing is searched until there is a query.
 */

const JOB_ARRANGEMENTS = ["any", "remote", "hybrid", "onsite"] as const;

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
	minPay: z.number().int().positive().max(MAX_JOB_SEARCH_SALARY).optional().catch(undefined),
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

/** The filters the Filters sheet holds besides the place, for its button (which names the place itself). */
export function sheetFilterCount(search: JobsSearch): number {
	return [search.arrangement !== "any", search.level !== "", search.minPay !== undefined, search.visa].filter(Boolean)
		.length;
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

/**
 * A saved search (a recent one, say) as the page's address: the reverse of {@link toSearchRequest}. "No remote jobs",
 * which only the API can ask for, reads as any arrangement.
 */
export function fromCriteria(criteria: JobSearchCriteria): JobsSearch {
	const arrangement = criteria.workArrangement ?? (criteria.remote === "only" ? "remote" : "any");
	return {
		q: criteria.query,
		location: criteria.location ?? "",
		country: criteria.country ?? "",
		posted: criteria.postedWithinDays,
		arrangement,
		level: criteria.seniority ?? "",
		...(criteria.salaryMin === undefined
			? { minPay: undefined, currency: undefined }
			: { minPay: criteria.salaryMin, currency: criteria.salaryCurrency }),
		noPay: criteria.includeNoSalary,
		visa: criteria.visaSponsorship ?? false,
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

/** The place as the posting gives it, else its parts. */
export function placeLabel(listing: Pick<JobListingCard, "location">): string {
	const { location } = listing;
	return (
		location.text.trim() ||
		[location.city, location.region, location.country].filter((part): part is string => Boolean(part)).join(", ")
	);
}

/** An amount of pay in its own currency, short for large ones ("£70K"); a code the runtime doesn't know is spelled out. */
export function formatPay(value: number, currency: string, locale: string): string {
	if (!currency) return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
	try {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
			notation: value >= 10_000 ? "compact" : "standard",
			minimumFractionDigits: 0,
			maximumFractionDigits: value >= 10_000 ? 1 : 0,
		}).format(value);
	} catch {
		return `${currency} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)}`;
	}
}

export type PayRange = {
	/** "£70K–£85K", or one amount. */
	range: string;
	/** What the amount is per, for the words around it. */
	period: NonNullable<JobListingCard["salary"]>["period"];
};

/** The listed pay in its own currency, without words; null when the posting lists none. */
export function payRange(salary: JobListingCard["salary"], locale: string): PayRange | null {
	if (!salary || (salary.min === undefined && salary.max === undefined)) return null;
	const { min, max, currency } = salary;
	const range =
		min !== undefined && max !== undefined && min !== max
			? `${formatPay(min, currency, locale)}–${formatPay(max, currency, locale)}`
			: formatPay((min ?? max) as number, currency, locale);
	return { range, period: salary.period };
}

// A job alert's search in the schedule sheet (web and app): the sheet edits the role, city and country; every other
// filter is kept as the search had it (they're chosen on the Jobs page).

export type AlertFields = {
	role: string;
	city: string;
	/** ISO country code; "" searches anywhere. */
	country: string;
	/** The rest of the search, saved unchanged. */
	filters: Partial<JobSearchCriteria>;
};

/** A saved search as the sheet's fields. */
export function alertFields(search: Partial<JobSearchCriteria>): AlertFields {
	const { query, location, country, ...filters } = search;
	return { role: query ?? "", city: location ?? "", country: country ?? "", filters };
}

type StartingAlert = {
	/** The schedule being edited; an old one has a `query` but no `search`. */
	existing: { search: JobSearchCriteria | null; query: string } | null;
	/** A new alert from the Jobs screen: its current search. */
	search: Partial<JobSearchCriteria> | undefined;
	/** The role, place and country from Preferences (`jobs.defaults`), when loaded. */
	defaults: JobSearchDefaults | undefined;
	targetRoles: readonly string[];
};

/** Where a job alert starts: its own search, else the Jobs screen's, else Preferences, else the first target role. */
export function startingAlertSearch({ existing, search, defaults, targetRoles }: StartingAlert) {
	if (existing) return existing.search ?? { query: existing.query };
	if (search) return search;
	if (defaults)
		return {
			query: defaults.query,
			...(defaults.location ? { location: defaults.location } : {}),
			...(defaults.country ? { country: defaults.country } : {}),
			remote: defaults.remote,
		} satisfies Partial<JobSearchCriteria>;
	return { query: targetRoles[0] ?? "" };
}

/** The search a job alert saves: the kept filters with the sheet's role, city and country. */
export function alertSearch(fields: AlertFields): Partial<JobSearchCriteria> & { query: string } {
	const city = fields.city.trim();
	return {
		...fields.filters,
		query: fields.role.trim(),
		...(city ? { location: city } : {}),
		...(fields.country ? { country: fields.country } : {}),
	};
}
