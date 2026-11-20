import z from "zod";
import { jobListingSchema, jobSenioritySchema, jobWorkArrangementSchema } from "./listing";

/** What a job search asks for (`.agents/docs/plans/lowongan/02-teknis.md` section 7). */

export const JOB_SEARCH_POSTED_WITHIN_DAYS = [1, 7, 14, 30] as const;
export const JOB_SEARCH_REMOTE = ["any", "only", "exclude"] as const;
/** Listings a page of results holds (K3). */
export const JOB_SEARCH_PAGE_SIZE = 20;

export const jobSearchInputSchema = z.object({
	query: z.string().trim().min(2).max(200),
	/** A city or area inside the country, such as "Berlin". */
	location: z.string().trim().min(1).max(200).optional(),
	/** ISO 3166-1 alpha-2; empty searches everywhere. */
	country: z
		.string()
		.regex(/^[A-Z]{2}$/)
		.optional(),
	/** `only` with a country is "remote in this country"; without one, "remote anywhere". */
	remote: z.enum(JOB_SEARCH_REMOTE).default("any"),
	postedWithinDays: z.union(JOB_SEARCH_POSTED_WITHIN_DAYS.map((days) => z.literal(days))).default(30),
	workArrangement: jobWorkArrangementSchema.optional(),
	seniority: jobSenioritySchema.optional(),
	salaryMin: z.number().int().positive().max(100_000_000).optional(),
	salaryCurrency: z
		.string()
		.regex(/^[A-Z]{3}$/)
		.optional(),
	includeNoSalary: z.boolean().default(true),
	visaSponsorship: z.boolean().optional(),
	/** A provider's own page token, used between Rezumi and the provider; `jobs.search` takes its own cursor instead. */
	cursor: z.string().max(2_000).optional(),
});
export type JobSearchInput = z.infer<typeof jobSearchInputSchema>;

/** A search as a job alert keeps it: everything but the page cursor. */
export const jobSearchCriteriaSchema = jobSearchInputSchema.omit({ cursor: true });
export type JobSearchCriteria = z.infer<typeof jobSearchCriteriaSchema>;

/** The page token `jobs.search` hands back for "load more": the id of the page it continues from. */
export const jobSearchCursorSchema = z.string().regex(/^[a-f0-9]{64}$/);

/** What `jobs.search` takes: a search, and for "load more" the cursor the previous page returned. */
export const jobSearchRequestSchema = jobSearchInputSchema.extend({ cursor: jobSearchCursorSchema.optional() });
export type JobSearchRequest = z.infer<typeof jobSearchRequestSchema>;

/** A listing as a search result shows it: everything but the full description, which `jobs.listing` returns. */
export const jobListingCardSchema = jobListingSchema.omit({ description: true });
export type JobListingCard = z.infer<typeof jobListingCardSchema>;

export const jobSearchQuotaSchema = z.object({
	used: z.number().int().nonnegative(),
	max: z.number().int().nonnegative(),
	/** When the count starts again: midnight in the account's time zone. */
	resetsAt: z.iso.datetime({ offset: true }),
});
export type JobSearchQuota = z.infer<typeof jobSearchQuotaSchema>;

/**
 * How a listing's skills read against the person's Profile, without AI (K8): the skills the listing names that the
 * Profile mentions, and those it doesn't yet. Missing here is missing from the Profile, not from the person.
 */
export const jobListingMatchSchema = z.object({
	matched: z.array(z.string()),
	missing: z.array(z.string()),
});
export type JobListingMatch = z.infer<typeof jobListingMatchSchema>;

export const jobSearchResultSchema = z.object({
	listings: z.array(jobListingCardSchema),
	/** Passed back as `cursor` for the next page; missing on the last one. */
	cursor: jobSearchCursorSchema.optional(),
	/** When the providers answered this page. */
	fetchedAt: z.iso.datetime({ offset: true }),
	/** Answered from Rezumi's shared cache, without calling a provider. */
	fromCache: z.boolean(),
	/** An older answer than usual, because the providers couldn't be asked just now. */
	stale: z.boolean(),
	/** Today's server budget for job providers is spent: only saved answers until tomorrow (K7). */
	budgetLimited: z.boolean(),
	quota: jobSearchQuotaSchema,
	/** The listings on this page the person already tracks: listing id → application id. */
	tracked: z.record(z.string(), z.string()),
	/** Listing id → its skills against the person's Profile; missing for listings that name no skills. */
	matches: z.record(z.string(), jobListingMatchSchema).default({}),
});
export type JobSearchResult = z.infer<typeof jobSearchResultSchema>;

export const jobSearchStatusSchema = z.object({
	/** Whether this server can search for jobs at all (a treg token is set). */
	available: z.boolean(),
	/** Only saved answers right now: the day's budget is spent or searching is switched off. */
	cacheOnly: z.boolean(),
	quota: jobSearchQuotaSchema,
});
export type JobSearchStatus = z.infer<typeof jobSearchStatusSchema>;

/**
 * Where the Jobs page starts: the first role and place from the person's career preferences, and the country their
 * searches target (`searchRegions`, else the account time zone's). Nothing is searched until they press Search.
 */
export const jobSearchDefaultsSchema = z.object({
	query: z.string(),
	location: z.string(),
	/** Empty: anywhere. */
	country: z.string(),
	remote: z.enum(JOB_SEARCH_REMOTE),
	/** Up to three roles from the preferences, offered before the first search. */
	suggestions: z.array(z.string()),
});
export type JobSearchDefaults = z.infer<typeof jobSearchDefaultsSchema>;

/** What `jobs.track` gives back: the application the listing is tracked as, and whether it was just made. */
export const jobTrackResultSchema = z.object({
	applicationId: z.string(),
	created: z.boolean(),
});
export type JobTrackResult = z.infer<typeof jobTrackResultSchema>;
