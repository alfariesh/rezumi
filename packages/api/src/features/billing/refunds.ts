import type { Transaction } from "./account";
import type DodoPayments from "dodopayments";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { lockBillingAccount } from "./account";
import { raiseBillingAlertQuietly } from "./alerts";
import { cancelProviderSubscription } from "./deletion";
import { dodoApi, dodoErrorCode, dodoErrorDetail, dodoStatus, isTransientDodoError } from "./dodo/client";
import { getDodoConfig } from "./dodo/config";
import { applyDodoRefund, nextRefundSequence, refundKeyFor } from "./fulfillment";

/**
 * Giving money back, from the admin page, through Dodo Payments' refund API. Rezumi asks for amounts **before tax**
 * (Dodo gives the tax on them back itself) and keeps its own fees; a refund alone never ends a subscription: the admin
 * chooses to end it too. Refunds made in Dodo's dashboard arrive through the refund webhooks and the same bookkeeping.
 */

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
	if (payment.provider !== "dodo" || !payment.providerPaymentId)
		throw new ORPCError("BAD_REQUEST", { message: "Only Dodo Payments payments can be refunded here." });
	if (payment.status !== "paid" && payment.status !== "partially_refunded")
		throw new ORPCError("BAD_REQUEST", { message: "Only a paid payment can be refunded." });
	return payment as PaymentRow & { providerPaymentId: string };
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

/** What a refusal from Dodo means, for the admin. */
function refusalMessage(error: unknown) {
	const status = dodoStatus(error);
	if (status === 422 || status === 400 || status === 409)
		return `Dodo Payments refused the refund: ${dodoErrorDetail(error) ?? "the amount or payment isn't refundable"}.`;
	if (status === 401 || status === 403)
		return "Dodo Payments didn't allow the refund: check that the API key is from the right mode and still active.";
	if (status === 404) return "Dodo Payments doesn't know this payment.";
	return `Dodo Payments refused the refund (${dodoErrorCode("refund.create", error)}).`;
}

/**
 * What Dodo is asked to give back: the whole payment when nothing was refunded before and the whole rest is asked for
 * (Dodo then returns the tax too); otherwise the amount before tax on the payment's line, Dodo adding its tax.
 */
async function refundRequest(
	api: DodoPayments,
	payment: PaymentRow & { providerPaymentId: string },
	amount: number,
): Promise<Pick<DodoPayments.RefundCreateParams, "items" | "currency">> {
	if (payment.refundedAmount === 0 && amount >= payment.amount) return {};
	const lines = await api.payments.retrieveLineItems(payment.providerPaymentId);
	const line = lines.items[0];
	if (!line || !lines.partial_refund_allowed)
		throw new ORPCError("BAD_REQUEST", {
			message: "Dodo Payments doesn't allow a partial refund of this payment. Refund it in full instead.",
		});
	return {
		currency: payment.currency.toUpperCase() as DodoPayments.Currency,
		items: [{ item_id: line.items_id, amount, tax_inclusive: false }],
	};
}

/**
 * Refunds a paid payment through Dodo Payments. The refund is saved (as `requesting`) before Dodo is asked, with the
 * payment held so two clicks can't make two refunds, and its id goes to Dodo in the refund's metadata so the webhook
 * finds it. A refund still waiting blocks a second one. With `endSubscription`, the subscription the payment belongs
 * to is cancelled at once (access ends now); otherwise it carries on.
 */
export async function requestRefund(input: {
	actorUserId: string;
	paymentId: string;
	/** Before tax, in the currency's smallest unit; the rest of the payment when left out. */
	amount?: number | undefined;
	reason: string;
	/** Also take the payment's credits back on a partial refund. A full refund always does. */
	revokeBenefits?: boolean | undefined;
	/** End the subscription now as well. */
	endSubscription?: boolean | undefined;
	now?: Date;
}): Promise<RefundResult> {
	const config = getDodoConfig();
	if (!config)
		throw new ORPCError("BILLING_UNAVAILABLE", { status: 403, message: "Dodo Payments isn't set up on this server." });
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
				message: "A refund for this payment is still being processed by Dodo Payments. Check the status first.",
			});
		assertAmount(payment, amount);
		const sequence = await nextRefundSequence(tx, payment.id);
		const [refund] = await tx
			.insert(schema.billingRefund)
			.values({
				paymentId: payment.id,
				sequence,
				refundKey: refundKeyFor(payment.id, sequence),
				method: "dodo",
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
	const api = dodoApi(config);
	const fail = async (code: string) => {
		await db
			.update(schema.billingRefund)
			.set({ status: "failed", failureReason: code, settledAt: now })
			.where(and(eq(schema.billingRefund.id, refund.id), eq(schema.billingRefund.status, "requesting")));
		await raiseBillingAlertQuietly({ kind: "refund_failed", paymentId: payment.id, now });
	};
	try {
		const created = await api.refunds.create({
			payment_id: payment.providerPaymentId,
			...(await refundRequest(api, payment, refund.amount)),
			reason: input.reason.slice(0, 3000),
			metadata: { rezumi_refund_id: refund.id },
		});
		await applyDodoRefund(created, { source: "admin", eventType: "refund.create", now });
	} catch (error) {
		if (error instanceof ORPCError) {
			await fail("refund_not_partial");
			throw error;
		}
		if (isTransientDodoError(error)) {
			// No answer: the refund may have gone through. The refund job asks Dodo until it knows.
			console.warn("[billing] A Dodo Payments refund got no answer; it is checked again.", {
				refundId: refund.id,
				error: dodoErrorCode("refund.create", error),
			});
			throw new ORPCError("BAD_GATEWAY", {
				message: "Dodo Payments didn't answer. The refund is checked again automatically; don't send it twice.",
			});
		}
		await fail(dodoErrorCode("refund.create", error));
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
				await cancelProviderSubscription(config, subscription.providerId, now);
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
					error: dodoErrorCode("subscription.cancel", error),
				});
			}
		}
	}
	return resultOf(refund.id, subscriptionEnded);
}

/** A refund saved but not settled this long after it was asked: the job asks Dodo about it. */
const REFUND_RECHECK_MS = 2 * 60 * 1000;
/** A refund Dodo still doesn't list this long after it was asked never reached Dodo. */
const REFUND_LOST_MS = 60 * 60 * 1000;

/**
 * The billing job's look at refunds still waiting: Rezumi's requests without a settled answer (a lost reply, a refund
 * Dodo is still processing or reviewing). Reads the payment's refunds at Dodo and applies them. Returns how many
 * payments it checked.
 */
export async function reconcileRefunds(now = new Date()): Promise<number> {
	const config = getDodoConfig();
	if (!config) return 0;
	const api = dodoApi(config);
	const waiting = await db
		.selectDistinct({ providerPaymentId: schema.billingPayment.providerPaymentId })
		.from(schema.billingRefund)
		.innerJoin(schema.billingPayment, eq(schema.billingRefund.paymentId, schema.billingPayment.id))
		.where(
			and(
				eq(schema.billingRefund.status, "requesting"),
				eq(schema.billingRefund.method, "dodo"),
				lt(schema.billingRefund.updatedAt, new Date(+now - REFUND_RECHECK_MS)),
				inArray(schema.billingPayment.status, ["paid", "partially_refunded", "refunded"]),
			),
		)
		.limit(10);
	let checked = 0;
	for (const { providerPaymentId } of waiting) {
		if (!providerPaymentId) continue;
		try {
			const payment = await api.payments.retrieve(providerPaymentId);
			const known = new Set<string>();
			for (const listed of payment.refunds) {
				const refund = await api.refunds.retrieve(listed.refund_id);
				const local = refund.metadata?.rezumi_refund_id;
				if (typeof local === "string") known.add(local);
				await applyDodoRefund(refund, { source: "status_check", eventType: "status_check", now });
			}
			const stillWaiting = await db
				.select({
					id: schema.billingRefund.id,
					paymentId: schema.billingRefund.paymentId,
					createdAt: schema.billingRefund.createdAt,
				})
				.from(schema.billingRefund)
				.innerJoin(schema.billingPayment, eq(schema.billingRefund.paymentId, schema.billingPayment.id))
				.where(
					and(
						eq(schema.billingRefund.status, "requesting"),
						eq(schema.billingPayment.providerPaymentId, providerPaymentId),
					),
				);
			for (const refund of stillWaiting) {
				// Dodo has no refund carrying this id a good while after it was asked: the request never reached it.
				const lost = !known.has(refund.id) && +now - +refund.createdAt > REFUND_LOST_MS;
				await db
					.update(schema.billingRefund)
					.set(lost ? { status: "failed", failureReason: "refund_not_found", settledAt: now } : { updatedAt: now })
					.where(and(eq(schema.billingRefund.id, refund.id), eq(schema.billingRefund.status, "requesting")));
				if (lost) await raiseBillingAlertQuietly({ kind: "refund_failed", paymentId: refund.paymentId, now });
			}
			checked++;
		} catch (error) {
			console.warn("[billing] Checking refunds with Dodo Payments failed; they are checked again later.", {
				error: dodoErrorCode("refund.get", error),
			});
		}
	}
	return checked;
}
