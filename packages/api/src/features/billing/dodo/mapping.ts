import type { SubscriptionSnapshot } from "../subscriptions";
import type { BillingPaymentStatus, BillingReason, BillingSubscriptionStatus } from "@rezumi/db/schema";
import type DodoPayments from "dodopayments";
import { parseDate } from "../subscription-access";

/**
 * Pure translations between Dodo Payments' objects and Rezumi's billing rows: statuses, periods, amounts and the safe
 * fields kept for support. No database, no network; the webhook handler and the billing job share them.
 */

type Metadata = Record<string, string | number | boolean>;

/** The fields of a Dodo subscription Rezumi keeps, as subscription webhooks and the subscription API give them. */
export type DodoSubscriptionLike = Pick<
	DodoPayments.Subscription,
	| "subscription_id"
	| "status"
	| "product_id"
	| "recurring_pre_tax_amount"
	| "currency"
	| "previous_billing_date"
	| "next_billing_date"
	| "cancel_at_next_billing_date"
	| "created_at"
	| "trial_period_days"
> & {
	customer: { customer_id: string; metadata?: Metadata | undefined };
	metadata?: Metadata | undefined;
	cancelled_at?: string | null | undefined;
	scheduled_change?: { product_id: string; effective_at: string } | null | undefined;
};

/** The fields of a Dodo payment Rezumi keeps, as payment webhooks and the payment API give them. */
export type DodoPaymentLike = Pick<DodoPayments.Payment, "payment_id" | "total_amount" | "currency" | "created_at"> & {
	status?: DodoPayments.IntentStatus | null | undefined;
	tax?: number | null | undefined;
	subscription_id?: string | null | undefined;
	checkout_session_id?: string | null | undefined;
	charge_type?: DodoPayments.ChargeType | null | undefined;
	is_update_payment_method?: boolean | undefined;
	service_periods?: readonly { subscription_id: string; starts_at: string; ends_at: string }[] | undefined;
	refunds?: readonly { refund_id: string; status: string; amount?: number | null | undefined }[] | undefined;
	refund_status?: "partial" | "full" | null | undefined;
	disputes?: readonly { dispute_id: string; dispute_status: string }[] | undefined;
	product_cart?: readonly { product_id: string }[] | null | undefined;
	error_code?: string | null | undefined;
	metadata?: Metadata | undefined;
	customer: { customer_id: string; metadata?: Metadata | undefined };
};

/** A checkout session's state, as the checkout session API gives it. */
export type DodoCheckoutLike = Pick<DodoPayments.CheckoutSessionStatus, "id" | "created_at"> & {
	payment_id?: string | null | undefined;
	payment_status?: DodoPayments.IntentStatus | null | undefined;
};

/** A Dodo refund, as refund webhooks and the refund API give it. */
export type DodoRefundLike = Pick<DodoPayments.Refund, "refund_id" | "payment_id" | "status" | "is_partial"> & {
	amount?: number | null | undefined;
	reason?: string | null | undefined;
	metadata?: Metadata | undefined;
	created_at?: string | undefined;
};

/** A Dodo dispute, as dispute webhooks give it. */
export type DodoDisputeLike = Pick<DodoPayments.Dispute, "dispute_id" | "payment_id" | "dispute_status">;

/** A Dodo checkout session lives 24 hours. */
export const CHECKOUT_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** How far past the trial's length a first period may end and still be the trial (Dodo's clock and rounding). */
const TRIAL_SLACK_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether an active subscription is still in its free trial: it has trial days and its current period, the first one,
 * ends no later than the trial does. The first renewal moves the period on and ends it.
 */
export function isInTrial(
	subscription: Pick<DodoSubscriptionLike, "trial_period_days" | "created_at" | "next_billing_date">,
): boolean {
	if (!subscription.trial_period_days) return false;
	const created = parseDate(subscription.created_at);
	const next = parseDate(subscription.next_billing_date);
	if (!created || !next) return false;
	return +next <= +created + subscription.trial_period_days * DAY_MS + TRIAL_SLACK_MS;
}

/** A Dodo subscription's status as Rezumi keeps it: an active one in its free trial is `trialing`. */
export function subscriptionStatusOf(subscription: DodoSubscriptionLike): BillingSubscriptionStatus {
	if (subscription.status === "active" && isInTrial(subscription)) return "trialing";
	return subscription.status;
}

const ENDED_SUBSCRIPTION = new Set(["cancelled", "failed", "expired"]);

/**
 * A Dodo subscription as the row Rezumi keeps, read at `observedAt`. Dodo's objects carry no modification time, so the
 * moment it was read orders the states: Rezumi re-reads a subscription before applying its webhooks.
 */
export function subscriptionSnapshot(subscription: DodoSubscriptionLike, observedAt: Date): SubscriptionSnapshot {
	const created = parseDate(subscription.created_at) ?? observedAt;
	const next = parseDate(subscription.next_billing_date);
	const cancelAtPeriodEnd = subscription.cancel_at_next_billing_date;
	const cancelledAt = parseDate(subscription.cancelled_at);
	const ended = ENDED_SUBSCRIPTION.has(subscription.status);
	return {
		providerSubscriptionId: subscription.subscription_id,
		providerCustomerId: subscription.customer.customer_id,
		providerProductId: subscription.product_id,
		status: subscriptionStatusOf(subscription),
		amount: subscription.recurring_pre_tax_amount,
		currency: subscription.currency.toLowerCase(),
		currentPeriodStart: parseDate(subscription.previous_billing_date) ?? created,
		currentPeriodEnd: next,
		cancelAtPeriodEnd,
		canceledAt: cancelledAt,
		startedAt: created,
		endsAt: cancelAtPeriodEnd ? next : null,
		// Cancelled for the period end, it ends there; cancelled now, failed or expired, it is over already.
		endedAt: ended ? (cancelAtPeriodEnd && next && next > observedAt ? next : (cancelledAt ?? observedAt)) : null,
		pendingProductId: subscription.scheduled_change?.product_id ?? null,
		observedAt,
	};
}

const LOST_DISPUTES = new Set(["dispute_lost", "dispute_accepted"]);

/** Whether a dispute ended with the money going back to the customer. */
export const isLostDispute = (status: string) => LOST_DISPUTES.has(status);

/**
 * A Dodo payment's status, as Rezumi's: a charge still settling (processing, or waiting on the customer) is pending;
 * once it succeeded, a lost dispute reverses it and refunds mark it refunded in part or in full.
 */
export function paymentStatusOf(payment: DodoPaymentLike): BillingPaymentStatus {
	switch (payment.status) {
		case "succeeded":
			break;
		case "failed":
			return "failed";
		case "cancelled":
			return "cancelled";
		default:
			return "pending";
	}
	if (payment.disputes?.some((dispute) => isLostDispute(dispute.dispute_status))) return "reversed";
	if (payment.refund_status === "full") return "refunded";
	if (payment.refund_status === "partial") return "partially_refunded";
	return "paid";
}

/** Why a payment was made, from Dodo's charge type. */
export function billingReasonOf(chargeType: DodoPaymentLike["charge_type"]): BillingReason {
	switch (chargeType) {
		case "new":
			return "subscription_create";
		case "renewal":
			return "subscription_cycle";
		case "plan_change":
			return "subscription_update";
		default:
			return "purchase";
	}
}

/** Before tax and after discounts: what Rezumi earns before fees. Dodo reports the total and the tax in it. */
export const netAmountOf = (payment: Pick<DodoPaymentLike, "total_amount" | "tax">) =>
	Math.max(0, payment.total_amount - (payment.tax ?? 0));

/**
 * An amount Dodo reports tax included (a refund), as the part of a payment's net amount it stands for: the same share
 * of the net as of the total. Tax-free payments are the same either way.
 */
export function netShare(amountWithTax: number, payment: { amount: number; totalAmount: number }): number {
	if (payment.totalAmount <= 0) return 0;
	return Math.min(payment.amount, Math.round((amountWithTax * payment.amount) / payment.totalAmount));
}

/**
 * How much of a payment's net amount Dodo says went back: all of it after a full refund, else its succeeded refunds'
 * share. Rezumi's own refund rows may know more; the larger wins.
 */
export function refundedNetOf(payment: DodoPaymentLike, totals: { amount: number; totalAmount: number }): number {
	if (payment.refund_status === "full") return totals.amount;
	const refunded = (payment.refunds ?? [])
		.filter((refund) => refund.status === "succeeded")
		.reduce((sum, refund) => sum + (refund.amount ?? 0), 0);
	return netShare(refunded, totals);
}

/** The stretch a payment pays for of one subscription, from its service periods; none for a one-time payment. */
export function paymentPeriod(
	payment: Pick<DodoPaymentLike, "service_periods">,
	subscriptionId: string | null | undefined,
): { start: Date | null; end: Date | null } {
	const period = payment.service_periods?.find((entry) => entry.subscription_id === subscriptionId);
	return { start: parseDate(period?.starts_at), end: parseDate(period?.ends_at) };
}

/** The app's language as one Dodo's checkout and emails speak, or English. */
const DODO_LOCALES = new Set([
	"ar",
	"ca",
	"zh",
	"nl",
	"en",
	"fr",
	"de",
	"he",
	"id",
	"it",
	"ja",
	"ka",
	"ko",
	"ms",
	"pl",
	"pt",
	"ro",
	"ru",
	"es",
	"sv",
	"th",
	"tr",
]);

export function dodoLocale(locale: string | null | undefined): DodoPayments.Locale {
	const language = (locale ?? "").split(/[-_]/)[0]?.toLowerCase() ?? "";
	return (DODO_LOCALES.has(language) ? language : "en") as DodoPayments.Locale;
}

/** The fields kept from a Dodo object in an event's payload: ids, statuses and amounts, never names or emails. */
export function safeObjectFields(object: Record<string, unknown>): Record<string, unknown> {
	const allowed = [
		"payment_id",
		"subscription_id",
		"refund_id",
		"dispute_id",
		"id",
		"status",
		"payment_status",
		"dispute_status",
		"charge_type",
		"total_amount",
		"tax",
		"amount",
		"currency",
		"product_id",
		"checkout_session_id",
		"refund_status",
		"is_partial",
		"previous_billing_date",
		"next_billing_date",
		"cancel_at_next_billing_date",
		"trial_period_days",
		"recurring_pre_tax_amount",
		"error_code",
		"retry_attempt",
	];
	return Object.fromEntries(allowed.filter((key) => key in object).map((key) => [key, object[key]]));
}
