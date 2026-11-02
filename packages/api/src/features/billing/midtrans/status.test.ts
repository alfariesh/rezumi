import type { BillingPaymentStatus } from "@rezumi/db/schema";
import { describe, expect, it } from "vite-plus/test";
import { mapProviderStatus, nextPaymentStatus, parseGrossAmount, safeProviderFields } from "./status";

describe("mapProviderStatus", () => {
	it.each([
		["pending", null, "pending"],
		["authorize", null, "pending"],
		["settlement", "accept", "paid"],
		["settlement", null, "paid"],
		["capture", "accept", "paid"],
		["capture", "challenge", "pending"],
		["deny", null, "failed"],
		["failure", null, "failed"],
		["cancel", null, "cancelled"],
		["expire", null, "expired"],
		["refund", null, "refunded"],
		["partial_refund", null, "partially_refunded"],
		["chargeback", null, "reversed"],
	])("maps %s (fraud %s) to %s", (transactionStatus, fraudStatus, status) => {
		expect(mapProviderStatus(transactionStatus, fraudStatus)).toEqual({ kind: "status", status });
	});

	it("leaves a partial chargeback and a settlement fraud screening denied for a person to look at", () => {
		expect(mapProviderStatus("partial_chargeback", null)).toEqual({ kind: "review" });
		expect(mapProviderStatus("settlement", "deny")).toEqual({ kind: "review" });
	});

	it("doesn't guess at a status it doesn't know", () => {
		expect(mapProviderStatus("something_new", null)).toEqual({ kind: "unknown" });
	});
});

describe("nextPaymentStatus", () => {
	const cases: [BillingPaymentStatus, BillingPaymentStatus, BillingPaymentStatus, string][] = [
		["creating", "pending", "pending", "applied"],
		["pending", "paid", "paid", "applied"],
		["pending", "failed", "failed", "applied"],
		// One Snap session can hold a failed attempt before a good one.
		["failed", "pending", "pending", "applied"],
		["failed", "paid", "paid", "applied"],
		// Paid at the last second still counts.
		["expired", "paid", "paid", "applied"],
		["cancelled", "paid", "paid", "applied"],
		["pending", "expired", "expired", "applied"],
		["pending", "cancelled", "cancelled", "applied"],
		// Paid never goes back.
		["paid", "pending", "paid", "stale"],
		["paid", "expired", "paid", "stale"],
		["paid", "cancelled", "paid", "stale"],
		["paid", "paid", "paid", "duplicate"],
		// deny after settlement is a reversal.
		["paid", "failed", "reversed", "applied"],
		["paid", "reversed", "reversed", "applied"],
		["paid", "refunded", "refunded", "applied"],
		["paid", "partially_refunded", "partially_refunded", "applied"],
		["partially_refunded", "refunded", "refunded", "applied"],
		["partially_refunded", "paid", "partially_refunded", "stale"],
		["partially_refunded", "partially_refunded", "partially_refunded", "duplicate"],
		// Final.
		["refunded", "paid", "refunded", "stale"],
		["reversed", "paid", "reversed", "stale"],
		["refunded", "refunded", "refunded", "duplicate"],
		// An expired or cancelled payment doesn't reopen.
		["expired", "pending", "expired", "stale"],
		["expired", "failed", "expired", "stale"],
		["cancelled", "expired", "cancelled", "stale"],
		["expired", "expired", "expired", "duplicate"],
	];
	it.each(cases)("%s + %s → %s (%s)", (current, next, status, outcome) => {
		expect(nextPaymentStatus(current, next)).toEqual({ status, outcome });
	});
});

describe("parseGrossAmount", () => {
	it.each([
		["79000.00", 79_000],
		["79000", 79_000],
		["79000.0", 79_000],
		[" 29000.00 ", 29_000],
	])("reads %j as %i Rupiah", (value, amount) => {
		expect(parseGrossAmount(value)).toBe(amount);
	});

	it.each(["79000.50", "-79000", "7.9e4", "", "Rp79.000", null, undefined])("refuses %j", (value) => {
		expect(parseGrossAmount(value)).toBeNull();
	});
});

describe("safeProviderFields", () => {
	it("keeps the allowlist and drops signatures, card data, customer details and VA numbers", () => {
		expect(
			safeProviderFields({
				order_id: "RZ-1",
				transaction_status: "settlement",
				gross_amount: "79000.00",
				signature_key: "secret",
				masked_card: "481111-1114",
				approval_code: "123",
				customer_details: { email: "sari@example.test" },
				va_numbers: [{ bank: "bni", va_number: "9881234567" }],
				token: "snap-token",
			}),
		).toEqual({ order_id: "RZ-1", transaction_status: "settlement", gross_amount: "79000.00", va_banks: "bni" });
	});
});
