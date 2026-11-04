import type { RequestAuthentication } from "../../context";
import { ORPCError } from "@orpc/server";
import z from "zod";
import { BILLING_PAYMENT_STATUSES } from "@rezumi/db/schema";
import { creditSourceSchema, paidPlanIdSchema, planIdSchema } from "@rezumi/schema/billing";
import { protectedProcedure } from "../../context";
import { checkoutRateLimit } from "../../middleware/rate-limit";
import { assertBillingAdmin, billingAdmin } from "./admin";
import { listRecentAlerts } from "./alerts";
import {
	changePaymentMethod,
	checkout,
	getPayment,
	getPendingPayment,
	listPayments,
	previewPurchase,
	purchaseBlocker,
} from "./checkout";
import { getCreditBalance, listCreditHistory } from "./credits";
import { getEntitlements, isBillingAppliedTo } from "./entitlements";
import { countActiveDocuments } from "./limits";
import { billingDailySeries, billingMetrics, exportPaymentsCsv, listRecentPayments, previousRange } from "./reports";

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

const payment = z.object({
	id: z.string(),
	orderId: z.string().describe("The order number Midtrans and the receipt show."),
	planId: paidPlanIdSchema,
	amount: z.number().int().describe("Whole Rupiah."),
	currency: z.string(),
	durationDays: z.number().int(),
	credits: z.number().int().describe("Rezumi AI credits that come with it."),
	status: z.enum(BILLING_PAYMENT_STATUSES),
	paymentType: z.string().nullable().describe("The Midtrans method used, once chosen."),
	createdAt: z.date(),
	expiresAt: z.date().nullable().describe("When it can no longer be paid."),
	paidAt: z.date().nullable(),
	refundedAmount: z.number().int(),
	redirectUrl: z
		.string()
		.nullable()
		.describe("Where to continue paying: web sessions only, while the payment is open."),
});

const paymentDetail = payment.extend({
	access: z
		.object({ startsAt: z.date(), endsAt: z.date() })
		.nullable()
		.describe("When the pass it bought runs, first day to last; null until it is granted."),
});

const purchasePreview = z.object({
	planId: paidPlanIdSchema,
	amount: z.number().int().describe("Whole Rupiah, as checkout would charge now."),
	currency: z.string(),
	durationDays: z.number().int(),
	credits: z.number().int().describe("Rezumi AI credits that come with it."),
	schedule: z
		.array(z.object({ planId: paidPlanIdSchema, startsAt: z.date(), endsAt: z.date(), purchase: z.boolean() }))
		.describe(
			"The account's paid time if this pass were paid now, in the order it is used; purchase marks the new pass.",
		),
});

const checkoutResult = z.object({
	paymentId: z.string(),
	redirectUrl: z.string().describe("The Midtrans payment page to send the browser to."),
	expiresAt: z.date(),
	reused: z.boolean().describe("Whether this is an open payment from before rather than a new one."),
});

const paymentIdInput = z.object({ paymentId: z.string().min(1).max(100) });
// Midtrans keeps a refund reason of up to 255 characters.
const refundReason = z.string().trim().min(3).max(255);
const reportRange = z
	.object({ from: z.date(), to: z.date() })
	.refine((range) => range.to > range.from, { message: "The end must be after the start." });

const refundResult = z.object({
	refundId: z.string(),
	status: z.enum(["requesting", "succeeded", "failed"]),
	amount: z.number().int(),
	paymentStatus: z.enum(BILLING_PAYMENT_STATUSES),
	refundedAmount: z.number().int(),
});

const idempotencyKey = z
	.string()
	.trim()
	.min(1)
	.max(200)
	.describe("A new random key per click; repeating it returns the same payment.");

/** How the request signed in; buying depends on it. A protected procedure always has one. */
function authenticationOf(context: { authentication?: RequestAuthentication | null | undefined }) {
	if (!context.authentication) throw new ORPCError("UNAUTHORIZED");
	return context.authentication;
}

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
					brandLogos: z.boolean(),
					wordOdtExport: z.boolean(),
					customStyles: z.boolean(),
					customFonts: z.boolean(),
					automationApi: z.boolean(),
				}),
				credits: credits.nullable().describe("Rezumi AI credits; null while plans don't apply to the account."),
				canPurchase: z.boolean().describe("Whether this session can buy a pass now (web sessions only)."),
				purchaseBlockedBy: z
					.enum(["unavailable", "paused", "web_only", "guest", "email_not_verified"])
					.nullable()
					.describe("Why it can't, when it can't."),
				pendingPayment: payment.nullable().describe("The newest payment that can still be paid; web sessions only."),
			}),
		)
		.handler(async ({ context }) => {
			const now = new Date();
			const authentication = authenticationOf(context);
			const [entitlements, used, blocker] = await Promise.all([
				getEntitlements(context.user.id, now),
				countActiveDocuments(context.user.id),
				purchaseBlocker(authentication),
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
				canPurchase: blocker === null,
				purchaseBlockedBy: blocker,
				pendingPayment: entitlements.enabled ? await getPendingPayment(authentication, now) : null,
			};
		}),

	previewPurchase: protectedProcedure
		.route({ ...route, method: "GET", path: "/billing/purchase-preview" })
		.input(z.object({ planId: paidPlanIdSchema }))
		.output(purchasePreview)
		.handler(({ context, input }) => previewPurchase(context.user.id, input.planId)),

	checkout: protectedProcedure
		.route({ ...route, method: "POST", path: "/billing/checkout" })
		.use(checkoutRateLimit)
		.input(z.object({ planId: paidPlanIdSchema, idempotencyKey }))
		.output(checkoutResult)
		.handler(({ context, input }) =>
			checkout({
				authentication: authenticationOf(context),
				planId: input.planId,
				idempotencyKey: input.idempotencyKey,
				locale: context.locale,
			}),
		),

	changePaymentMethod: protectedProcedure
		.route({ ...route, method: "POST", path: "/billing/payments/{paymentId}/change-method" })
		.use(checkoutRateLimit)
		.input(z.object({ paymentId: z.string().min(1).max(100) }))
		.output(checkoutResult)
		.handler(({ context, input }) =>
			changePaymentMethod({
				authentication: authenticationOf(context),
				paymentId: input.paymentId,
			}),
		),

	payment: protectedProcedure
		.route({ ...route, method: "GET", path: "/billing/payments/{id}" })
		.input(z.object({ id: z.string().min(1).max(100) }))
		.output(paymentDetail)
		.handler(({ context, input }) => getPayment(authenticationOf(context), input.id)),

	payments: protectedProcedure
		.route({ ...route, method: "GET", path: "/billing/payments" })
		.input(
			z
				.object({
					cursor: z.string().min(1).max(100).optional().describe("The nextCursor of the previous page."),
					limit: z.number().int().min(1).max(50).optional().describe("Maximum payments (1–50). Defaults to 20."),
				})
				.optional(),
		)
		.output(z.object({ items: z.array(payment), nextCursor: z.string().nullable() }))
		.handler(({ context, input }) =>
			listPayments(authenticationOf(context), {
				cursor: input?.cursor,
				limit: input?.limit ?? 20,
			}),
		),

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

		// Support views: read only, so no reason; the actions below each record theirs.
		search: adminProcedure
			.route({ ...route, method: "GET", path: "/billing/admin/search" })
			.input(z.object({ query: z.string().trim().min(3).max(200) }))
			.handler(({ input }) => billingAdmin.search(input)),

		customer: adminProcedure
			.route({ ...route, method: "GET", path: "/billing/admin/customers/{userId}" })
			.input(z.object({ userId: z.string().min(1).max(100) }))
			.handler(({ input }) => billingAdmin.customer(input)),

		alerts: adminProcedure
			.route({ ...route, method: "GET", path: "/billing/admin/alerts" })
			.input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
			.handler(({ input }) => listRecentAlerts(input?.limit ?? 20)),

		// The period's numbers, the same period just before (for trends), and the day-by-day series for the charts.
		metrics: adminProcedure
			.route({ ...route, method: "GET", path: "/billing/admin/metrics" })
			.input(reportRange)
			.handler(async ({ input }) => {
				const now = new Date();
				const current = await billingMetrics(input, now);
				const previous = await billingMetrics(previousRange(input), now);
				return {
					...current,
					previous: {
						revenue: previous.sales.revenue,
						payments: previous.sales.payments,
						net: previous.net,
						started: previous.checkouts.started,
						paid: previous.checkouts.paid,
						signups: previous.signups.total,
						creditsUsed: previous.credits.used,
					},
					daily: await billingDailySeries(input),
				};
			}),

		payments: adminProcedure
			.route({ ...route, method: "GET", path: "/billing/admin/payments" })
			.input(
				z.object({
					from: z.date(),
					to: z.date(),
					limit: z.number().int().min(1).max(100).optional(),
					offset: z.number().int().min(0).max(100_000).optional(),
					status: z.enum(["paid", "waiting", "failed", "refunded"]).optional(),
				}),
			)
			.handler(({ input }) =>
				listRecentPayments(input, { limit: input.limit ?? 20, offset: input.offset ?? 0, status: input.status }),
			),

		exportPayments: adminProcedure
			.route({ ...route, method: "GET", path: "/billing/admin/payments/export" })
			.input(reportRange)
			.output(z.object({ filename: z.string(), csv: z.string(), rows: z.number().int() }))
			.handler(({ input }) => exportPaymentsCsv(input)),

		syncPayment: adminProcedure
			.route({ ...route, method: "POST", path: "/billing/admin/payments/{paymentId}/sync" })
			.input(paymentIdInput)
			.output(
				z.object({
					found: z.boolean().describe("Whether Midtrans has a transaction for it yet."),
					transactionStatus: z.string().nullable(),
					status: z.enum(BILLING_PAYMENT_STATUSES),
					changed: z.boolean(),
				}),
			)
			.handler(({ context, input }) => billingAdmin.syncPayment({ ...input, actorUserId: context.user.id })),

		refund: adminProcedure
			.route({ ...route, method: "POST", path: "/billing/admin/payments/{paymentId}/refund" })
			.input(
				paymentIdInput.extend({
					amount: z.number().int().min(1).max(100_000_000).optional().describe("Rupiah; the rest when left out."),
					reason: refundReason,
					revokeBenefits: z.boolean().optional().describe("Also take the pass and credits back on a partial refund."),
				}),
			)
			.output(refundResult)
			.handler(({ context, input }) => billingAdmin.refund({ ...input, actorUserId: context.user.id })),

		recordManualRefund: adminProcedure
			.route({ ...route, method: "POST", path: "/billing/admin/payments/{paymentId}/manual-refund" })
			.input(
				paymentIdInput.extend({
					amount: z.number().int().min(1).max(100_000_000),
					reason: refundReason,
					revokeBenefits: z.boolean().optional(),
				}),
			)
			.output(refundResult)
			.handler(({ context, input }) => billingAdmin.recordManualRefund({ ...input, actorUserId: context.user.id })),

		resendReceipt: adminProcedure
			.route({ ...route, method: "POST", path: "/billing/admin/payments/{paymentId}/receipt" })
			.input(paymentIdInput)
			.output(z.object({ sent: z.boolean() }))
			.handler(({ context, input }) => billingAdmin.resendReceipt({ ...input, actorUserId: context.user.id })),
	},
};
