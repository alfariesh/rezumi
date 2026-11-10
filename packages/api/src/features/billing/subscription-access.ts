import type { BillingPaymentStatus, BillingSubscriptionStatus } from "@rezumi/db/schema";
import type { BillingInterval, PaidPlanId } from "@rezumi/schema/billing";

/**
 * Pure rules for paid access, whoever sells it: which way a payment's status may move, how long a subscription gives
 * access, and the months its credits come in. No database, no network; the webhook handler, the billing job and the
 * entitlement checks share them.
 */

export const parseDate = (value: string | null | undefined): Date | null => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(+date) ? null : date;
};

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
	// A partly refunded payment reported as just paid is an older state.
	if (current === "partially_refunded" && incoming === "paid") return { outcome: "stale", status: current };
	return { outcome: "applied", status: incoming };
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
 * How long an active subscription keeps access past its period end while the renewal's news is on its way: renewals
 * happen at the period end and their webhooks can lag or need a retry. A failed renewal turns it past_due or on_hold,
 * which ends access at the last paid period at once.
 */
export const RENEWAL_GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * The paid access a subscription gives at `now`, or null. Active and trialing subscriptions run to their period end
 * (a little past it while the renewal arrives); past_due and on_hold ones only to the end of the last period a payment
 * paid for; one cancelled for the period end runs to it; the rest (cancelled now, paused, never paid, over) give none.
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
		case "on_hold":
			endsAt = subscription.paidThrough;
			break;
		case "cancelled":
			endsAt = subscription.cancelAtPeriodEnd ? subscription.currentPeriodEnd : null;
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
