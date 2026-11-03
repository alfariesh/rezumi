import type { RouterOutput } from "@/libs/orpc/client";
import { t } from "@lingui/core/macro";

export type AdminCustomer = RouterOutput["billing"]["admin"]["customer"];
export type AdminPayment = AdminCustomer["payments"][number];
export type AdminMetrics = RouterOutput["billing"]["admin"]["metrics"];
export type AdminPaymentRow = RouterOutput["billing"]["admin"]["payments"]["items"][number];

/** What each alert kind means, in a line. Unknown kinds show their code. */
export function getAlertLabel(kind: string) {
	switch (kind) {
		case "amount_mismatch":
			return t`Amount doesn't match the order`;
		case "paid_not_applied":
			return t`Paid at Midtrans, not active here`;
		case "payment_reversed":
			return t`Payment reversed by the bank`;
		case "needs_review":
			return t`Status needs a look by hand`;
		case "rejected_signatures":
			return t`Notifications with a bad signature`;
		case "midtrans_errors":
			return t`Midtrans API kept failing`;
		case "receipt_failed":
			return t`Receipt email not delivered`;
		case "refund_failed":
			return t`Refund not confirmed`;
		default:
			return kind;
	}
}

/**
 * How long Midtrans takes a refund for each method, and its limits (Midtrans docs, checked 2026-11-03). Shown before
 * the admin refunds, since a refusal comes only after asking.
 */
export function getRefundWindow(paymentType: string | null) {
	switch (paymentType) {
		case "qris":
			return t`QRIS: up to 45 days when paid with the acquirer's own app (GoPay), about 7 days from other apps.`;
		case "gopay":
			return t`GoPay: up to 45 days after settlement.`;
		case "shopeepay":
			return t`ShopeePay: full refunds only, between 06.00 and 23.50 WIB.`;
		case "dana":
			return t`DANA: up to 45 days after settlement.`;
		case "ovo":
			return t`OVO: full refunds only, within 7 days.`;
		case "credit_card":
			return t`Card: up to 6 months after the payment.`;
		default:
			return t`Midtrans can't refund this method: transfer the money to the customer yourself, then record it here.`;
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

/** US dollars from millionths, for AI costs: "$0.0123". */
export const formatUsdMicros = (micros: number | null) =>
	micros === null ? "—" : `$${(micros / 1_000_000).toFixed(micros < 10_000 ? 4 : 2)}`;

type HistoryTone = "success" | "warning" | "danger" | "default" | "muted";

/** A Midtrans event in words: what Midtrans said and what Rezumi did with it. */
export function describeEvent(event: AdminCustomer["events"][number]): { title: string; tone: HistoryTone } {
	const said = event.transactionStatus ?? "—";
	switch (event.outcome) {
		case "applied":
			return event.transactionStatus === "settlement" || event.transactionStatus === "capture"
				? { title: t`Midtrans: paid`, tone: "success" }
				: event.transactionStatus === "refund" || event.transactionStatus === "partial_refund"
					? { title: t`Midtrans: refunded`, tone: "warning" }
					: { title: t`Midtrans: ${said}`, tone: "default" };
		case "duplicate":
			return { title: t`Midtrans: ${said} (already handled)`, tone: "muted" };
		case "stale":
			return { title: t`Midtrans: late ${said}, ignored`, tone: "muted" };
		case "rejected_signature":
			return { title: t`Notification with a bad signature, rejected`, tone: "danger" };
		case "amount_mismatch":
			return { title: t`Midtrans amount doesn't match`, tone: "danger" };
		case "error":
			return { title: t`Midtrans status needs a look: ${said}`, tone: "danger" };
		default:
			return { title: t`Midtrans: ${said}`, tone: "default" };
	}
}

/** An audit entry in words. Unknown actions show their code. */
export function describeAudit(action: string): { title: string; tone: HistoryTone } {
	switch (action) {
		case "payment.fulfilled":
			return { title: t`Pass and credits granted`, tone: "success" };
		case "payment.benefits_revoked":
			return { title: t`Pass and credits taken back`, tone: "warning" };
		case "payment.refund_recorded":
			return { title: t`Refund recorded`, tone: "warning" };
		case "payment.synced":
			return { title: t`Status checked with Midtrans`, tone: "muted" };
		case "refund.requested":
			return { title: t`Refund asked of Midtrans`, tone: "warning" };
		case "refund.failed":
			return { title: t`Refund refused by Midtrans`, tone: "danger" };
		case "receipt.resent":
			return { title: t`Receipt sent again`, tone: "muted" };
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
