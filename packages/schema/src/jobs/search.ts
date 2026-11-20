import z from "zod";
import { jobSenioritySchema, jobWorkArrangementSchema } from "./listing";

/** What a job search asks for (`.agents/docs/plans/lowongan/02-teknis.md` section 7). */

export const JOB_SEARCH_POSTED_WITHIN_DAYS = [1, 7, 14, 30] as const;
export const JOB_SEARCH_REMOTE = ["any", "only", "exclude"] as const;

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
	cursor: z.string().max(2_000).optional(),
});
export type JobSearchInput = z.infer<typeof jobSearchInputSchema>;
