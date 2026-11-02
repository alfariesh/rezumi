import z from "zod";
import { creditSourceSchema, paidPlanIdSchema, planIdSchema } from "@rezumi/schema/billing";
import { protectedProcedure } from "../../context";
import { assertBillingAdmin, billingAdmin } from "./admin";
import { getCreditBalance, listCreditHistory } from "./credits";
import { getEntitlements, isBillingAppliedTo } from "./entitlements";
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

const credits = z.object({
	balance: z.number().int().describe("Rezumi AI credits that can be spent now."),
	nextExpiry: z
		.object({ credits: z.number().int(), at: z.date() })
		.nullable()
		.describe("The soonest expiry among those credits, and how many expire then."),
	trial: z.object({
		available: z.boolean().describe("Whether the trial credits come with the first use of Rezumi AI."),
		grantedAt: z.date().nullable(),
		expiresAt: z.date().nullable(),
	}),
});

const creditHistoryEntry = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("grant"),
		id: z.string(),
		at: z.date(),
		source: creditSourceSchema,
		amount: z.number().int(),
		remaining: z.number().int(),
		expiresAt: z.date(),
		revokedAt: z.date().nullable(),
	}),
	z.object({
		type: z.literal("usage"),
		id: z.string(),
		at: z.date(),
		action: z.string().describe("The kind of Rezumi AI work, or admin-adjustment for a correction."),
		credits: z.number().int(),
		status: z.enum(["reserved", "committed", "released"]),
	}),
]);

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
				credits: credits.nullable().describe("Rezumi AI credits; null while plans don't apply to the account."),
			}),
		)
		.handler(async ({ context }) => {
			const now = new Date();
			const [entitlements, used] = await Promise.all([
				getEntitlements(context.user.id, now),
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
				credits: entitlements.enabled ? await getCreditBalance(context.user.id, now) : null,
			};
		}),

	creditHistory: protectedProcedure
		.route({ ...route, method: "GET", path: "/billing/credits/history" })
		.input(
			z
				.object({
					limit: z.number().int().min(1).max(50).optional().describe("Maximum entries (1–50). Defaults to 20."),
					offset: z.number().int().min(0).max(5000).optional().describe("Zero-based offset. Defaults to 0."),
				})
				.optional(),
		)
		.output(z.object({ items: z.array(creditHistoryEntry), hasMore: z.boolean() }))
		.handler(async ({ context, input }) => {
			if (!(await isBillingAppliedTo(context.user.id))) return { items: [], hasMore: false };
			return listCreditHistory(context.user.id, { limit: input?.limit ?? 20, offset: input?.offset ?? 0 });
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

		adjustCredits: adminProcedure
			.route({ ...route, method: "POST", path: "/billing/admin/credits" })
			.input(
				z
					.object({
						userId: z.string().min(1).optional(),
						email: z.email().optional(),
						amount: z
							.number()
							.int()
							.min(-10_000)
							.max(10_000)
							.refine((amount) => amount !== 0, { message: "Give a positive or negative amount." }),
						expiresInDays: z.number().int().min(1).max(366).optional(),
						reason: z.string().trim().min(3).max(500),
					})
					.refine((input) => (input.userId === undefined) !== (input.email === undefined), {
						message: "Give either userId or email.",
					})
					.refine((input) => input.amount < 0 || input.expiresInDays !== undefined, {
						message: "Say in how many days added credits expire.",
					}),
			)
			.output(
				z.object({
					userId: z.string(),
					amount: z.number().int(),
					balance: z.number().int(),
					expiresAt: z.date().nullable(),
				}),
			)
			.handler(({ context, input }) => billingAdmin.adjustCredits({ ...input, actorUserId: context.user.id })),

		revokePeriod: adminProcedure
			.route({ ...route, method: "POST", path: "/billing/admin/periods/{periodId}/revoke" })
			.input(z.object({ periodId: z.string().min(1), reason: z.string().trim().min(3).max(500) }))
			.output(period)
			.handler(({ context, input }) => billingAdmin.revokePeriod({ ...input, actorUserId: context.user.id })),
	},
};
