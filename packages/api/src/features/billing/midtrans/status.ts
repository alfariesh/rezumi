import type { BillingPaymentStatus } from "@rezumi/db/schema";

/**
 * What a Midtrans status means for a payment, and which moves are allowed. Pure functions: the only door that applies
 * them is `applyVerifiedStatus` in ../fulfillment.ts. Statuses from Midtrans' transaction status cycle.
 */

/** A Midtrans status mapped to a local one, or a status to leave alone: one to review by hand, or one not known. */
export type MappedStatus =
	| { kind: "status"; status: Exclude<BillingPaymentStatus, "creating"> }
	| { kind: "review" }
	| { kind: "unknown" };

const to = (status: Exclude<BillingPaymentStatus, "creating">): MappedStatus => ({ kind: "status", status });

/**
 * `deny` and `failure` map to failed here; after a payment was paid, `nextPaymentStatus` makes that a reversal. A
 * card `capture` is paid only once fraud screening accepts it. `status_code` is the API result, never a decision.
 */
export function mapProviderStatus(transactionStatus: string, fraudStatus: string | null): MappedStatus {
	switch (transactionStatus) {
		case "pending":
		case "authorize":
			return to("pending");
		case "settlement":
			// Fraud screening rejected it after all: not money to act on without a look.
			return fraudStatus === "deny" ? { kind: "review" } : to("paid");
		case "capture":
			return fraudStatus === "accept" ? to("paid") : to("pending");
		case "deny":
		case "failure":
			return to("failed");
		case "cancel":
			return to("cancelled");
		case "expire":
			return to("expired");
		case "refund":
			return to("refunded");
		case "partial_refund":
			return to("partially_refunded");
		case "chargeback":
			return to("reversed");
		case "partial_chargeback":
			return { kind: "review" };
		default:
			return { kind: "unknown" };
	}
}

export type Transition = { status: BillingPaymentStatus; outcome: "applied" | "duplicate" | "stale" };

const PAID_STATES: readonly BillingPaymentStatus[] = ["paid", "partially_refunded"];
const UNPAID_OPEN: readonly BillingPaymentStatus[] = ["creating", "pending", "failed"];

/**
 * Where a payment goes from `current` when Midtrans verifiably says `next`:
 * - anything but a refund or reversal can become paid: a customer who paid at the last second gets the pass, and one
 *   Snap session can hold a failed attempt before a good one;
 * - paid never goes back to pending, failed, expired or cancelled (a late notification is stale), only on to a
 *   partial or full refund or a reversal, and `deny` after paid is a reversal (some bank transfers do that);
 * - refunded and reversed are final;
 * - an expired or cancelled payment doesn't reopen as pending or failed.
 */
export function nextPaymentStatus(current: BillingPaymentStatus, next: BillingPaymentStatus): Transition {
	const stay = (outcome: "duplicate" | "stale"): Transition => ({ status: current, outcome });
	const move = (status: BillingPaymentStatus): Transition => ({ status, outcome: "applied" });
	if (current === "refunded" || current === "reversed") return stay(current === next ? "duplicate" : "stale");
	if (PAID_STATES.includes(current)) {
		if (next === "failed") return move("reversed");
		if (next === "partially_refunded" || next === "refunded" || next === "reversed")
			return next === current ? stay("duplicate") : move(next);
		return stay(next === current ? "duplicate" : "stale");
	}
	if (next === current) return stay("duplicate");
	if (next === "paid" || next === "refunded" || next === "partially_refunded" || next === "reversed") return move(next);
	// Still open: pending, failed (another method may follow), cancelled or expired.
	if (UNPAID_OPEN.includes(current)) return move(next);
	// Expired or cancelled: only money (above) moves it on.
	return stay("stale");
}

/** `gross_amount` as whole Rupiah: "79000.00" and "79000" are 79000; anything with sen or not a number is null. */
export function parseGrossAmount(value: string | null | undefined): number | null {
	const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value?.trim() ?? "");
	if (!match?.[1] || (match[2] && Number(match[2]) !== 0)) return null;
	return Number(match[1]);
}

/** The Midtrans fields that are safe to keep: no signature, card data, customer details or tokens. */
const SAFE_FIELDS = [
	"order_id",
	"transaction_id",
	"transaction_status",
	"status_code",
	"status_message",
	"fraud_status",
	"payment_type",
	"gross_amount",
	"currency",
	"transaction_time",
	"settlement_time",
	"expiry_time",
	"issuer",
	"acquirer",
	"bank",
	"refund_amount",
] as const;

/** The allowlisted fields of a Midtrans payload, as short strings. Everything else is dropped. */
export function safeProviderFields(payload: Record<string, unknown>): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const key of SAFE_FIELDS) {
		const value = payload[key];
		if (typeof value === "string" || typeof value === "number") fields[key] = String(value).slice(0, 200);
	}
	// A virtual account names its bank inside a list; keep the bank names only, never the account numbers.
	const accounts = payload.va_numbers;
	if (Array.isArray(accounts)) {
		const banks = accounts
			.map((account: unknown) =>
				account && typeof account === "object" && "bank" in account && typeof account.bank === "string"
					? account.bank.slice(0, 40)
					: null,
			)
			.filter(Boolean);
		if (banks.length) fields.va_banks = banks.join(",");
	}
	return fields;
}
