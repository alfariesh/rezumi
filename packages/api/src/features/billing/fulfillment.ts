import type { Transaction } from "./account";
import type {
	DodoCheckoutLike,
	DodoDisputeLike,
	DodoPaymentLike,
	DodoRefundLike,
	DodoSubscriptionLike,
} from "./dodo/mapping";
import type { SubscriptionRow } from "./subscriptions";
import type {
	BillingPaymentEventOutcome,
	BillingPaymentEventSource,
	BillingPaymentStatus,
	BillingRefundStatus,
} from "@rezumi/db/schema";
import type { BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import { and, eq, isNull, max, or } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { BILLING_CATALOG_VERSION, PLANS } from "@rezumi/schema/billing";
import { lockBillingAccount } from "./account";
import { raiseBillingAlert } from "./alerts";
import { grantSubscriptionMonth } from "./credits";
import { getDodoConfig, planForProduct } from "./dodo/config";
import {
	billingReasonOf,
	CHECKOUT_LIFETIME_MS,
	isLostDispute,
	netAmountOf,
	netShare,
	paymentPeriod,
	paymentStatusOf,
	refundedNetOf,
	safeObjectFields,
	subscriptionSnapshot,
} from "./dodo/mapping";
import { creditMonth, nextPaymentStatus, parseDate } from "./subscription-access";
import { upsertSubscription } from "./subscriptions";

/**
 * The one door every change Dodo Payments reports goes through: payments (succeeded, failed, refunded, disputed),
 * subscriptions (renewed, changed, cancelled, on hold), checkout sessions (expired), refunds and disputes. Each runs in
 * one transaction holding the account's billing lock and the rows it changes, records the event, and is safe to
 * repeat: a webhook redelivered (same `webhook-id`) does nothing, and a state older than the one kept is skipped.
 * Access and credits are granted exactly once per payment. Never call these from inside another transaction; they open
 * their own, and they make no Dodo calls: the callers read what they need first.
 */

type PaymentRow = typeof schema.billingPayment.$inferSelect;

/** Where a Dodo object came from: a signed webhook, the billing job or a customer's page asking, or an admin. */
export type EventContext = {
	source: BillingPaymentEventSource;
	/** The webhook's event type (payment.succeeded, payment.completed), or what asked (status_check). */
	eventType: string;
	/** The `webhook-id` (Dodo) or `svix-id` (Sumopod) of the delivery, unique per event; redeliveries carry the same one. */
	webhookId?: string | null | undefined;
	now?: Date | undefined;
};

export type AppliedChange = {
	outcome: BillingPaymentEventOutcome;
	paymentId: string | null;
	status: BillingPaymentStatus | null;
	/** Whether this call granted the payment's access and credits. */
	fulfilled: boolean;
};

export const ignored = (outcome: BillingPaymentEventOutcome = "ignored"): AppliedChange => ({
	outcome,
	paymentId: null,
	status: null,
	fulfilled: false,
});

const PAID_AT_SOME_POINT: ReadonlySet<BillingPaymentStatus> = new Set([
	"paid",
	"partially_refunded",
	"refunded",
	"reversed",
]);

function requireConfig() {
	const config = getDodoConfig();
	if (!config) throw new Error("Dodo Payments isn't set up on this server.");
	return config;
}

/** Reports an event that is about something Rezumi doesn't sell or know, outside any account's lock. */
export async function recordUnrelated(
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
export async function claimEvent(tx: Transaction, context: EventContext, providerObjectId: string) {
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
export async function finishEvent(
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

/** An account that still exists, or null. */
async function existingUser(id: unknown): Promise<string | null> {
	if (typeof id !== "string" || !id) return null;
	const [owner] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, id));
	return owner?.id ?? null;
}

/**
 * The account a Dodo object belongs to, from the surest sign to the least: the subscription Rezumi already keeps, the
 * user id Rezumi put in the checkout's (and the customer's) metadata, then the customer Rezumi made for the account.
 * `userId` is null when the account is gone; `externalCustomerId` still names it for a subscription kept before.
 */
async function accountFor(signs: {
	subscriptionId?: string | null | undefined;
	metadata?: Record<string, unknown> | undefined;
	customer: { customer_id: string; metadata?: Record<string, unknown> | undefined };
}): Promise<{ userId: string | null; externalCustomerId: string | null }> {
	if (signs.subscriptionId) {
		const [kept] = await db
			.select({ userId: schema.billingSubscription.userId, external: schema.billingSubscription.externalCustomerId })
			.from(schema.billingSubscription)
			.where(eq(schema.billingSubscription.providerSubscriptionId, signs.subscriptionId));
		if (kept) return { userId: kept.userId, externalCustomerId: kept.external };
	}
	const fromMetadata =
		(await existingUser(signs.metadata?.rezumi_user_id)) ??
		(await existingUser(signs.customer.metadata?.rezumi_user_id));
	if (fromMetadata) return { userId: fromMetadata, externalCustomerId: fromMetadata };
	const [account] = await db
		.select({ userId: schema.billingAccount.userId })
		.from(schema.billingAccount)
		.where(eq(schema.billingAccount.providerCustomerId, signs.customer.customer_id));
	return { userId: account?.userId ?? null, externalCustomerId: account?.userId ?? null };
}

/** Takes back the Rezumi AI credits a payment granted (a full refund, a lost dispute, or a partial refund asked to). */
export async function revokePaymentCredits(
	tx: Transaction,
	payment: Pick<PaymentRow, "id" | "userId">,
	reason: string,
) {
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

/** Rezumi's own key for a refund before Dodo gives it an id: RF-<payment id>-<sequence>. */
export const refundKeyFor = (paymentId: string, sequence: number) => `RF-${paymentId}-${sequence}`;

/**
 * The month of credits a paid Pro AI payment brings: the month of its subscription period that is running now (the
 * whole period for a monthly subscription). Granted once per subscription per month, so a plan change's payment
 * doesn't add another. Returns the credits granted.
 */
async function grantPaymentCredits(
	tx: Transaction,
	input: {
		userId: string;
		planId: PaidPlanId;
		paymentId: string;
		subscription: SubscriptionRow | null;
		/** A plan change that charged nothing bought nothing new: the paid charge for the change brings the month. */
		freePlanChange: boolean;
		now: Date;
	},
) {
	const { subscription } = input;
	const perMonth = PLANS[input.planId].creditsPerMonth;
	if (input.freePlanChange) return 0;
	if (!perMonth || !subscription || subscription.planId !== input.planId || !subscription.currentPeriodEnd) return 0;
	const month = creditMonth(
		{ start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd },
		subscription.interval,
		input.now < subscription.currentPeriodStart ? subscription.currentPeriodStart : input.now,
	);
	if (!month) return 0;
	const grant = await grantSubscriptionMonth(tx, {
		userId: input.userId,
		subscriptionId: subscription.id,
		paymentId: input.paymentId,
		amount: perMonth,
		startsAt: month.start,
		expiresAt: month.end,
		now: input.now,
	});
	return grant?.amount ?? 0;
}

/** The row Rezumi already keeps for a payment, or the checkout row it opened for it. */
async function knownPaymentRow(payment: DodoPaymentLike) {
	const columns = {
		id: schema.billingPayment.id,
		userId: schema.billingPayment.userId,
		planId: schema.billingPayment.planId,
		interval: schema.billingPayment.interval,
	};
	const [byPayment] = await db
		.select(columns)
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.providerPaymentId, payment.payment_id));
	if (byPayment || !payment.checkout_session_id) return byPayment ?? null;
	const [byCheckout] = await db
		.select(columns)
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.providerCheckoutId, payment.checkout_session_id));
	return byCheckout ?? null;
}

/** What a payment is applied with: the subscription it charges, as read from Dodo just before (null for none). */
export type PaymentRead = { subscription: DodoSubscriptionLike | null; observedAt: Date };

/**
 * Applies a Dodo payment: links it to the checkout Rezumi opened (or records a renewal or plan change as a new
 * payment), keeps its amounts, moves its status along the allowed transitions, and on the first paid state grants its
 * month of Pro AI credits and moves the subscription's paid_through. A full refund or a lost dispute takes the
 * payment's credits back; access follows the subscription, which a refund alone doesn't end. A payment that only saved
 * a new card is no sale and is skipped.
 */
export async function applyDodoPayment(
	payment: DodoPaymentLike,
	context: EventContext,
	read: PaymentRead,
): Promise<AppliedChange> {
	const config = requireConfig();
	const now = context.now ?? new Date();
	const payload = safeObjectFields(payment as unknown as Record<string, unknown>);
	if (payment.is_update_payment_method) {
		await recordUnrelated(context, payment.payment_id, "ignored", payload);
		return ignored();
	}
	const known = await knownPaymentRow(payment);
	const { subscription } = read;
	const subscriptionPlan = planForProduct(config, subscription?.product_id);
	const plan: { planId: PaidPlanId; interval: BillingInterval | null } | null =
		subscriptionPlan ?? planForProduct(config, payment.product_cart?.[0]?.product_id) ?? known;
	if (!plan) {
		await recordUnrelated(context, payment.payment_id, "unknown_product", payload);
		return ignored("unknown_product");
	}
	const owner = await accountFor({
		subscriptionId: payment.subscription_id,
		metadata: payment.metadata,
		customer: payment.customer,
	});
	const userId = known?.userId ?? owner.userId;
	const externalCustomerId = owner.externalCustomerId ?? userId;

	return db.transaction(async (tx) => {
		if (userId) await lockBillingAccount(tx, userId);
		const claim = await claimEvent(tx, context, payment.payment_id);
		if (!claim) return ignored("duplicate");

		const incoming = paymentStatusOf(payment);
		const paid = incoming === "paid" || incoming === "partially_refunded";
		const period = paymentPeriod(payment, payment.subscription_id);
		let subscriptionRow: SubscriptionRow | null = null;
		if (subscription && subscriptionPlan && externalCustomerId) {
			const snapshot = subscriptionSnapshot(subscription, read.observedAt);
			subscriptionRow = (
				await upsertSubscription(tx, {
					subscription: snapshot,
					plan: subscriptionPlan,
					userId,
					externalCustomerId,
					paidThrough: paid ? (period.end ?? snapshot.currentPeriodEnd) : null,
				})
			).row;
		}

		let [row] = await tx
			.select()
			.from(schema.billingPayment)
			.where(eq(schema.billingPayment.providerPaymentId, payment.payment_id))
			.for("update");
		if (!row && payment.checkout_session_id) {
			// The checkout's row: still waiting for its payment, or holding an attempt that failed before this one.
			[row] = await tx
				.select()
				.from(schema.billingPayment)
				.where(eq(schema.billingPayment.providerCheckoutId, payment.checkout_session_id))
				.for("update");
			if (row?.providerPaymentId && nextPaymentStatus(row.status, incoming).outcome !== "applied") {
				// An earlier attempt on the same checkout, after a later one settled it: nothing to change.
				await finishEvent(tx, claim, context, {
					providerObjectId: payment.payment_id,
					outcome: "stale",
					paymentId: row.id,
					payload,
				});
				return { outcome: "stale" as const, paymentId: row.id, status: row.status, fulfilled: false };
			}
		}
		const amount = netAmountOf(payment);
		const totalAmount = payment.total_amount;
		const currency = payment.currency.toLowerCase();
		if (!row) {
			if (!plan.interval) throw new Error("A new payment needs its subscription's plan.");
			[row] = await tx
				.insert(schema.billingPayment)
				.values({
					userId,
					provider: "dodo",
					providerPaymentId: payment.payment_id,
					providerCheckoutId: payment.checkout_session_id ?? null,
					subscriptionId: subscriptionRow?.id ?? null,
					planId: plan.planId,
					interval: plan.interval,
					catalogVersion: BILLING_CATALOG_VERSION,
					billingReason: billingReasonOf(payment.charge_type),
					amount,
					taxAmount: payment.tax ?? 0,
					totalAmount,
					currency,
					status: "pending",
					createdAt: parseDate(payment.created_at) ?? now,
				})
				.returning();
			if (!row) throw new Error("The payment was not saved.");
		}

		const transition = nextPaymentStatus(row.status, incoming);
		const refundedAmount = Math.min(
			amount,
			Math.max(row.refundedAmount, refundedNetOf(payment, { amount, totalAmount })),
		);
		const planId = subscriptionPlan?.planId ?? row.planId;
		const changes: Partial<typeof schema.billingPayment.$inferInsert> = {
			providerPaymentId: payment.payment_id,
			subscriptionId: subscriptionRow?.id ?? row.subscriptionId,
			billingReason: payment.charge_type ? billingReasonOf(payment.charge_type) : row.billingReason,
			amount,
			taxAmount: payment.tax ?? 0,
			totalAmount,
			currency,
			providerStatus: payment.status ?? row.providerStatus,
			periodStart: period.start ?? row.periodStart,
			periodEnd: period.end ?? row.periodEnd,
			refundedAmount,
			planId,
			...(subscriptionPlan && { interval: subscriptionPlan.interval }),
		};
		if (transition.outcome === "applied") {
			changes.status = transition.status;
			if (transition.status === "failed" || transition.status === "cancelled")
				changes.failureReason = payment.error_code ? `payment_${payment.error_code}`.slice(0, 80) : "payment_failed";
		}
		const nextStatus = changes.status ?? row.status;
		if (PAID_AT_SOME_POINT.has(nextStatus) && !row.paidAt) changes.paidAt = now;
		let fulfilled = false;
		if (paid && transition.outcome !== "stale" && !row.fulfilledAt) {
			if (userId) {
				const credits = await grantPaymentCredits(tx, {
					userId,
					planId,
					paymentId: row.id,
					subscription: subscriptionRow,
					freePlanChange: payment.charge_type === "plan_change" && payment.total_amount === 0,
					now,
				});
				changes.credits = credits;
				changes.fulfilledAt = now;
				fulfilled = true;
				await tx.insert(schema.billingAuditLog).values({
					targetUserId: userId,
					action: "payment.fulfilled",
					details: {
						paymentId: row.id,
						providerPaymentId: payment.payment_id,
						planId,
						interval: changes.interval ?? row.interval,
						billingReason: changes.billingReason,
						amount,
						currency,
						credits,
						...(subscriptionRow && { subscriptionId: subscriptionRow.id, paidThrough: subscriptionRow.paidThrough }),
					},
				});
			} else if (transition.outcome === "applied") {
				// Paid for an account that is gone: nobody to give it to, so the money should go back. Said once.
				await raiseBillingAlert(tx, { kind: "paid_not_applied", paymentId: row.id, now });
			}
		}
		let moneyChanged = false;
		if (nextStatus === "reversed" && row.status !== "reversed") {
			moneyChanged = true;
			await revokePaymentCredits(tx, row, "payment.reversed");
			await raiseBillingAlert(tx, { kind: "payment_reversed", paymentId: row.id, now });
		} else if (refundedAmount > row.refundedAmount) {
			moneyChanged = true;
			const full = nextStatus === "refunded" || refundedAmount >= amount;
			const revokeAsked = await tx
				.select({ id: schema.billingRefund.id })
				.from(schema.billingRefund)
				.where(and(eq(schema.billingRefund.paymentId, row.id), eq(schema.billingRefund.revokeBenefits, true)))
				.limit(1);
			if (full || revokeAsked.length)
				await revokePaymentCredits(tx, row, full ? "payment.refunded" : "payment.partially_refunded");
			await tx.insert(schema.billingAuditLog).values({
				targetUserId: row.userId,
				action: "payment.refund_recorded",
				details: { paymentId: row.id, refundedAmount, source: context.source },
			});
		}
		await tx.update(schema.billingPayment).set(changes).where(eq(schema.billingPayment.id, row.id));
		const outcome = fulfilled || moneyChanged ? "applied" : transition.outcome;
		await finishEvent(tx, claim, context, {
			providerObjectId: payment.payment_id,
			outcome,
			paymentId: row.id,
			subscriptionId: subscriptionRow?.id ?? null,
			payload,
		});
		return { outcome, paymentId: row.id, status: nextStatus, fulfilled };
	});
}

/**
 * Applies a Dodo subscription's state, read from Dodo at `observedAt`: started, renewed, changed plan, set to cancel,
 * cancelled, on hold. Access is read from it (entitlements); credits and paid_through come with its payments. A state
 * read earlier than the one kept is skipped.
 */
export async function applyDodoSubscription(
	subscription: DodoSubscriptionLike,
	context: EventContext,
	observedAt: Date = context.now ?? new Date(),
): Promise<AppliedChange & { subscriptionId: string | null }> {
	const config = requireConfig();
	const plan = planForProduct(config, subscription.product_id);
	const payload = safeObjectFields(subscription as unknown as Record<string, unknown>);
	if (!plan) {
		await recordUnrelated(context, subscription.subscription_id, "unknown_product", payload);
		return { ...ignored("unknown_product"), subscriptionId: null };
	}
	const { userId, externalCustomerId } = await accountFor({
		subscriptionId: subscription.subscription_id,
		metadata: subscription.metadata,
		customer: subscription.customer,
	});
	if (!externalCustomerId) {
		await recordUnrelated(context, subscription.subscription_id, "unknown_customer", payload);
		return { ...ignored("unknown_customer"), subscriptionId: null };
	}
	const snapshot = subscriptionSnapshot(subscription, observedAt);
	return db.transaction(async (tx) => {
		if (userId) await lockBillingAccount(tx, userId);
		const claim = await claimEvent(tx, context, subscription.subscription_id);
		if (!claim) return { ...ignored("duplicate"), subscriptionId: null };
		const before = (
			await tx
				.select({
					status: schema.billingSubscription.status,
					planId: schema.billingSubscription.planId,
					interval: schema.billingSubscription.interval,
					cancelAtPeriodEnd: schema.billingSubscription.cancelAtPeriodEnd,
					pendingProductId: schema.billingSubscription.pendingProductId,
				})
				.from(schema.billingSubscription)
				.where(eq(schema.billingSubscription.providerSubscriptionId, subscription.subscription_id))
		)[0];
		const { row, outcome } = await upsertSubscription(tx, { subscription: snapshot, plan, userId, externalCustomerId });
		// What support asks about: a new plan or billing period, a cancellation set or undone, a change for the renewal.
		const changed =
			!before ||
			before.status !== row.status ||
			before.planId !== row.planId ||
			before.interval !== row.interval ||
			before.cancelAtPeriodEnd !== row.cancelAtPeriodEnd ||
			before.pendingProductId !== row.pendingProductId;
		if (outcome === "applied" && changed)
			await tx.insert(schema.billingAuditLog).values({
				targetUserId: userId,
				action: "subscription.changed",
				details: {
					subscriptionId: row.id,
					from: before
						? {
								status: before.status,
								planId: before.planId,
								interval: before.interval,
								cancelAtPeriodEnd: before.cancelAtPeriodEnd,
							}
						: null,
					to: {
						status: row.status,
						planId: row.planId,
						interval: row.interval,
						cancelAtPeriodEnd: row.cancelAtPeriodEnd,
					},
					pendingPlanChange: row.pendingProductId !== null,
					source: context.source,
				},
			});
		await finishEvent(tx, claim, context, {
			providerObjectId: subscription.subscription_id,
			outcome,
			subscriptionId: row.id,
			payload,
		});
		return { outcome, paymentId: null, status: null, fulfilled: false, subscriptionId: row.id };
	});
}

/** How long after a checkout session closes an unpaid payment is ended. */
const EXPIRY_GRACE_MS = 30 * 60 * 1000;

/**
 * Applies a checkout session that has no payment yet to the payment Rezumi opened for it: once the session has closed
 * (24 hours, and a little more), the payment still waiting expires. A session with a payment is settled by that
 * payment instead. Sessions Rezumi didn't open are left alone.
 */
export async function applyDodoCheckout(checkout: DodoCheckoutLike, context: EventContext): Promise<AppliedChange> {
	const now = context.now ?? new Date();
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
		const closesAt =
			payment.expiresAt ?? new Date(+(parseDate(checkout.created_at) ?? payment.createdAt) + CHECKOUT_LIFETIME_MS);
		const waiting = (payment.status === "creating" || payment.status === "pending") && !payment.providerPaymentId;
		const closed = +now > +closesAt + EXPIRY_GRACE_MS;
		const transition = waiting && closed ? nextPaymentStatus(payment.status, "expired") : null;
		const changes: Partial<typeof schema.billingPayment.$inferInsert> = {
			providerStatus: payment.providerPaymentId
				? payment.providerStatus
				: `checkout_${checkout.payment_status ?? (closed ? "expired" : "open")}`,
		};
		if (transition?.outcome === "applied") {
			changes.status = transition.status;
			changes.failureReason = "checkout_expired";
		}
		await tx.update(schema.billingPayment).set(changes).where(eq(schema.billingPayment.id, payment.id));
		const outcome = transition?.outcome ?? "stale";
		await finishEvent(tx, claim, context, { providerObjectId: checkout.id, outcome, paymentId: payment.id, payload });
		return { outcome, paymentId: payment.id, status: changes.status ?? payment.status, fulfilled: false };
	});
}

const refundStatus = (status: DodoRefundLike["status"]): BillingRefundStatus =>
	status === "succeeded" ? "succeeded" : status === "failed" ? "failed" : "requesting";

/**
 * Applies a Dodo refund to its payment: Rezumi's own request (found by the id it put in the refund's metadata) takes
 * Dodo's id and status; one made in Dodo's dashboard is added, its amount (tax included) turned into the payment's net
 * share. The payment's refunded amount never goes down, and a full refund takes its credits back. Null when the
 * refund's payment isn't one of Rezumi's yet (the caller applies the payment first).
 */
export async function applyDodoRefund(refund: DodoRefundLike, context: EventContext): Promise<AppliedChange | null> {
	const now = context.now ?? new Date();
	const [known] = await db
		.select({ id: schema.billingPayment.id, userId: schema.billingPayment.userId })
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.providerPaymentId, refund.payment_id));
	if (!known) return null;
	const payload = safeObjectFields(refund as unknown as Record<string, unknown>);
	return db.transaction(async (tx) => {
		if (known.userId) await lockBillingAccount(tx, known.userId);
		const claim = await claimEvent(tx, context, refund.refund_id);
		if (!claim) return ignored("duplicate");
		const [payment] = await tx
			.select()
			.from(schema.billingPayment)
			.where(eq(schema.billingPayment.id, known.id))
			.for("update");
		if (!payment) throw new Error("No payment has that ID.");
		const status = refundStatus(refund.status);
		const localId = typeof refund.metadata?.rezumi_refund_id === "string" ? refund.metadata.rezumi_refund_id : null;
		const [existing] = await tx
			.select()
			.from(schema.billingRefund)
			.where(
				localId
					? or(
							and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.id, localId)),
							eq(schema.billingRefund.refundKey, refund.refund_id),
						)
					: eq(schema.billingRefund.refundKey, refund.refund_id),
			)
			.for("update");
		const settledAt = status === "requesting" ? null : now;
		const failureReason = status === "failed" ? `refund_${refund.status}` : null;
		let outcome: BillingPaymentEventOutcome = "applied";
		if (existing) {
			// A settled refund doesn't go back to waiting.
			if (existing.status !== "requesting" && status === "requesting") outcome = "stale";
			else if (existing.status === status && existing.refundKey === refund.refund_id) outcome = "duplicate";
			else
				await tx
					.update(schema.billingRefund)
					.set({ refundKey: refund.refund_id, status, settledAt, failureReason })
					.where(eq(schema.billingRefund.id, existing.id));
		} else {
			// Made at Dodo, not here: the net share of what it gave back, or the rest of the payment for a full refund.
			const settled = await tx
				.select({ amount: schema.billingRefund.amount })
				.from(schema.billingRefund)
				.where(and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.status, "succeeded")));
			const left = payment.amount - settled.reduce((sum, row) => sum + row.amount, 0);
			const amount = Math.min(left, refund.is_partial ? netShare(refund.amount ?? 0, payment) : left);
			if (amount > 0)
				await tx.insert(schema.billingRefund).values({
					paymentId: payment.id,
					sequence: await nextRefundSequence(tx, payment.id),
					refundKey: refund.refund_id,
					method: "dodo",
					status,
					amount,
					reason: refund.reason?.trim().slice(0, 500) || "Refunded at Dodo Payments",
					failureReason,
					settledAt,
				});
			else outcome = "ignored";
		}

		const succeeded = await tx
			.select({ amount: schema.billingRefund.amount, revokeBenefits: schema.billingRefund.revokeBenefits })
			.from(schema.billingRefund)
			.where(and(eq(schema.billingRefund.paymentId, payment.id), eq(schema.billingRefund.status, "succeeded")));
		const total = succeeded.reduce((sum, row) => sum + row.amount, 0);
		const refundedAmount = Math.min(payment.amount, Math.max(payment.refundedAmount, total));
		const changes: Partial<typeof schema.billingPayment.$inferInsert> = { refundedAmount };
		if (refundedAmount > payment.refundedAmount) {
			const full = refundedAmount >= payment.amount;
			const transition = nextPaymentStatus(payment.status, full ? "refunded" : "partially_refunded");
			if (transition.outcome === "applied") changes.status = transition.status;
			if (full || succeeded.some((row) => row.revokeBenefits))
				await revokePaymentCredits(tx, payment, full ? "payment.refunded" : "payment.partially_refunded");
			await tx.insert(schema.billingAuditLog).values({
				targetUserId: payment.userId,
				action: "payment.refund_recorded",
				details: { paymentId: payment.id, refundId: refund.refund_id, refundedAmount, source: context.source },
			});
		}
		await tx.update(schema.billingPayment).set(changes).where(eq(schema.billingPayment.id, payment.id));
		await finishEvent(tx, claim, context, {
			providerObjectId: refund.refund_id,
			outcome,
			paymentId: payment.id,
			payload,
		});
		return { outcome, paymentId: payment.id, status: changes.status ?? payment.status, fulfilled: false };
	});
}

/**
 * Applies a card dispute to its payment. Opening one alerts the owner (evidence goes in through Dodo's dashboard within
 * days); losing or accepting one reverses the payment and takes its credits back. Returns the subscription the payment
 * belongs to when the dispute was lost, so the caller can end it at Dodo: a customer who took the money back shouldn't
 * be charged again. Null when the payment isn't one of Rezumi's yet.
 */
export async function applyDodoDispute(
	dispute: DodoDisputeLike,
	context: EventContext,
): Promise<(AppliedChange & { endSubscription: string | null }) | null> {
	const now = context.now ?? new Date();
	const [known] = await db
		.select({ id: schema.billingPayment.id, userId: schema.billingPayment.userId })
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.providerPaymentId, dispute.payment_id));
	if (!known) return null;
	const payload = safeObjectFields(dispute as unknown as Record<string, unknown>);
	return db.transaction(async (tx) => {
		if (known.userId) await lockBillingAccount(tx, known.userId);
		const claim = await claimEvent(tx, context, dispute.dispute_id);
		if (!claim) return { ...ignored("duplicate"), endSubscription: null };
		const [payment] = await tx
			.select()
			.from(schema.billingPayment)
			.where(eq(schema.billingPayment.id, known.id))
			.for("update");
		if (!payment) throw new Error("No payment has that ID.");
		let outcome: BillingPaymentEventOutcome = "applied";
		let status = payment.status;
		let endSubscription: string | null = null;
		if (dispute.dispute_status === "dispute_opened") {
			await raiseBillingAlert(tx, { kind: "payment_reversed", paymentId: payment.id, now });
		} else if (isLostDispute(dispute.dispute_status)) {
			const transition = nextPaymentStatus(payment.status, "reversed");
			outcome = transition.outcome;
			if (transition.outcome === "applied") {
				status = "reversed";
				await tx
					.update(schema.billingPayment)
					.set({ status, failureReason: dispute.dispute_status })
					.where(eq(schema.billingPayment.id, payment.id));
				await revokePaymentCredits(tx, payment, "payment.reversed");
				await raiseBillingAlert(tx, { kind: "payment_reversed", paymentId: payment.id, now });
				if (payment.subscriptionId) {
					const [subscription] = await tx
						.select({ providerId: schema.billingSubscription.providerSubscriptionId })
						.from(schema.billingSubscription)
						.where(eq(schema.billingSubscription.id, payment.subscriptionId));
					endSubscription = subscription?.providerId ?? null;
				}
			}
		} else outcome = "ignored";
		await tx.insert(schema.billingAuditLog).values({
			targetUserId: payment.userId,
			action: "payment.dispute",
			details: { paymentId: payment.id, disputeId: dispute.dispute_id, status: dispute.dispute_status },
		});
		await finishEvent(tx, claim, context, {
			providerObjectId: dispute.dispute_id,
			outcome,
			paymentId: payment.id,
			payload,
		});
		return { outcome, paymentId: payment.id, status, fulfilled: false, endSubscription };
	});
}
