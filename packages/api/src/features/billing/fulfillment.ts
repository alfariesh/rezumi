import type { Transaction } from "./account";
import type { MidtransRefund, MidtransTransactionStatus } from "./midtrans/client";
import type { BillingPaymentEventOutcome, BillingPaymentEventSource, BillingPaymentStatus } from "@rezumi/db/schema";
import { and, eq, gt, isNull, max } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { lockBillingAccount } from "./account";
import { raiseBillingAlert, raiseBillingAlertQuietly } from "./alerts";
import { grantCredits } from "./credits";
import { mapProviderStatus, nextPaymentStatus, parseGrossAmount } from "./midtrans/status";
import { grantMembershipPeriod, revokeMembershipPeriod } from "./periods";
import { DAY_MS } from "./timeline";

type PaymentRow = typeof schema.billingPayment.$inferSelect;

/**
 * What the server verified about a payment: Midtrans' own status (from Get Status, never a browser), or, when
 * Midtrans has no transaction for it at all, the local end it reached: expired after its window closed unpaid, or
 * cancelled because the customer switched to another payment method.
 */
export type VerifiedPaymentStatus =
	| { found: true; status: MidtransTransactionStatus }
	| { found: false; status: "expired" | "cancelled"; reason: string };

export type AppliedPaymentStatus = {
	status: BillingPaymentStatus;
	outcome: BillingPaymentEventOutcome;
	/** Whether this call granted the pass and credits. */
	fulfilled: boolean;
};

/** Takes back a payment's pass and the credits it brought (full refund, reversal). Safe to call twice. */
async function revokePaymentBenefits(
	tx: Transaction,
	payment: Pick<PaymentRow, "id" | "userId">,
	reason: string,
	now = new Date(),
) {
	if (!payment.userId) return { periods: 0, credits: 0 };
	const periods = await tx
		.select({ id: schema.membershipPeriod.id })
		.from(schema.membershipPeriod)
		.where(
			and(
				eq(schema.membershipPeriod.paymentId, payment.id),
				isNull(schema.membershipPeriod.revokedAt),
				gt(schema.membershipPeriod.endsAt, now),
			),
		);
	let revoked = 0;
	for (const period of periods)
		if (await revokeMembershipPeriod(tx, { userId: payment.userId, periodId: period.id, reason, now })) revoked++;
	const grants = await tx
		.update(schema.aiCreditGrant)
		.set({ revokedAt: now })
		.where(and(eq(schema.aiCreditGrant.paymentId, payment.id), isNull(schema.aiCreditGrant.revokedAt)))
		.returning({ remaining: schema.aiCreditGrant.remaining });
	const credits = grants.reduce((sum, grant) => sum + grant.remaining, 0);
	if (revoked || grants.length)
		await tx.insert(schema.billingAuditLog).values({
			targetUserId: payment.userId,
			action: "payment.benefits_revoked",
			reason,
			details: { paymentId: payment.id, periods: revoked, credits },
		});
	return { periods: revoked, credits };
}

/** Rezumi's refund key for a payment's nth refund: deterministic, so sending it again never refunds twice. */
export const refundKeyFor = (paymentId: string, sequence: number) => `RF-${paymentId}-${sequence}`;

/** The payment's next refund sequence number. Call it holding the payment row. */
export async function nextRefundSequence(tx: Transaction, paymentId: string) {
	const [last] = await tx
		.select({ sequence: max(schema.billingRefund.sequence) })
		.from(schema.billingRefund)
		.where(eq(schema.billingRefund.paymentId, paymentId));
	return (last?.sequence ?? 0) + 1;
}

/**
 * Brings the payment's refunds in line with what Midtrans lists: Rezumi's own requests (by refund key) become
 * succeeded, and a refund made in the Midtrans dashboard is added with Midtrans' key. Idempotent by refund key.
 */
async function recordProviderRefunds(tx: Transaction, payment: PaymentRow, refunds: MidtransRefund[], now: Date) {
	for (const refund of refunds) {
		const amount = parseGrossAmount(refund.amount);
		if (!amount) continue;
		const [known] = await tx
			.select({ id: schema.billingRefund.id, status: schema.billingRefund.status })
			.from(schema.billingRefund)
			.where(and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.refundKey, refund.refundKey)));
		if (known) {
			if (known.status !== "succeeded")
				await tx
					.update(schema.billingRefund)
					.set({ status: "succeeded", settledAt: now, failureReason: null })
					.where(eq(schema.billingRefund.id, known.id));
			continue;
		}
		await tx.insert(schema.billingRefund).values({
			paymentId: payment.id,
			sequence: await nextRefundSequence(tx, payment.id),
			refundKey: refund.refundKey,
			method: "midtrans",
			status: "succeeded",
			amount,
			reason: refund.reason ?? "Refunded in the Midtrans dashboard",
			settledAt: now,
		});
	}
}

/**
 * After a refund is recorded: what the payment has given back in total (its succeeded refunds, or Midtrans' own total
 * when that is higher, all of it when Midtrans says the whole payment was refunded), and its pass and credits taken
 * back when all the money went back or the admin asked for it on a partial refund. Runs in the caller's transaction,
 * holding the payment row; taking back twice changes nothing.
 */
export async function settleRefunds(
	tx: Transaction,
	payment: PaymentRow,
	input: {
		now: Date;
		providerTotal?: number | null;
		fullyRefunded?: boolean;
		/** Whether Midtrans listed its refunds by key; without the list a full refund settles every waiting one. */
		providerListed?: boolean;
	},
) {
	if (input.fullyRefunded && !input.providerListed)
		await tx
			.update(schema.billingRefund)
			.set({ status: "succeeded", settledAt: input.now })
			.where(and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.status, "requesting")));
	const succeeded = await tx
		.select({
			method: schema.billingRefund.method,
			amount: schema.billingRefund.amount,
			revokeBenefits: schema.billingRefund.revokeBenefits,
		})
		.from(schema.billingRefund)
		.where(and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.status, "succeeded")));
	const sum = (method: string) =>
		succeeded.filter((refund) => refund.method === method).reduce((total, refund) => total + refund.amount, 0);
	const viaMidtrans = Math.max(sum("midtrans"), input.providerTotal ?? 0);
	// Never lower than before: a total Midtrans reported without a row behind it still counts.
	const refundedAmount = input.fullyRefunded
		? payment.amount
		: Math.min(payment.amount, Math.max(payment.refundedAmount, sum("manual") + viaMidtrans));
	const full = refundedAmount >= payment.amount;
	if (full || succeeded.some((refund) => refund.revokeBenefits))
		await revokePaymentBenefits(tx, payment, full ? "payment.refunded" : "payment.partially_refunded", input.now);
	return { refundedAmount, full };
}

/** Grants a paid payment's pass, queued like any purchase, and its credits until that pass ends. */
async function fulfil(tx: Transaction, payment: PaymentRow & { userId: string }, now: Date) {
	const period = await grantMembershipPeriod(tx, {
		userId: payment.userId,
		planId: payment.planId,
		durationMs: payment.durationDays * DAY_MS,
		source: "payment",
		paymentId: payment.id,
		now,
	});
	if (payment.credits > 0)
		await grantCredits(tx, {
			userId: payment.userId,
			source: "plan",
			amount: payment.credits,
			expiresAt: period.endsAt,
			paymentId: payment.id,
			now,
		});
	await tx.insert(schema.billingAuditLog).values({
		targetUserId: payment.userId,
		action: "payment.fulfilled",
		details: {
			paymentId: payment.id,
			planId: payment.planId,
			amount: payment.amount,
			periodId: period.id,
			startsAt: period.startsAt.toISOString(),
			endsAt: period.endsAt.toISOString(),
			credits: payment.credits,
		},
	});
}

/**
 * After applying a verified status failed: when Midtrans says the payment is paid, the customer paid and is still
 * waiting, so the owner hears about it now rather than after the retries.
 */
export async function alertIfPaidNotApplied(paymentId: string, verified: VerifiedPaymentStatus) {
	if (!verified.found) return;
	const mapped = mapProviderStatus(verified.status.transactionStatus, verified.status.fraudStatus);
	if (mapped.kind === "status" && mapped.status === "paid")
		await raiseBillingAlertQuietly({ kind: "paid_not_applied", paymentId });
}

/**
 * The one door every payment status change goes through. Holding the account's billing lock and the payment row, it
 * checks the amount, applies the allowed transition (midtrans/status.ts), grants the pass and credits exactly once
 * when the payment becomes paid, takes them back on a full refund or reversal, and records what happened. Call it
 * with a status verified server-side, and never from inside another transaction: it opens its own.
 */
export async function applyVerifiedStatus(input: {
	paymentId: string;
	verified: VerifiedPaymentStatus;
	source: BillingPaymentEventSource;
	/** The notification that prompted the check, when one did. */
	notification?: { transactionStatus: string | null };
	now?: Date;
}): Promise<AppliedPaymentStatus> {
	const now = input.now ?? new Date();
	const [owner] = await db
		.select({ userId: schema.billingPayment.userId })
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.id, input.paymentId));
	if (!owner) throw new Error("No payment has that ID.");
	return db.transaction(async (tx) => {
		// The account first, as every billing change takes it, then the payment row.
		if (owner.userId) await lockBillingAccount(tx, owner.userId);
		const [payment] = await tx
			.select()
			.from(schema.billingPayment)
			.where(eq(schema.billingPayment.id, input.paymentId))
			.for("update");
		if (!payment) throw new Error("No payment has that ID.");
		const { verified } = input;
		const provider = verified.found ? verified.status : null;
		if (provider && provider.orderId !== payment.providerOrderId)
			throw new Error("The verified status belongs to another order.");

		const record = (outcome: BillingPaymentEventOutcome) =>
			// A status check that changed nothing isn't news; every notification is kept.
			input.source === "status_check" && outcome === "duplicate"
				? Promise.resolve()
				: tx
						.insert(schema.billingPaymentEvent)
						.values({
							paymentId: payment.id,
							providerOrderId: payment.providerOrderId,
							source: input.source,
							transactionStatus: provider?.transactionStatus ?? null,
							statusCode: provider?.statusCode ?? null,
							fraudStatus: provider?.fraudStatus ?? null,
							grossAmount: provider?.grossAmount ?? null,
							signatureValid: input.source === "notification" ? true : null,
							outcome,
							payload: {
								...provider?.fields,
								...(input.notification && { notified_status: input.notification.transactionStatus }),
								...(!verified.found && { local_status: verified.status, reason: verified.reason }),
							},
							receivedAt: now,
						})
						.then(() => undefined);
		const checked = input.source === "status_check" ? { lastCheckedAt: now } : {};
		const keep = async (outcome: BillingPaymentEventOutcome): Promise<AppliedPaymentStatus> => {
			await record(outcome);
			if (input.source === "status_check")
				await tx.update(schema.billingPayment).set(checked).where(eq(schema.billingPayment.id, payment.id));
			return { status: payment.status, outcome, fulfilled: false };
		};

		if (provider && parseGrossAmount(provider.grossAmount) !== payment.amount) {
			console.error("[billing] A Midtrans amount doesn't match its payment; nothing was granted.", {
				paymentId: payment.id,
				orderId: payment.providerOrderId,
			});
			await raiseBillingAlert(tx, { kind: "amount_mismatch", paymentId: payment.id, now });
			return keep("amount_mismatch");
		}
		const mapped = verified.found
			? mapProviderStatus(verified.status.transactionStatus, verified.status.fraudStatus)
			: ({ kind: "status", status: verified.status } as const);
		if (mapped.kind !== "status") {
			console.error("[billing] A Midtrans status needs a manual look; the payment was left as it is.", {
				paymentId: payment.id,
				orderId: payment.providerOrderId,
				status: provider?.transactionStatus,
			});
			await raiseBillingAlert(tx, { kind: "needs_review", paymentId: payment.id, now });
			return keep("error");
		}
		const transition = nextPaymentStatus(payment.status, mapped.status);
		if (transition.outcome === "stale") {
			// Midtrans has the money, but the bank reversed it here: someone should look. A refund made by hand (a bank
			// transfer for a virtual account) leaves Midtrans at settlement on purpose, so that is no alarm.
			if (mapped.status === "paid" && payment.status === "reversed")
				await raiseBillingAlert(tx, { kind: "paid_not_applied", paymentId: payment.id, now });
			return keep("stale");
		}

		const changes: Partial<typeof schema.billingPayment.$inferInsert> = { ...checked };
		if (provider)
			Object.assign(changes, {
				providerStatus: provider.transactionStatus,
				fraudStatus: provider.fraudStatus,
				paymentType: provider.paymentType ?? payment.paymentType,
				transactionId: provider.transactionId ?? payment.transactionId,
			});
		if (!verified.found) changes.failureReason = verified.reason;
		let fulfilled = false;
		if (transition.outcome === "applied") {
			changes.status = transition.status;
			if (transition.status === "paid" && !payment.paidAt) changes.paidAt = now;
			if (transition.status === "paid" && !payment.fulfilledAt && payment.userId) {
				await fulfil(tx, { ...payment, userId: payment.userId }, now);
				changes.fulfilledAt = now;
				fulfilled = true;
			}
			// Paid after its account was deleted: nobody to give the pass to, so the money should go back. Said once.
			if (transition.status === "paid" && !payment.userId)
				await raiseBillingAlert(tx, { kind: "paid_not_applied", paymentId: payment.id, now });
			if (transition.status === "reversed") {
				await revokePaymentBenefits(tx, payment, "payment.reversed", now);
				await raiseBillingAlert(tx, { kind: "payment_reversed", paymentId: payment.id, now });
				console.error("[billing] A paid payment was reversed; its pass and credits were taken back.", {
					paymentId: payment.id,
					orderId: payment.providerOrderId,
				});
			}
		}
		// A refund from the admin page, the Midtrans dashboard or a notification: the same bookkeeping, once per key.
		if (provider && (transition.status === "refunded" || transition.status === "partially_refunded")) {
			await recordProviderRefunds(tx, payment, provider.refunds, now);
			const settled = await settleRefunds(tx, payment, {
				now,
				providerTotal: parseGrossAmount(provider.refundAmount),
				fullyRefunded: transition.status === "refunded",
				providerListed: provider.refunds.length > 0,
			});
			changes.refundedAmount = settled.refundedAmount;
			// Midtrans knows only its own share: with a refund by hand as well, all of it may be back.
			if (settled.full) changes.status = "refunded";
			if (transition.outcome === "applied" || settled.refundedAmount !== payment.refundedAmount)
				await tx.insert(schema.billingAuditLog).values({
					targetUserId: payment.userId,
					action: "payment.refund_recorded",
					details: { paymentId: payment.id, refundedAmount: settled.refundedAmount, source: input.source },
				});
		}
		await tx.update(schema.billingPayment).set(changes).where(eq(schema.billingPayment.id, payment.id));
		await record(transition.outcome);
		return { status: changes.status ?? transition.status, outcome: transition.outcome, fulfilled };
	});
}
