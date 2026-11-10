import type { DodoApi } from "./dodo/client";
import type { SubscriptionRow } from "./subscriptions";
import type { BillingPaymentStatus, BillingReason } from "@rezumi/db/schema";
import type { BillingCurrency, BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import type DodoPayments from "dodopayments";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gt, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { BILLING_CATALOG_VERSION, currencyForCountry, PLANS, planPrice } from "@rezumi/schema/billing";
import { generateId } from "@rezumi/utils/string";
import { lockBillingAccount } from "./account";
import { raiseBillingAlertQuietly } from "./alerts";
import { dodoApi, dodoErrorCode, dodoErrorDetail, dodoStatus } from "./dodo/client";
import { getDodoConfig, planForProduct, productFor } from "./dodo/config";
import { CHECKOUT_LIFETIME_MS, dodoLocale } from "./dodo/mapping";
import { isBillingAppliedTo } from "./entitlements";
import { applyDodoSubscription } from "./fulfillment";
import { applyRecentPayments, syncPaymentStatus } from "./reconcile";
import { CHANGE_REQUESTED_ACTION, getCurrentSubscription, LIVE_SUBSCRIPTION_STATUSES } from "./subscriptions";

type PaymentRow = typeof schema.billingPayment.$inferSelect;
type Authentication = { user: { id: string }; method: "apiKey" | "bearer" | "session" };

/** An open checkout is offered again while at least this much of it is left. */
const REUSE_MIN_REMAINING_MS = 10 * 60 * 1000;

/** Why an account can't buy right now, in the order the checks run. */
export type PurchaseBlocker = "unavailable" | "paused" | "web_only" | "guest" | "email_not_verified";

/**
 * What stops an account from buying: plans not applying to it or Dodo Payments not set up, purchases paused, a request
 * that isn't a web session (the apps, API keys and OAuth/MCP clients never buy), a guest account, or an unverified
 * email. Null when it can buy.
 */
export async function purchaseBlocker(authentication: Authentication): Promise<PurchaseBlocker | null> {
	if (!getDodoConfig() || !(await isBillingAppliedTo(authentication.user.id))) return "unavailable";
	if (env.BILLING_CHECKOUT_PAUSED) return "paused";
	if (authentication.method !== "session") return "web_only";
	const [owner] = await db
		.select({ isAnonymous: schema.user.isAnonymous, emailVerified: schema.user.emailVerified })
		.from(schema.user)
		.where(eq(schema.user.id, authentication.user.id));
	if (!owner || owner.isAnonymous) return "guest";
	if (!owner.emailVerified) return "email_not_verified";
	return null;
}

// Neutral messages: no prices, no buying, no links, since the apps show server messages as they are.
const BLOCKER_ERRORS: Record<PurchaseBlocker, () => ORPCError<string, unknown>> = {
	unavailable: () => new ORPCError("BILLING_UNAVAILABLE", { status: 403, message: "This isn't available right now." }),
	paused: () =>
		new ORPCError("BILLING_UNAVAILABLE", { status: 403, message: "This is paused for now. Try again later." }),
	web_only: () => new ORPCError("FORBIDDEN", { message: "This is only available on the Rezumi website." }),
	guest: () => new ORPCError("FORBIDDEN", { message: "Create an account with your email address first." }),
	email_not_verified: () =>
		new ORPCError("EMAIL_NOT_VERIFIED", { status: 403, message: "Verify your email address first." }),
};

async function assertCanPurchase(authentication: Authentication) {
	const blocker = await purchaseBlocker(authentication);
	if (blocker) throw BLOCKER_ERRORS[blocker]();
}

function requireDodo() {
	const config = getDodoConfig();
	if (!config) throw BLOCKER_ERRORS.unavailable();
	return config;
}

const unavailable = () =>
	new ORPCError("BAD_GATEWAY", { message: "Billing couldn't be reached. Try again in a moment." });

/** A payment as its owner sees it. The checkout address is only for a web session, and only while it can be paid. */
export type PaymentView = {
	id: string;
	/** The provider's payment id, once there is one. */
	providerPaymentId: string | null;
	planId: PaidPlanId;
	interval: BillingInterval | null;
	billingReason: BillingReason | null;
	/** Before tax, in the currency's smallest unit. */
	amount: number;
	taxAmount: number;
	totalAmount: number;
	currency: string;
	credits: number;
	status: BillingPaymentStatus;
	createdAt: Date;
	expiresAt: Date | null;
	paidAt: Date | null;
	periodStart: Date | null;
	periodEnd: Date | null;
	refundedAmount: number;
	redirectUrl: string | null;
	/** The free trial its checkout offered, in days; a paid $0 payment is that trial starting. */
	trialDays: number | null;
};

function toPaymentView(payment: PaymentRow, authentication: Authentication, now = new Date()): PaymentView {
	const payable =
		authentication.method === "session" &&
		payment.status === "pending" &&
		!payment.providerPaymentId &&
		payment.expiresAt !== null &&
		payment.expiresAt > now;
	return {
		id: payment.id,
		providerPaymentId: payment.providerPaymentId,
		planId: payment.planId,
		interval: payment.interval,
		billingReason: payment.billingReason,
		amount: payment.amount,
		taxAmount: payment.taxAmount,
		totalAmount: payment.totalAmount,
		currency: payment.currency.toLowerCase(),
		credits: payment.credits,
		status: payment.status,
		createdAt: payment.createdAt,
		expiresAt: payment.expiresAt,
		paidAt: payment.paidAt,
		periodStart: payment.periodStart,
		periodEnd: payment.periodEnd,
		refundedAmount: payment.refundedAmount,
		redirectUrl: payable ? payment.redirectUrl : null,
		trialDays: payment.trialDays,
	};
}

/** The account's subscription as its owner sees it. */
export type SubscriptionView = {
	id: string;
	planId: PaidPlanId;
	interval: BillingInterval;
	status: SubscriptionRow["status"];
	/** The recurring price before tax and discounts, in the currency's smallest unit. */
	amount: number;
	currency: string;
	currentPeriodStart: Date;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	/** The plan and interval it changes to at the next renewal (a downgrade), when one is scheduled. */
	pendingChange: { planId: PaidPlanId; interval: BillingInterval } | null;
};

export function toSubscriptionView(row: SubscriptionRow): SubscriptionView {
	const config = getDodoConfig();
	const pending = config ? planForProduct(config, row.pendingProductId) : null;
	return {
		id: row.id,
		planId: row.planId,
		interval: row.interval,
		status: row.status,
		amount: row.amount,
		currency: row.currency,
		currentPeriodStart: row.currentPeriodStart,
		currentPeriodEnd: row.currentPeriodEnd,
		cancelAtPeriodEnd: row.cancelAtPeriodEnd,
		pendingChange: pending,
	};
}

const isLive = (row: SubscriptionRow | null): row is SubscriptionRow =>
	!!row && (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(row.status) && !row.endedAt;

/** The request's country and client address, as the server adapters pass them on (Cloudflare's headers). */
export type RequestOrigin = { country?: string | null | undefined; ip?: string | null | undefined };

/**
 * Whether the account can still start a plan's free trial: only its first subscription gets one, so not after any
 * subscription (live or ended) or any paid payment.
 */
export async function hasTrialAvailable(userId: string): Promise<boolean> {
	const [subscribed] = await db
		.select({ id: schema.billingSubscription.id })
		.from(schema.billingSubscription)
		.where(eq(schema.billingSubscription.userId, userId))
		.limit(1);
	if (subscribed) return false;
	const [paid] = await db
		.select({ id: schema.billingPayment.id })
		.from(schema.billingPayment)
		.where(and(eq(schema.billingPayment.userId, userId), isNotNull(schema.billingPayment.paidAt)))
		.limit(1);
	return !paid;
}

/** The currency a request is charged in: Rupiah from Indonesia, US dollars elsewhere. */
export const currencyOf = (origin: RequestOrigin): BillingCurrency => currencyForCountry(origin.country);

/**
 * The account's customer at Dodo: made once, before its first checkout, with the account id in its metadata, then
 * reused for every checkout and the billing portal. Two first checkouts racing each make one; the first saved wins.
 */
async function customerFor(
	api: DodoApi,
	userId: string,
	owner: { name: string; email: string },
	locale: string | undefined,
): Promise<string> {
	const read = async () =>
		(
			await db
				.select({ id: schema.billingAccount.providerCustomerId })
				.from(schema.billingAccount)
				.where(eq(schema.billingAccount.userId, userId))
		)[0]?.id ?? null;
	const kept = await read();
	if (kept) return kept;
	const customer = await api.customers.create({
		email: owner.email,
		name: owner.name.trim() || owner.email.split("@")[0] || "Rezumi customer",
		metadata: { rezumi_user_id: userId },
		preferred_locale: dodoLocale(locale),
	});
	const [saved] = await db
		.update(schema.billingAccount)
		.set({ providerCustomerId: customer.customer_id })
		.where(and(eq(schema.billingAccount.userId, userId), isNull(schema.billingAccount.providerCustomerId)))
		.returning({ id: schema.billingAccount.providerCustomerId });
	return saved?.id ?? (await read()) ?? customer.customer_id;
}

export type CheckoutResult = { paymentId: string; redirectUrl: string; expiresAt: Date; reused: boolean };

/**
 * Starts a subscription on the web. The same request key returns the same payment, and an open checkout for the same
 * plan, interval and currency is offered again rather than doubled. Otherwise a `creating` row (catalog copy and all)
 * is committed before Dodo is called, so a failed or lost call still leaves a record; the checkout page is saved once
 * it exists. An account that already subscribes changes its plan instead (`changePlan`).
 */
export async function checkout(input: {
	authentication: Authentication;
	planId: PaidPlanId;
	interval: BillingInterval;
	idempotencyKey: string;
	origin?: RequestOrigin;
	/** The app language: the checkout page's and the customer's emails', and kept for later emails. */
	locale?: string | undefined;
	now?: Date;
}): Promise<CheckoutResult> {
	await assertCanPurchase(input.authentication);
	const config = requireDodo();
	const userId = input.authentication.user.id;
	const now = input.now ?? new Date();
	const currency = currencyOf(input.origin ?? {});
	const amount = planPrice(input.planId, input.interval, currency);
	if (isLive(await getCurrentSubscription(userId)))
		throw new ORPCError("CONFLICT", { message: "You already have a subscription. Change its plan instead." });
	const trialDays =
		PLANS[input.planId].trialDays && (await hasTrialAvailable(userId)) ? PLANS[input.planId].trialDays : null;

	const prepared = await db.transaction(async (tx) => {
		const account = await lockBillingAccount(tx, userId);
		if (input.locale && account.locale !== input.locale)
			await tx
				.update(schema.billingAccount)
				.set({ locale: input.locale })
				.where(eq(schema.billingAccount.userId, userId));
		const [same] = await tx
			.select()
			.from(schema.billingPayment)
			.where(
				and(eq(schema.billingPayment.userId, userId), eq(schema.billingPayment.idempotencyKey, input.idempotencyKey)),
			);
		if (same) return { existing: same };
		const [open] = await tx
			.select()
			.from(schema.billingPayment)
			.where(
				and(
					eq(schema.billingPayment.userId, userId),
					eq(schema.billingPayment.provider, "dodo"),
					eq(schema.billingPayment.status, "pending"),
					eq(schema.billingPayment.planId, input.planId),
					eq(schema.billingPayment.interval, input.interval),
					eq(schema.billingPayment.currency, currency),
					isNotNull(schema.billingPayment.redirectUrl),
					isNull(schema.billingPayment.providerPaymentId),
					gt(schema.billingPayment.expiresAt, new Date(+now + REUSE_MIN_REMAINING_MS)),
				),
			)
			.orderBy(desc(schema.billingPayment.createdAt))
			.limit(1);
		if (open) return { existing: open };
		const [owner] = await tx
			.select({ name: schema.user.name, email: schema.user.email })
			.from(schema.user)
			.where(eq(schema.user.id, userId));
		if (!owner) throw new ORPCError("UNAUTHORIZED");
		const [created] = await tx
			.insert(schema.billingPayment)
			.values({
				id: generateId(),
				userId,
				provider: "dodo",
				idempotencyKey: input.idempotencyKey,
				planId: input.planId,
				interval: input.interval,
				catalogVersion: BILLING_CATALOG_VERSION,
				billingReason: "subscription_create",
				amount,
				totalAmount: amount,
				currency,
				credits: 0,
				trialDays,
				status: "creating",
				channel: "web",
				createdAt: now,
			})
			.returning();
		if (!created) throw new Error("The payment was not saved.");
		return { created, owner };
	});

	if ("existing" in prepared) {
		const { existing } = prepared;
		if (existing.status === "pending" && existing.redirectUrl && existing.expiresAt && existing.expiresAt > now)
			return { paymentId: existing.id, redirectUrl: existing.redirectUrl, expiresAt: existing.expiresAt, reused: true };
		if (existing.status === "creating")
			throw new ORPCError("CONFLICT", { message: "This payment is still being prepared. Try again in a moment." });
		throw new ORPCError("CONFLICT", { message: "This request was already used. Start again." });
	}

	const { created, owner } = prepared;
	const api = dodoApi(config);
	let session: DodoPayments.CheckoutSessionResponse;
	let operation: "customer.create" | "checkout.create" = "customer.create";
	try {
		const customerId = await customerFor(api, userId, owner, input.locale);
		operation = "checkout.create";
		session = await api.checkoutSessions.create({
			product_cart: [{ product_id: productFor(config, input.planId, input.interval), quantity: 1 }],
			customer: { customer_id: customerId },
			// The price list's currency, pinned: the Rupiah price is a fixed one, not a conversion.
			billing_currency: currency.toUpperCase() as DodoPayments.Currency,
			...(currency === "idr" && { billing_address: { country: "ID" } }),
			feature_flags: { allow_currency_selection: false, allow_discount_code: true },
			// Set here rather than on the products, so only a first subscription gets it, the same in every mode.
			subscription_data: { trial_period_days: trialDays ?? 0 },
			customization: { force_language: dodoLocale(input.locale) },
			show_saved_payment_methods: true,
			metadata: { rezumi_payment_id: created.id, rezumi_user_id: userId },
			// The payment id in the path, so whatever Dodo adds to the query can't break the address.
			return_url: new URL(`/dashboard/settings/billing/return/${created.id}`, env.APP_URL).toString(),
			cancel_url: new URL("/dashboard/settings/billing", env.APP_URL).toString(),
		});
		if (!session.checkout_url) throw new Error("Dodo Payments returned no checkout page.");
	} catch (error) {
		const code = dodoErrorCode(operation, error);
		console.error("[billing] Opening a Dodo Payments checkout failed.", {
			paymentId: created.id,
			error: code,
			...(dodoErrorDetail(error) && { reason: dodoErrorDetail(error) }),
		});
		await db
			.update(schema.billingPayment)
			.set({ status: "failed", failureReason: code })
			.where(and(eq(schema.billingPayment.id, created.id), eq(schema.billingPayment.status, "creating")));
		await raiseBillingAlertQuietly({ kind: "provider_errors", paymentId: created.id, now });
		throw unavailable();
	}
	const redirectUrl = session.checkout_url;
	const expiresAt = new Date(+now + CHECKOUT_LIFETIME_MS);
	// The page exists, so the payment waits for the customer; a webhook may have moved it on already.
	await db
		.update(schema.billingPayment)
		.set({
			providerCheckoutId: session.session_id,
			redirectUrl,
			expiresAt,
			providerStatus: "checkout_open",
			status: sql`case when ${schema.billingPayment.status} = 'creating' then 'pending' else ${schema.billingPayment.status} end`,
		})
		.where(eq(schema.billingPayment.id, created.id));
	console.info("[billing] Opened a Dodo Payments checkout.", { paymentId: created.id, checkoutId: session.session_id });
	return { paymentId: created.id, redirectUrl, expiresAt, reused: false };
}

/** Dodo's answer to a subscription change, as an error the owner can act on. */
function subscriptionChangeError(
	operation: "subscription.update" | "subscription.change_plan",
	error: unknown,
): ORPCError<string, unknown> {
	const status = dodoStatus(error);
	console.warn("[billing] A Dodo Payments subscription change didn't go through.", {
		error: dodoErrorCode(operation, error),
		...(dodoErrorDetail(error) && { reason: dodoErrorDetail(error) }),
	});
	if (status === 402)
		return new ORPCError("PAYMENT_FAILED", {
			status: 402,
			message: "The payment for this change didn't go through. Update your payment method and try again.",
		});
	if (status === 409)
		return new ORPCError("CONFLICT", { message: "Another change is still being made. Try again in a moment." });
	if (status && status < 500 && status !== 429)
		return new ORPCError("BAD_REQUEST", { message: "This change isn't possible right now." });
	return unavailable();
}

async function liveSubscriptionOf(userId: string) {
	const current = await getCurrentSubscription(userId);
	if (!isLive(current)) throw new ORPCError("NOT_FOUND", { message: "You don't have a subscription to change." });
	return current;
}

async function subscriptionRowById(id: string | null, fallback: SubscriptionRow) {
	if (!id) return fallback;
	const [row] = await db.select().from(schema.billingSubscription).where(eq(schema.billingSubscription.id, id));
	return row ?? fallback;
}

/**
 * How long an upgrade waits for Dodo to settle its charge before answering. The charge comes off-session and can take
 * most of a minute in test mode; one still open is answered `processing` and finished by its webhooks or the billing job.
 */
const UPGRADE_SETTLE_DELAYS_MS = [0, 1000, 2000, 3000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type PlanChangeResult = {
	/**
	 * `now` for an upgrade that went through, `processing` for one whose charge Dodo is still settling (the new plan
	 * applies once it succeeds), `renewal` for a downgrade (from the next renewal).
	 */
	effective: "now" | "processing" | "renewal";
	subscription: SubscriptionView;
};

/**
 * Moves a subscription to another plan or interval. Up (Pro AI, or yearly) applies now: the price difference for the
 * rest of the period is charged at once and the renewal date stays, except a longer interval, which starts its new
 * period now with the unused time credited. The new plan only applies once its charge succeeds, and a running free
 * trial ends with it (the new plan has none, so its full price is charged). That payment is applied here when Dodo
 * settles it within a few seconds, so its credits come at once; otherwise the answer is `processing` and the change is
 * recorded, so the billing job keeps checking until the webhooks' news is in. Down applies at the next renewal, so the
 * paid period keeps its terms. A subscription set to cancel is resumed first by its owner; one whose payment failed
 * needs its payment first.
 */
export async function changePlan(input: {
	authentication: Authentication;
	planId: PaidPlanId;
	interval: BillingInterval;
	now?: Date;
}): Promise<PlanChangeResult> {
	await assertCanPurchase(input.authentication);
	const config = requireDodo();
	const current = await liveSubscriptionOf(input.authentication.user.id);
	if (current.status === "past_due" || current.status === "on_hold")
		throw new ORPCError("CONFLICT", {
			message: "Your last payment didn't go through. Update your payment method first.",
		});
	if (current.status === "paused")
		throw new ORPCError("CONFLICT", { message: "Your subscription is paused. Resume it first." });
	if (current.cancelAtPeriodEnd)
		throw new ORPCError("CONFLICT", {
			message: "Your subscription is set to end. Keep it first, then change the plan.",
		});
	const target = productFor(config, input.planId, input.interval);
	if (target === current.providerProductId)
		throw new ORPCError("CONFLICT", { message: "You're on this plan already." });
	const up =
		PLANS[input.planId].rank > PLANS[current.planId].rank ||
		(input.planId === current.planId && input.interval === "year" && current.interval === "month");
	const api = dodoApi(config);
	const context = { source: "status_check", eventType: "subscription.change_plan", now: input.now } as const;
	// The copy here can lag a change whose charge settled late: read Dodo first, so a second click doesn't change it again.
	let fresh: DodoPayments.Subscription;
	const freshAt = new Date();
	try {
		fresh = await api.subscriptions.retrieve(current.providerSubscriptionId);
	} catch (error) {
		throw subscriptionChangeError("subscription.update", error);
	}
	if (fresh.product_id === target || (!up && fresh.scheduled_change?.product_id === target)) {
		const applied = await applyDodoSubscription(fresh, context, freshAt);
		if (up) await applyRecentPayments(api, current.providerSubscriptionId, input.now ?? new Date()).catch(() => 0);
		const row = await subscriptionRowById(applied.subscriptionId, current);
		return { effective: up ? "now" : "renewal", subscription: toSubscriptionView(row) };
	}
	const requestedAt = new Date();
	if (up)
		await db.insert(schema.billingAuditLog).values({
			targetUserId: input.authentication.user.id,
			action: CHANGE_REQUESTED_ACTION,
			details: { subscriptionId: current.id, productId: target, planId: input.planId, interval: input.interval },
		});
	try {
		await api.subscriptions.changePlan(current.providerSubscriptionId, {
			product_id: target,
			quantity: 1,
			cancel_scheduled_change_plan: true,
			...(up
				? {
						// Same interval: the difference for the time left, renewal date kept. Another interval starts a new period.
						proration_billing_mode:
							input.interval === current.interval ? "prorated_immediately_keep_cycle" : "prorated_immediately",
						on_payment_failure: "prevent_change",
						effective_at: "immediately",
					}
				: { proration_billing_mode: "full_immediately", effective_at: "next_billing_date" }),
		});
	} catch (error) {
		throw subscriptionChangeError("subscription.change_plan", error);
	}
	let latest: DodoPayments.Subscription | null = null;
	let observedAt = freshAt;
	try {
		for (const delay of up ? UPGRADE_SETTLE_DELAYS_MS : [0]) {
			if (delay) await sleep(delay);
			observedAt = new Date();
			latest = await api.subscriptions.retrieve(current.providerSubscriptionId);
			if (!up || latest.product_id === target) break;
		}
	} catch (error) {
		console.warn("[billing] Reading a changed subscription failed; its webhooks bring the change.", {
			error: dodoErrorCode("subscription.get", error),
		});
	}
	const applied = latest ? await applyDodoSubscription(latest, context, observedAt) : null;
	if (up)
		try {
			// The charge for the change; applied now, so its credits come at once.
			await applyRecentPayments(api, current.providerSubscriptionId, input.now ?? new Date(), requestedAt);
		} catch (error) {
			console.warn("[billing] Reading a plan change's payment failed; its webhook or the billing job brings it.", {
				error: dodoErrorCode("payment.list", error),
			});
		}
	const settled = !up || latest?.product_id === target;
	if (!settled) {
		// Still on the old plan: the charge either failed (the plan stays) or hasn't settled yet.
		const [failed] = await db
			.select({ id: schema.billingPayment.id })
			.from(schema.billingPayment)
			.where(
				and(
					eq(schema.billingPayment.subscriptionId, current.id),
					eq(schema.billingPayment.status, "failed"),
					gt(schema.billingPayment.createdAt, new Date(+requestedAt - 60_000)),
				),
			)
			.limit(1);
		if (failed)
			throw new ORPCError("PAYMENT_FAILED", {
				status: 402,
				message: "The payment for this change didn't go through. Update your payment method and try again.",
			});
	}
	const row = await subscriptionRowById(applied?.subscriptionId ?? null, current);
	return { effective: !up ? "renewal" : settled ? "now" : "processing", subscription: toSubscriptionView(row) };
}

/** The reasons a customer can give for cancelling, as Dodo Payments records them. */
export const CANCELLATION_REASONS = [
	"too_expensive",
	"missing_features",
	"switched_service",
	"unused",
	"customer_service",
	"low_quality",
	"too_complex",
	"other",
] as const;

/**
 * Sets the subscription to end at the close of the period already paid (`cancel: true`), or keeps it going again
 * before then (`cancel: false`). Access runs to the period end either way; nothing is refunded.
 */
export async function setSubscriptionCancellation(input: {
	authentication: Authentication;
	cancel: boolean;
	reason?: (typeof CANCELLATION_REASONS)[number] | undefined;
	comment?: string | undefined;
	now?: Date;
}): Promise<SubscriptionView> {
	if (input.authentication.method !== "session") throw BLOCKER_ERRORS.web_only();
	const config = requireDodo();
	const current = await liveSubscriptionOf(input.authentication.user.id);
	if (current.cancelAtPeriodEnd === input.cancel) return toSubscriptionView(current);
	const comment = input.comment?.trim();
	let updated: DodoPayments.Subscription;
	const observedAt = new Date();
	try {
		updated = await dodoApi(config).subscriptions.update(
			current.providerSubscriptionId,
			input.cancel
				? {
						cancel_at_next_billing_date: true,
						...(input.reason && { cancellation_feedback: input.reason }),
						...(comment && { cancellation_comment: comment.slice(0, 1000) }),
					}
				: { cancel_at_next_billing_date: false },
		);
	} catch (error) {
		throw subscriptionChangeError("subscription.update", error);
	}
	const applied = await applyDodoSubscription(
		updated,
		{ source: "status_check", eventType: input.cancel ? "subscription.cancel" : "subscription.resume", now: input.now },
		observedAt,
	);
	return toSubscriptionView(await subscriptionRowById(applied.subscriptionId, current));
}

/**
 * A link into Dodo Payments' customer portal for this account's customer: payment method, invoices, and cancelling.
 * Made per click (it lasts a day) and only for a web session of an account Dodo knows.
 */
export async function openBillingPortal(authentication: Authentication): Promise<{ url: string }> {
	if (authentication.method !== "session") throw BLOCKER_ERRORS.web_only();
	if (!(await isBillingAppliedTo(authentication.user.id))) throw BLOCKER_ERRORS.unavailable();
	const config = requireDodo();
	const userId = authentication.user.id;
	const [account] = await db
		.select({ customerId: schema.billingAccount.providerCustomerId })
		.from(schema.billingAccount)
		.where(eq(schema.billingAccount.userId, userId));
	const customerId =
		account?.customerId ??
		(
			await db
				.select({ customerId: schema.billingSubscription.providerCustomerId })
				.from(schema.billingSubscription)
				.where(
					and(eq(schema.billingSubscription.userId, userId), isNotNull(schema.billingSubscription.providerCustomerId)),
				)
				.orderBy(desc(schema.billingSubscription.createdAt))
				.limit(1)
		)[0]?.customerId;
	if (!customerId) throw new ORPCError("NOT_FOUND", { message: "There's no billing account to manage yet." });
	try {
		const session = await dodoApi(config).customers.customerPortal.create(customerId, {
			return_url: new URL("/dashboard/settings/billing", env.APP_URL).toString(),
		});
		return { url: session.link };
	} catch (error) {
		if (dodoStatus(error) === 404)
			throw new ORPCError("NOT_FOUND", { message: "There's no billing account to manage yet." });
		console.error("[billing] Opening the Dodo Payments customer portal failed.", {
			error: dodoErrorCode("customer_portal.create", error),
		});
		throw unavailable();
	}
}

async function ownPayment(userId: string, paymentId: string) {
	const [payment] = await db
		.select()
		.from(schema.billingPayment)
		.where(and(eq(schema.billingPayment.id, paymentId), eq(schema.billingPayment.userId, userId)));
	if (!payment) throw new ORPCError("NOT_FOUND", { message: "No payment of yours has that ID." });
	return payment;
}

/** One of the account's payments, checked with Dodo first while it is still open (at most every 10 seconds). */
export async function getPayment(authentication: Authentication, paymentId: string): Promise<PaymentView> {
	const payment = await ownPayment(authentication.user.id, paymentId);
	if (payment.provider !== "dodo" || (payment.status !== "pending" && payment.status !== "creating"))
		return toPaymentView(payment, authentication);
	await syncPaymentStatus(payment.id);
	return toPaymentView(await ownPayment(authentication.user.id, paymentId), authentication);
}

/** Whether a payment has an invoice: one that went through (refunded ones keep theirs), not a free trial starting. */
const hasInvoice = (payment: PaymentRow) =>
	payment.provider === "dodo" &&
	!!payment.providerPaymentId &&
	!!payment.paidAt &&
	!(payment.trialDays && payment.totalAmount === 0);

/**
 * The invoice for a paid payment, as the PDF Dodo Payments (the seller) issues. `unavailable` means use the billing
 * portal, which lists them all.
 */
export async function getInvoice(
	authentication: Authentication,
	paymentId: string,
): Promise<{ status: "ready"; file: File } | { status: "unavailable" }> {
	if (authentication.method !== "session") throw BLOCKER_ERRORS.web_only();
	const payment = await ownPayment(authentication.user.id, paymentId);
	const config = requireDodo();
	if (!hasInvoice(payment) || !payment.providerPaymentId) return { status: "unavailable" };
	try {
		const response = await dodoApi(config).invoices.payments.retrieve(payment.providerPaymentId);
		const blob = await response.blob();
		const day = (payment.paidAt ?? payment.createdAt).toISOString().slice(0, 10);
		return {
			status: "ready",
			file: new File([blob], `rezumi-invoice-${day}.pdf`, { type: "application/pdf" }),
		};
	} catch (error) {
		console.warn("[billing] Reading a Dodo Payments invoice failed.", {
			error: dodoErrorCode("payment.invoice", error),
		});
		return { status: "unavailable" };
	}
}

/**
 * The account's payments, newest first. IDs are UUIDv7, so the cursor is the last ID seen. An attempt Dodo never
 * answered (no checkout page, no payment) charged nothing and isn't listed; the admin pages still show it.
 */
export async function listPayments(
	authentication: Authentication,
	page: { cursor?: string | undefined; limit: number },
): Promise<{ items: PaymentView[]; nextCursor: string | null }> {
	const rows = await db
		.select()
		.from(schema.billingPayment)
		.where(
			and(
				eq(schema.billingPayment.userId, authentication.user.id),
				or(isNotNull(schema.billingPayment.providerCheckoutId), isNotNull(schema.billingPayment.providerPaymentId)),
				page.cursor ? lt(schema.billingPayment.id, page.cursor) : undefined,
			),
		)
		.orderBy(desc(schema.billingPayment.id))
		.limit(page.limit + 1);
	const items = rows.slice(0, page.limit).map((row) => toPaymentView(row, authentication));
	return { items, nextCursor: rows.length > page.limit ? (items.at(-1)?.id ?? null) : null };
}

/** The account's newest checkout that can still be paid, for the web to offer to continue; null for the apps. */
export async function getPendingPayment(authentication: Authentication, now = new Date()): Promise<PaymentView | null> {
	if (authentication.method !== "session") return null;
	const [payment] = await db
		.select()
		.from(schema.billingPayment)
		.where(
			and(
				eq(schema.billingPayment.userId, authentication.user.id),
				eq(schema.billingPayment.provider, "dodo"),
				eq(schema.billingPayment.status, "pending"),
				isNotNull(schema.billingPayment.redirectUrl),
				isNull(schema.billingPayment.providerPaymentId),
				gt(schema.billingPayment.expiresAt, now),
			),
		)
		.orderBy(desc(schema.billingPayment.createdAt))
		.limit(1);
	return payment ? toPaymentView(payment, authentication, now) : null;
}
