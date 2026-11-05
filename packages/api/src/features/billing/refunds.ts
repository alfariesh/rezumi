import type { Transaction } from "./account";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { lockBillingAccount } from "./account";
import { raiseBillingAlertQuietly } from "./alerts";
import { applyPolarRefund, applyPolarSubscription, nextRefundSequence, refundKeyFor } from "./fulfillment";
import { isTransientPolarError, polarApi, polarErrorCode, polarErrorDetail, polarStatus } from "./polar/client";
import { getPolarConfig } from "./polar/config";

/**
 * Giving money back, from the admin page, through Polar's refund API. Polar refunds amounts **before tax** (it works
 * out the tax to give back itself), keeps its own fees, and a refund alone never ends a subscription: the admin
 * chooses to end it too. Refunds Polar makes on its own (from its dashboard, or to head off a dispute) arrive through
 * the refund webhooks and the same bookkeeping.
 */

type PaymentRow = typeof schema.billingPayment.$inferSelect;

/** Polar's reasons for a refund the admin can pick. */
export const REFUND_REASONS = [
	"customer_request",
	"duplicate",
	"service_disruption",
	"satisfaction_guarantee",
	"fraudulent",
	"other",
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

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
	if (payment.provider !== "polar" || !payment.providerOrderId)
		throw new ORPCError("BAD_REQUEST", { message: "Only Polar orders can be refunded here." });
	if (payment.status !== "paid" && payment.status !== "partially_refunded")
		throw new ORPCError("BAD_REQUEST", { message: "Only a paid payment can be refunded." });
	return payment as PaymentRow & { providerOrderId: string };
}

function assertAmount(payment: PaymentRow, amount: number) {
	const left = payment.amount - payment.refundedAmount;
	if (left <= 0) throw new ORPCError("BAD_REQUEST", { message: "This payment was already refunded in full." });
	if (amount > left)
		throw new ORPCError("BAD_REQUEST", {
			message: `At most ${left} (smallest ${payment.currency.toUpperCase()} units, before tax) is left to refund.`,
		});
}

export type RefundResult = {
	refundId: string;
	status: "requesting" | "succeeded" | "failed";
	amount: number;
	paymentStatus: PaymentRow["status"];
	refundedAmount: number;
	/** Whether the subscription the payment renewed was ended too. */
	subscriptionEnded: boolean;
};

async function resultOf(refundId: string, subscriptionEnded: boolean): Promise<RefundResult> {
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
	return { ...row, subscriptionEnded };
}

/** What a refusal from Polar means, for the admin. */
function refusalMessage(error: unknown) {
	const status = polarStatus(error);
	if (status === 422 || status === 400)
		return `Polar refused the refund: ${polarErrorDetail(error) ?? "the amount or order isn't refundable"}.`;
	if (status === 401 || status === 403)
		return "Polar didn't allow the refund: check that the access token has the refunds scope.";
	if (status === 404) return "Polar doesn't know this order.";
	return `Polar refused the refund (${polarErrorCode("refund.create", error)}).`;
}

/**
 * Refunds a paid order through Polar. The refund is saved (as `requesting`) before Polar is asked, with the payment
 * held so two clicks can't make two refunds, and its id goes to Polar in the refund's metadata so the webhook finds
 * it. A refund still waiting blocks a second one. With `endSubscription`, the subscription the order belongs to is
 * revoked at once (access ends now); otherwise it carries on.
 */
export async function requestRefund(input: {
	actorUserId: string;
	paymentId: string;
	/** Before tax, in the currency's smallest unit; the rest of the payment when left out. */
	amount?: number | undefined;
	reason: string;
	polarReason?: RefundReason | undefined;
	/** Also take the payment's credits back on a partial refund. A full refund always does. */
	revokeBenefits?: boolean | undefined;
	/** End the subscription now as well. */
	endSubscription?: boolean | undefined;
	now?: Date;
}): Promise<RefundResult> {
	const config = getPolarConfig();
	if (!config)
		throw new ORPCError("BILLING_UNAVAILABLE", { status: 403, message: "Polar isn't set up on this server." });
	const now = input.now ?? new Date();
	const claimed = await db.transaction(async (tx) => {
		const payment = await lockPayment(tx, input.paymentId);
		const amount = input.amount ?? payment.amount - payment.refundedAmount;
		const [open] = await tx
			.select({ id: schema.billingRefund.id })
			.from(schema.billingRefund)
			.where(and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.status, "requesting")));
		if (open)
			throw new ORPCError("CONFLICT", {
				message: "A refund for this payment is still being processed by Polar. Check the status first.",
			});
		assertAmount(payment, amount);
		const sequence = await nextRefundSequence(tx, payment.id);
		const [refund] = await tx
			.insert(schema.billingRefund)
			.values({
				paymentId: payment.id,
				sequence,
				refundKey: refundKeyFor(payment.id, sequence),
				method: "polar",
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
			details: { paymentId: payment.id, refundId: refund.id, amount, endSubscription: input.endSubscription ?? false },
		});
		return { payment, refund };
	});

	const { payment, refund } = claimed;
	const api = polarApi(config);
	try {
		const created = await api.refunds.create({
			order_id: payment.providerOrderId,
			reason: input.polarReason ?? "customer_request",
			amount: refund.amount,
			comment: input.reason.slice(0, 500),
			metadata: { rezumi_refund_id: refund.id },
		});
		await applyPolarRefund(created, { source: "admin", eventType: "refund.create", now });
	} catch (error) {
		if (isTransientPolarError(error)) {
			// No answer: the refund may have gone through. The refund job asks Polar until it knows.
			console.warn("[billing] A Polar refund got no answer; it is checked again.", {
				refundId: refund.id,
				error: polarErrorCode("refund.create", error),
			});
			throw new ORPCError("BAD_GATEWAY", {
				message: "Polar didn't answer. The refund is checked again automatically; don't send it twice.",
			});
		}
		await db
			.update(schema.billingRefund)
			.set({ status: "failed", failureReason: polarErrorCode("refund.create", error), settledAt: now })
			.where(and(eq(schema.billingRefund.id, refund.id), eq(schema.billingRefund.status, "requesting")));
		await raiseBillingAlertQuietly({ kind: "refund_failed", paymentId: payment.id, now });
		throw new ORPCError("BAD_REQUEST", { message: refusalMessage(error) });
	}

	let subscriptionEnded = false;
	if (input.endSubscription && payment.subscriptionId) {
		const [subscription] = await db
			.select({ providerId: schema.billingSubscription.providerSubscriptionId })
			.from(schema.billingSubscription)
			.where(eq(schema.billingSubscription.id, payment.subscriptionId));
		if (subscription) {
			try {
				const revoked = await api.subscriptions.revoke(subscription.providerId);
				await applyPolarSubscription(revoked, { source: "admin", eventType: "subscription.revoke", now });
				subscriptionEnded = true;
				await db.insert(schema.billingAuditLog).values({
					actorUserId: input.actorUserId,
					targetUserId: payment.userId,
					action: "subscription.revoked",
					reason: input.reason,
					details: { paymentId: payment.id, subscriptionId: payment.subscriptionId },
				});
			} catch (error) {
				console.warn("[billing] Ending a subscription after a refund failed.", {
					paymentId: payment.id,
					error: polarErrorCode("subscription.revoke", error),
				});
			}
		}
	}
	return resultOf(refund.id, subscriptionEnded);
}

/** A refund saved but not settled this long after it was asked: the job asks Polar about it. */
const REFUND_RECHECK_MS = 2 * 60 * 1000;
/** A refund Polar still doesn't list this long after it was asked never reached Polar. */
const REFUND_LOST_MS = 60 * 60 * 1000;

/**
 * The billing job's look at refunds still waiting: Rezumi's requests without a settled answer (a lost reply, a refund
 * Polar is still processing). Lists the order's refunds at Polar and applies them. Returns how many orders it checked.
 */
export async function reconcileRefunds(now = new Date()): Promise<number> {
	const config = getPolarConfig();
	if (!config) return 0;
	const api = polarApi(config);
	const waiting = await db
		.selectDistinct({ orderId: schema.billingPayment.providerOrderId })
		.from(schema.billingRefund)
		.innerJoin(schema.billingPayment, eq(schema.billingRefund.paymentId, schema.billingPayment.id))
		.where(
			and(
				eq(schema.billingRefund.status, "requesting"),
				eq(schema.billingRefund.method, "polar"),
				lt(schema.billingRefund.updatedAt, new Date(+now - REFUND_RECHECK_MS)),
				inArray(schema.billingPayment.status, ["paid", "partially_refunded", "refunded"]),
			),
		)
		.limit(10);
	let checked = 0;
	for (const { orderId } of waiting) {
		if (!orderId) continue;
		try {
			const refunds = await api.refunds.list({ order_id: orderId, limit: 20 });
			for (const refund of refunds.items)
				await applyPolarRefund(refund, { source: "status_check", eventType: "status_check", now });
			const known = new Set(refunds.items.map((refund) => refund.metadata.rezumi_refund_id).filter(Boolean));
			const stillWaiting = await db
				.select({
					id: schema.billingRefund.id,
					paymentId: schema.billingRefund.paymentId,
					createdAt: schema.billingRefund.createdAt,
				})
				.from(schema.billingRefund)
				.innerJoin(schema.billingPayment, eq(schema.billingRefund.paymentId, schema.billingPayment.id))
				.where(and(eq(schema.billingRefund.status, "requesting"), eq(schema.billingPayment.providerOrderId, orderId)));
			for (const refund of stillWaiting) {
				// Polar has no refund carrying this id a good while after it was asked: the request never reached it.
				const lost = !known.has(refund.id) && +now - +refund.createdAt > REFUND_LOST_MS;
				await db
					.update(schema.billingRefund)
					.set(lost ? { status: "failed", failureReason: "refund_not_found", settledAt: now } : { updatedAt: now })
					.where(and(eq(schema.billingRefund.id, refund.id), eq(schema.billingRefund.status, "requesting")));
				if (lost) await raiseBillingAlertQuietly({ kind: "refund_failed", paymentId: refund.paymentId, now });
			}
			checked++;
		} catch (error) {
			console.warn("[billing] Checking refunds with Polar failed; they are checked again later.", {
				error: polarErrorCode("refund.list", error),
			});
		}
	}
	return checked;
}
