import type { BillingPaymentStatus, BillingSubscriptionStatus } from "@rezumi/db/schema";
import type { BillingInterval, PaidPlanId } from "@rezumi/schema/billing";

/**
 * Pure translations between Polar's objects and Rezumi's billing rows: statuses, periods, access and the months a
 * subscription's credits come in. No database, no network; the webhook handler and the billing job share them.
 */

/** The fields of a Polar subscription Rezumi keeps, from a Subscription or the one embedded in an Order. */
export type PolarSubscriptionLike = {
	id: string;
	status: BillingSubscriptionStatus;
	product_id: string;
	customer_id: string;
	amount: number;
	currency: string;
	current_period_start: string;
	current_period_end: string | null;
	cancel_at_period_end: boolean;
	canceled_at: string | null;
	started_at: string | null;
	ends_at: string | null;
	ended_at: string | null;
	created_at: string;
	modified_at: string | null;
	pending_update?: { product_id?: string | null } | null;
};

/** The fields of a Polar order Rezumi keeps. */
export type PolarOrderLike = {
	id: string;
	status: "draft" | "pending" | "paid" | "refunded" | "partially_refunded" | "void";
	billing_reason: string;
	net_amount: number;
	tax_amount: number;
	total_amount: number;
	refunded_amount: number;
	currency: string;
	product_id: string | null;
	checkout_id: string | null;
	subscription_id: string | null;
	created_at: string;
	modified_at: string | null;
	items: readonly { start_timestamp: string | null; end_timestamp: string | null }[];
};

export const parseDate = (value: string | null | undefined): Date | null => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(+date) ? null : date;
};

/** When Polar last changed an object: what orders its events, newest wins. */
export const providerModifiedAt = (object: { created_at: string; modified_at: string | null }) =>
	parseDate(object.modified_at) ?? parseDate(object.created_at) ?? new Date(0);

/** A Polar order's status, as a payment's. A draft or pending order is still being charged. */
export function orderPaymentStatus(status: PolarOrderLike["status"]): BillingPaymentStatus {
	switch (status) {
		case "draft":
		case "pending":
			return "pending";
		case "paid":
			return "paid";
		case "partially_refunded":
			return "partially_refunded";
		case "refunded":
			return "refunded";
		case "void":
			return "cancelled";
	}
}

/** A checkout session's status, as its payment's while no order exists yet. A succeeded checkout waits for its order. */
export function checkoutPaymentStatus(status: "open" | "expired" | "confirmed" | "succeeded" | "failed") {
	switch (status) {
		case "open":
		case "confirmed":
		case "succeeded":
			return "pending" as const;
		case "expired":
			return "expired" as const;
		case "failed":
			return "failed" as const;
	}
}

const ENDED: ReadonlySet<BillingPaymentStatus> = new Set(["refunded", "reversed"]);
const PAID: ReadonlySet<BillingPaymentStatus> = new Set(["paid", "partially_refunded", "refunded", "reversed"]);

export type PaymentTransition =
	| { outcome: "applied"; status: BillingPaymentStatus }
	| { outcome: "duplicate"; status: BillingPaymentStatus }
	| { outcome: "stale"; status: BillingPaymentStatus };

/**
 * Where a payment may go next. Anything may become paid (a checkout paid at the last moment still counts); paid never
 * goes back to waiting, failing or expiring; from paid only refunds and reversals follow, and a full refund or a
 * reversal is the end.
 */
export function nextPaymentStatus(current: BillingPaymentStatus, incoming: BillingPaymentStatus): PaymentTransition {
	if (current === incoming) return { outcome: "duplicate", status: current };
	if (ENDED.has(current)) return { outcome: "stale", status: current };
	if (PAID.has(current) && !PAID.has(incoming)) return { outcome: "stale", status: current };
	// A partly refunded order reported as just paid is an older event.
	if (current === "partially_refunded" && incoming === "paid") return { outcome: "stale", status: current };
	return { outcome: "applied", status: incoming };
}

/** The stretch an order pays for: its items' first start and last end, or none (a one-time order). */
export function orderPeriod(order: Pick<PolarOrderLike, "items">): { start: Date | null; end: Date | null } {
	let start: Date | null = null;
	let end: Date | null = null;
	for (const item of order.items ?? []) {
		const from = parseDate(item.start_timestamp);
		const to = parseDate(item.end_timestamp);
		if (from && (!start || from < start)) start = from;
		if (to && (!end || to > end)) end = to;
	}
	return { start, end };
}

/** A subscription row as the entitlement and credit code read it. */
export type SubscriptionState = {
	planId: PaidPlanId;
	interval: BillingInterval;
	status: BillingSubscriptionStatus;
	currentPeriodStart: Date;
	currentPeriodEnd: Date | null;
	paidThrough: Date | null;
	cancelAtPeriodEnd: boolean;
	endedAt: Date | null;
};

/**
 * How long an active subscription keeps access past its period end while the renewal's news is on its way: Polar
 * renews at the period end and its webhooks can lag or need a retry. A failed renewal turns it past_due, which ends
 * access at the last paid period at once.
 */
export const RENEWAL_GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * The paid access a subscription gives at `now`, or null. Active and trialing subscriptions run to their period end
 * (a little past it while the renewal arrives); past_due ones only to the end of the last period an order paid for;
 * the rest (canceled, unpaid, paused, never paid) give none.
 */
export function subscriptionAccess(
	subscription: SubscriptionState,
	now: Date,
): { planId: PaidPlanId; startsAt: Date; endsAt: Date; renews: boolean } | null {
	let endsAt: Date | null;
	switch (subscription.status) {
		// A trial's end is its first charge, a renewal like any other.
		case "active":
		case "trialing": {
			const end = subscription.currentPeriodEnd;
			endsAt = end && end <= now ? new Date(+end + RENEWAL_GRACE_MS) : end;
			break;
		}
		case "past_due":
			endsAt = subscription.paidThrough;
			break;
		default:
			return null;
	}
	if (subscription.endedAt && (!endsAt || subscription.endedAt < endsAt)) endsAt = subscription.endedAt;
	if (!endsAt || endsAt <= now) return null;
	return {
		planId: subscription.planId,
		startsAt: subscription.currentPeriodStart,
		endsAt,
		// A trial goes on into its first charge unless it was cancelled.
		renews: (subscription.status === "active" || subscription.status === "trialing") && !subscription.cancelAtPeriodEnd,
	};
}

/** `date` plus whole calendar months (UTC), clamped to the end of a shorter month: Jan 31 + 1 → Feb 28. */
export function addMonths(date: Date, months: number): Date {
	const result = new Date(date);
	const day = result.getUTCDate();
	result.setUTCDate(1);
	result.setUTCMonth(result.getUTCMonth() + months);
	const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
	result.setUTCDate(Math.min(day, lastDay));
	return result;
}

/**
 * The month of a subscription period that contains `at`, for its credits: the whole period for a monthly subscription,
 * one calendar month of a yearly one (the last ending at the period end). Null outside the period.
 */
export function creditMonth(
	period: { start: Date; end: Date },
	interval: BillingInterval,
	at: Date,
): { start: Date; end: Date } | null {
	if (at < period.start || at >= period.end) return null;
	if (interval === "month") return { start: period.start, end: period.end };
	// A yearly period has twelve months; a period moved by hand (a changed billing date) may have fewer or a few more.
	for (let month = 0; month < 24; month++) {
		const start = addMonths(period.start, month);
		if (start >= period.end) return null;
		const next = addMonths(period.start, month + 1);
		const end = next < period.end ? next : period.end;
		if (at < end) return { start, end };
	}
	return null;
}

/** The fields kept from a Polar object in an event's payload: ids, statuses and amounts, never names or emails. */
export function safeObjectFields(object: Record<string, unknown>): Record<string, unknown> {
	const allowed = [
		"id",
		"status",
		"billing_reason",
		"net_amount",
		"tax_amount",
		"total_amount",
		"refunded_amount",
		"amount",
		"currency",
		"product_id",
		"checkout_id",
		"subscription_id",
		"order_id",
		"reason",
		"recurring_interval",
		"current_period_start",
		"current_period_end",
		"cancel_at_period_end",
		"ended_at",
		"expires_at",
		"modified_at",
	];
	return Object.fromEntries(allowed.filter((key) => key in object).map((key) => [key, object[key]]));
}
