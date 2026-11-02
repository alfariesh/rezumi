import type { Transaction } from "./account";
import type { MidtransTransactionStatus } from "./midtrans/client";
import type { BillingPaymentEventOutcome, BillingPaymentEventSource, BillingPaymentStatus } from "@rezumi/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { lockBillingAccount } from "./account";
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
			return keep("error");
		}
		const transition = nextPaymentStatus(payment.status, mapped.status);
		if (transition.outcome === "stale") return keep("stale");

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
			if (transition.status === "refunded" || transition.status === "reversed") {
				if (transition.status === "refunded") changes.refundedAmount = payment.amount;
				await revokePaymentBenefits(tx, payment, `payment.${transition.status}`, now);
				if (transition.status === "reversed")
					console.error("[billing] A paid payment was reversed; its pass and credits were taken back.", {
						paymentId: payment.id,
						orderId: payment.providerOrderId,
					});
			}
		}
		if (transition.status === "partially_refunded") {
			const refunded = parseGrossAmount(provider?.refundAmount);
			if (refunded !== null && refunded <= payment.amount) changes.refundedAmount = refunded;
			if (transition.outcome === "applied" || changes.refundedAmount !== payment.refundedAmount)
				await tx.insert(schema.billingAuditLog).values({
					targetUserId: payment.userId,
					action: "payment.refund_recorded",
					details: { paymentId: payment.id, refundedAmount: changes.refundedAmount ?? payment.refundedAmount },
				});
		}
		await tx.update(schema.billingPayment).set(changes).where(eq(schema.billingPayment.id, payment.id));
		await record(transition.outcome);
		return { status: transition.status, outcome: transition.outcome, fulfilled };
	});
}
