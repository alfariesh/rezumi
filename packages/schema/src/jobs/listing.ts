import z from "zod";

/**
 * A job listing from a job data provider, in Rezumi's own shape (`.agents/docs/plans/lowongan/02-teknis.md` section 5).
 * Listings are shared between accounts: they hold what the provider published, never anything about a person who
 * searched, and never a recruiter's or hiring team's contact details.
 */

export const JOB_PROVIDERS = ["hirebase", "jobspipe"] as const;
export const jobProviderSchema = z.enum(JOB_PROVIDERS);
export type JobProvider = z.infer<typeof jobProviderSchema>;

export const JOB_WORK_ARRANGEMENTS = ["onsite", "hybrid", "remote"] as const;
export const jobWorkArrangementSchema = z.enum(JOB_WORK_ARRANGEMENTS);
export type JobWorkArrangement = z.infer<typeof jobWorkArrangementSchema>;

/** Seniority on one scale for every provider. */
export const JOB_SENIORITIES = ["entry", "junior", "mid", "senior", "lead", "executive"] as const;
export const jobSenioritySchema = z.enum(JOB_SENIORITIES);
export type JobSeniority = z.infer<typeof jobSenioritySchema>;

export const JOB_SALARY_PERIODS = ["year", "month", "hour", "unknown"] as const;

/** Longest description kept for a listing, the same cap as a saved posting. */
export const MAX_JOB_DESCRIPTION_CHARS = 20_000;

const httpUrl = z.url({ protocol: /^https?$/ });
const text = (max: number) => z.string().trim().min(1).max(max);

export const jobCompanySchema = z.object({
	name: text(300),
	domain: text(253).optional(),
	logoUrl: httpUrl.optional(),
	size: text(60).optional(),
	industry: text(200).optional(),
});

export const jobLocationSchema = z.object({
	city: text(200).optional(),
	region: text(200).optional(),
	country: text(200).optional(),
	countryCode: z
		.string()
		.regex(/^[A-Z]{2}$/)
		.optional(),
	/** The place as shown, such as "Berlin, Germany" or "Remote". */
	text: z.string().trim().max(500),
});

export const jobSalarySchema = z.object({
	min: z.number().nonnegative().optional(),
	max: z.number().nonnegative().optional(),
	currency: z
		.string()
		.regex(/^[A-Z]{3}$/)
		.or(z.literal("")),
	period: z.enum(JOB_SALARY_PERIODS),
});

/** What a provider adapter produces: a listing before Rezumi has stored it. */
export const jobListingDraftSchema = z.object({
	provider: jobProviderSchema,
	externalId: text(200),
	title: text(500),
	company: jobCompanySchema,
	location: jobLocationSchema,
	workArrangement: jobWorkArrangementSchema.optional(),
	seniority: jobSenioritySchema.optional(),
	employmentType: text(100).optional(),
	visaSponsorship: z.boolean().optional(),
	/** Pay the posting itself lists; a provider's estimate never goes here. */
	salary: jobSalarySchema.optional(),
	/** Plain text, never HTML: the provider's text is untrusted data. */
	description: z.string().max(MAX_JOB_DESCRIPTION_CHARS),
	requirementsSummary: text(2_000).optional(),
	skills: z.array(text(200)).max(100),
	/** The original posting, always shown with the listing. */
	postingUrl: httpUrl,
	applyUrl: httpUrl.optional(),
	/** Where the provider found it, such as "linkedin", "indeed" or "workday". */
	source: text(100).optional(),
	language: text(20).optional(),
	postedAt: z.iso.datetime({ offset: true }).optional(),
	closedAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export type JobListingDraft = z.infer<typeof jobListingDraftSchema>;

export const jobListingSchema = jobListingDraftSchema.extend({
	id: z.string().min(1),
	firstSeenAt: z.iso.datetime({ offset: true }),
	lastVerifiedAt: z.iso.datetime({ offset: true }),
	closedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type JobListing = z.infer<typeof jobListingSchema>;
