import type { AppliedChange, EventContext } from "../fulfillment";
import type { SumopodPayment } from "./client";
import type { BillingPaymentEventOutcome } from "@rezumi/db/schema";
import { and, eq } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { lockBillingAccount } from "../account";
import { raiseBillingAlert } from "../alerts";
import { claimEvent, finishEvent, ignored, recordUnrelated } from "../fulfillment";
import { fulfilPass } from "../passes";
import { nextPaymentStatus, parseDate } from "../subscription-access";
import { paymentIdFromOrder, paymentStatusOf, safePaymentFields, toWholeRupiah } from "./mapping";

/**
 * Applies what Sumopod says about a QRIS payment, from a signed webhook or a status check: the one door for passes.
 * Runs in one transaction holding the account's billing lock and the payment row, records the event, and is safe to
 * repeat: a redelivered webhook (same `svix-id`) does nothing, and statuses only move the allowed way (paid never goes
 * back). The first paid state grants the pass (and a Pro AI pass's first month of credits) exactly once, and queues the
 * receipt email. A payment that paid less than its price grants nothing and alerts the owner. Makes no Sumopod calls.
 */
export async function applySumopodPayment(payment: SumopodPayment, context: EventContext): Promise<AppliedChange> {
	const now = context.now ?? new Date();
	const payload = safePaymentFields(payment);
	const ownId = paymentIdFromOrder(payment.order_id);
	const [known] = await db
		.select({ id: schema.billingPayment.id, userId: schema.billingPayment.userId })
		.from(schema.billingPayment)
		.where(
			and(
				eq(schema.billingPayment.provider, "sumopod"),
				ownId ? eq(schema.billingPayment.id, ownId) : eq(schema.billingPayment.providerCheckoutId, payment.payment_id),
			),
		);
	if (!known) {
		await recordUnrelated(context, payment.payment_id, "ignored", payload);
		return ignored();
	}
	const incoming = paymentStatusOf(payment.status);

	return db.transaction(async (tx) => {
		if (known.userId) await lockBillingAccount(tx, known.userId);
		const claim = await claimEvent(tx, context, payment.payment_id);
		if (!claim) return ignored("duplicate");
		const [row] = await tx
			.select()
			.from(schema.billingPayment)
			.where(eq(schema.billingPayment.id, known.id))
			.for("update");
		if (!row) throw new Error("No payment has that ID.");
		const finish = async (outcome: BillingPaymentEventOutcome) => {
			await finishEvent(tx, claim, context, {
				providerObjectId: payment.payment_id,
				outcome,
				paymentId: row.id,
				payload,
			});
			return { outcome, paymentId: row.id, status: row.status, fulfilled: false };
		};
		// Another payment link than the one Rezumi opened for this order: not this payment's news.
		if (row.providerCheckoutId && row.providerCheckoutId !== payment.payment_id) return finish("ignored");
		if (!incoming) return finish("ignored");

		const transition = nextPaymentStatus(row.status, incoming);
		const changes: Partial<typeof schema.billingPayment.$inferInsert> = {
			providerStatus: payment.status.slice(0, 40),
			...(!row.providerCheckoutId && { providerCheckoutId: payment.payment_id }),
		};
		if (incoming === "paid" && transition.outcome === "applied" && payment.amount < toWholeRupiah(row.amount)) {
			// Less than the price came in (it never should: Rezumi sets the amount). Nothing is granted; a person looks.
			await tx
				.update(schema.billingPayment)
				.set({ ...changes, failureReason: "amount_mismatch" })
				.where(eq(schema.billingPayment.id, row.id));
			await raiseBillingAlert(tx, { kind: "needs_review", paymentId: row.id, now });
			return finish("error");
		}
		let fulfilled = false;
		if (transition.outcome === "applied") {
			changes.status = transition.status;
			if (transition.status === "paid") {
				changes.providerPaymentId = payment.payment_id;
				changes.paidAt = row.paidAt ?? parseDate(payment.paid_at) ?? now;
				changes.failureReason = null;
			} else if (transition.status === "failed" || transition.status === "expired" || transition.status === "cancelled")
				changes.failureReason = `payment_${transition.status}`;
		}
		if (changes.status === "paid" && !row.fulfilledAt) {
			if (row.userId) {
				const granted = await fulfilPass(tx, { ...row, userId: row.userId }, now);
				changes.fulfilledAt = now;
				changes.credits = granted.credits;
				changes.billingReason = granted.reason;
				changes.periodStart = granted.period.startsAt;
				changes.periodEnd = granted.period.endsAt;
				fulfilled = true;
				await tx.insert(schema.billingAuditLog).values({
					targetUserId: row.userId,
					action: "payment.fulfilled",
					details: {
						paymentId: row.id,
						providerPaymentId: payment.payment_id,
						planId: row.planId,
						interval: row.interval,
						days: row.durationDays,
						billingReason: granted.reason,
						amount: row.amount,
						currency: row.currency,
						credits: granted.credits,
						periodId: granted.period.id,
						startsAt: granted.period.startsAt.toISOString(),
						endsAt: granted.period.endsAt.toISOString(),
					},
				});
				// Rezumi sells the pass itself, so it sends the receipt (the billing job emails it).
				await tx
					.insert(schema.billingNotification)
					.values({
						key: `receipt:${row.id}`,
						kind: "payment_receipt",
						userId: row.userId,
						details: { paymentId: row.id },
						createdAt: now,
					})
					.onConflictDoNothing();
			} else {
				// Paid for an account that is gone: nobody to give it to, so the money should go back. Said once.
				await raiseBillingAlert(tx, { kind: "paid_not_applied", paymentId: row.id, now });
			}
		}
		await tx.update(schema.billingPayment).set(changes).where(eq(schema.billingPayment.id, row.id));
		const outcome = fulfilled ? "applied" : transition.outcome;
		await finishEvent(tx, claim, context, {
			providerObjectId: payment.payment_id,
			outcome,
			paymentId: row.id,
			payload,
		});
		return { outcome, paymentId: row.id, status: changes.status ?? row.status, fulfilled };
	});
}
