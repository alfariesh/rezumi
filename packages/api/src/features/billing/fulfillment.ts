import type { Transaction } from "./account";
import type { PolarOrderLike, PolarSubscriptionLike } from "./polar/mapping";
import type { SubscriptionRow } from "./subscriptions";
import type {
	BillingPaymentEventOutcome,
	BillingPaymentEventSource,
	BillingPaymentStatus,
	BillingRefundStatus,
	BillingReason,
} from "@rezumi/db/schema";
import { and, eq, isNull, max, or } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { BILLING_CATALOG_VERSION, PLANS } from "@rezumi/schema/billing";
import { lockBillingAccount } from "./account";
import { raiseBillingAlert } from "./alerts";
import { grantSubscriptionMonth } from "./credits";
import { getPolarConfig, planForProduct } from "./polar/config";
import {
	checkoutPaymentStatus,
	creditMonth,
	nextPaymentStatus,
	orderPaymentStatus,
	orderPeriod,
	parseDate,
	safeObjectFields,
} from "./polar/mapping";
import { upsertSubscription } from "./subscriptions";

/**
 * The one door every change Polar reports goes through: orders (paid, refunded), subscriptions (renewed, changed,
 * canceled), checkout sessions (expired) and refunds. Each runs in one transaction holding the account's billing lock
 * and the rows it changes, records the event, and is safe to repeat: a webhook redelivered (same `webhook-id`) does
 * nothing, and a state older than the one kept is skipped. Access and credits are granted exactly once per order.
 * Never call these from inside another transaction; they open their own.
 */

type PaymentRow = typeof schema.billingPayment.$inferSelect;

/** Where a Polar object came from: a signed webhook, the billing job or a customer's page asking, or an admin. */
export type EventContext = {
	source: BillingPaymentEventSource;
	/** The webhook's event type (order.paid), or what asked (status_check). */
	eventType: string;
	/** Polar's `webhook-id`, unique per event; redeliveries carry the same one. */
	webhookId?: string | null | undefined;
	now?: Date | undefined;
};

export type AppliedChange = {
	outcome: BillingPaymentEventOutcome;
	paymentId: string | null;
	status: BillingPaymentStatus | null;
	/** Whether this call granted the order's access and credits. */
	fulfilled: boolean;
};

const ignored = (outcome: BillingPaymentEventOutcome = "ignored"): AppliedChange => ({
	outcome,
	paymentId: null,
	status: null,
	fulfilled: false,
});

/** Reports an event that is about something Rezumi doesn't sell or know, outside any account's lock. */
async function recordUnrelated(
	context: EventContext,
	providerObjectId: string,
	outcome: BillingPaymentEventOutcome,
	payload: Record<string, unknown>,
) {
	// Status checks only ever ask about Rezumi's own payments; keep the table for news.
	if (context.source !== "webhook") return;
	await db
		.insert(schema.billingPaymentEvent)
		.values({
			webhookId: context.webhookId ?? null,
			eventType: context.eventType,
			providerObjectId,
			source: context.source,
			outcome,
			payload,
			receivedAt: context.now ?? new Date(),
		})
		.onConflictDoNothing({ target: schema.billingPaymentEvent.webhookId });
}

/**
 * Takes the webhook's id inside the transaction: the event row goes in first, so a redelivery racing this one waits on
 * the unique index and then finds it taken. Null when this event was handled before. Status checks have no id.
 */
async function claimEvent(tx: Transaction, context: EventContext, providerObjectId: string) {
	if (!context.webhookId) return { id: null as string | null };
	const [claimed] = await tx
		.insert(schema.billingPaymentEvent)
		.values({
			webhookId: context.webhookId,
			eventType: context.eventType,
			providerObjectId,
			source: context.source,
			outcome: "applied",
			receivedAt: context.now ?? new Date(),
		})
		.onConflictDoNothing({ target: schema.billingPaymentEvent.webhookId })
		.returning({ id: schema.billingPaymentEvent.id });
	return claimed ? { id: claimed.id } : null;
}

/** Writes what the event did: onto the claimed row for a webhook, or a new row for a check that changed something. */
async function finishEvent(
	tx: Transaction,
	claim: { id: string | null },
	context: EventContext,
	fields: {
		providerObjectId: string;
		outcome: BillingPaymentEventOutcome;
		paymentId?: string | null;
		subscriptionId?: string | null;
		payload: Record<string, unknown>;
	},
) {
	const values = {
		outcome: fields.outcome,
		paymentId: fields.paymentId ?? null,
		subscriptionId: fields.subscriptionId ?? null,
		payload: fields.payload,
	};
	if (claim.id) {
		await tx.update(schema.billingPaymentEvent).set(values).where(eq(schema.billingPaymentEvent.id, claim.id));
		return;
	}
	if (fields.outcome === "duplicate" || fields.outcome === "stale") return;
	await tx.insert(schema.billingPaymentEvent).values({
		...values,
		eventType: context.eventType,
		providerObjectId: fields.providerObjectId,
		source: context.source,
		receivedAt: context.now ?? new Date(),
	});
}

/** The account a Polar customer stands for: its external id is the user id Rezumi gave at checkout. */
async function accountFor(externalId: string | null | undefined): Promise<string | null> {
	if (!externalId) return null;
	const [owner] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, externalId));
	return owner?.id ?? null;
}

/** Takes back the Rezumi AI credits a payment granted (a full refund, or a partial one the admin asked to). */
async function revokePaymentCredits(tx: Transaction, payment: Pick<PaymentRow, "id" | "userId">, reason: string) {
	const now = new Date();
	const grants = await tx
		.update(schema.aiCreditGrant)
		.set({ revokedAt: now })
		.where(and(eq(schema.aiCreditGrant.paymentId, payment.id), isNull(schema.aiCreditGrant.revokedAt)))
		.returning({ remaining: schema.aiCreditGrant.remaining });
	if (!grants.length) return 0;
	const credits = grants.reduce((sum, grant) => sum + grant.remaining, 0);
	await tx.insert(schema.billingAuditLog).values({
		targetUserId: payment.userId,
		action: "payment.benefits_revoked",
		reason,
		details: { paymentId: payment.id, credits },
	});
	return credits;
}

/** The payment's next refund sequence number. Call it holding the payment row. */
export async function nextRefundSequence(tx: Transaction, paymentId: string) {
	const [last] = await tx
		.select({ sequence: max(schema.billingRefund.sequence) })
		.from(schema.billingRefund)
		.where(eq(schema.billingRefund.paymentId, paymentId));
	return (last?.sequence ?? 0) + 1;
}

/** Rezumi's own key for a refund before Polar gives it an id: RF-<payment id>-<sequence>. */
export const refundKeyFor = (paymentId: string, sequence: number) => `RF-${paymentId}-${sequence}`;

/**
 * The month of credits a paid Pro AI order brings: the month of its subscription period that is running now (the
 * whole period for a monthly subscription). Granted once per subscription per month, so a plan change's order doesn't
 * add another. Returns the credits granted.
 */
async function grantOrderCredits(
	tx: Transaction,
	input: { userId: string; payment: PaymentRow; subscription: SubscriptionRow | null; now: Date },
) {
	const { subscription } = input;
	const perMonth = PLANS[input.payment.planId].creditsPerMonth;
	if (!perMonth || !subscription || subscription.planId !== input.payment.planId || !subscription.currentPeriodEnd)
		return 0;
	const month = creditMonth(
		{ start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd },
		subscription.interval,
		input.now < subscription.currentPeriodStart ? subscription.currentPeriodStart : input.now,
	);
	if (!month) return 0;
	const grant = await grantSubscriptionMonth(tx, {
		userId: input.userId,
		subscriptionId: subscription.id,
		paymentId: input.payment.id,
		amount: perMonth,
		expiresAt: month.end,
		now: input.now,
	});
	return grant?.amount ?? 0;
}

/** A Polar order, with the customer and subscription it carries, as the webhook and the order API give it. */
export type PolarOrderInput = PolarOrderLike & {
	customer: { external_id?: string | null };
	subscription: PolarSubscriptionLike | null;
};

/**
 * Applies a Polar order: links it to the checkout Rezumi opened (or records a renewal or plan change as a new payment),
 * keeps its amounts, moves its status along the allowed transitions, and on the first paid state grants its month of
 * Pro AI credits and moves the subscription's paid_through. A full refund takes the order's credits back; access
 * follows the subscription, which a refund alone doesn't end.
 */
export async function applyPolarOrder(order: PolarOrderInput, context: EventContext): Promise<AppliedChange> {
	const config = getPolarConfig();
	if (!config) throw new Error("Polar isn't set up on this server.");
	const now = context.now ?? new Date();
	const plan = planForProduct(config, order.product_id);
	const payload = safeObjectFields(order as unknown as Record<string, unknown>);
	if (!plan) {
		await recordUnrelated(context, order.id, "unknown_product", payload);
		return ignored("unknown_product");
	}
	let userId = await accountFor(order.customer.external_id);
	if (!userId && order.checkout_id) {
		const [opened] = await db
			.select({ userId: schema.billingPayment.userId })
			.from(schema.billingPayment)
			.where(eq(schema.billingPayment.providerCheckoutId, order.checkout_id));
		userId = opened?.userId ?? null;
	}
	const externalCustomerId = order.customer.external_id ?? userId;

	return db.transaction(async (tx) => {
		if (userId) await lockBillingAccount(tx, userId);
		const claim = await claimEvent(tx, context, order.id);
		if (!claim) return ignored("duplicate");

		const incoming = orderPaymentStatus(order.status);
		const paid = incoming === "paid" || incoming === "partially_refunded";
		const period = orderPeriod(order);
		let subscription: SubscriptionRow | null = null;
		if (order.subscription && externalCustomerId) {
			const subscriptionPlan = planForProduct(config, order.subscription.product_id) ?? plan;
			subscription = (
				await upsertSubscription(tx, {
					subscription: order.subscription,
					plan: subscriptionPlan,
					userId,
					externalCustomerId,
					paidThrough: paid ? (period.end ?? parseDate(order.subscription.current_period_end)) : null,
				})
			).row;
		}

		let [payment] = await tx
			.select()
			.from(schema.billingPayment)
			.where(eq(schema.billingPayment.providerOrderId, order.id))
			.for("update");
		if (!payment && order.checkout_id)
			[payment] = await tx
				.select()
				.from(schema.billingPayment)
				.where(
					and(
						eq(schema.billingPayment.providerCheckoutId, order.checkout_id),
						isNull(schema.billingPayment.providerOrderId),
					),
				)
				.for("update");
		if (!payment) {
			[payment] = await tx
				.insert(schema.billingPayment)
				.values({
					userId,
					provider: "polar",
					providerOrderId: order.id,
					providerCheckoutId: order.checkout_id,
					subscriptionId: subscription?.id ?? null,
					planId: plan.planId,
					interval: plan.interval,
					catalogVersion: BILLING_CATALOG_VERSION,
					billingReason: order.billing_reason as BillingReason,
					amount: order.net_amount,
					taxAmount: order.tax_amount,
					totalAmount: order.total_amount,
					currency: order.currency.toLowerCase(),
					status: "pending",
					createdAt: parseDate(order.created_at) ?? now,
				})
				.returning();
			if (!payment) throw new Error("The payment was not saved.");
		}

		const transition = nextPaymentStatus(payment.status, incoming);
		const refundedAmount = Math.min(order.net_amount, Math.max(payment.refundedAmount, order.refunded_amount));
		const changes: Partial<typeof schema.billingPayment.$inferInsert> = {
			providerOrderId: order.id,
			subscriptionId: subscription?.id ?? payment.subscriptionId,
			billingReason: order.billing_reason as BillingReason,
			amount: order.net_amount,
			taxAmount: order.tax_amount,
			totalAmount: order.total_amount,
			currency: order.currency.toLowerCase(),
			providerStatus: order.status,
			periodStart: period.start ?? payment.periodStart,
			periodEnd: period.end ?? payment.periodEnd,
			refundedAmount,
			planId: plan.planId,
			interval: plan.interval,
		};
		let fulfilled = false;
		if (transition.outcome === "applied") changes.status = transition.status;
		const nextStatus = changes.status ?? payment.status;
		if (paid && !payment.paidAt) changes.paidAt = now;
		let refundChanged = false;
		if (paid && transition.outcome !== "stale" && !payment.fulfilledAt) {
			if (userId) {
				const credits = await grantOrderCredits(tx, { userId, payment, subscription, now });
				changes.credits = credits;
				changes.fulfilledAt = now;
				fulfilled = true;
				await tx.insert(schema.billingAuditLog).values({
					targetUserId: userId,
					action: "payment.fulfilled",
					details: {
						paymentId: payment.id,
						orderId: order.id,
						planId: plan.planId,
						interval: plan.interval,
						billingReason: order.billing_reason,
						amount: order.net_amount,
						currency: order.currency.toLowerCase(),
						credits,
						...(subscription && { subscriptionId: subscription.id, paidThrough: subscription.paidThrough }),
					},
				});
			} else if (transition.outcome === "applied") {
				// Paid for an account that is gone: nobody to give it to, so the money should go back. Said once.
				await raiseBillingAlert(tx, { kind: "paid_not_applied", paymentId: payment.id, now });
			}
		}
		if (refundedAmount > payment.refundedAmount) {
			refundChanged = true;
			const full = nextStatus === "refunded" || refundedAmount >= order.net_amount;
			const revokeAsked = await tx
				.select({ id: schema.billingRefund.id })
				.from(schema.billingRefund)
				.where(and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.revokeBenefits, true)))
				.limit(1);
			if (full || revokeAsked.length)
				await revokePaymentCredits(tx, payment, full ? "payment.refunded" : "payment.partially_refunded");
			await tx.insert(schema.billingAuditLog).values({
				targetUserId: payment.userId,
				action: "payment.refund_recorded",
				details: { paymentId: payment.id, refundedAmount, source: context.source },
			});
		}
		await tx.update(schema.billingPayment).set(changes).where(eq(schema.billingPayment.id, payment.id));
		const outcome = fulfilled || refundChanged ? "applied" : transition.outcome;
		await finishEvent(tx, claim, context, {
			providerObjectId: order.id,
			outcome,
			paymentId: payment.id,
			subscriptionId: subscription?.id ?? null,
			payload,
		});
		return { outcome, paymentId: payment.id, status: nextStatus, fulfilled };
	});
}

/** A Polar subscription with its customer, as subscription webhooks and the subscription API give it. */
export type PolarSubscriptionInput = PolarSubscriptionLike & { customer: { external_id?: string | null } };

/**
 * Applies a Polar subscription's state: created, renewed, changed plan, set to cancel, canceled, past due. Access is
 * read from it (entitlements); credits and paid_through come with its orders. An older state than the one kept is
 * skipped.
 */
export async function applyPolarSubscription(
	subscription: PolarSubscriptionInput,
	context: EventContext,
): Promise<AppliedChange & { subscriptionId: string | null }> {
	const config = getPolarConfig();
	if (!config) throw new Error("Polar isn't set up on this server.");
	const plan = planForProduct(config, subscription.product_id);
	const payload = safeObjectFields(subscription as unknown as Record<string, unknown>);
	if (!plan) {
		await recordUnrelated(context, subscription.id, "unknown_product", payload);
		return { ...ignored("unknown_product"), subscriptionId: null };
	}
	const externalCustomerId = subscription.customer.external_id ?? null;
	const userId = await accountFor(externalCustomerId);
	if (!externalCustomerId) {
		await recordUnrelated(context, subscription.id, "unknown_customer", payload);
		return { ...ignored("unknown_customer"), subscriptionId: null };
	}
	return db.transaction(async (tx) => {
		if (userId) await lockBillingAccount(tx, userId);
		const claim = await claimEvent(tx, context, subscription.id);
		if (!claim) return { ...ignored("duplicate"), subscriptionId: null };
		const before = (
			await tx
				.select({ status: schema.billingSubscription.status, planId: schema.billingSubscription.planId })
				.from(schema.billingSubscription)
				.where(eq(schema.billingSubscription.providerSubscriptionId, subscription.id))
		)[0];
		const { row, outcome } = await upsertSubscription(tx, { subscription, plan, userId, externalCustomerId });
		if (outcome === "applied" && (before?.status !== row.status || before?.planId !== row.planId))
			await tx.insert(schema.billingAuditLog).values({
				targetUserId: userId,
				action: "subscription.changed",
				details: {
					subscriptionId: row.id,
					from: before ? { status: before.status, planId: before.planId } : null,
					to: { status: row.status, planId: row.planId, interval: row.interval },
					cancelAtPeriodEnd: row.cancelAtPeriodEnd,
					source: context.source,
				},
			});
		await finishEvent(tx, claim, context, {
			providerObjectId: subscription.id,
			outcome,
			subscriptionId: row.id,
			payload,
		});
		return { outcome, paymentId: null, status: null, fulfilled: false, subscriptionId: row.id };
	});
}

/** A Polar checkout session, as checkout webhooks and the checkout API give it. */
export type PolarCheckoutInput = {
	id: string;
	status: "open" | "expired" | "confirmed" | "succeeded" | "failed";
	expires_at: string;
	created_at: string;
	modified_at: string | null;
};

/**
 * Applies a checkout session's state to the payment Rezumi opened for it: an expired or failed checkout ends a payment
 * still waiting; a succeeded one waits for its order. Checkouts Rezumi didn't open (checkout links, the dashboard)
 * are left alone.
 */
export async function applyPolarCheckout(checkout: PolarCheckoutInput, context: EventContext): Promise<AppliedChange> {
	const [opened] = await db
		.select({ id: schema.billingPayment.id, userId: schema.billingPayment.userId })
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.providerCheckoutId, checkout.id));
	const payload = safeObjectFields(checkout as unknown as Record<string, unknown>);
	if (!opened) {
		await recordUnrelated(context, checkout.id, "ignored", payload);
		return ignored();
	}
	return db.transaction(async (tx) => {
		if (opened.userId) await lockBillingAccount(tx, opened.userId);
		const claim = await claimEvent(tx, context, checkout.id);
		if (!claim) return ignored("duplicate");
		const [payment] = await tx
			.select()
			.from(schema.billingPayment)
			.where(eq(schema.billingPayment.id, opened.id))
			.for("update");
		if (!payment) throw new Error("No payment has that ID.");
		const waiting = payment.status === "creating" || payment.status === "pending";
		const target = checkoutPaymentStatus(checkout.status);
		const transition = waiting && !payment.providerOrderId ? nextPaymentStatus(payment.status, target) : null;
		const changes: Partial<typeof schema.billingPayment.$inferInsert> = {
			providerStatus: payment.providerOrderId ? payment.providerStatus : `checkout_${checkout.status}`,
			expiresAt: parseDate(checkout.expires_at) ?? payment.expiresAt,
		};
		if (transition?.outcome === "applied") {
			changes.status = transition.status;
			if (transition.status !== "pending") changes.failureReason = `checkout_${checkout.status}`;
		}
		await tx.update(schema.billingPayment).set(changes).where(eq(schema.billingPayment.id, payment.id));
		const outcome = transition?.outcome ?? "stale";
		await finishEvent(tx, claim, context, { providerObjectId: checkout.id, outcome, paymentId: payment.id, payload });
		return { outcome, paymentId: payment.id, status: changes.status ?? payment.status, fulfilled: false };
	});
}

/** A Polar refund, as refund webhooks and the refund API give it. */
export type PolarRefundInput = {
	id: string;
	status: "pending" | "succeeded" | "failed" | "canceled";
	reason: string;
	amount: number;
	order_id: string;
	metadata: Record<string, string | number | boolean>;
	dispute?: unknown;
	created_at: string;
	modified_at: string | null;
};

const refundStatus = (status: PolarRefundInput["status"]): BillingRefundStatus =>
	status === "succeeded" ? "succeeded" : status === "pending" ? "requesting" : "failed";

/**
 * Applies a Polar refund to its payment: Rezumi's own request (found by the id it put in the refund's metadata) takes
 * Polar's id and status; one made in Polar's dashboard, or by Polar to head off a dispute, is added. The payment's
 * refunded amount never goes down, and a full refund takes its credits back. Null when the refund's order isn't one
 * of Rezumi's payments yet (the caller applies the order first).
 */
export async function applyPolarRefund(refund: PolarRefundInput, context: EventContext): Promise<AppliedChange | null> {
	const now = context.now ?? new Date();
	const [known] = await db
		.select({ id: schema.billingPayment.id, userId: schema.billingPayment.userId })
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.providerOrderId, refund.order_id));
	if (!known) return null;
	const payload = safeObjectFields(refund as unknown as Record<string, unknown>);
	return db.transaction(async (tx) => {
		if (known.userId) await lockBillingAccount(tx, known.userId);
		const claim = await claimEvent(tx, context, refund.id);
		if (!claim) return ignored("duplicate");
		const [payment] = await tx
			.select()
			.from(schema.billingPayment)
			.where(eq(schema.billingPayment.id, known.id))
			.for("update");
		if (!payment) throw new Error("No payment has that ID.");
		const status = refundStatus(refund.status);
		const localId = typeof refund.metadata.rezumi_refund_id === "string" ? refund.metadata.rezumi_refund_id : null;
		const [existing] = await tx
			.select()
			.from(schema.billingRefund)
			.where(
				localId
					? or(
							and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.id, localId)),
							eq(schema.billingRefund.refundKey, refund.id),
						)
					: eq(schema.billingRefund.refundKey, refund.id),
			)
			.for("update");
		const settledAt = status === "requesting" ? null : now;
		let outcome: BillingPaymentEventOutcome = "applied";
		if (existing) {
			// A settled refund doesn't go back to waiting.
			if (existing.status !== "requesting" && status === "requesting") outcome = "stale";
			else if (existing.status === status && existing.refundKey === refund.id) outcome = "duplicate";
			else
				await tx
					.update(schema.billingRefund)
					.set({
						refundKey: refund.id,
						status,
						settledAt,
						failureReason: status === "failed" ? `refund_${refund.status}` : null,
					})
					.where(eq(schema.billingRefund.id, existing.id));
		} else {
			await tx.insert(schema.billingRefund).values({
				paymentId: payment.id,
				sequence: await nextRefundSequence(tx, payment.id),
				refundKey: refund.id,
				method: "polar",
				status,
				amount: refund.amount,
				reason:
					refund.reason === "dispute_prevention"
						? "Refunded by Polar to prevent a dispute"
						: `Refunded at Polar (${refund.reason})`,
				failureReason: status === "failed" ? `refund_${refund.status}` : null,
				settledAt,
			});
		}
		if (refund.reason === "dispute_prevention" || refund.dispute)
			await raiseBillingAlert(tx, { kind: "payment_reversed", paymentId: payment.id, now });

		const succeeded = await tx
			.select({ amount: schema.billingRefund.amount, revokeBenefits: schema.billingRefund.revokeBenefits })
			.from(schema.billingRefund)
			.where(and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.status, "succeeded")));
		const total = succeeded.reduce((sum, row) => sum + row.amount, 0);
		const refundedAmount = Math.min(payment.amount, Math.max(payment.refundedAmount, total));
		const changes: Partial<typeof schema.billingPayment.$inferInsert> = { refundedAmount };
		if (refundedAmount > payment.refundedAmount) {
			const full = refundedAmount >= payment.amount;
			const target = full ? "refunded" : "partially_refunded";
			const transition = nextPaymentStatus(payment.status, target);
			if (transition.outcome === "applied") changes.status = transition.status;
			if (full || succeeded.some((row) => row.revokeBenefits))
				await revokePaymentCredits(tx, payment, full ? "payment.refunded" : "payment.partially_refunded");
			await tx.insert(schema.billingAuditLog).values({
				targetUserId: payment.userId,
				action: "payment.refund_recorded",
				details: { paymentId: payment.id, refundId: refund.id, refundedAmount, source: context.source },
			});
		}
		await tx.update(schema.billingPayment).set(changes).where(eq(schema.billingPayment.id, payment.id));
		await finishEvent(tx, claim, context, { providerObjectId: refund.id, outcome, paymentId: payment.id, payload });
		return { outcome, paymentId: payment.id, status: changes.status ?? payment.status, fulfilled: false };
	});
}
