import { ORPCError } from "@orpc/server";
import z from "zod";
import { jobListingFitSchema } from "@rezumi/schema/jobs/fit";
import { jobListingSchema } from "@rezumi/schema/jobs/listing";
import {
	jobSearchDefaultsSchema,
	jobSearchRecentSchema,
	jobSearchRequestSchema,
	jobSearchResultSchema,
	jobSearchStatusSchema,
	jobTrackResultSchema,
} from "@rezumi/schema/jobs/search";
import { protectedProcedure } from "../../context";
import { aiRequestRateLimit } from "../../middleware/rate-limit";
import { adminProcedure } from "../auth/admin-session";
import { aiSourceInput } from "../billing/ai-source";
import { JOB_COST_DAYS, jobCostReport, jobCostReportSchema } from "./admin";
import { jobSearchDefaults } from "./defaults";
import { checkListingFit, readListingFit } from "./fit";
import { forgetRecentSearches } from "./recent";
import { JobSearchError, jobSearchService } from "./service";
import { trackListing } from "./track";

/**
 * Job search over oRPC (`02-teknis.md` section 7). Listings come from Hirebase and JobsPipe through Rezumi's own treg
 * account: people set nothing up. Their data rules apply (section 13): every listing links to its original posting,
 * and nothing here exports listings in bulk.
 */

const route = { tags: ["Jobs"] } as const;

const listingGone = { NOT_FOUND: { message: "This job listing isn't available anymore.", status: 404 } } as const;

const errors = {
	JOBS_UNAVAILABLE: { message: "Job search isn't available right now. Try again later.", status: 503 },
	JOBS_BUDGET_LIMITED: {
		message: "Job search has reached today's limit on this server. Try again tomorrow.",
		status: 503,
	},
	RATE_LIMIT_EXCEEDED: { message: "Too many searches in a short time. Wait a minute, then try again.", status: 429 },
	BAD_REQUEST: { message: "This list can't be continued. Search again to see more jobs.", status: 400 },
} as const;

function searchError(error: unknown): never {
	if (!(error instanceof JobSearchError)) throw error;
	switch (error.code) {
		case "unavailable":
			throw new ORPCError("JOBS_UNAVAILABLE", { status: 503, message: errors.JOBS_UNAVAILABLE.message });
		case "budget":
			throw new ORPCError("JOBS_BUDGET_LIMITED", { status: 503, message: errors.JOBS_BUDGET_LIMITED.message });
		case "rate-limit":
			throw new ORPCError("RATE_LIMIT_EXCEEDED", { status: 429, message: errors.RATE_LIMIT_EXCEEDED.message });
		case "cursor":
			throw new ORPCError("BAD_REQUEST", { status: 400, message: errors.BAD_REQUEST.message });
	}
}

export const jobsRouter = {
	search: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/jobs/search",
			operationId: "searchJobs",
			summary: "Search job listings",
			description:
				"Searches current job listings (20 a page) by title, place and filters. Each new search or further page counts toward the plan's searches a day; opening the same page again that day doesn't. Answers may come from a shared cache up to six hours old. Requires authentication.",
		})
		.input(jobSearchRequestSchema)
		.output(jobSearchResultSchema)
		.errors({
			...errors,
			PLAN_LIMIT_REACHED: { message: "Today's job searches are used up.", status: 403 },
		})
		.handler(async ({ context, input, signal }) => {
			try {
				return await jobSearchService.search(context.user.id, input, signal);
			} catch (error) {
				signal?.throwIfAborted();
				return searchError(error);
			}
		}),

	listing: protectedProcedure
		.route({
			...route,
			method: "GET",
			path: "/jobs/listings/{id}",
			operationId: "getJobListing",
			summary: "Get a job listing",
			description:
				"Returns one job listing with its full description and the link to the original posting. A closed listing has closedAt set. Requires authentication.",
		})
		.input(z.object({ id: z.string().min(1).max(64) }))
		.output(jobListingSchema)
		.errors(listingGone)
		.handler(async ({ input }) => {
			const listing = await jobSearchService.listing(input.id);
			if (!listing) throw new ORPCError("NOT_FOUND", { status: 404 });
			return listing;
		}),

	hide: protectedProcedure
		.route({
			...route,
			method: "PUT",
			path: "/jobs/listings/{id}/hidden",
			operationId: "hideJobListing",
			summary: "Hide or show a job listing",
			description: "Hides a job listing from your search results, or shows it again. Requires authentication.",
		})
		.input(z.object({ id: z.string().min(1).max(64), hidden: z.boolean().default(true) }))
		.output(z.object({ hidden: z.boolean() }))
		.errors(listingGone)
		.handler(async ({ context, input }) => {
			if (!(await jobSearchService.hide(context.user.id, input.id, input.hidden)))
				throw new ORPCError("NOT_FOUND", { status: 404 });
			return { hidden: input.hidden };
		}),

	track: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/jobs/listings/{id}/track",
			operationId: "trackJobListing",
			summary: "Track a job listing",
			description:
				"Saves a job listing as an application in the Saved stage, with its role, company, place, listed pay, the provider's copy of the posting and the link to the original. A posting already saved gives back that application instead of a second one. Requires authentication.",
		})
		.input(z.object({ id: z.string().min(1).max(64) }))
		.output(jobTrackResultSchema)
		.errors(listingGone)
		.handler(async ({ context, input }) => {
			const listing = await jobSearchService.listing(input.id);
			if (!listing || listing.closedAt) throw new ORPCError("NOT_FOUND", { status: 404 });
			return trackListing(context.user.id, listing);
		}),

	fit: protectedProcedure
		.route({
			...route,
			method: "GET",
			path: "/jobs/listings/{id}/fit",
			operationId: "getJobListingFit",
			summary: "Get your fit check of a job listing",
			description:
				"Returns the AI fit check you ran on a job listing, if any, and whether your Profile changed since (then it's outdated). Costs nothing. Requires authentication.",
		})
		.input(z.object({ id: z.string().min(1).max(64) }))
		.output(jobListingFitSchema)
		.handler(({ context, input }) => readListingFit(context.user.id, input.id)),

	checkFit: protectedProcedure
		.use(aiRequestRateLimit)
		.route({
			...route,
			method: "POST",
			path: "/jobs/listings/{id}/fit",
			operationId: "checkJobListingFit",
			summary: "Check your fit for a job listing with AI",
			description:
				"Checks each requirement of a job listing against the facts and stories in your Profile and compares the job with your preferences, as the application workspace's Fit check does. With `aiSource: \"rezumi\"` it costs 4 Rezumi AI credits. The answer is kept: asking again while your Profile is unchanged gives it back without running or charging again. Tracking the listing copies it into the application's workspace. Requires authentication.",
		})
		.input(
			z.object({
				id: z.string().min(1).max(64),
				locale: z.string().max(20).default("en-US"),
				...aiSourceInput,
			}),
		)
		.output(jobListingFitSchema)
		.errors(listingGone)
		.handler(({ context, input, signal }) =>
			checkListingFit({
				userId: context.user.id,
				listingId: input.id,
				locale: input.locale,
				aiSource: input.aiSource,
				idempotencyKey: input.idempotencyKey,
				signal,
			}),
		),

	defaults: protectedProcedure
		.route({
			...route,
			method: "GET",
			path: "/jobs/defaults",
			operationId: "getJobSearchDefaults",
			summary: "Get a starting job search",
			description:
				"Returns the role, place and country a job search starts from, taken from your career preferences and search regions. Searches nothing. Requires authentication.",
		})
		.input(z.object({}).optional())
		.output(jobSearchDefaultsSchema)
		.handler(({ context }) =>
			jobSearchDefaults(context.user.id, context.reqHeaders.get("x-client-timezone") ?? undefined),
		),

	quota: protectedProcedure
		.route({
			...route,
			method: "GET",
			path: "/jobs/quota",
			operationId: "getJobSearchQuota",
			summary: "Get job search availability and today's searches",
			description:
				"Says whether job search is available on this server, whether only saved results are given right now, and how many of today's searches are used. Requires authentication.",
		})
		.input(z.object({}).optional())
		.output(jobSearchStatusSchema)
		.handler(({ context }) => jobSearchService.status(context.user.id)),

	recent: protectedProcedure
		.route({
			...route,
			method: "GET",
			path: "/jobs/recent",
			operationId: "listRecentJobSearches",
			summary: "List your recent job searches",
			description:
				"Returns your last 10 job searches, newest first, each with `seenToday`: whether its first page was opened today, so searching it again today doesn't count toward the day's searches. Searches nothing. Requires authentication.",
		})
		.input(z.object({}).optional())
		.output(z.object({ searches: z.array(jobSearchRecentSchema) }))
		.handler(async ({ context }) => ({ searches: await jobSearchService.recent(context.user.id) })),

	forgetRecent: protectedProcedure
		.route({
			...route,
			method: "DELETE",
			path: "/jobs/recent/{id}",
			operationId: "forgetRecentJobSearch",
			summary: "Remove a recent job search",
			description: "Removes one search from your recent job searches. Requires authentication.",
		})
		.input(z.object({ id: z.string().min(1).max(64) }))
		.output(z.object({ ok: z.literal(true) }))
		.handler(async ({ context, input }) => {
			await forgetRecentSearches(context.user.id, input.id);
			return { ok: true as const };
		}),

	clearRecent: protectedProcedure
		.route({
			...route,
			method: "DELETE",
			path: "/jobs/recent",
			operationId: "clearRecentJobSearches",
			summary: "Clear your recent job searches",
			description: "Removes every search from your recent job searches. Requires authentication.",
		})
		.input(z.object({}).optional())
		.output(z.object({ ok: z.literal(true) }))
		.handler(async ({ context }) => {
			await forgetRecentSearches(context.user.id);
			return { ok: true as const };
		}),

	admin: {
		costs: adminProcedure
			.route({ tags: ["Internal"], method: "GET", path: "/jobs/admin/costs", operationId: "getJobSearchCosts" })
			.input(z.object({ days: z.union(JOB_COST_DAYS.map((days) => z.literal(days))).default(7) }))
			.output(jobCostReportSchema)
			.handler(({ input }) => jobCostReport({ days: input.days })),
	},
};
