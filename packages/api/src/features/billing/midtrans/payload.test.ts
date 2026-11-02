import { describe, expect, it } from "vite-plus/test";
import {
	buildSnapPayload,
	formatJakartaTime,
	paymentIdFromOrderId,
	providerOrderIdFor,
	returnUrlFor,
	windowEnd,
	windowStart,
} from "./payload";

const paymentId = "0197f326-973a-743c-b0a9-77cfc3c95d53";

const build = (overrides: Partial<Parameters<typeof buildSnapPayload>[0]> = {}) =>
	buildSnapPayload({
		paymentId,
		planId: "pro-ai",
		amount: 79_000,
		customer: { name: "Sari Wulandari", email: "sari@example.test" },
		enabledPayments: ["other_qris"],
		appUrl: "https://rezumi.app",
		start: new Date("2026-11-02T07:00:00.000Z"),
		...overrides,
	});

describe("Midtrans order IDs", () => {
	it("prefixes the UUIDv7 and stays within Snap's 50 allowed characters", () => {
		const orderId = providerOrderIdFor(paymentId);
		expect(orderId).toBe(`RZ-${paymentId}`);
		expect(orderId).toHaveLength(39);
		expect(orderId).toMatch(/^[\w.~-]{1,50}$/);
	});

	it("refuses an ID that would break the order ID rules", () => {
		expect(() => providerOrderIdFor("has spaces")).toThrow();
		expect(() => providerOrderIdFor("x".repeat(48))).toThrow();
	});

	it("reads the payment back out of Rezumi's own orders only", () => {
		expect(paymentIdFromOrderId(`RZ-${paymentId}`)).toBe(paymentId);
		expect(paymentIdFromOrderId("ORDER-sandbox-0001")).toBeNull();
		expect(paymentIdFromOrderId(`RZ-${paymentId}-x`)).toBeNull();
	});
});

describe("buildSnapPayload", () => {
	it("matches the documented request for a Pro AI pass", () => {
		const returnUrl = `https://rezumi.app/dashboard/settings/billing/return/${paymentId}/`;
		expect(build({ enabledPayments: ["other_qris", "gopay", "shopeepay"] })).toEqual({
			transaction_details: { order_id: `RZ-${paymentId}`, gross_amount: 79_000 },
			item_details: [{ id: "pro-ai", name: "Rezumi Pro AI - akses 30 hari", price: 79_000, quantity: 1 }],
			customer_details: { first_name: "Sari Wulandari", email: "sari@example.test" },
			enabled_payments: ["other_qris", "gopay", "shopeepay"],
			expiry: { start_time: "2026-11-02 14:00:00 +0700", unit: "hour", duration: 24 },
			callbacks: { finish: returnUrl },
			gopay: { enable_callback: true, callback_url: returnUrl },
			shopeepay: { callback_url: returnUrl },
			custom_field1: "pro-ai",
		});
	});

	it("keeps the item total equal to gross_amount and every name within 50 characters", () => {
		for (const [planId, amount] of [
			["plus", 29_000],
			["pro-ai", 79_000],
		] as const) {
			const payload = build({ planId, amount });
			const [item] = payload.item_details;
			expect(item.price * item.quantity).toBe(payload.transaction_details.gross_amount);
			expect(Number.isInteger(payload.transaction_details.gross_amount)).toBe(true);
			expect(item.name.length).toBeLessThanOrEqual(50);
		}
	});

	it("sends the e-wallet callbacks only with their wallet enabled, as Snap refuses them otherwise", () => {
		const qrisOnly = build();
		expect(qrisOnly).not.toHaveProperty("gopay");
		expect(qrisOnly).not.toHaveProperty("shopeepay");
		expect(build({ enabledPayments: ["gopay"] })).toHaveProperty("gopay.callback_url");
		expect(build({ enabledPayments: ["gopay"] })).not.toHaveProperty("shopeepay");
	});

	it("never sends a phone number or address", () => {
		const customer = build().customer_details as Record<string, unknown>;
		expect(Object.keys(customer).toSorted()).toEqual(["email", "first_name"]);
	});

	it("sends the configured methods as they are", () => {
		expect(build({ enabledPayments: ["other_qris", "gopay", "bni_va"] }).enabled_payments).toEqual([
			"other_qris",
			"gopay",
			"bni_va",
		]);
	});

	it("falls back to the email's name when the account has none", () => {
		expect(build({ customer: { name: "  ", email: "sari@example.test" } }).customer_details.first_name).toBe("sari");
	});

	it.each([0, -1, 79_000.5])("refuses the amount %s", (amount) => {
		expect(() => build({ amount })).toThrow();
	});

	it("refuses an empty method list", () => {
		expect(() => build({ enabledPayments: [] })).toThrow();
	});
});

describe("payment window", () => {
	it("starts on a whole second and lasts 24 hours", () => {
		const start = windowStart(new Date("2026-11-02T07:00:00.987Z"));
		expect(start.toISOString()).toBe("2026-11-02T07:00:00.000Z");
		expect(windowEnd(start).toISOString()).toBe("2026-11-03T07:00:00.000Z");
	});

	it("writes the expiry start in Western Indonesian Time across a date change", () => {
		expect(formatJakartaTime(new Date("2026-12-31T17:30:05Z"))).toBe("2027-01-01 00:30:05 +0700");
	});

	it("puts the payment in the return path, with the trailing slash Midtrans asks for", () => {
		expect(returnUrlFor("http://localhost:3000", paymentId)).toBe(
			`http://localhost:3000/dashboard/settings/billing/return/${paymentId}/`,
		);
	});
});
