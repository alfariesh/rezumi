import z from "zod";
import { portfolioDataSchema, writablePortfolioDataSchema } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { portfolioThemeSchema } from "@rezumi/schema/portfolio/themes";
import { protectedProcedure } from "../../context";
import { portfolioMutationRateLimit, portfolioUpdateRateLimit } from "../../middleware/rate-limit";
import { portfolioService } from "./service";

// Kept out of the public API and its OpenAPI spec until portfolios launch (portfolio plan Phase 12).
const route = { tags: ["Internal"] };

const disabled = { PORTFOLIO_DISABLED: { status: 403, message: "Portfolios aren't available for this account yet." } };
const notFound = { NOT_FOUND: { status: 404, message: "This account has no portfolio yet." } };
const sourceInvalid = {
	PORTFOLIO_SOURCE_INVALID: { status: 400, message: "Choose one of your resumes that isn't in Trash." },
};

const resumeIdSchema = z.string().min(1).max(64);

const portfolioSchema = z.object({
	id: z.string(),
	sourceResumeId: z.string().nullable().describe("The resume its career sections come from; null for none."),
	sourceResume: z
		.object({ id: z.string(), name: z.string(), slug: z.string(), inTrash: z.boolean() })
		.nullable()
		.describe("The source resume. One in Trash still shows, so the editor can ask for another."),
	isPublic: z.boolean().describe("Whether it is published at /<username>."),
	showInSearchEngines: z.boolean(),
	publishedAt: z.date().nullable().describe("When it was first published."),
	suspendedAt: z.date().nullable().describe("When an admin took it down; it can't be published until lifted."),
	suspendedReason: z.string().nullable(),
	data: portfolioDataSchema,
	createdAt: z.date(),
	updatedAt: z.date().describe("Changes with every save of data; send it back with the next save."),
});

export const portfolioRouter = {
	get: protectedProcedure
		.route({ ...route, method: "GET", path: "/portfolio", operationId: "getPortfolio", summary: "Get the portfolio" })
		.input(z.object({}).optional())
		.output(
			z.object({
				enabled: z.boolean().describe("Whether portfolios are open to this account; false hides the feature."),
				portfolio: portfolioSchema.nullable(),
				limits: z.object({
					works: z.number().int(),
					storageBytes: z.number().int().nullable().describe("Null when unlimited."),
					dataBytes: z.number().int(),
				}),
				usage: z.object({ works: z.number().int(), storageBytes: z.number().int() }),
			}),
		)
		.handler(({ context }) => portfolioService.get(context.user.id)),

	create: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio",
			operationId: "createPortfolio",
			summary: "Create the portfolio",
		})
		.input(
			z.object({
				sourceResumeId: resumeIdSchema
					.nullable()
					.optional()
					.describe("A resume to start from; null for none; missing for the primary resume."),
				theme: portfolioThemeSchema.optional(),
				basics: z
					.object({
						name: z.string().max(PORTFOLIO_LIMITS.text.name).optional(),
						headline: z.string().max(PORTFOLIO_LIMITS.text.headline).optional(),
						location: z.string().max(PORTFOLIO_LIMITS.text.location).optional(),
					})
					.optional()
					.describe("For a portfolio without a resume."),
			}),
		)
		.use(portfolioMutationRateLimit)
		.errors({
			...disabled,
			...sourceInvalid,
			PORTFOLIO_EXISTS: { status: 409, message: "This account already has a portfolio." },
		})
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.create(context.user.id, input)),

	update: protectedProcedure
		.route({
			...route,
			method: "PUT",
			path: "/portfolio",
			operationId: "updatePortfolio",
			summary: "Save the portfolio's data",
		})
		.input(
			z.object({
				data: writablePortfolioDataSchema,
				expectedUpdatedAt: z.coerce
					.date()
					.describe("The updatedAt this save was made from; a different one means it changed elsewhere."),
			}),
		)
		.use(portfolioUpdateRateLimit)
		.errors({
			...disabled,
			...notFound,
			PORTFOLIO_VERSION_CONFLICT: { status: 409, message: "The portfolio changed somewhere else after you opened it." },
			PORTFOLIO_TOO_LARGE: { status: 413, message: "The portfolio is too large to save." },
			PORTFOLIO_FILE_NOT_FOUND: { status: 400, message: "A file in this portfolio isn't one of its uploads." },
		})
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.update(context.user.id, input)),

	setPublic: protectedProcedure
		.route({
			...route,
			method: "PUT",
			path: "/portfolio/public",
			operationId: "setPortfolioPublic",
			summary: "Publish or unpublish the portfolio",
		})
		.input(z.object({ isPublic: z.boolean() }))
		.use(portfolioMutationRateLimit)
		.errors({
			...disabled,
			...notFound,
			PORTFOLIO_EMAIL_NOT_VERIFIED: { status: 403, message: "Verify your email address before publishing." },
			PORTFOLIO_SUSPENDED: { status: 403, message: "This portfolio was taken down and can't be published." },
		})
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.setPublic(context.user.id, input)),

	updateSettings: protectedProcedure
		.route({
			...route,
			method: "PATCH",
			path: "/portfolio/settings",
			operationId: "updatePortfolioSettings",
			summary: "Change the portfolio's settings",
		})
		.input(
			z.object({
				showInSearchEngines: z.boolean().optional(),
				sourceResumeId: resumeIdSchema
					.nullable()
					.optional()
					.describe("Another resume of the account, or null for none."),
			}),
		)
		.use(portfolioMutationRateLimit)
		.errors({ ...disabled, ...notFound, ...sourceInvalid })
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.updateSettings(context.user.id, input)),

	delete: protectedProcedure
		.route({
			...route,
			method: "DELETE",
			path: "/portfolio",
			operationId: "deletePortfolio",
			summary: "Delete the portfolio",
		})
		.input(z.object({}).optional())
		.use(portfolioMutationRateLimit)
		.errors({ ...disabled, ...notFound })
		.output(z.void())
		.handler(({ context }) => portfolioService.delete(context.user.id)),
};
