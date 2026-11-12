import type { SumopodPayment } from "./client";
import type { BillingPaymentStatus } from "@rezumi/db/schema";
import z from "zod";
import { sumopodPaymentSchema } from "./client";

/**
 * Pure translations between Sumopod's payments and Rezumi's billing rows: order numbers, statuses, amounts and the safe
 * fields kept for support. No database, no network.
 */

/** Rezumi's order number at Sumopod for a payment row: `RZ-<payment id>`, the same number receipts show. */
export const orderIdFor = (paymentId: string) => `RZ-${paymentId}`;

/** The payment row an order number names, or null for an order Rezumi didn't make. */
export function paymentIdFromOrder(orderId: string | null | undefined): string | null {
	const match = /^RZ-([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i.exec(orderId?.trim() ?? "");
	return match?.[1]?.toLowerCase() ?? null;
}

/** Rupiah in the catalog's smallest unit (two decimals) as the whole Rupiah Sumopod takes: 2_900_000 → 29_000. */
export const toWholeRupiah = (amount: number) => Math.round(amount / 100);

/** Whole Rupiah from Sumopod in the catalog's smallest unit: 29_000 → 2_900_000. */
export const fromWholeRupiah = (rupiah: number) => Math.round(rupiah * 100);

/** Where a Sumopod payment stands, as Rezumi's payment status; null for a status Rezumi doesn't know. */
export function paymentStatusOf(status: string): BillingPaymentStatus | null {
	switch (status.trim().toLowerCase()) {
		case "completed":
		case "paid":
		case "success":
		case "succeeded":
		case "settled":
			return "paid";
		case "failed":
			return "failed";
		case "expired":
			return "expired";
		case "cancelled":
		case "canceled":
			return "cancelled";
		case "pending":
		case "unpaid":
		case "waiting":
		case "created":
			return "pending";
		default:
			return null;
	}
}

/** The webhook events Sumopod sends. `payment.test` comes from the Settings page's "Save & Test". */
export const SUMOPOD_PAYMENT_EVENTS = ["payment.completed", "payment.failed", "payment.expired"] as const;

/** A webhook delivery's body: the event and the payment it is about. */
export const sumopodWebhookSchema = z.object({
	event_type: z.string().min(1),
	data: z.unknown(),
});

/** The payment a webhook's `data` describes, or null when it isn't one (a test event, say). */
export function webhookPayment(data: unknown): SumopodPayment | null {
	const parsed = sumopodPaymentSchema.safeParse(data);
	return parsed.success ? parsed.data : null;
}

/** The fields of a Sumopod payment kept with an event, for support: ids, amounts, status and times. */
export function safePaymentFields(payment: Partial<SumopodPayment>): Record<string, unknown> {
	const allowed = [
		"payment_id",
		"order_id",
		"amount",
		"fee",
		"net_amount",
		"status",
		"payment_method",
		"expires_at",
		"paid_at",
		"settled_at",
	] as const;
	const fields: Record<string, unknown> = {};
	for (const key of allowed) {
		const value = payment[key];
		if (value !== undefined && value !== null) fields[key] = value;
	}
	return fields;
}
