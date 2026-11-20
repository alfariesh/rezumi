import { ORPCError } from "@orpc/server";
import z from "zod";
import { jobListingSchema } from "@rezumi/schema/jobs/listing";
import { jobSearchRequestSchema, jobSearchResultSchema, jobSearchStatusSchema } from "@rezumi/schema/jobs/search";
import { protectedProcedure } from "../../context";
import { JobSearchError, jobSearchService } from "./service";

/**
 * Job search over oRPC (`02-teknis.md` section 7). Listings come from Hirebase and JobsPipe through Rezumi's own treg
 * account: people set nothing up. Their data rules apply (section 13): every listing links to its original posting,
 * and nothing here exports listings in bulk.
 */

const route = { tags: ["Jobs"] } as const;

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
		.errors({ NOT_FOUND: { message: "This job listing isn't available anymore.", status: 404 } })
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
		.errors({ NOT_FOUND: { message: "This job listing isn't available anymore.", status: 404 } })
		.handler(async ({ context, input }) => {
			if (!(await jobSearchService.hide(context.user.id, input.id, input.hidden)))
				throw new ORPCError("NOT_FOUND", { status: 404 });
			return { hidden: input.hidden };
		}),

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
};
