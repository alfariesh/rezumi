import type { RequestAuthentication } from "../../context";
import { ORPCError } from "@orpc/server";
import z from "zod";
import { BILLING_PAYMENT_STATUSES, BILLING_SUBSCRIPTION_STATUSES } from "@rezumi/db/schema";
import {
	billingCurrencySchema,
	billingIntervalSchema,
	creditSourceSchema,
	paidPlanIdSchema,
	planIdSchema,
} from "@rezumi/schema/billing";
import { protectedProcedure } from "../../context";
import { checkoutRateLimit } from "../../middleware/rate-limit";
import { assertAdminSession } from "../auth/admin-session";
import { billingAdmin } from "./admin";
import { listRecentAlerts } from "./alerts";
import {
	CANCELLATION_REASONS,
	changePlan,
	checkout,
	currencyOf,
	getInvoice,
	getPayment,
	getPendingPayment,
	hasTrialAvailable,
	listPayments,
	openBillingPortal,
	purchaseBlocker,
	setSubscriptionCancellation,
	toSubscriptionView,
} from "./checkout";
import { getCreditBalance, listCreditHistory } from "./credits";
import { getEntitlements, isBillingAppliedTo } from "./entitlements";
import { countActiveDocuments } from "./limits";
import { REFUND_REASONS } from "./refunds";
import { billingDailySeries, billingMetrics, exportPaymentsCsv, listRecentPayments, previousRange } from "./reports";
import { getCurrentSubscription } from "./subscriptions";

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
	orderId: z.string().nullable().describe("Polar's order id, once the payment has an order."),
	planId: paidPlanIdSchema,
	interval: billingIntervalSchema
		.nullable()
		.describe("Monthly or yearly; null for a 30-day pass from before subscriptions."),
	billingReason: z
		.enum(["purchase", "subscription_create", "subscription_cycle", "subscription_update", "subscription_meter_cycle"])
		.nullable()
		.describe("A new subscription, a renewal, or a plan change."),
	amount: z
		.number()
		.int()
		.describe("Before tax, in the currency's smallest unit (US cents; Rupiah has two decimals too)."),
	taxAmount: z.number().int(),
	totalAmount: z.number().int().describe("What was charged, tax included."),
	currency: z.string(),
	credits: z.number().int().describe("Rezumi AI credits that came with it."),
	status: z.enum(BILLING_PAYMENT_STATUSES),
	createdAt: z.date(),
	expiresAt: z.date().nullable().describe("When its checkout page closes."),
	paidAt: z.date().nullable(),
	periodStart: z.date().nullable(),
	periodEnd: z.date().nullable().describe("The end of the subscription period it paid for."),
	refundedAmount: z.number().int(),
	redirectUrl: z
		.string()
		.nullable()
		.describe("Where to continue paying: web sessions only, while the checkout is open."),
	trialDays: z
		.number()
		.int()
		.nullable()
		.describe("The free trial its checkout offered, in days. Paid with a total of 0, it is that trial starting."),
});

const subscription = z.object({
	id: z.string(),
	planId: paidPlanIdSchema,
	interval: billingIntervalSchema,
	status: z.enum(BILLING_SUBSCRIPTION_STATUSES),
	amount: z.number().int().describe("The recurring price before tax and discounts, in the currency's smallest unit."),
	currency: z.string(),
	currentPeriodStart: z.date(),
	currentPeriodEnd: z.date().nullable().describe("When it renews, or ends when cancelAtPeriodEnd."),
	cancelAtPeriodEnd: z.boolean(),
	pendingChange: z
		.object({ planId: paidPlanIdSchema, interval: billingIntervalSchema })
		.nullable()
		.describe("The plan it changes to at the next renewal, when a downgrade is scheduled."),
});

const checkoutResult = z.object({
	paymentId: z.string(),
	redirectUrl: z.string().describe("Polar's checkout page to send the browser to."),
	expiresAt: z.date(),
	reused: z.boolean().describe("Whether this is an open checkout from before rather than a new one."),
});

const paymentIdInput = z.object({ paymentId: z.string().min(1).max(100) });
const refundReason = z.string().trim().min(3).max(500);
const reportRange = z
	.object({ from: z.date(), to: z.date() })
	.refine((range) => range.to > range.from, { message: "The end must be after the start." });

const refundResult = z.object({
	refundId: z.string(),
	status: z.enum(["requesting", "succeeded", "failed"]),
	amount: z.number().int(),
	paymentStatus: z.enum(BILLING_PAYMENT_STATUSES),
	refundedAmount: z.number().int(),
	subscriptionEnded: z.boolean(),
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

/** The visitor's country (Cloudflare's CF-IPCountry) and address, for their currency and Polar's tax location. */
function originOf(context: { reqHeaders?: Headers; trustedClient?: string | undefined }) {
	return {
		country: context.reqHeaders?.get("cf-ipcountry") ?? null,
		ip: context.trustedClient ?? context.reqHeaders?.get("x-real-ip") ?? null,
	};
}

const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
	await assertAdminSession(context.authentication);
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
				currentPeriodEndsAt: z.date().nullable().describe("When the current plan ends, or renews when renews."),
				source: z
					.enum(["subscription", "period"])
					.nullable()
					.describe("Where the current plan comes from: a subscription, or access granted outside one."),
				renews: z.boolean(),
				subscription: subscription.nullable().describe("The account's subscription, live or the last one."),
				currency: billingCurrencySchema.describe("The currency this visitor is charged in."),
				upcoming: z.array(z.object({ planId: paidPlanIdSchema, startsAt: z.date(), endsAt: z.date() })),
				limits: z.object({ activeResumes: usage, activeCoverLetters: usage }),
				features: z.object({
					premiumTemplates: z.boolean(),
					brandLogos: z.boolean(),
					wordOdtExport: z.boolean(),
					customStyles: z.boolean(),
					customFonts: z.boolean(),
					automationApi: z.boolean(),
					premiumPortfolioThemes: z.boolean(),
					premiumHeroEffects: z.boolean(),
					hidePortfolioCredit: z.boolean(),
					customDomain: z.boolean(),
					detailedPortfolioStats: z.boolean(),
				}),
				credits: credits.nullable().describe("Rezumi AI credits; null while plans don't apply to the account."),
				canPurchase: z.boolean().describe("Whether this session can subscribe or change plans now (web only)."),
				purchaseBlockedBy: z
					.enum(["unavailable", "paused", "web_only", "guest", "email_not_verified"])
					.nullable()
					.describe("Why it can't, when it can't."),
				pendingPayment: payment.nullable().describe("The newest checkout that can still be paid; web sessions only."),
				trialAvailable: z
					.boolean()
					.describe(
						"Whether a first subscription to a plan with trialDays in the catalog starts with that free trial.",
					),
			}),
		)
		.handler(async ({ context }) => {
			const now = new Date();
			const authentication = authenticationOf(context);
			const [entitlements, used, blocker, current] = await Promise.all([
				getEntitlements(context.user.id, now),
				countActiveDocuments(context.user.id),
				purchaseBlocker(authentication),
				getCurrentSubscription(context.user.id),
			]);
			return {
				enabled: entitlements.enabled,
				planId: entitlements.planId,
				currentPeriodEndsAt: entitlements.currentPeriodEndsAt,
				source: entitlements.source,
				renews: entitlements.renews,
				subscription: entitlements.enabled && current ? toSubscriptionView(current) : null,
				currency: currencyOf(originOf(context)),
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
				trialAvailable: entitlements.enabled && !current && (await hasTrialAvailable(context.user.id)),
			};
		}),

	checkout: protectedProcedure
		.route({ ...route, method: "POST", path: "/billing/checkout" })
		.use(checkoutRateLimit)
		.input(z.object({ planId: paidPlanIdSchema, interval: billingIntervalSchema, idempotencyKey }))
		.output(checkoutResult)
		.handler(({ context, input }) =>
			checkout({
				authentication: authenticationOf(context),
				planId: input.planId,
				interval: input.interval,
				idempotencyKey: input.idempotencyKey,
				origin: originOf(context),
				locale: context.locale,
			}),
		),

	changePlan: protectedProcedure
		.route({ ...route, method: "POST", path: "/billing/subscription/plan" })
		.use(checkoutRateLimit)
		.input(z.object({ planId: paidPlanIdSchema, interval: billingIntervalSchema }))
		.output(z.object({ effective: z.enum(["now", "renewal"]), subscription }))
		.handler(({ context, input }) =>
			changePlan({ authentication: authenticationOf(context), planId: input.planId, interval: input.interval }),
		),

	cancelSubscription: protectedProcedure
		.route({ ...route, method: "POST", path: "/billing/subscription/cancel" })
		.use(checkoutRateLimit)
		.input(
			z
				.object({
					reason: z.enum(CANCELLATION_REASONS).optional(),
					comment: z.string().trim().max(1000).optional(),
				})
				.optional(),
		)
		.output(subscription)
		.handler(({ context, input }) =>
			setSubscriptionCancellation({
				authentication: authenticationOf(context),
				cancel: true,
				reason: input?.reason,
				comment: input?.comment,
			}),
		),

	resumeSubscription: protectedProcedure
		.route({ ...route, method: "POST", path: "/billing/subscription/resume" })
		.use(checkoutRateLimit)
		.input(z.object({}).optional())
		.output(subscription)
		.handler(({ context }) =>
			setSubscriptionCancellation({ authentication: authenticationOf(context), cancel: false }),
		),

	portal: protectedProcedure
		.route({ ...route, method: "POST", path: "/billing/portal" })
		.use(checkoutRateLimit)
		.input(z.object({}).optional())
		.output(z.object({ url: z.string().describe("Polar's customer portal, signed in as this account; it expires.") }))
		.handler(({ context }) => openBillingPortal(authenticationOf(context))),

	invoice: protectedProcedure
		.route({ ...route, method: "POST", path: "/billing/payments/{id}/invoice" })
		.use(checkoutRateLimit)
		.input(z.object({ id: z.string().min(1).max(100) }))
		.output(
			z.discriminatedUnion("status", [
				z.object({ status: z.literal("ready"), url: z.string() }),
				z.object({ status: z.enum(["generating", "unavailable"]) }),
			]),
		)
		.handler(({ context, input }) => getInvoice(authenticationOf(context), input.id)),

	payment: protectedProcedure
		.route({ ...route, method: "GET", path: "/billing/payments/{id}" })
		.input(z.object({ id: z.string().min(1).max(100) }))
		.output(payment)
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
						activeSubscriptions: previous.subscriptions.active,
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
					found: z.boolean().describe("Whether Polar has a checkout or order for it."),
					status: z.enum(BILLING_PAYMENT_STATUSES),
					changed: z.boolean(),
				}),
			)
			.handler(({ context, input }) => billingAdmin.syncPayment({ ...input, actorUserId: context.user.id })),

		refund: adminProcedure
			.route({ ...route, method: "POST", path: "/billing/admin/payments/{paymentId}/refund" })
			.input(
				paymentIdInput.extend({
					amount: z
						.number()
						.int()
						.min(1)
						.max(10_000_000_000)
						.optional()
						.describe("Before tax, in the currency's smallest unit; the rest when left out."),
					reason: refundReason,
					polarReason: z
						.enum(REFUND_REASONS)
						.optional()
						.describe("The reason Polar records; customer_request by default."),
					revokeBenefits: z.boolean().optional().describe("Also take the payment's credits back on a partial refund."),
					endSubscription: z.boolean().optional().describe("Also end the subscription now (access stops at once)."),
				}),
			)
			.output(refundResult)
			.handler(({ context, input }) => billingAdmin.refund({ ...input, actorUserId: context.user.id })),
	},
};
