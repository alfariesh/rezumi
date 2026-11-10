import type { DodoApi } from "./dodo/client";
import type { DodoConfig } from "./dodo/config";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, notExists, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { PLANS } from "@rezumi/schema/billing";
import { raiseBillingAlertQuietly } from "./alerts";
import { grantSubscriptionMonth } from "./credits";
import { cancelProviderSubscription } from "./deletion";
import { dodoApi, dodoErrorCode, dodoStatus, isTransientDodoError } from "./dodo/client";
import { getDodoConfig } from "./dodo/config";
import { applyDodoCheckout, applyDodoPayment, applyDodoSubscription } from "./fulfillment";
import { creditMonth } from "./subscription-access";
import { CHANGE_REQUESTED_ACTION, LIVE_SUBSCRIPTION_STATUSES } from "./subscriptions";
import { readPayment } from "./webhook";

/**
 * Asking Dodo Payments where things stand, for the webhooks that never arrive or arrive late: when someone looks at an
 * open payment, and from the billing job with backoff. Every Dodo call happens outside a transaction; the functions in
 * fulfillment.ts apply the answers, exactly as they apply webhooks.
 */

/** Someone looking at a payment checks Dodo at most this often. */
export const SYNC_INTERVAL_MS = 10_000;
// The billing job checks payments older than this, up to this age, this many per run, within this time.
const RECONCILE_MIN_AGE_MS = 2 * 60 * 1000;
const RECONCILE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const RECONCILE_BATCH = 20;
const RECONCILE_BUDGET_MS = 20_000;
/** A subscription whose period ended this long ago without news is asked about, then at most this often. */
const SUBSCRIPTION_OVERDUE_MS = 30 * 60 * 1000;
const SUBSCRIPTION_RECHECK_MS = 60 * 60 * 1000;
/** An upgrade whose charge was still settling is checked this often, for this long after it was asked. */
const CHANGE_RECHECK_MS = 45 * 1000;
const CHANGE_WINDOW_MS = 30 * 60 * 1000;

const OPEN_STATUSES = ["creating", "pending"] as const;

type OpenPayment = {
	id: string;
	providerCheckoutId: string | null;
	providerPaymentId: string | null;
	createdAt: Date;
};

const paymentColumns = {
	id: schema.billingPayment.id,
	providerCheckoutId: schema.billingPayment.providerCheckoutId,
	providerPaymentId: schema.billingPayment.providerPaymentId,
	createdAt: schema.billingPayment.createdAt,
};

/** Reads one payment and the subscription it charges from Dodo, and applies them. */
async function applyPaymentFromDodo(api: DodoApi, paymentId: string, now: Date) {
	const payment = await api.payments.retrieve(paymentId);
	return applyDodoPayment(
		payment,
		{ source: "status_check", eventType: "status_check", now },
		await readPayment(api, payment),
	);
}

/**
 * Checks one open payment with Dodo and applies the answer: its payment once there is one, else its checkout session
 * (a session closed long ago without a payment expires it).
 */
async function checkPayment(config: DodoConfig, payment: OpenPayment, now: Date) {
	const api = dodoApi(config);
	if (payment.providerPaymentId) return applyPaymentFromDodo(api, payment.providerPaymentId, now);
	if (!payment.providerCheckoutId) {
		// Dodo never answered the checkout request (a lost call): nothing to pay on. A younger one may still be opening.
		if (+now - +payment.createdAt > RECONCILE_MIN_AGE_MS)
			await db
				.update(schema.billingPayment)
				.set({ status: "failed", failureReason: "checkout_not_created" })
				.where(and(eq(schema.billingPayment.id, payment.id), eq(schema.billingPayment.status, "creating")));
		return null;
	}
	const session = await api.checkoutSessions.retrieve(payment.providerCheckoutId);
	if (session.payment_id) return applyPaymentFromDodo(api, session.payment_id, now);
	return applyDodoCheckout(session, { source: "status_check", eventType: "status_check", now });
}

/**
 * Checks a payment someone is looking at, when it is still open and wasn't checked in the last SYNC_INTERVAL_MS.
 * Concurrent lookers make one call between them. Errors leave the payment as it was.
 */
export async function syncPaymentStatus(paymentId: string, now = new Date()): Promise<void> {
	const config = getDodoConfig();
	if (!config) return;
	const [claimed] = await db
		.update(schema.billingPayment)
		.set({ lastCheckedAt: now })
		.where(
			and(
				eq(schema.billingPayment.id, paymentId),
				eq(schema.billingPayment.provider, "dodo"),
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
		console.warn("[billing] Checking a payment with Dodo Payments failed; it is checked again later.", {
			paymentId,
			error: dodoErrorCode("checkout.get", error),
		});
	}
}

/**
 * Asks Dodo about one payment now, whatever its status here, and applies the answer: a missed webhook, a refund made in
 * Dodo's dashboard. The admin page's "check again". Returns false when Dodo has nothing for it yet.
 */
export async function syncPaymentWithProvider(paymentId: string, now = new Date()): Promise<boolean> {
	const config = getDodoConfig();
	if (!config) return false;
	const [payment] = await db
		.select(paymentColumns)
		.from(schema.billingPayment)
		.where(and(eq(schema.billingPayment.id, paymentId), eq(schema.billingPayment.provider, "dodo")));
	if (!payment || (!payment.providerPaymentId && !payment.providerCheckoutId)) return false;
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
 * holds), marks them checked, then asks Dodo about each within a time budget. Safe to run twice at once. Returns how
 * many it checked.
 */
export async function reconcilePayments(now = new Date()): Promise<number> {
	const config = getDodoConfig();
	if (!config) return 0;
	const started = Date.now();
	const claimed = await db.transaction(async (tx) => {
		const rows = await tx
			.select(paymentColumns)
			.from(schema.billingPayment)
			.where(
				and(
					eq(schema.billingPayment.provider, "dodo"),
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
			if (isTransientDodoError(error) || dodoStatus(error)) failures++;
			console.warn("[billing] Reconciling a payment failed; it is checked again later.", {
				paymentId: payment.id,
				error: dodoErrorCode("checkout.get", error),
			});
		}
	}
	// Every check failing at Dodo, run after run, is an outage or a revoked key: the alert adds them up.
	if (failures && !checked) await raiseBillingAlertQuietly({ kind: "provider_errors", count: failures, now });
	return checked;
}

/** How many of a subscription's latest payments a check applies. */
const RECENT_PAYMENTS = 3;

/**
 * Applies a subscription's latest payments, oldest first: a renewal, a plan change or a refund whose webhook hasn't
 * arrived yet. Payments applied already change nothing. `since` leaves out older ones. Returns how many it applied.
 */
export async function applyRecentPayments(
	api: DodoApi,
	providerSubscriptionId: string,
	now: Date,
	since?: Date,
): Promise<number> {
	const page = await api.payments.list({
		subscription_id: providerSubscriptionId,
		page_size: 10,
		...(since && { created_at_gte: since.toISOString() }),
	});
	const recent = page.items
		.toSorted((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
		.slice(0, RECENT_PAYMENTS)
		.toReversed();
	for (const item of recent) await applyPaymentFromDodo(api, item.payment_id, now);
	return recent.length;
}

/**
 * Asks Dodo about subscriptions whose webhooks seem lost, and applies the answers (latest payments, then the
 * subscription): a period that ended a while ago without a renewal, cancellation or failure arriving, and a monthly
 * Pro AI subscription paid through now without credits for now, whose plan-change payment hasn't arrived, and an
 * upgrade asked for in the last half hour that hasn't reached its new product here (its charge was still settling when
 * the customer got their answer). Yearly ones get their months from grantYearlyCredits. Returns how many it checked.
 */
export async function reconcileSubscriptions(now = new Date()): Promise<number> {
	const config = getDodoConfig();
	if (!config) return 0;
	const api = dodoApi(config);
	const started = Date.now();
	const overdue = and(
		isNotNull(schema.billingSubscription.currentPeriodEnd),
		lt(schema.billingSubscription.currentPeriodEnd, new Date(+now - SUBSCRIPTION_OVERDUE_MS)),
	);
	const uncredited = and(
		eq(schema.billingSubscription.planId, "pro-ai"),
		eq(schema.billingSubscription.interval, "month"),
		gt(schema.billingSubscription.paidThrough, now),
		notExists(
			db
				.select({ id: schema.aiCreditGrant.id })
				.from(schema.aiCreditGrant)
				.where(
					and(
						eq(schema.aiCreditGrant.subscriptionId, schema.billingSubscription.id),
						gt(schema.aiCreditGrant.expiresAt, now),
					),
				),
		),
	);
	const dueRows = await db
		.select({ id: schema.billingSubscription.id, providerId: schema.billingSubscription.providerSubscriptionId })
		.from(schema.billingSubscription)
		.where(
			and(
				eq(schema.billingSubscription.provider, "dodo"),
				inArray(schema.billingSubscription.status, [...LIVE_SUBSCRIPTION_STATUSES]),
				or(overdue, uncredited),
				or(
					isNull(schema.billingSubscription.lastCheckedAt),
					lt(schema.billingSubscription.lastCheckedAt, new Date(+now - SUBSCRIPTION_RECHECK_MS)),
				),
			),
		)
		.orderBy(asc(schema.billingSubscription.currentPeriodEnd))
		.limit(RECONCILE_BATCH);
	const awaited = await db
		.selectDistinct({
			id: schema.billingSubscription.id,
			providerId: schema.billingSubscription.providerSubscriptionId,
		})
		.from(schema.billingSubscription)
		.innerJoin(
			schema.billingAuditLog,
			and(
				eq(schema.billingAuditLog.action, CHANGE_REQUESTED_ACTION),
				gt(schema.billingAuditLog.createdAt, new Date(+now - CHANGE_WINDOW_MS)),
				sql`${schema.billingAuditLog.details}->>'subscriptionId' = ${schema.billingSubscription.id}`,
				sql`${schema.billingAuditLog.details}->>'productId' <> ${schema.billingSubscription.providerProductId}`,
			),
		)
		.where(
			and(
				eq(schema.billingSubscription.provider, "dodo"),
				inArray(schema.billingSubscription.status, [...LIVE_SUBSCRIPTION_STATUSES]),
				or(
					isNull(schema.billingSubscription.lastCheckedAt),
					lt(schema.billingSubscription.lastCheckedAt, new Date(+now - CHANGE_RECHECK_MS)),
				),
			),
		)
		.limit(RECONCILE_BATCH);
	const rows = [...awaited, ...dueRows.filter((row) => !awaited.some((other) => other.id === row.id))];
	let checked = 0;
	for (const row of rows) {
		if (Date.now() - started > RECONCILE_BUDGET_MS) break;
		await db
			.update(schema.billingSubscription)
			.set({ lastCheckedAt: now })
			.where(eq(schema.billingSubscription.id, row.id));
		try {
			await applyRecentPayments(api, row.providerId, now);
			const observedAt = new Date();
			const current = await api.subscriptions.retrieve(row.providerId);
			await applyDodoSubscription(current, { source: "status_check", eventType: "status_check", now }, observedAt);
			checked++;
		} catch (error) {
			console.warn("[billing] Checking a subscription with Dodo Payments failed; it is checked again later.", {
				subscriptionId: row.id,
				error: dodoErrorCode("subscription.get", error),
			});
		}
	}
	return checked;
}

/**
 * Credits for the months of a yearly Pro AI subscription after its first: when a month starts, its 100 credits are
 * granted (once per subscription per month, so two runs never double them). Monthly subscriptions get theirs with
 * each renewal's payment. Returns how many grants it made.
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
		// Granted already (the usual case, every minute of the month), or still covered by an earlier grant running into
		// this month (a switch from monthly): a read, not a write under the account's lock.
		const [given] = await db
			.select({ id: schema.aiCreditGrant.id })
			.from(schema.aiCreditGrant)
			.where(
				and(
					eq(schema.aiCreditGrant.subscriptionId, row.id),
					or(
						eq(schema.aiCreditGrant.expiresAt, month.end),
						and(isNull(schema.aiCreditGrant.revokedAt), gt(schema.aiCreditGrant.expiresAt, month.start)),
					),
				),
			)
			.limit(1);
		if (given) continue;
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
		// No paid payment behind it here yet: the payment brings the first month itself.
		if (!payment) continue;
		const grant = await db.transaction((tx) =>
			grantSubscriptionMonth(tx, {
				userId,
				subscriptionId: row.id,
				paymentId: payment.id,
				amount: perMonth,
				startsAt: month.start,
				expiresAt: month.end,
				now,
			}),
		);
		if (grant) granted++;
	}
	return granted;
}

/**
 * Subscriptions whose account was deleted while they still billed: cancels each at Dodo at once. The delete hook tries
 * this first; this catches what it couldn't. Returns how many it ended.
 */
export async function endDeletedAccountSubscriptions(now = new Date()): Promise<number> {
	const config = getDodoConfig();
	if (!config) return 0;
	const rows = await db
		.select({ id: schema.billingSubscription.id, providerId: schema.billingSubscription.providerSubscriptionId })
		.from(schema.billingSubscription)
		.where(
			and(
				eq(schema.billingSubscription.provider, "dodo"),
				isNull(schema.billingSubscription.userId),
				isNull(schema.billingSubscription.revokedForDeletionAt),
				inArray(schema.billingSubscription.status, [...LIVE_SUBSCRIPTION_STATUSES]),
			),
		)
		.limit(20);
	let ended = 0;
	for (const row of rows) {
		try {
			await cancelProviderSubscription(config, row.providerId, now);
			await db
				.update(schema.billingSubscription)
				.set({ revokedForDeletionAt: now })
				.where(eq(schema.billingSubscription.id, row.id));
			ended++;
		} catch (error) {
			console.warn("[billing] Ending a deleted account's subscription failed; it is tried again later.", {
				subscriptionId: row.id,
				error: dodoErrorCode("subscription.cancel", error),
			});
		}
	}
	return ended;
}
