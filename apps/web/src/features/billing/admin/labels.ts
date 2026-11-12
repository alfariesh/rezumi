import type { RouterOutput } from "@/libs/orpc/client";
import { t } from "@lingui/core/macro";
import { planIdSchema } from "@rezumi/schema/billing";
import { getPlanName } from "../plan";
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
			return t`Paid, not active here`;
		case "payment_reversed":
			return t`Card dispute`;
		case "needs_review":
			return t`Event needs a look by hand`;
		case "rejected_signatures":
			return t`Webhooks with a bad signature`;
		case "provider_errors":
			return t`Payment provider API kept failing`;
		case "refund_failed":
			return t`Refund not confirmed`;
		// Kinds from before Dodo Payments, still in old alert rows.
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

/** A subscription status in words. */
export function getSubscriptionStatusLabel(subscription: Pick<AdminSubscription, "status" | "cancelAtPeriodEnd">) {
	switch (subscription.status) {
		case "active":
			return subscription.cancelAtPeriodEnd ? t`Active, ends at period end` : t`Active`;
		case "trialing":
			return t`Trial`;
		case "past_due":
		case "on_hold":
			return t`Payment failed`;
		case "paused":
			return t`Paused`;
		case "cancelled":
			return subscription.cancelAtPeriodEnd ? t`Active, ends at period end` : t`Ended`;
		case "expired":
			return t`Ended`;
		case "pending":
		case "failed":
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

/**
 * A payment provider event in words: what Dodo Payments or Sumopod (or Polar, on older rows) reported and what Rezumi
 * did.
 */
export function describeEvent(event: AdminCustomer["events"][number]): { title: string; tone: HistoryTone } {
	const type = event.eventType;
	switch (event.outcome) {
		case "applied":
			return type === "payment.succeeded" || type === "payment.completed" || type === "order.paid"
				? { title: t`Provider: payment received`, tone: "success" }
				: type.startsWith("refund.") || type === "order.refunded"
					? { title: t`Provider: refund`, tone: "warning" }
					: type.startsWith("dispute.")
						? { title: t`Provider: card dispute`, tone: "danger" }
						: { title: t`Provider: ${type}`, tone: "default" };
		case "duplicate":
			return { title: t`Provider: ${type} (already handled)`, tone: "muted" };
		case "stale":
			return { title: t`Provider: older ${type}, ignored`, tone: "muted" };
		case "ignored":
		case "unknown_product":
		case "unknown_customer":
			return { title: t`Provider: ${type}, not for this payment`, tone: "muted" };
		case "error":
			return { title: t`Provider event needs a look: ${type}`, tone: "danger" };
		default:
			return { title: t`Provider: ${type}`, tone: "default" };
	}
}

type SubscriptionSnapshot = {
	status?: AdminSubscription["status"];
	planId?: string;
	interval?: string;
	cancelAtPeriodEnd?: boolean;
};

const asRecord = (value: unknown) =>
	value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

/** What a subscription change was, from its audit details. Older entries hold less and may read as a plain change. */
function describeSubscriptionChange(details: unknown) {
	const record = asRecord(details);
	const from = asRecord(record?.from) as SubscriptionSnapshot | undefined;
	const to = asRecord(record?.to) as SubscriptionSnapshot | undefined;
	if (!to) return t`Subscription changed`;
	if (!from) return t`Subscription started`;
	if (to.status && to.status !== from.status) {
		const status = getSubscriptionStatusLabel({ status: to.status, cancelAtPeriodEnd: to.cancelAtPeriodEnd ?? false });
		return t`Subscription now: ${status}`;
	}
	if (from.cancelAtPeriodEnd === false && to.cancelAtPeriodEnd === true) return t`Set to end at the period end`;
	if (from.cancelAtPeriodEnd === true && to.cancelAtPeriodEnd === false) return t`Cancellation undone`;
	const planId = planIdSchema.safeParse(to.planId);
	const intervalChanged = from.interval !== undefined && from.interval !== to.interval;
	if (planId.success && (from.planId !== to.planId || intervalChanged)) {
		const plan = getPlanName(planId.data);
		return to.interval === "year" ? t`Plan changed to ${plan}, yearly` : t`Plan changed to ${plan}, monthly`;
	}
	if (record?.pendingPlanChange === true) return t`Plan change set for the renewal`;
	return t`Subscription changed`;
}

/** An audit entry in words. Unknown actions show their code. */
export function describeAudit(entry: { action: string; details?: unknown }): { title: string; tone: HistoryTone } {
	switch (entry.action) {
		case "payment.fulfilled":
			return { title: t`Payment applied`, tone: "success" };
		case "payment.benefits_revoked":
			return { title: t`Credits taken back`, tone: "warning" };
		case "payment.refund_recorded":
			return { title: t`Refund recorded`, tone: "warning" };
		case "payment.synced":
			return { title: t`Status checked with the provider`, tone: "muted" };
		case "refund.requested":
			return { title: t`Refund requested`, tone: "warning" };
		case "refund.failed":
			return { title: t`Refund refused`, tone: "danger" };
		case "refund.recorded":
			return { title: t`QRIS refund recorded by an admin`, tone: "warning" };
		case "subscription.changed":
			return { title: describeSubscriptionChange(entry.details), tone: "default" };
		case "subscription.revoked":
			return { title: t`Subscription ended by an admin`, tone: "danger" };
		case "payment.dispute":
			return { title: t`Card dispute`, tone: "danger" };
		case "subscription.change_requested":
			return { title: t`Upgrade requested`, tone: "muted" };
		case "period.granted":
			return { title: t`Pass given by an admin`, tone: "success" };
		case "period.revoked":
			return { title: t`Pass revoked by an admin`, tone: "danger" };
		case "credits.adjusted":
			return { title: t`Credits adjusted`, tone: "default" };
		default:
			return { title: entry.action, tone: "default" };
	}
}
