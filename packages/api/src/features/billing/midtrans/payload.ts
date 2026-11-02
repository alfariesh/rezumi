import type { MidtransPaymentCode } from "./config";
import type { PaidPlanId } from "@rezumi/schema/billing";

/** How long a checkout can be paid, from the moment its Snap page is created. Covers the page and every method. */
export const PAYMENT_WINDOW_HOURS = 24;

/** The Snap request for one pass. Field names and limits from Midtrans' JSON objects reference. */
export type SnapTransactionPayload = {
	transaction_details: { order_id: string; gross_amount: number };
	item_details: [{ id: PaidPlanId; name: string; price: number; quantity: 1 }];
	customer_details: { first_name: string; email: string };
	enabled_payments: MidtransPaymentCode[];
	expiry: { start_time: string; unit: "hour"; duration: number };
	callbacks: { finish: string };
	/** Only with GoPay enabled: Snap refuses a GoPay callback for a transaction that can't use GoPay. */
	gopay?: { enable_callback: true; callback_url: string };
	/** Only with ShopeePay enabled, likewise. */
	shopeepay?: { callback_url: string };
	custom_field1: PaidPlanId;
};

const ORDER_ID_PATTERN = /^[\w.~-]{1,50}$/;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const ITEM_NAMES: Record<PaidPlanId, string> = {
	plus: "Rezumi Plus - akses 30 hari",
	"pro-ai": "Rezumi Pro AI - akses 30 hari",
};

/** Midtrans `order_id` for a payment: RZ- and its UUIDv7, 39 characters. */
export function providerOrderIdFor(paymentId: string) {
	const orderId = `RZ-${paymentId}`;
	if (!ORDER_ID_PATTERN.test(orderId)) throw new Error("The payment ID does not make a valid Midtrans order ID.");
	return orderId;
}

/** The payment ID inside a Midtrans `order_id` of Rezumi's, or null for anyone else's order. */
export function paymentIdFromOrderId(orderId: string): string | null {
	const match = /^RZ-([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i.exec(orderId);
	return match?.[1] ?? null;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `yyyy-MM-dd HH:mm:ss +0700`, the expiry start Midtrans expects, in Western Indonesian Time. */
export function formatJakartaTime(at: Date) {
	const local = new Date(+at + JAKARTA_OFFSET_MS);
	return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())} +0700`;
}

/** The start of a payment window: whole seconds, since that is what the expiry start can say. */
export const windowStart = (now: Date) => new Date(Math.floor(+now / 1000) * 1000);

/** When a payment window that starts at `start` closes. */
export const windowEnd = (start: Date) => new Date(+start + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);

/** Where Midtrans sends the browser back. The ID sits in the path, so the query Midtrans adds can't break it. */
export function returnUrlFor(appUrl: string, paymentId: string) {
	return new URL(`/dashboard/settings/billing/return/${encodeURIComponent(paymentId)}/`, appUrl).toString();
}

/**
 * The Snap request for a payment. An explicit `start_time` makes the 24 hours count from now for the page and every
 * method; without it a pending method would start counting only once chosen. The phone number is never sent.
 */
export function buildSnapPayload(input: {
	paymentId: string;
	planId: PaidPlanId;
	amount: number;
	customer: { name: string; email: string };
	enabledPayments: readonly MidtransPaymentCode[];
	appUrl: string;
	start: Date;
}): SnapTransactionPayload {
	if (!Number.isInteger(input.amount) || input.amount <= 0)
		throw new Error("A Midtrans payment needs a positive whole Rupiah amount.");
	if (!input.enabledPayments.length) throw new Error("A Midtrans payment needs at least one payment method.");
	const returnUrl = returnUrlFor(input.appUrl, input.paymentId);
	const name = input.customer.name.trim().slice(0, 255) || input.customer.email.split("@")[0] || "Rezumi";
	return {
		transaction_details: { order_id: providerOrderIdFor(input.paymentId), gross_amount: input.amount },
		item_details: [{ id: input.planId, name: ITEM_NAMES[input.planId].slice(0, 50), price: input.amount, quantity: 1 }],
		customer_details: { first_name: name, email: input.customer.email },
		enabled_payments: [...input.enabledPayments],
		expiry: { start_time: formatJakartaTime(input.start), unit: "hour", duration: PAYMENT_WINDOW_HOURS },
		callbacks: { finish: returnUrl },
		...(input.enabledPayments.includes("gopay") && { gopay: { enable_callback: true, callback_url: returnUrl } }),
		...(input.enabledPayments.includes("shopeepay") && { shopeepay: { callback_url: returnUrl } }),
		custom_field1: input.planId,
	};
}
