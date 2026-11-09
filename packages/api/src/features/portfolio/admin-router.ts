import z from "zod";
import { portfolioDataSchema } from "@rezumi/schema/portfolio/data";
import {
	PORTFOLIO_REPORT_LIMITS,
	PORTFOLIO_REPORT_REASONS,
	PORTFOLIO_REPORT_STATUSES,
} from "@rezumi/schema/portfolio/moderation";
import { resumeDataSchema } from "@rezumi/schema/resume/data";
import { protectedProcedure } from "../../context";
import { assertAdminSession } from "../auth/admin-session";
import { portfolioErrorMap, portfolioErrors } from "./errors";
import { getPortfolioMode } from "./mode";
import {
	findPortfolioForAdmin,
	getPortfolioForAdmin,
	liftPortfolioSuspension,
	listPortfolioReports,
	setPortfolioOwnerBanned,
	setPortfolioReportStatus,
	suspendPortfolio,
} from "./moderation";

// Kept out of the public API: the owner's tools, like the billing admin.
const route = { tags: ["Internal"] };

/** Web sessions of administrators, while portfolios exist at all. */
const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
	await assertAdminSession(context.authentication);
	if (getPortfolioMode() === "off") throw portfolioErrors.disabled();
	return next();
});

const idSchema = z.string().min(1).max(64);
const reasonSchema = z.string().trim().min(3).max(PORTFOLIO_REPORT_LIMITS.reason);
const okSchema = z.object({ ok: z.literal(true) });

const reportSchema = z.object({
	id: z.string(),
	reason: z.enum(PORTFOLIO_REPORT_REASONS),
	details: z.string(),
	reporterEmail: z.string().nullable(),
	status: z.enum(PORTFOLIO_REPORT_STATUSES),
	createdAt: z.date(),
	handledAt: z.date().nullable(),
});

export const portfolioAdminRouter = {
	reports: adminProcedure
		.route({ ...route, method: "GET", path: "/portfolio/admin/reports", operationId: "listPortfolioReports" })
		.input(z.object({ status: z.enum(PORTFOLIO_REPORT_STATUSES).optional(), cursor: z.string().max(128).optional() }))
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED"))
		.output(
			z.object({
				items: z.array(
					reportSchema.extend({
						portfolioId: z.string(),
						isPublic: z.boolean(),
						suspendedAt: z.date().nullable(),
						username: z.string(),
						ownerEmail: z.string(),
					}),
				),
				open: z.number().int(),
				nextCursor: z.string().nullable(),
			}),
		)
		.handler(({ input }) => listPortfolioReports(input)),

	find: adminProcedure
		.route({ ...route, method: "GET", path: "/portfolio/admin/find", operationId: "findPortfolioForAdmin" })
		.input(z.object({ query: z.string().trim().min(1).max(254) }))
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED", "NOT_FOUND"))
		.output(z.object({ portfolioId: z.string() }))
		.handler(({ input }) => findPortfolioForAdmin(input.query)),

	get: adminProcedure
		.route({ ...route, method: "GET", path: "/portfolio/admin/{portfolioId}", operationId: "getPortfolioForAdmin" })
		.input(z.object({ portfolioId: idSchema }))
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED", "NOT_FOUND"))
		.output(
			z.object({
				id: z.string(),
				isPublic: z.boolean(),
				suspendedAt: z.date().nullable(),
				suspendedReason: z.string().nullable(),
				data: portfolioDataSchema,
				resumeData: resumeDataSchema.nullable(),
				ownerId: z.string(),
				ownerName: z.string(),
				username: z.string(),
				ownerEmail: z.string(),
				ownerRole: z.string().nullable(),
				ownerBanned: z.boolean(),
				ownerBanReason: z.string().nullable(),
				ownerCreatedAt: z.date(),
				reports: z.array(reportSchema),
				history: z.array(
					z.object({
						id: z.string(),
						action: z.string(),
						reason: z.string().nullable(),
						createdAt: z.date(),
						actorName: z.string().nullable(),
					}),
				),
			}),
		)
		.handler(({ input }) => getPortfolioForAdmin(input.portfolioId)),

	suspend: adminProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/admin/{portfolioId}/suspend",
			operationId: "suspendPortfolio",
		})
		.input(z.object({ portfolioId: idSchema, reason: reasonSchema }))
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED", "NOT_FOUND", "PORTFOLIO_MODERATION_CONFLICT"))
		.output(okSchema)
		.handler(({ context, input }) => suspendPortfolio(context.user.id, input)),

	lift: adminProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/admin/{portfolioId}/lift",
			operationId: "liftPortfolioSuspension",
		})
		.input(z.object({ portfolioId: idSchema, reason: reasonSchema }))
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED", "NOT_FOUND", "PORTFOLIO_MODERATION_CONFLICT"))
		.output(okSchema)
		.handler(({ context, input }) => liftPortfolioSuspension(context.user.id, input)),

	setBanned: adminProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/admin/{portfolioId}/ban",
			operationId: "setPortfolioOwnerBanned",
		})
		.input(z.object({ portfolioId: idSchema, banned: z.boolean(), reason: reasonSchema }))
		.errors(
			portfolioErrorMap(
				"PORTFOLIO_DISABLED",
				"NOT_FOUND",
				"PORTFOLIO_MODERATION_CONFLICT",
				"PORTFOLIO_CANNOT_BAN_ADMIN",
			),
		)
		.output(okSchema)
		.handler(({ context, input }) => setPortfolioOwnerBanned(context.user.id, input)),

	setReportStatus: adminProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/admin/reports/{reportId}/status",
			operationId: "setPortfolioReportStatus",
		})
		.input(z.object({ reportId: idSchema, status: z.enum(PORTFOLIO_REPORT_STATUSES), reason: reasonSchema }))
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED"))
		.output(okSchema)
		.handler(({ context, input }) => setPortfolioReportStatus(context.user.id, input)),
};
