import type { PlanSummary } from "./plan";
import type { RouterOutput } from "@/libs/orpc/client";
import type { BillingCurrency, BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { useRouteContext } from "@tanstack/react-router";
import { PLANS, planPrice, toMajorUnits } from "@rezumi/schema/billing";
import { getPlanName } from "./plan";

export type Payment = RouterOutput["billing"]["payments"]["items"][number];
export type PaymentDetail = RouterOutput["billing"]["payment"];
export type PaymentStatus = Payment["status"];
export type Subscription = NonNullable<PlanSummary["subscription"]>;

/** The browser's time zone, or UTC when it can't say. */
const browserTimeZone = () => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
};

/** The account's time zone; until one is chosen it reads UTC, so dates show in the browser's own zone. */
export const planTimeZone = (timezone: string | null | undefined) =>
	timezone && timezone !== "UTC" ? timezone : browserTimeZone();

/**
 * Dates for plans and payments, in the app's language and the account's time zone: "3 December 2026 at 08:10 GMT+7"
 * with the time, "3 Dec 2026" without, "3 Dec 2026, 08:10" in a column.
 */
export function usePlanDates() {
	const { session } = useRouteContext({ from: "/dashboard" });
	const timeZone = planTimeZone(session.user.timezone);
	return {
		formatDate: (date: Date) =>
			date.toLocaleString(i18n.locale, {
				day: "numeric",
				month: "long",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				timeZone,
				timeZoneName: "short",
			}),
		formatDay: (date: Date) =>
			date.toLocaleDateString(i18n.locale, { day: "numeric", month: "short", year: "numeric", timeZone }),
		/** "3 Dec 2026, 08:10": for a column of times whose zone is named once, by `zoneName`. */
		formatShort: (date: Date) =>
			date.toLocaleString(i18n.locale, {
				day: "numeric",
				month: "short",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				timeZone,
			}),
		/** The zone a time is in, as the locale abbreviates it: "WIB", or "GMT+7" in English. */
		zoneName: (date: Date) =>
			new Intl.DateTimeFormat(i18n.locale, { timeZone, timeZoneName: "short" })
				.formatToParts(date)
				.find((part) => part.type === "timeZoneName")?.value ?? timeZone,
	};
}

/**
 * An amount in a currency's smallest unit, written the locale's way: "$4.99" and "$39" in English, "Rp59.000" in
 * Indonesian. Whole amounts drop the decimals; Rupiah never shows them.
 */
export function formatPrice(amount: number, currency: string) {
	const code = currency.toUpperCase();
	const value = toMajorUnits(amount, currency);
	const whole = Number.isInteger(value);
	return new Intl.NumberFormat(i18n.locale, {
		style: "currency",
		currency: code,
		minimumFractionDigits: code === "IDR" || whole ? 0 : 2,
		maximumFractionDigits: code === "IDR" ? 0 : 2,
	}).format(value);
}

/** A plan's price per renewal, formatted in the visitor's currency. */
export const priceLabel = (planId: PaidPlanId, interval: BillingInterval, currency: BillingCurrency) =>
	formatPrice(planPrice(planId, interval, currency), currency);

/** How much a year costs less than twelve months, as a whole percentage: 35 for "save 35%". */
export function yearlySaving(planId: PaidPlanId, currency: BillingCurrency) {
	const twelveMonths = planPrice(planId, "month", currency) * 12;
	return Math.round((1 - planPrice(planId, "year", currency) / twelveMonths) * 100);
}

/** A yearly price spread over its months, formatted: what a month costs when paid yearly. */
export function monthlyOfYearly(planId: PaidPlanId, currency: BillingCurrency) {
	// Whole cents, and whole Rupiah (a hundred of its smallest unit).
	const unit = currency === "idr" ? 100 : 1;
	return formatPrice(Math.round(planPrice(planId, "year", currency) / 12 / unit) * unit, currency);
}

/** A subscription that still bills or gives access, so a new checkout isn't the way to a plan: changing it is. */
export const isLiveSubscription = (subscription: Subscription | null | undefined): subscription is Subscription =>
	!!subscription && ["trialing", "active", "past_due", "paused"].includes(subscription.status);

/**
 * What choosing a plan and interval does from where the account stands: a first subscription, the plan it is on, a
 * change up (charged the difference now: a higher plan, or yearly) or down (from the next renewal).
 */
export type PurchaseKind = "subscribe" | "current" | "upgrade" | "downgrade";

export function getPurchaseKind(
	subscription: Subscription | null | undefined,
	target: { planId: PaidPlanId; interval: BillingInterval },
): PurchaseKind {
	if (!isLiveSubscription(subscription)) return "subscribe";
	if (subscription.planId === target.planId && subscription.interval === target.interval) return "current";
	const up =
		PLANS[target.planId].rank > PLANS[subscription.planId].rank ||
		(target.planId === subscription.planId && target.interval === "year");
	return up ? "upgrade" : "downgrade";
}

/** The button's words for a plan and interval, from where the account stands. */
export function getPurchaseLabel(
	kind: PurchaseKind,
	target: { planId: PaidPlanId; interval: BillingInterval },
	subscription?: Subscription | null,
) {
	const name = getPlanName(target.planId);
	if (kind === "current") return t`Your plan`;
	if (kind === "subscribe") return t`Get ${name}`;
	const samePlan = subscription?.planId === target.planId;
	if (samePlan) return target.interval === "year" ? t`Switch to yearly` : t`Switch to monthly`;
	return kind === "upgrade" ? t`Upgrade to ${name}` : t`Switch to ${name}`;
}

/** How often a plan renews, for a price: "/ month", "/ year". */
export const intervalSuffix = (interval: BillingInterval) => (interval === "year" ? t`/ year` : t`/ month`);

export function getPaymentStatusLabel(status: PaymentStatus) {
	switch (status) {
		case "creating":
			return t`Preparing`;
		case "pending":
			return t`Waiting for payment`;
		case "paid":
			return t`Paid`;
		case "failed":
			return t`Failed`;
		case "expired":
			return t`Expired`;
		case "cancelled":
			return t`Cancelled`;
		case "partially_refunded":
			return t`Partly refunded`;
		case "refunded":
			return t`Refunded`;
		case "reversed":
			return t`Reversed by the bank`;
	}
}

export function getPaymentStatusColor(status: PaymentStatus): "success" | "warning" | "danger" | "default" {
	if (status === "paid") return "success";
	if (status === "pending" || status === "creating") return "warning";
	if (status === "failed" || status === "reversed") return "danger";
	return "default";
}

/** What a payment was for, in a few words: a new subscription, a renewal, a plan change, or a 30-day pass. */
export function getPaymentReasonLabel(payment: Pick<Payment, "billingReason" | "interval">) {
	if (payment.interval === null) return t`30-day pass`;
	switch (payment.billingReason) {
		case "subscription_cycle":
			return t`Renewal`;
		case "subscription_update":
			return t`Plan change`;
		default:
			return t`New subscription`;
	}
}

/** Whether a payment has an invoice at Polar: an order that went through (refunded ones keep theirs). */
export const hasInvoice = (payment: Pick<Payment, "paidAt" | "orderId">) =>
	payment.paidAt !== null && payment.orderId !== null;

/** Where a payment stands for the page Polar sends the customer back to. */
export type ReturnState = "paid" | "waiting" | "closed" | "failed" | "expired" | "refunded";

export function getReturnState(payment: Pick<Payment, "status" | "expiresAt">, now = new Date()): ReturnState {
	switch (payment.status) {
		case "paid":
		case "partially_refunded":
			return "paid";
		case "creating":
		case "pending":
			// Still open on the server, but the checkout closed: a payment made at the last moment can still arrive.
			return payment.expiresAt && payment.expiresAt <= now ? "closed" : "waiting";
		case "failed":
		case "cancelled":
			return "failed";
		case "expired":
			return "expired";
		case "refunded":
		case "reversed":
			return "refunded";
	}
}

/** Whether the return page should keep asking: the payment may still change on its own. */
export const isOpenPayment = (payment: Pick<Payment, "status">) =>
	payment.status === "pending" || payment.status === "creating";
