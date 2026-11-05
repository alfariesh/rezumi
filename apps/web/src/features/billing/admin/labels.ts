import type { RouterOutput } from "@/libs/orpc/client";
import { t } from "@lingui/core/macro";
import { formatPrice } from "../purchase";

export type AdminCustomer = RouterOutput["billing"]["admin"]["customer"];
export type AdminPayment = AdminCustomer["payments"][number];
export type AdminMetrics = RouterOutput["billing"]["admin"]["metrics"];
export type AdminPaymentRow = RouterOutput["billing"]["admin"]["payments"]["items"][number];

export type AdminSubscription = AdminCustomer["subscriptions"][number];

/** What each alert kind means, in a line. Unknown kinds show their code. */
export function getAlertLabel(kind: string) {
	switch (kind) {
		case "paid_not_applied":
			return t`Paid at Polar, not active here`;
		case "payment_reversed":
			return t`Refunded by Polar to prevent a dispute`;
		case "needs_review":
			return t`Event needs a look by hand`;
		case "rejected_signatures":
			return t`Webhooks with a bad signature`;
		case "provider_errors":
			return t`Polar API kept failing`;
		case "refund_failed":
			return t`Refund not confirmed`;
		// Kinds from before Polar, still in old alert rows.
		case "amount_mismatch":
			return t`Amount doesn't match the order`;
		case "midtrans_errors":
			return t`Midtrans API kept failing`;
		case "receipt_failed":
			return t`Receipt email not delivered`;
		default:
			return kind;
	}
}

/** A Polar subscription status in words. */
export function getSubscriptionStatusLabel(subscription: Pick<AdminSubscription, "status" | "cancelAtPeriodEnd">) {
	switch (subscription.status) {
		case "active":
			return subscription.cancelAtPeriodEnd ? t`Active, ends at period end` : t`Active`;
		case "trialing":
			return t`Trial`;
		case "past_due":
			return t`Payment failed`;
		case "paused":
			return t`Paused`;
		case "canceled":
			return t`Ended`;
		case "unpaid":
			return t`Ended, unpaid`;
		case "incomplete":
		case "incomplete_expired":
			return t`Never paid`;
	}
}

/** A period the overview's numbers cover, in Western Indonesian Time, where the books are kept. */
export type ReportPreset = "7d" | "30d" | "90d" | "month" | "last-month";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** [from, to) for a preset at `now`: days start at midnight WIB, months on the 1st. */
export function reportRange(preset: ReportPreset, now = new Date()) {
	const wib = new Date(+now + WIB_OFFSET_MS);
	const midnight = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day) - WIB_OFFSET_MS);
	const [year, month, day] = [wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()];
	const today = midnight(year, month, day);
	const tomorrow = new Date(+today + DAY_MS);
	switch (preset) {
		case "7d":
			return { from: new Date(+tomorrow - 7 * DAY_MS), to: tomorrow };
		case "30d":
			return { from: new Date(+tomorrow - 30 * DAY_MS), to: tomorrow };
		case "90d":
			return { from: new Date(+tomorrow - 90 * DAY_MS), to: tomorrow };
		case "month":
			return { from: midnight(year, month, 1), to: midnight(year, month + 1, 1) };
		case "last-month":
			return { from: midnight(year, month - 1, 1), to: midnight(year, month, 1) };
	}
}

/**
 * Money in several currencies, never added together: "$12.47 · IDR 177,000". A dash when there is none. Amounts are in
 * each currency's smallest unit.
 */
export function formatMoney(money: Record<string, number>) {
	const parts = Object.entries(money)
		.filter(([, amount]) => amount !== 0)
		.toSorted(([a], [b]) => (a === "usd" ? -1 : b === "usd" ? 1 : a.localeCompare(b)))
		.map(([currency, amount]) => formatPrice(amount, currency));
	return parts.length ? parts.join(" · ") : "—";
}

/** US dollars from millionths, for AI costs: "$0.0123". */
export const formatUsdMicros = (micros: number | null) =>
	micros === null ? "—" : `$${(micros / 1_000_000).toFixed(micros < 10_000 ? 4 : 2)}`;

type HistoryTone = "success" | "warning" | "danger" | "default" | "muted";

/** A Polar event in words: what Polar reported and what Rezumi did with it. */
export function describeEvent(event: AdminCustomer["events"][number]): { title: string; tone: HistoryTone } {
	const type = event.eventType;
	switch (event.outcome) {
		case "applied":
			return type === "order.paid"
				? { title: t`Polar: order paid`, tone: "success" }
				: type === "order.refunded" || type.startsWith("refund.")
					? { title: t`Polar: refund`, tone: "warning" }
					: { title: t`Polar: ${type}`, tone: "default" };
		case "duplicate":
			return { title: t`Polar: ${type} (already handled)`, tone: "muted" };
		case "stale":
			return { title: t`Polar: older ${type}, ignored`, tone: "muted" };
		case "ignored":
		case "unknown_product":
		case "unknown_customer":
			return { title: t`Polar: ${type}, not for this payment`, tone: "muted" };
		case "error":
			return { title: t`Polar event needs a look: ${type}`, tone: "danger" };
		default:
			return { title: t`Polar: ${type}`, tone: "default" };
	}
}

/** An audit entry in words. Unknown actions show their code. */
export function describeAudit(action: string): { title: string; tone: HistoryTone } {
	switch (action) {
		case "payment.fulfilled":
			return { title: t`Payment applied (credits granted)`, tone: "success" };
		case "payment.benefits_revoked":
			return { title: t`Credits taken back`, tone: "warning" };
		case "payment.refund_recorded":
			return { title: t`Refund recorded`, tone: "warning" };
		case "payment.synced":
			return { title: t`Status checked with Polar`, tone: "muted" };
		case "refund.requested":
			return { title: t`Refund asked of Polar`, tone: "warning" };
		case "refund.failed":
			return { title: t`Refund refused by Polar`, tone: "danger" };
		case "subscription.changed":
			return { title: t`Subscription changed`, tone: "default" };
		case "subscription.revoked":
			return { title: t`Subscription ended by an admin`, tone: "danger" };
		case "period.granted":
			return { title: t`Pass given by an admin`, tone: "success" };
		case "period.revoked":
			return { title: t`Pass revoked by an admin`, tone: "danger" };
		case "credits.adjusted":
			return { title: t`Credits adjusted`, tone: "default" };
		default:
			return { title: action, tone: "default" };
	}
}
