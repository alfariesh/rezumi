import type { SubscriptionRow } from "./subscriptions";
import type { BillingPaymentStatus, BillingReason } from "@rezumi/db/schema";
import type { BillingCurrency, BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import { isIP } from "node:net";
import { ORPCError } from "@orpc/server";
import { errors as polarErrors } from "@polar-sh/sdk/2026-10";
import { and, desc, eq, gt, isNotNull, lt, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { BILLING_CATALOG_VERSION, currencyForCountry, PLANS, planPrice } from "@rezumi/schema/billing";
import { generateId } from "@rezumi/utils/string";
import { lockBillingAccount } from "./account";
import { raiseBillingAlertQuietly } from "./alerts";
import { isBillingAppliedTo } from "./entitlements";
import { applyPolarSubscription } from "./fulfillment";
import { polarApi, polarErrorCode, polarErrorDetail, polarStatus } from "./polar/client";
import { getPolarConfig, planForProduct, productFor } from "./polar/config";
import { applyRecentOrders, syncPaymentStatus } from "./reconcile";
import { getCurrentSubscription, LIVE_SUBSCRIPTION_STATUSES } from "./subscriptions";

type PaymentRow = typeof schema.billingPayment.$inferSelect;
type Authentication = { user: { id: string }; method: "apiKey" | "bearer" | "session" };

/** An open checkout is offered again while at least this much of it is left. */
const REUSE_MIN_REMAINING_MS = 10 * 60 * 1000;

/** Why an account can't buy right now, in the order the checks run. */
export type PurchaseBlocker = "unavailable" | "paused" | "web_only" | "guest" | "email_not_verified";

/**
 * What stops an account from buying: plans not applying to it or Polar not set up, purchases paused, a request that
 * isn't a web session (the apps, API keys and OAuth/MCP clients never buy), a guest account, or an unverified email.
 * Null when it can buy.
 */
export async function purchaseBlocker(authentication: Authentication): Promise<PurchaseBlocker | null> {
	if (!getPolarConfig() || !(await isBillingAppliedTo(authentication.user.id))) return "unavailable";
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

function requirePolar() {
	const config = getPolarConfig();
	if (!config) throw BLOCKER_ERRORS.unavailable();
	return config;
}

const unavailable = () =>
	new ORPCError("BAD_GATEWAY", { message: "Billing couldn't be reached. Try again in a moment." });

/** A payment as its owner sees it. The checkout address is only for a web session, and only while it can be paid. */
export type PaymentView = {
	id: string;
	orderId: string | null;
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
};

function toPaymentView(payment: PaymentRow, authentication: Authentication, now = new Date()): PaymentView {
	const payable =
		authentication.method === "session" &&
		payment.status === "pending" &&
		!payment.providerOrderId &&
		payment.expiresAt !== null &&
		payment.expiresAt > now;
	return {
		id: payment.id,
		orderId: payment.providerOrderId,
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
	const config = getPolarConfig();
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

/** An address Polar can place, for the customer's currency and tax: never a private or loopback one. */
function publicIp(ip: string | null | undefined): string | undefined {
	const value = ip?.trim();
	if (!value || !isIP(value)) return undefined;
	if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(value)) return undefined;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(value)) return undefined;
	if (/^(::1$|fc|fd|fe80:)/i.test(value)) return undefined;
	return value;
}

/** The currency a request is charged in: Rupiah from Indonesia, US dollars elsewhere. */
export const currencyOf = (origin: RequestOrigin): BillingCurrency => currencyForCountry(origin.country);

export type CheckoutResult = { paymentId: string; redirectUrl: string; expiresAt: Date; reused: boolean };

/**
 * Starts a subscription on the web. The same request key returns the same payment, and an open checkout for the same
 * plan, interval and currency is offered again rather than doubled. Otherwise a `creating` row (catalog copy and all)
 * is committed before Polar is called, so a failed or lost call still leaves a record; the checkout page is saved
 * once it exists. An account that already subscribes changes its plan instead (`changePlan`).
 */
export async function checkout(input: {
	authentication: Authentication;
	planId: PaidPlanId;
	interval: BillingInterval;
	idempotencyKey: string;
	origin?: RequestOrigin;
	/** The app language: the checkout page's, and kept for later emails. */
	locale?: string | undefined;
	now?: Date;
}): Promise<CheckoutResult> {
	await assertCanPurchase(input.authentication);
	const config = requirePolar();
	const userId = input.authentication.user.id;
	const now = input.now ?? new Date();
	const currency = currencyOf(input.origin ?? {});
	const amount = planPrice(input.planId, input.interval, currency);
	if (isLive(await getCurrentSubscription(userId)))
		throw new ORPCError("CONFLICT", { message: "You already have a subscription. Change its plan instead." });

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
					eq(schema.billingPayment.provider, "polar"),
					eq(schema.billingPayment.status, "pending"),
					eq(schema.billingPayment.planId, input.planId),
					eq(schema.billingPayment.interval, input.interval),
					eq(schema.billingPayment.currency, currency),
					isNotNull(schema.billingPayment.redirectUrl),
					sql`${schema.billingPayment.providerOrderId} is null`,
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
				provider: "polar",
				idempotencyKey: input.idempotencyKey,
				planId: input.planId,
				interval: input.interval,
				catalogVersion: BILLING_CATALOG_VERSION,
				billingReason: "subscription_create",
				amount,
				totalAmount: amount,
				currency,
				credits: 0,
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
	const returnUrl = new URL("/dashboard/settings/billing", env.APP_URL).toString();
	let session;
	try {
		session = await polarApi(config).checkouts.create({
			products: [productFor(config, input.planId, input.interval)],
			external_customer_id: userId,
			customer_email: owner.email,
			customer_name: owner.name || null,
			customer_ip_address: publicIp(input.origin?.ip) ?? null,
			currency,
			locale: input.locale ?? null,
			// The payment id in the path, so whatever Polar adds to the query can't break the address.
			success_url: `${new URL(`/dashboard/settings/billing/return/${created.id}`, env.APP_URL)}?checkout_id={CHECKOUT_ID}`,
			return_url: returnUrl,
			allow_discount_codes: true,
			allow_trial: false,
			metadata: { rezumi_payment_id: created.id },
		});
	} catch (error) {
		const code = polarErrorCode("checkout.create", error);
		console.error("[billing] Opening a Polar checkout failed.", {
			paymentId: created.id,
			error: code,
			...(polarErrorDetail(error) && { reason: polarErrorDetail(error) }),
		});
		await db
			.update(schema.billingPayment)
			.set({ status: "failed", failureReason: code })
			.where(and(eq(schema.billingPayment.id, created.id), eq(schema.billingPayment.status, "creating")));
		await raiseBillingAlertQuietly({ kind: "provider_errors", paymentId: created.id, now });
		throw unavailable();
	}
	const expiresAt = new Date(session.expires_at);
	// The page exists, so the payment waits for the customer; a webhook may have moved it on already.
	await db
		.update(schema.billingPayment)
		.set({
			providerCheckoutId: session.id,
			redirectUrl: session.url,
			expiresAt,
			providerStatus: `checkout_${session.status}`,
			status: sql`case when ${schema.billingPayment.status} = 'creating' then 'pending' else ${schema.billingPayment.status} end`,
		})
		.where(eq(schema.billingPayment.id, created.id));
	console.info("[billing] Opened a Polar checkout.", { paymentId: created.id, checkoutId: session.id });
	return { paymentId: created.id, redirectUrl: session.url, expiresAt, reused: false };
}

/** Polar's answer to a subscription change, as an error the owner can act on. */
function subscriptionChangeError(operation: "subscription.update", error: unknown) {
	const status = polarStatus(error);
	console.warn("[billing] A Polar subscription change didn't go through.", {
		error: polarErrorCode(operation, error),
		...(polarErrorDetail(error) && { reason: polarErrorDetail(error) }),
	});
	if (error instanceof polarErrors.PaymentFailed || status === 402)
		return new ORPCError("PAYMENT_FAILED", {
			status: 402,
			message: "The payment for this change didn't go through. Update your payment method and try again.",
		});
	if (error instanceof polarErrors.SubscriptionLocked || status === 409)
		return new ORPCError("CONFLICT", { message: "Another change is still being made. Try again in a moment." });
	if (error instanceof polarErrors.AlreadyCanceledSubscription)
		return new ORPCError("CONFLICT", { message: "This subscription has already ended." });
	if (status && status < 500 && status !== 429)
		return new ORPCError("BAD_REQUEST", { message: "This change isn't possible right now." });
	return unavailable();
}

async function liveSubscriptionOf(userId: string) {
	const current = await getCurrentSubscription(userId);
	if (!isLive(current)) throw new ORPCError("NOT_FOUND", { message: "You don't have a subscription to change." });
	return current;
}

export type PlanChangeResult = {
	/** `now` for an upgrade (charged the difference at once), `renewal` for a downgrade (from the next renewal). */
	effective: "now" | "renewal";
	subscription: SubscriptionView;
};

/**
 * Moves a subscription to another plan or interval. Up (Pro AI, or yearly) applies now and charges the prorated
 * difference at once; that order is applied here, so its credits come at once rather than with its webhook. Down
 * applies at the next renewal, so the paid period keeps its terms. A subscription set to cancel is resumed first by
 * its owner; a past-due one needs its payment first.
 */
export async function changePlan(input: {
	authentication: Authentication;
	planId: PaidPlanId;
	interval: BillingInterval;
	now?: Date;
}): Promise<PlanChangeResult> {
	await assertCanPurchase(input.authentication);
	const config = requirePolar();
	const current = await liveSubscriptionOf(input.authentication.user.id);
	if (current.status === "past_due")
		throw new ORPCError("CONFLICT", {
			message: "Your last payment didn't go through. Update your payment method first.",
		});
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
	let updated;
	try {
		updated = await polarApi(config).subscriptions.update(current.providerSubscriptionId, {
			product_id: target,
			proration_behavior: up ? "invoice" : "next_period",
		});
	} catch (error) {
		throw subscriptionChangeError("subscription.update", error);
	}
	const applied = await applyPolarSubscription(updated, {
		source: "status_check",
		eventType: "subscription.change_plan",
		now: input.now,
	});
	if (up)
		try {
			// Polar makes the difference's order with the change itself.
			await applyRecentOrders(polarApi(config), current.providerSubscriptionId, input.now ?? new Date());
		} catch (error) {
			console.warn("[billing] Reading a plan change's order failed; its webhook or the billing job brings it.", {
				error: polarErrorCode("order.list", error),
			});
		}
	const [row] = applied.subscriptionId
		? await db
				.select()
				.from(schema.billingSubscription)
				.where(eq(schema.billingSubscription.id, applied.subscriptionId))
		: [current];
	return { effective: up ? "now" : "renewal", subscription: toSubscriptionView(row ?? current) };
}

/** Polar's reasons a customer can give for cancelling, as its dashboard reports them. */
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
	const config = requirePolar();
	const current = await liveSubscriptionOf(input.authentication.user.id);
	if (current.cancelAtPeriodEnd === input.cancel) return toSubscriptionView(current);
	let updated;
	try {
		updated = await polarApi(config).subscriptions.update(
			current.providerSubscriptionId,
			input.cancel
				? {
						cancel_at_period_end: true,
						customer_cancellation_reason: input.reason ?? null,
						customer_cancellation_comment: input.comment?.trim() || null,
					}
				: { cancel_at_period_end: false },
		);
	} catch (error) {
		throw subscriptionChangeError("subscription.update", error);
	}
	const applied = await applyPolarSubscription(updated, {
		source: "status_check",
		eventType: input.cancel ? "subscription.cancel" : "subscription.resume",
		now: input.now,
	});
	const [row] = applied.subscriptionId
		? await db
				.select()
				.from(schema.billingSubscription)
				.where(eq(schema.billingSubscription.id, applied.subscriptionId))
		: [current];
	return toSubscriptionView(row ?? current);
}

/**
 * A link into Polar's customer portal, signed in as this account: payment method, invoices and receipts, and
 * cancelling. Made per click (it expires within the hour) and only for a web session of an account Polar knows.
 */
export async function openBillingPortal(authentication: Authentication): Promise<{ url: string }> {
	if (authentication.method !== "session") throw BLOCKER_ERRORS.web_only();
	if (!(await isBillingAppliedTo(authentication.user.id))) throw BLOCKER_ERRORS.unavailable();
	const config = requirePolar();
	try {
		const session = await polarApi(config).customerSessions.create({
			external_customer_id: authentication.user.id,
			return_url: new URL("/dashboard/settings/billing", env.APP_URL).toString(),
		});
		return { url: session.customer_portal_url };
	} catch (error) {
		const status = polarStatus(error);
		if (status === 404 || status === 422)
			throw new ORPCError("NOT_FOUND", { message: "There's no billing account to manage yet." });
		console.error("[billing] Opening the Polar customer portal failed.", {
			error: polarErrorCode("customer_session.create", error),
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

/** One of the account's payments, checked with Polar first while it is still open (at most every 10 seconds). */
export async function getPayment(authentication: Authentication, paymentId: string): Promise<PaymentView> {
	const payment = await ownPayment(authentication.user.id, paymentId);
	if (payment.provider !== "polar" || (payment.status !== "pending" && payment.status !== "creating"))
		return toPaymentView(payment, authentication);
	await syncPaymentStatus(payment.id);
	return toPaymentView(await ownPayment(authentication.user.id, paymentId), authentication);
}

/**
 * The invoice for a paid order, from Polar (the seller). Polar makes it on first request, which takes a few seconds:
 * `generating` means ask again shortly; `unavailable` means use the billing portal.
 */
export async function getInvoice(
	authentication: Authentication,
	paymentId: string,
): Promise<{ status: "ready"; url: string } | { status: "generating" | "unavailable" }> {
	if (authentication.method !== "session") throw BLOCKER_ERRORS.web_only();
	const payment = await ownPayment(authentication.user.id, paymentId);
	const config = requirePolar();
	if (payment.provider !== "polar" || !payment.providerOrderId || !payment.paidAt) return { status: "unavailable" };
	const api = polarApi(config);
	try {
		const invoice = await api.orders.invoice(payment.providerOrderId);
		return { status: "ready", url: invoice.url };
	} catch (error) {
		if (polarStatus(error) !== 404) {
			console.warn("[billing] Reading a Polar invoice failed.", { error: polarErrorCode("order.invoice", error) });
			return { status: "unavailable" };
		}
	}
	try {
		await api.orders.generateInvoice(payment.providerOrderId);
		return { status: "generating" };
	} catch (error) {
		console.warn("[billing] Asking Polar for an invoice failed.", { error: polarErrorCode("order.invoice", error) });
		return { status: "unavailable" };
	}
}

/**
 * The account's payments, newest first. IDs are UUIDv7, so the cursor is the last ID seen. An attempt Polar never
 * answered (no checkout page, no order) charged nothing and isn't listed; the admin pages still show it.
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
				or(isNotNull(schema.billingPayment.providerCheckoutId), isNotNull(schema.billingPayment.providerOrderId)),
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
				eq(schema.billingPayment.provider, "polar"),
				eq(schema.billingPayment.status, "pending"),
				isNotNull(schema.billingPayment.redirectUrl),
				sql`${schema.billingPayment.providerOrderId} is null`,
				gt(schema.billingPayment.expiresAt, now),
			),
		)
		.orderBy(desc(schema.billingPayment.createdAt))
		.limit(1);
	return payment ? toPaymentView(payment, authentication, now) : null;
}
