import type { AppliedPaymentStatus } from "./fulfillment";
import type { MidtransConfig } from "./midtrans/config";
import { and, asc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { raiseBillingAlertQuietly } from "./alerts";
import { alertIfPaidNotApplied, applyVerifiedStatus } from "./fulfillment";
import { MidtransError, expireTransaction, getTransactionStatus } from "./midtrans/client";
import { getMidtransConfig } from "./midtrans/config";

/**
 * Asking Midtrans where open payments stand, for the notifications that never arrive: when someone looks at a payment,
 * and from the billing job with backoff. Every HTTP call happens outside a transaction; `applyVerifiedStatus`
 * applies the answer.
 */

/** How long after the payment window closes an unpaid payment is ended: Midtrans has closed its page by then. */
export const EXPIRY_GRACE_MS = 30 * 60 * 1000;
/** Someone looking at a payment checks Midtrans at most this often. */
export const SYNC_INTERVAL_MS = 10_000;
// The billing job checks payments older than this, up to this age, this many per run, within this time.
const RECONCILE_MIN_AGE_MS = 2 * 60 * 1000;
const RECONCILE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const RECONCILE_BATCH = 20;
const RECONCILE_BUDGET_MS = 20_000;

const OPEN_STATUSES = ["creating", "pending"] as const;

type OpenPayment = { id: string; providerOrderId: string; expiresAt: Date | null };

const paymentColumns = {
	id: schema.billingPayment.id,
	providerOrderId: schema.billingPayment.providerOrderId,
	expiresAt: schema.billingPayment.expiresAt,
};

/**
 * Checks one open payment with Midtrans and applies the answer. Once its window closed more than EXPIRY_GRACE_MS ago,
 * it first expires the transaction at Midtrans, then checks again; still nothing there means it was never paid.
 */
async function checkPayment(
	config: MidtransConfig,
	payment: OpenPayment,
	now: Date,
): Promise<AppliedPaymentStatus | null> {
	const closed = payment.expiresAt !== null && +now > +payment.expiresAt + EXPIRY_GRACE_MS;
	if (closed)
		await expireTransaction(config, payment.providerOrderId).catch((error: unknown) => {
			// The status check below decides; an expire Midtrans refused changes nothing.
			if (!(error instanceof MidtransError)) throw error;
		});
	const result = await getTransactionStatus(config, payment.providerOrderId);
	if (result.found)
		return applyVerifiedStatus({ paymentId: payment.id, verified: result, source: "status_check", now }).catch(
			async (error: unknown) => {
				await alertIfPaidNotApplied(payment.id, result);
				throw error;
			},
		);
	if (!closed) return null;
	return applyVerifiedStatus({
		paymentId: payment.id,
		verified: { found: false, status: "expired", reason: "window_closed" },
		source: "status_check",
		now,
	});
}

/**
 * Checks a payment someone is looking at, when it is still open and wasn't checked in the last SYNC_INTERVAL_MS.
 * Concurrent lookers make one call between them. Errors leave the payment as it was.
 */
export async function syncPaymentStatus(paymentId: string, now = new Date()): Promise<void> {
	const config = getMidtransConfig();
	if (!config) return;
	const [claimed] = await db
		.update(schema.billingPayment)
		.set({ lastCheckedAt: now })
		.where(
			and(
				eq(schema.billingPayment.id, paymentId),
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
		console.warn("[billing] Checking a payment with Midtrans failed; it is checked again later.", {
			paymentId,
			error: error instanceof MidtransError ? error.code : "error",
		});
	}
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
 * The billing job's safety net for missed notifications: claims open payments due for a check (skipping rows another
 * run holds), marks them checked, then asks Midtrans about each within a time budget. Safe to run twice at once.
 * Returns how many it checked.
 */
export async function reconcilePayments(now = new Date()): Promise<number> {
	const config = getMidtransConfig();
	if (!config) return 0;
	const started = Date.now();
	const claimed = await db.transaction(async (tx) => {
		const rows = await tx
			.select(paymentColumns)
			.from(schema.billingPayment)
			.where(
				and(
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
	let midtransFailures = 0;
	for (const payment of claimed) {
		// What's left waits for its next turn.
		if (Date.now() - started > RECONCILE_BUDGET_MS) break;
		try {
			await checkPayment(config, payment, now);
			checked++;
		} catch (error) {
			if (error instanceof MidtransError) midtransFailures++;
			console.warn("[billing] Reconciling a payment failed; it is checked again later.", {
				paymentId: payment.id,
				error: error instanceof MidtransError ? error.code : "error",
			});
		}
	}
	// Every check failing at Midtrans, run after run, is an outage or a wrong key: the alert adds them up.
	if (midtransFailures && !checked)
		await raiseBillingAlertQuietly({ kind: "midtrans_errors", count: midtransFailures, now });
	return checked;
}
