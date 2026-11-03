import type { PlanSummary } from "./plan";
import type { RouterOutput } from "@/libs/orpc/client";
import type { PaidPlanId } from "@rezumi/schema/billing";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { useRouteContext } from "@tanstack/react-router";
import { BILLING_CURRENCY, PLANS } from "@rezumi/schema/billing";
import { getPlanName } from "./plan";

export type Payment = RouterOutput["billing"]["payments"]["items"][number];
export type PaymentDetail = RouterOutput["billing"]["payment"];
export type PurchasePreview = RouterOutput["billing"]["previewPurchase"];
export type PaymentStatus = Payment["status"];

/** The account's timezone; until one is chosen it reads UTC, and Rezumi sells in Indonesia, so dates show in WIB. */
export const planTimeZone = (timezone: string | null | undefined) =>
	timezone && timezone !== "UTC" ? timezone : "Asia/Jakarta";

/**
 * Dates for plans and payments, in the app's language and the account's timezone: "3 Desember 2026 pukul 08.10 WIB"
 * with the time, "3 Des 2026" without, "3 Des 2026, 08.10" in a column.
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
		/** "3 Des 2026, 08.10": for a column of times whose zone is named once, by `zoneName`. */
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

/** A price in whole Rupiah, written the locale's way: "Rp 79.000" in Indonesian, "IDR 79,000" in English. */
export const formatPrice = (amount: number) =>
	new Intl.NumberFormat(i18n.locale, {
		style: "currency",
		currency: BILLING_CURRENCY,
		maximumFractionDigits: 0,
	}).format(amount);

/** What buying a plan does from where the account stands: a first pass, more days, an upgrade or a queued pass. */
export type PurchaseKind = "buy" | "extend" | "upgrade" | "queue";

export function getPurchaseKind(current: PlanSummary["planId"], target: PaidPlanId): PurchaseKind {
	if (current === target) return "extend";
	if (current === "free") return "buy";
	return PLANS[target].rank > PLANS[current].rank ? "upgrade" : "queue";
}

/** The buy button's words for a plan, from where the account stands. */
export function getPurchaseLabel(kind: PurchaseKind, target: PaidPlanId) {
	const name = getPlanName(target);
	const days = PLANS[target].durationDays;
	if (kind === "extend") return t`Extend ${days} days`;
	if (kind === "upgrade") return t`Upgrade to ${name}`;
	return t`Buy ${name}`;
}

export type PlannedStretch = PurchasePreview["schedule"][number];

/**
 * What a purchase does to the account's paid time, as the server would lay it out if it were paid now: the new pass,
 * the stretch it waits behind (none when it starts once paid), and the time it pushes behind it (`after`) (the rest of a lower
 * plan, or passes already queued). Null without the new pass.
 */
export function splitPurchase(
	preview: PurchasePreview,
): { pass: PlannedStretch; waitsFor: PlannedStretch | null; after: PlannedStretch[] } | null {
	const index = preview.schedule.findIndex((stretch) => stretch.purchase);
	const pass = preview.schedule[index];
	if (!pass) return null;
	return { pass, waitsFor: preview.schedule[index - 1] ?? null, after: preview.schedule.slice(index + 1) };
}

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

/** The Midtrans method a payment used, by name; a dash until one is chosen. */
export function getPaymentMethodName(paymentType: string | null) {
	switch (paymentType) {
		case null:
			return "—";
		case "qris":
			return "QRIS";
		case "gopay":
			return "GoPay";
		case "shopeepay":
			return "ShopeePay";
		case "bank_transfer":
			return t`Virtual account`;
		case "echannel":
			return "Mandiri Bill";
		case "credit_card":
			return t`Card`;
		default:
			return paymentType;
	}
}

/** Whether a payment ever went through, so it has a receipt (refunded ones keep theirs). */
export const hasReceipt = (payment: Pick<Payment, "paidAt">) => payment.paidAt !== null;

/** Where a payment stands for the page Midtrans sends the customer back to. */
export type ReturnState = "paid" | "waiting" | "closed" | "failed" | "expired" | "refunded";

export function getReturnState(payment: Pick<Payment, "status" | "expiresAt">, now = new Date()): ReturnState {
	switch (payment.status) {
		case "paid":
		case "partially_refunded":
			return "paid";
		case "creating":
		case "pending":
			// Still open on the server, but the time to pay is over: a payment made at the last moment can still arrive.
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

const ORDER_ID = /^RZ-([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i;

/** The payment behind a Midtrans order number (`RZ-<payment id>`), for return links that carry only `order_id`. */
export function paymentIdFromOrderId(orderId: unknown): string | null {
	if (typeof orderId !== "string") return null;
	return ORDER_ID.exec(orderId.trim())?.[1]?.toLowerCase() ?? null;
}
