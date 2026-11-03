import type { Transaction } from "./account";
import type { MidtransRefundAnswer } from "./midtrans/client";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { lockBillingAccount } from "./account";
import { raiseBillingAlertQuietly } from "./alerts";
import { applyVerifiedStatus, nextRefundSequence, refundKeyFor, settleRefunds } from "./fulfillment";
import { MidtransError, getTransactionStatus, refundTransaction } from "./midtrans/client";
import { getMidtransConfig } from "./midtrans/config";

/**
 * Giving money back, from the admin page. Through Midtrans for the methods its refund API takes; by hand (a bank
 * transfer) for virtual accounts and convenience stores, recorded here afterwards. A full refund takes the payment's
 * pass and remaining credits back; a partial one only when the admin asks.
 */

/** Payment types Midtrans' refund API takes (docs checked 2026-11-03). Virtual accounts and stores are refunded by hand. */
const API_REFUNDABLE = new Set(["qris", "gopay", "shopeepay", "dana", "ovo", "credit_card", "kredivo", "akulaku"]);
/** Methods Midtrans refunds only in full. */
const FULL_REFUND_ONLY = new Set(["shopeepay", "ovo"]);

/** Whether the admin page can refund through Midtrans, refund only in full, or only record a manual transfer. */
export function refundModeOf(paymentType: string | null) {
	if (!paymentType || !API_REFUNDABLE.has(paymentType)) return "manual" as const;
	return FULL_REFUND_ONLY.has(paymentType) ? ("api_full" as const) : ("api" as const);
}

type PaymentRow = typeof schema.billingPayment.$inferSelect;

/** Holds the payment for a refund: its account's billing lock first, as everywhere, then the row. */
async function lockPayment(tx: Transaction, paymentId: string) {
	const [owner] = await tx
		.select({ userId: schema.billingPayment.userId })
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.id, paymentId));
	if (!owner) throw new ORPCError("NOT_FOUND", { message: "No payment has that ID." });
	if (owner.userId) await lockBillingAccount(tx, owner.userId);
	const [payment] = await tx
		.select()
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.id, paymentId))
		.for("update");
	if (!payment) throw new ORPCError("NOT_FOUND", { message: "No payment has that ID." });
	if (payment.status !== "paid" && payment.status !== "partially_refunded")
		throw new ORPCError("BAD_REQUEST", { message: "Only a paid payment can be refunded." });
	return payment;
}

function assertAmount(payment: PaymentRow, amount: number) {
	const left = payment.amount - payment.refundedAmount;
	if (left <= 0) throw new ORPCError("BAD_REQUEST", { message: "This payment was already refunded in full." });
	if (amount > left)
		throw new ORPCError("BAD_REQUEST", { message: `At most Rp${left} of this payment is left to refund.` });
}

export type RefundResult = {
	refundId: string;
	status: "requesting" | "succeeded" | "failed";
	amount: number;
	paymentStatus: PaymentRow["status"];
	refundedAmount: number;
};

async function resultOf(refundId: string): Promise<RefundResult> {
	const [row] = await db
		.select({
			refundId: schema.billingRefund.id,
			status: schema.billingRefund.status,
			amount: schema.billingRefund.amount,
			paymentStatus: schema.billingPayment.status,
			refundedAmount: schema.billingPayment.refundedAmount,
		})
		.from(schema.billingRefund)
		.innerJoin(schema.billingPayment, eq(schema.billingRefund.paymentId, schema.billingPayment.id))
		.where(eq(schema.billingRefund.id, refundId));
	if (!row) throw new Error("The refund disappeared.");
	return row;
}

/** What a refusal from Midtrans means, for the admin. */
function refusalMessage(error: MidtransError) {
	switch (error.statusCode ?? String(error.httpStatus)) {
		case "412":
			return "Midtrans won't refund this payment now: its method may not allow it, the refund window may have passed (QRIS from another app: about 7 days), ShopeePay only takes refunds 06.00–23.50 WIB, or the merchant balance is too low.";
		case "414":
			return "Midtrans refused the amount.";
		case "401":
		case "403":
			return "Midtrans didn't allow the refund: refunds may not be activated on the account yet (ask Midtrans support), or Midtrans doesn't know this order.";
		default:
			return `Midtrans refused the refund (${error.code}).`;
	}
}

/**
 * Refunds through Midtrans' refund API. The refund (and its deterministic key, RF-<payment>-<n>) is saved before
 * Midtrans is asked, with the payment held so two clicks can't make two refunds; asking again while one is unanswered
 * sends the same key, which Midtrans never refunds twice. The answer goes through `applyVerifiedStatus`, the same
 * bookkeeping a refund notification gets, so whichever comes first wins and the other changes nothing.
 */
export async function requestRefund(input: {
	actorUserId: string;
	paymentId: string;
	/** Rupiah; the rest of the payment when left out. */
	amount?: number | undefined;
	reason: string;
	/** Also take the pass and credits back on a partial refund. A full refund always does. */
	revokeBenefits?: boolean | undefined;
	now?: Date;
}): Promise<RefundResult> {
	const config = getMidtransConfig();
	if (!config)
		throw new ORPCError("BILLING_UNAVAILABLE", { status: 403, message: "Midtrans isn't set up on this server." });
	const now = input.now ?? new Date();
	const claimed = await db.transaction(async (tx) => {
		const payment = await lockPayment(tx, input.paymentId);
		const mode = refundModeOf(payment.paymentType);
		if (mode === "manual")
			throw new ORPCError("BAD_REQUEST", {
				message: "Midtrans can't refund this method. Transfer the money yourself, then record a manual refund.",
			});
		const left = payment.amount - payment.refundedAmount;
		const amount = input.amount ?? left;
		const [open] = await tx
			.select()
			.from(schema.billingRefund)
			.where(and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.status, "requesting")));
		if (open) {
			// Asking again: the same key and amount, so a lost answer can't become a second refund.
			if (open.amount !== amount)
				throw new ORPCError("CONFLICT", {
					message: `A refund of Rp${open.amount} is still waiting for Midtrans. Check the status, or send that one again.`,
				});
			return { payment, refund: open };
		}
		assertAmount(payment, amount);
		if (mode === "api_full" && amount !== payment.amount)
			throw new ORPCError("BAD_REQUEST", { message: "Midtrans refunds this method only in full." });
		const sequence = await nextRefundSequence(tx, payment.id);
		const [refund] = await tx
			.insert(schema.billingRefund)
			.values({
				paymentId: payment.id,
				sequence,
				refundKey: refundKeyFor(payment.id, sequence),
				method: "midtrans",
				status: "requesting",
				amount,
				reason: input.reason,
				revokeBenefits: input.revokeBenefits ?? false,
				actorUserId: input.actorUserId,
			})
			.returning();
		if (!refund) throw new Error("The refund was not saved.");
		await tx.insert(schema.billingAuditLog).values({
			actorUserId: input.actorUserId,
			targetUserId: payment.userId,
			action: "refund.requested",
			reason: input.reason,
			details: { paymentId: payment.id, refundId: refund.id, refundKey: refund.refundKey, amount },
		});
		return { payment, refund };
	});

	const { payment, refund } = claimed;
	let answer: MidtransRefundAnswer;
	try {
		answer = await refundTransaction(config, payment.providerOrderId, {
			refundKey: refund.refundKey,
			// Without an amount Midtrans refunds the whole payment; only right when nothing was refunded before.
			amount: refund.amount === payment.amount ? undefined : refund.amount,
			reason: input.reason.slice(0, 255),
		});
	} catch (error) {
		if (!(error instanceof MidtransError)) throw error;
		return settleRefusal({ error, refund, payment, actorUserId: input.actorUserId, reason: input.reason, now });
	}
	if (!answer.confirmed) {
		// Accepted; the bank still has to confirm it. The refund job asks Midtrans until it does.
		await db
			.update(schema.billingRefund)
			.set({ failureReason: schema.REFUND_BANK_PROCESSING })
			.where(and(eq(schema.billingRefund.id, refund.id), eq(schema.billingRefund.status, "requesting")));
	} else if (answer.status.grossAmount === null) {
		// The reply is a verified status like Get Status; without its amount, ask for the full status instead.
		await syncPaymentWithMidtrans(payment.id, now);
	} else {
		await applyVerifiedStatus({
			paymentId: payment.id,
			verified: { found: true, status: answer.status },
			source: "admin",
			now,
		});
	}
	return resultOf(refund.id);
}

/** Midtrans' answers that say for certain this refund was not made; anything else may still have gone through. */
const NOT_MADE = new Set([400, 401, 403, 404, 412, 414]);

/**
 * After Midtrans didn't take a refund: its status is asked first, since the refund may have gone through anyway (a
 * lost answer, a key already used). Only a definite refusal, with a status that doesn't list the key, marks it failed;
 * otherwise it stays waiting, and sending it again with the same key is safe.
 */
async function settleRefusal(input: {
	error: MidtransError;
	refund: typeof schema.billingRefund.$inferSelect;
	payment: PaymentRow;
	actorUserId: string;
	reason: string;
	now: Date;
}): Promise<RefundResult> {
	const { error, refund, payment, now } = input;
	console.warn("[billing] A Midtrans refund didn't go through.", {
		paymentId: payment.id,
		refundId: refund.id,
		error: error.code,
		...(error.detail && { reason: error.detail }),
	});
	const checked = await syncPaymentWithMidtrans(payment.id, now).then(
		() => true,
		() => false,
	);
	const current = await resultOf(refund.id);
	if (current.status === "succeeded") return current;
	const code = Number(error.statusCode ?? error.httpStatus);
	if (!checked || error.transient || !NOT_MADE.has(code))
		throw new ORPCError("BAD_GATEWAY", {
			message:
				"Midtrans didn't confirm the refund. Check the status in a moment; sending it again is safe, it can't refund twice.",
		});
	await db
		.update(schema.billingRefund)
		.set({ status: "failed", failureReason: error.code })
		.where(and(eq(schema.billingRefund.id, refund.id), eq(schema.billingRefund.status, "requesting")));
	await db.insert(schema.billingAuditLog).values({
		actorUserId: input.actorUserId,
		targetUserId: payment.userId,
		action: "refund.failed",
		reason: input.reason,
		details: { paymentId: payment.id, refundId: refund.id, error: error.code },
	});
	await raiseBillingAlertQuietly({ kind: "refund_failed", paymentId: payment.id, now });
	throw new ORPCError("BAD_REQUEST", { message: refusalMessage(error) });
}

// The refund job asks about a waiting refund at most this often, for up to this long, this many per run.
const REFUND_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const REFUND_CHECK_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;
const REFUND_CHECK_BATCH = 10;

/**
 * The billing job's look at refunds still waiting on Midtrans (no answer, or the bank still processing): claims a
 * few not checked lately, then asks Midtrans about their payments outside any transaction. A refund the status lists
 * becomes succeeded through the usual bookkeeping. Safe to run twice at once. Returns how many payments it checked.
 */
export async function reconcileRefunds(now = new Date()): Promise<number> {
	if (!getMidtransConfig()) return 0;
	const refund = schema.billingRefund;
	const claimed = await db.transaction(async (tx) => {
		const rows = await tx
			.select({ id: refund.id, paymentId: refund.paymentId })
			.from(refund)
			.where(
				and(
					eq(refund.status, "requesting"),
					lt(refund.updatedAt, new Date(+now - REFUND_CHECK_INTERVAL_MS)),
					gt(refund.createdAt, new Date(+now - REFUND_CHECK_MAX_AGE_MS)),
				),
			)
			.orderBy(asc(refund.updatedAt))
			.limit(REFUND_CHECK_BATCH)
			.for("update", { skipLocked: true });
		if (rows.length)
			await tx
				.update(refund)
				.set({ updatedAt: now })
				.where(
					inArray(
						refund.id,
						rows.map((row) => row.id),
					),
				);
		return rows;
	});
	let checked = 0;
	for (const paymentId of new Set(claimed.map((row) => row.paymentId))) {
		try {
			await syncPaymentWithMidtrans(paymentId, now);
			checked++;
		} catch (error) {
			console.warn("[billing] Checking a waiting refund failed; it is checked again later.", {
				paymentId,
				error: error instanceof MidtransError ? error.code : "error",
			});
		}
	}
	return checked;
}

/**
 * Asks Midtrans where a payment stands now, whatever its status here, and applies the answer: a missed notification,
 * a refund made in the Midtrans dashboard, a refund whose answer was lost. Null when Midtrans has no transaction yet.
 */
export async function syncPaymentWithMidtrans(paymentId: string, now = new Date()) {
	const config = getMidtransConfig();
	if (!config)
		throw new ORPCError("BILLING_UNAVAILABLE", { status: 403, message: "Midtrans isn't set up on this server." });
	const [payment] = await db
		.select({ providerOrderId: schema.billingPayment.providerOrderId })
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.id, paymentId));
	if (!payment) throw new ORPCError("NOT_FOUND", { message: "No payment has that ID." });
	const result = await getTransactionStatus(config, payment.providerOrderId);
	if (!result.found) return null;
	return {
		transactionStatus: result.status.transactionStatus,
		...(await applyVerifiedStatus({ paymentId, verified: result, source: "admin", now })),
	};
}

/**
 * Records money the admin gave back outside Midtrans, such as a bank transfer for a virtual account payment. The
 * payment's refunded total and status follow, and a full refund takes the pass and remaining credits back.
 */
export async function recordManualRefund(input: {
	actorUserId: string;
	paymentId: string;
	amount: number;
	reason: string;
	revokeBenefits?: boolean | undefined;
	now?: Date;
}): Promise<RefundResult> {
	const now = input.now ?? new Date();
	const refundId = await db.transaction(async (tx) => {
		const payment = await lockPayment(tx, input.paymentId);
		const [open] = await tx
			.select({ id: schema.billingRefund.id })
			.from(schema.billingRefund)
			.where(and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.status, "requesting")));
		if (open)
			throw new ORPCError("CONFLICT", {
				message: "A Midtrans refund for this payment is still waiting. Check the status first.",
			});
		assertAmount(payment, input.amount);
		const sequence = await nextRefundSequence(tx, payment.id);
		const [refund] = await tx
			.insert(schema.billingRefund)
			.values({
				paymentId: payment.id,
				sequence,
				refundKey: refundKeyFor(payment.id, sequence),
				method: "manual",
				status: "succeeded",
				amount: input.amount,
				reason: input.reason,
				revokeBenefits: input.revokeBenefits ?? false,
				actorUserId: input.actorUserId,
				settledAt: now,
			})
			.returning({ id: schema.billingRefund.id });
		if (!refund) throw new Error("The refund was not saved.");
		const settled = await settleRefunds(tx, payment, { now });
		await tx
			.update(schema.billingPayment)
			.set({
				refundedAmount: settled.refundedAmount,
				status: settled.full ? "refunded" : "partially_refunded",
			})
			.where(eq(schema.billingPayment.id, payment.id));
		await tx.insert(schema.billingAuditLog).values({
			actorUserId: input.actorUserId,
			targetUserId: payment.userId,
			action: "payment.refund_recorded",
			reason: input.reason,
			details: {
				paymentId: payment.id,
				refundId: refund.id,
				method: "manual",
				amount: input.amount,
				refundedAmount: settled.refundedAmount,
			},
		});
		return refund.id;
	});
	return resultOf(refundId);
}
