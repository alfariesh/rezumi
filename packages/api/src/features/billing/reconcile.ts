import type { PolarApi } from "./polar/client";
import type { PolarConfig } from "./polar/config";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { PLANS } from "@rezumi/schema/billing";
import { raiseBillingAlertQuietly } from "./alerts";
import { grantSubscriptionMonth } from "./credits";
import { deletePolarCustomer } from "./deletion";
import { applyPolarCheckout, applyPolarOrder, applyPolarSubscription } from "./fulfillment";
import { isTransientPolarError, polarApi, polarErrorCode, polarStatus } from "./polar/client";
import { getPolarConfig } from "./polar/config";
import { creditMonth } from "./polar/mapping";
import { LIVE_SUBSCRIPTION_STATUSES } from "./subscriptions";

/**
 * Asking Polar where things stand, for the webhooks that never arrive or arrive late: when someone looks at an open
 * payment, and from the billing job with backoff. Every Polar call happens outside a transaction; the functions in
 * fulfillment.ts apply the answers, exactly as they apply webhooks.
 */

/** How long after a checkout page closes an unpaid payment is ended: Polar has expired the session by then. */
export const EXPIRY_GRACE_MS = 30 * 60 * 1000;
/** Someone looking at a payment checks Polar at most this often. */
export const SYNC_INTERVAL_MS = 10_000;
// The billing job checks payments older than this, up to this age, this many per run, within this time.
const RECONCILE_MIN_AGE_MS = 2 * 60 * 1000;
const RECONCILE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const RECONCILE_BATCH = 20;
const RECONCILE_BUDGET_MS = 20_000;
/** A subscription whose period ended this long ago without news is asked about, then at most this often. */
const SUBSCRIPTION_OVERDUE_MS = 30 * 60 * 1000;
const SUBSCRIPTION_RECHECK_MS = 60 * 60 * 1000;

const OPEN_STATUSES = ["creating", "pending"] as const;

type OpenPayment = {
	id: string;
	providerCheckoutId: string | null;
	providerOrderId: string | null;
	expiresAt: Date | null;
	createdAt: Date;
};

const paymentColumns = {
	id: schema.billingPayment.id,
	providerCheckoutId: schema.billingPayment.providerCheckoutId,
	providerOrderId: schema.billingPayment.providerOrderId,
	expiresAt: schema.billingPayment.expiresAt,
	createdAt: schema.billingPayment.createdAt,
};

/** Applies every order a checkout made (one, normally). */
async function applyCheckoutOrders(api: PolarApi, checkoutId: string, now: Date) {
	const orders = await api.orders.list({ checkout_id: checkoutId, limit: 10 });
	for (const order of orders.items)
		await applyPolarOrder(order, { source: "status_check", eventType: "status_check", now });
	return orders.items.length;
}

/**
 * Checks one open payment with Polar and applies the answer: its order once there is one, else its checkout session.
 * A session still open long after it should have closed is treated as expired.
 */
async function checkPayment(config: PolarConfig, payment: OpenPayment, now: Date) {
	const api = polarApi(config);
	const context = { source: "status_check", eventType: "status_check", now } as const;
	if (payment.providerOrderId) return applyPolarOrder(await api.orders.get(payment.providerOrderId), context);
	if (!payment.providerCheckoutId) {
		// Polar never answered the checkout request (a lost call): nothing to pay on. A younger one may still be opening.
		if (+now - +payment.createdAt > RECONCILE_MIN_AGE_MS)
			await db
				.update(schema.billingPayment)
				.set({ status: "failed", failureReason: "checkout_not_created" })
				.where(and(eq(schema.billingPayment.id, payment.id), eq(schema.billingPayment.status, "creating")));
		return null;
	}
	const session = await api.checkouts.get(payment.providerCheckoutId);
	if (session.status === "succeeded" || session.status === "confirmed")
		if (await applyCheckoutOrders(api, session.id, now)) return null;
	const closed = +now > +new Date(session.expires_at) + EXPIRY_GRACE_MS;
	return applyPolarCheckout(closed && session.status === "open" ? { ...session, status: "expired" } : session, context);
}

/**
 * Checks a payment someone is looking at, when it is still open and wasn't checked in the last SYNC_INTERVAL_MS.
 * Concurrent lookers make one call between them. Errors leave the payment as it was.
 */
export async function syncPaymentStatus(paymentId: string, now = new Date()): Promise<void> {
	const config = getPolarConfig();
	if (!config) return;
	const [claimed] = await db
		.update(schema.billingPayment)
		.set({ lastCheckedAt: now })
		.where(
			and(
				eq(schema.billingPayment.id, paymentId),
				eq(schema.billingPayment.provider, "polar"),
				inArray(schema.billingPayment.status, OPEN_STATUSES),
				or(
					isNull(schema.billingPayment.lastCheckedAt),
					lt(schema.billingPayment.lastCheckedAt, new Date(+now - SYNC_INTERVAL_MS)),
				),
			),
		)
		.returning(paymentColumns);
	if (!claimed) return;
	try {
		await checkPayment(config, claimed, now);
	} catch (error) {
		console.warn("[billing] Checking a payment with Polar failed; it is checked again later.", {
			paymentId,
			error: polarErrorCode("checkout.get", error),
		});
	}
}

/**
 * Asks Polar about one payment now, whatever its status here, and applies the answer: a missed webhook, a refund
 * made in Polar's dashboard. The admin page's "check again". Returns false when Polar has nothing for it yet.
 */
export async function syncPaymentWithPolar(paymentId: string, now = new Date()): Promise<boolean> {
	const config = getPolarConfig();
	if (!config) return false;
	const [payment] = await db
		.select(paymentColumns)
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.id, paymentId));
	if (!payment || (!payment.providerOrderId && !payment.providerCheckoutId)) return false;
	await checkPayment(config, payment, now);
	return true;
}

// Waits 2, 5, 15, 30 and 60 minutes between the job's checks, then 6 hours.
const due = (
	now: Date,
) => sql`(${schema.billingPayment.lastCheckedAt} is null or ${schema.billingPayment.lastCheckedAt} < ${now.toISOString()}::timestamptz - (case ${schema.billingPayment.checkAttempts}
	when 0 then interval '2 minutes'
	when 1 then interval '5 minutes'
	when 2 then interval '15 minutes'
	when 3 then interval '30 minutes'
	when 4 then interval '60 minutes'
	else interval '6 hours' end))`;

/**
 * The billing job's safety net for missed webhooks: claims open payments due for a check (skipping rows another run
 * holds), marks them checked, then asks Polar about each within a time budget. Safe to run twice at once. Returns how
 * many it checked.
 */
export async function reconcilePayments(now = new Date()): Promise<number> {
	const config = getPolarConfig();
	if (!config) return 0;
	const started = Date.now();
	const claimed = await db.transaction(async (tx) => {
		const rows = await tx
			.select(paymentColumns)
			.from(schema.billingPayment)
			.where(
				and(
					eq(schema.billingPayment.provider, "polar"),
					inArray(schema.billingPayment.status, OPEN_STATUSES),
					lt(schema.billingPayment.createdAt, new Date(+now - RECONCILE_MIN_AGE_MS)),
					gt(schema.billingPayment.createdAt, new Date(+now - RECONCILE_MAX_AGE_MS)),
					due(now),
				),
			)
			.orderBy(asc(sql`coalesce(${schema.billingPayment.lastCheckedAt}, ${schema.billingPayment.createdAt})`))
			.limit(RECONCILE_BATCH)
			.for("update", { skipLocked: true });
		if (rows.length)
			await tx
				.update(schema.billingPayment)
				.set({ lastCheckedAt: now, checkAttempts: sql`${schema.billingPayment.checkAttempts} + 1` })
				.where(
					inArray(
						schema.billingPayment.id,
						rows.map((row) => row.id),
					),
				);
		return rows;
	});
	let checked = 0;
	let failures = 0;
	for (const payment of claimed) {
		// What's left waits for its next turn.
		if (Date.now() - started > RECONCILE_BUDGET_MS) break;
		try {
			await checkPayment(config, payment, now);
			checked++;
		} catch (error) {
			if (isTransientPolarError(error) || polarStatus(error)) failures++;
			console.warn("[billing] Reconciling a payment failed; it is checked again later.", {
				paymentId: payment.id,
				error: polarErrorCode("checkout.get", error),
			});
		}
	}
	// Every check failing at Polar, run after run, is an outage or a revoked token: the alert adds them up.
	if (failures && !checked) await raiseBillingAlertQuietly({ kind: "provider_errors", count: failures, now });
	return checked;
}

/**
 * Subscriptions whose period ended a while ago without a renewal, cancellation or failure arriving: asks Polar for
 * each (and its latest orders) and applies the answers. Returns how many it checked.
 */
export async function reconcileSubscriptions(now = new Date()): Promise<number> {
	const config = getPolarConfig();
	if (!config) return 0;
	const api = polarApi(config);
	const started = Date.now();
	const overdue = await db
		.select({ id: schema.billingSubscription.id, providerId: schema.billingSubscription.providerSubscriptionId })
		.from(schema.billingSubscription)
		.where(
			and(
				inArray(schema.billingSubscription.status, [...LIVE_SUBSCRIPTION_STATUSES]),
				isNotNull(schema.billingSubscription.currentPeriodEnd),
				lt(schema.billingSubscription.currentPeriodEnd, new Date(+now - SUBSCRIPTION_OVERDUE_MS)),
				or(
					isNull(schema.billingSubscription.lastCheckedAt),
					lt(schema.billingSubscription.lastCheckedAt, new Date(+now - SUBSCRIPTION_RECHECK_MS)),
				),
			),
		)
		.orderBy(asc(schema.billingSubscription.currentPeriodEnd))
		.limit(RECONCILE_BATCH);
	let checked = 0;
	for (const row of overdue) {
		if (Date.now() - started > RECONCILE_BUDGET_MS) break;
		await db
			.update(schema.billingSubscription)
			.set({ lastCheckedAt: now })
			.where(eq(schema.billingSubscription.id, row.id));
		try {
			const context = { source: "status_check", eventType: "status_check", now } as const;
			const orders = await api.orders.list({ subscription_id: row.providerId, limit: 3, sorting: ["-created_at"] });
			for (const order of orders.items.toReversed()) await applyPolarOrder(order, context);
			await applyPolarSubscription(await api.subscriptions.get(row.providerId), context);
			checked++;
		} catch (error) {
			console.warn("[billing] Checking a subscription with Polar failed; it is checked again later.", {
				subscriptionId: row.id,
				error: polarErrorCode("subscription.get", error),
			});
		}
	}
	return checked;
}

/**
 * Credits for the months of a yearly Pro AI subscription after its first: when a month starts, its 100 credits are
 * granted (once per subscription per month, so two runs never double them). Monthly subscriptions get theirs with
 * each renewal's order. Returns how many grants it made.
 */
export async function grantYearlyCredits(now = new Date()): Promise<number> {
	const perMonth = PLANS["pro-ai"].creditsPerMonth;
	if (!perMonth) return 0;
	const rows = await db
		.select()
		.from(schema.billingSubscription)
		.where(
			and(
				eq(schema.billingSubscription.planId, "pro-ai"),
				eq(schema.billingSubscription.interval, "year"),
				inArray(schema.billingSubscription.status, ["active", "trialing", "past_due"]),
				isNotNull(schema.billingSubscription.userId),
				gt(schema.billingSubscription.paidThrough, now),
			),
		)
		.limit(200);
	let granted = 0;
	for (const row of rows) {
		if (!row.userId || !row.currentPeriodEnd) continue;
		const month = creditMonth({ start: row.currentPeriodStart, end: row.currentPeriodEnd }, "year", now);
		if (!month) continue;
		const userId = row.userId;
		const [payment] = await db
			.select({ id: schema.billingPayment.id })
			.from(schema.billingPayment)
			.where(
				and(
					eq(schema.billingPayment.subscriptionId, row.id),
					inArray(schema.billingPayment.status, ["paid", "partially_refunded"]),
				),
			)
			.orderBy(sql`${schema.billingPayment.createdAt} desc`)
			.limit(1);
		// No paid order behind it here yet: the order brings the first month itself.
		if (!payment) continue;
		const grant = await db.transaction((tx) =>
			grantSubscriptionMonth(tx, {
				userId,
				subscriptionId: row.id,
				paymentId: payment.id,
				amount: perMonth,
				expiresAt: month.end,
				now,
			}),
		);
		if (grant) granted++;
	}
	return granted;
}

/**
 * Subscriptions whose account was deleted while they still billed: deletes (and anonymizes) the customer at Polar,
 * which cancels them at once, or revokes the subscription itself when Polar no longer knows the customer. The delete
 * hook tries this first; this catches what it couldn't. Returns how many it ended.
 */
export async function endDeletedAccountSubscriptions(now = new Date()): Promise<number> {
	const config = getPolarConfig();
	if (!config) return 0;
	const api = polarApi(config);
	const rows = await db
		.select({
			id: schema.billingSubscription.id,
			providerId: schema.billingSubscription.providerSubscriptionId,
			externalCustomerId: schema.billingSubscription.externalCustomerId,
		})
		.from(schema.billingSubscription)
		.where(
			and(
				isNull(schema.billingSubscription.userId),
				isNull(schema.billingSubscription.revokedForDeletionAt),
				inArray(schema.billingSubscription.status, [...LIVE_SUBSCRIPTION_STATUSES]),
			),
		)
		.limit(20);
	let ended = 0;
	for (const row of rows) {
		try {
			await deletePolarCustomer(config, row.externalCustomerId);
			try {
				await api.subscriptions.revoke(row.providerId);
			} catch (error) {
				// Deleting the customer canceled it already, or it had ended.
				const status = polarStatus(error);
				if (status !== 403 && status !== 404 && status !== 409 && status !== 422) throw error;
			}
			await db
				.update(schema.billingSubscription)
				.set({ revokedForDeletionAt: now })
				.where(eq(schema.billingSubscription.id, row.id));
			ended++;
		} catch (error) {
			console.warn("[billing] Ending a deleted account's subscription failed; it is tried again later.", {
				subscriptionId: row.id,
				error: polarErrorCode("subscription.revoke", error),
			});
		}
	}
	return ended;
}
