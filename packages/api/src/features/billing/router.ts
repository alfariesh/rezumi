import z from "zod";
import { paidPlanIdSchema, planIdSchema } from "@rezumi/schema/billing";
import { protectedProcedure } from "../../context";
import { assertBillingAdmin, billingAdmin } from "./admin";
import { getEntitlements } from "./entitlements";
import { countActiveDocuments } from "./limits";

const route = { tags: ["Internal"] };

const usage = z.object({
	used: z.number().int().describe("Documents not in Trash."),
	max: z.number().int().nullable().describe("The plan's limit; null when unlimited."),
});

const period = z.object({
	id: z.string(),
	userId: z.string(),
	planId: paidPlanIdSchema,
	startsAt: z.date(),
	endsAt: z.date(),
});

const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
	await assertBillingAdmin(context.authentication);
	return next();
});

export const billingRouter = {
	summary: protectedProcedure
		.route({ ...route, method: "GET", path: "/billing/summary" })
		.input(z.object({}).optional())
		.output(
			z.object({
				enabled: z.boolean().describe("Whether plans apply to this account. False means unlimited."),
				planId: planIdSchema,
				currentPeriodEndsAt: z.date().nullable(),
				upcoming: z.array(z.object({ planId: paidPlanIdSchema, startsAt: z.date(), endsAt: z.date() })),
				limits: z.object({ activeResumes: usage, activeCoverLetters: usage }),
				features: z.object({
					premiumTemplates: z.boolean(),
					wordOdtExport: z.boolean(),
					customStyles: z.boolean(),
					customFonts: z.boolean(),
					automationApi: z.boolean(),
				}),
			}),
		)
		.handler(async ({ context }) => {
			const [entitlements, used] = await Promise.all([
				getEntitlements(context.user.id),
				countActiveDocuments(context.user.id),
			]);
			return {
				enabled: entitlements.enabled,
				planId: entitlements.planId,
				currentPeriodEndsAt: entitlements.currentPeriodEndsAt,
				upcoming: entitlements.upcoming,
				limits: {
					activeResumes: { used: used.activeResumes, max: entitlements.limits.activeResumes },
					activeCoverLetters: { used: used.activeCoverLetters, max: entitlements.limits.activeCoverLetters },
				},
				features: entitlements.features,
			};
		}),

	admin: {
		grantPeriod: adminProcedure
			.route({ ...route, method: "POST", path: "/billing/admin/periods" })
			.input(
				z
					.object({
						userId: z.string().min(1).optional(),
						email: z.email().optional(),
						planId: paidPlanIdSchema,
						days: z.number().int().min(1).max(366),
						reason: z.string().trim().min(3).max(500),
					})
					.refine((input) => (input.userId === undefined) !== (input.email === undefined), {
						message: "Give either userId or email.",
					}),
			)
			.output(period)
			.handler(({ context, input }) => billingAdmin.grantPeriod({ ...input, actorUserId: context.user.id })),

		revokePeriod: adminProcedure
			.route({ ...route, method: "POST", path: "/billing/admin/periods/{periodId}/revoke" })
			.input(z.object({ periodId: z.string().min(1), reason: z.string().trim().min(3).max(500) }))
			.output(period)
			.handler(({ context, input }) => billingAdmin.revokePeriod({ ...input, actorUserId: context.user.id })),
	},
};
