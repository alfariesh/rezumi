import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { RECONCILE_BATCH, RECONCILE_MIN_AGE_MS, SYNC_INTERVAL_MS } from "../reconcile";
import { getSumopodConfig } from "./config";
import { applySumopodPayment } from "./fulfillment";
import { orderIdFor, toWholeRupiah } from "./mapping";

/**
 * Closing QRIS payments nobody paid. Sumopod can't be asked where a payment stands (its API has no status endpoint for
 * API keys; checked against the sandbox 2026-11-10), so its webhooks are the only news of a payment: a missed one is
 * resent from Sumopod's Webhooks tab. What Rezumi can settle on its own is the end of a link: one never made (a lost
 * call) fails, and one that closed a while ago without news expires. A payment that comes in later still counts.
 */

const OPEN_STATUSES = ["creating", "pending"] as const;

/** How long after a payment link closes an unpaid payment is ended. */
const EXPIRY_GRACE_MS = 30 * 60 * 1000;

type OpenPayment = {
	id: string;
	providerCheckoutId: string | null;
	amount: number;
	expiresAt: Date | null;
	createdAt: Date;
};

const columns = {
	id: schema.billingPayment.id,
	providerCheckoutId: schema.billingPayment.providerCheckoutId,
	amount: schema.billingPayment.amount,
	expiresAt: schema.billingPayment.expiresAt,
	createdAt: schema.billingPayment.createdAt,
};

/** Ends one open QRIS payment when nobody can pay it any more. Returns whether it changed it. */
async function closeQrisPayment(payment: OpenPayment, now: Date): Promise<boolean> {
	if (!payment.providerCheckoutId) {
		// Sumopod never answered the request for a link: nothing to pay on. A younger one may still be opening.
		if (+now - +payment.createdAt <= RECONCILE_MIN_AGE_MS) return false;
		const failed = await db
			.update(schema.billingPayment)
			.set({ status: "failed", failureReason: "checkout_not_created" })
			.where(and(eq(schema.billingPayment.id, payment.id), eq(schema.billingPayment.status, "creating")))
			.returning({ id: schema.billingPayment.id });
		return failed.length > 0;
	}
	if (!payment.expiresAt || +now <= +payment.expiresAt + EXPIRY_GRACE_MS) return false;
	const applied = await applySumopodPayment(
		{
			payment_id: payment.providerCheckoutId,
			order_id: orderIdFor(payment.id),
			amount: toWholeRupiah(payment.amount),
			status: "expired",
		},
		{ source: "status_check", eventType: "status_check", now },
	);
	return applied.outcome === "applied";
}

/**
 * Looks at a QRIS payment someone is looking at (the return page), when it is still open and wasn't looked at in the
 * last SYNC_INTERVAL_MS: an abandoned link expires. A paid one arrives by webhook.
 */
export async function syncQrisPaymentStatus(paymentId: string, now = new Date()): Promise<void> {
	if (!getSumopodConfig()) return;
	const [claimed] = await db
		.update(schema.billingPayment)
		.set({ lastCheckedAt: now })
		.where(
			and(
				eq(schema.billingPayment.id, paymentId),
				eq(schema.billingPayment.provider, "sumopod"),
				inArray(schema.billingPayment.status, OPEN_STATUSES),
				or(
					isNull(schema.billingPayment.lastCheckedAt),
					lt(schema.billingPayment.lastCheckedAt, new Date(+now - SYNC_INTERVAL_MS)),
				),
			),
		)
		.returning(columns);
	if (claimed) await closeQrisPayment(claimed, now);
}

/**
 * The admin page's "check again" for a QRIS payment: closes it when nobody can pay it any more. Always false, since
 * Sumopod can't be asked; the admin resends a missed webhook from Sumopod's Webhooks tab instead.
 */
export async function syncQrisPaymentWithProvider(paymentId: string, now = new Date()): Promise<boolean> {
	const [payment] = await db
		.select(columns)
		.from(schema.billingPayment)
		.where(
			and(
				eq(schema.billingPayment.id, paymentId),
				eq(schema.billingPayment.provider, "sumopod"),
				inArray(schema.billingPayment.status, OPEN_STATUSES),
			),
		);
	if (payment) await closeQrisPayment(payment, now);
	return false;
}

/**
 * The billing job's sweep of QRIS payments nobody can pay any more: links never made, and links closed a while ago
 * without news. Safe to run twice at once (each change is a guarded update or an idempotent apply). Returns how many it
 * closed.
 */
export async function reconcileQrisPayments(now = new Date()): Promise<number> {
	if (!getSumopodConfig()) return 0;
	const rows = await db
		.select(columns)
		.from(schema.billingPayment)
		.where(
			and(
				eq(schema.billingPayment.provider, "sumopod"),
				inArray(schema.billingPayment.status, OPEN_STATUSES),
				or(
					and(
						isNull(schema.billingPayment.providerCheckoutId),
						lt(schema.billingPayment.createdAt, new Date(+now - RECONCILE_MIN_AGE_MS)),
					),
					and(
						isNotNull(schema.billingPayment.expiresAt),
						lt(schema.billingPayment.expiresAt, new Date(+now - EXPIRY_GRACE_MS)),
					),
				),
			),
		)
		.orderBy(asc(sql`${schema.billingPayment.createdAt}`))
		.limit(RECONCILE_BATCH);
	let closed = 0;
	for (const payment of rows) {
		try {
			if (await closeQrisPayment(payment, now)) closed++;
		} catch {
			console.warn("[billing] Closing an abandoned QRIS payment failed; it is tried again later.", {
				paymentId: payment.id,
			});
		}
	}
	return closed;
}
