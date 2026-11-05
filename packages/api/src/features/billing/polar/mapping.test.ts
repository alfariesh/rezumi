import type { SubscriptionState } from "./mapping";
import { describe, expect, it } from "vite-plus/test";
import {
	addMonths,
	checkoutPaymentStatus,
	creditMonth,
	nextPaymentStatus,
	orderPaymentStatus,
	orderPeriod,
	providerModifiedAt,
	RENEWAL_GRACE_MS,
	safeObjectFields,
	subscriptionAccess,
} from "./mapping";

const at = (iso: string) => new Date(iso);

describe("payment statuses", () => {
	it("maps Polar's order and checkout statuses", () => {
		expect(orderPaymentStatus("draft")).toBe("pending");
		expect(orderPaymentStatus("pending")).toBe("pending");
		expect(orderPaymentStatus("paid")).toBe("paid");
		expect(orderPaymentStatus("partially_refunded")).toBe("partially_refunded");
		expect(orderPaymentStatus("refunded")).toBe("refunded");
		expect(orderPaymentStatus("void")).toBe("cancelled");
		expect(checkoutPaymentStatus("open")).toBe("pending");
		expect(checkoutPaymentStatus("confirmed")).toBe("pending");
		expect(checkoutPaymentStatus("succeeded")).toBe("pending");
		expect(checkoutPaymentStatus("expired")).toBe("expired");
		expect(checkoutPaymentStatus("failed")).toBe("failed");
	});

	it("lets anything become paid, never paid go back, and ends at a full refund", () => {
		expect(nextPaymentStatus("pending", "paid")).toEqual({ outcome: "applied", status: "paid" });
		expect(nextPaymentStatus("expired", "paid")).toEqual({ outcome: "applied", status: "paid" });
		expect(nextPaymentStatus("failed", "paid")).toEqual({ outcome: "applied", status: "paid" });
		expect(nextPaymentStatus("paid", "paid")).toEqual({ outcome: "duplicate", status: "paid" });
		expect(nextPaymentStatus("paid", "pending")).toEqual({ outcome: "stale", status: "paid" });
		expect(nextPaymentStatus("paid", "expired")).toEqual({ outcome: "stale", status: "paid" });
		expect(nextPaymentStatus("paid", "partially_refunded").outcome).toBe("applied");
		expect(nextPaymentStatus("partially_refunded", "paid").outcome).toBe("stale");
		expect(nextPaymentStatus("partially_refunded", "refunded").outcome).toBe("applied");
		expect(nextPaymentStatus("refunded", "paid").outcome).toBe("stale");
		expect(nextPaymentStatus("refunded", "partially_refunded").outcome).toBe("stale");
		expect(nextPaymentStatus("pending", "expired").outcome).toBe("applied");
	});
});

describe("orders and objects", () => {
	it("reads the period an order pays for from its items", () => {
		expect(orderPeriod({ items: [] })).toEqual({ start: null, end: null });
		expect(
			orderPeriod({
				items: [
					{ start_timestamp: "2026-11-05T10:00:00Z", end_timestamp: "2026-12-05T10:00:00Z" },
					{ start_timestamp: "2026-11-20T00:00:00Z", end_timestamp: "2026-12-05T10:00:00Z" },
				],
			}),
		).toEqual({ start: at("2026-11-05T10:00:00Z"), end: at("2026-12-05T10:00:00Z") });
	});

	it("orders states by Polar's modification time, falling back to creation", () => {
		expect(providerModifiedAt({ created_at: "2026-11-01T00:00:00Z", modified_at: "2026-11-02T00:00:00Z" })).toEqual(
			at("2026-11-02T00:00:00Z"),
		);
		expect(providerModifiedAt({ created_at: "2026-11-01T00:00:00Z", modified_at: null })).toEqual(
			at("2026-11-01T00:00:00Z"),
		);
	});

	it("keeps only safe fields of a Polar object", () => {
		expect(
			safeObjectFields({
				id: "o",
				status: "paid",
				net_amount: 499,
				currency: "usd",
				customer: { email: "someone@example.test" },
				billing_name: "Someone",
				billing_address: { line1: "Street" },
			}),
		).toEqual({ id: "o", status: "paid", net_amount: 499, currency: "usd" });
	});
});

describe("subscription access", () => {
	const now = at("2026-11-05T12:00:00Z");
	const base: SubscriptionState = {
		planId: "pro-ai",
		interval: "month",
		status: "active",
		currentPeriodStart: at("2026-10-20T00:00:00Z"),
		currentPeriodEnd: at("2026-11-20T00:00:00Z"),
		paidThrough: at("2026-11-20T00:00:00Z"),
		cancelAtPeriodEnd: false,
		endedAt: null,
	};

	it("runs an active subscription to its period end, renewing unless set to cancel", () => {
		expect(subscriptionAccess(base, now)).toEqual({
			planId: "pro-ai",
			startsAt: base.currentPeriodStart,
			endsAt: base.currentPeriodEnd,
			renews: true,
		});
		expect(subscriptionAccess({ ...base, cancelAtPeriodEnd: true }, now)?.renews).toBe(false);
	});

	it("waits a few hours for a renewal's news, then stops", () => {
		const ended = { ...base, currentPeriodEnd: at("2026-11-05T11:00:00Z") };
		expect(subscriptionAccess(ended, now)?.endsAt).toEqual(new Date(+at("2026-11-05T11:00:00Z") + RENEWAL_GRACE_MS));
		expect(subscriptionAccess({ ...base, currentPeriodEnd: at("2026-11-05T05:00:00Z") }, now)).toBeNull();
	});

	it("gives a past_due subscription only its last paid period, and the rest nothing", () => {
		expect(
			subscriptionAccess({ ...base, status: "past_due", paidThrough: at("2026-11-05T11:00:00Z") }, now),
		).toBeNull();
		expect(
			subscriptionAccess({ ...base, status: "past_due", paidThrough: at("2026-11-06T00:00:00Z") }, now)?.endsAt,
		).toEqual(at("2026-11-06T00:00:00Z"));
		for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const)
			expect(subscriptionAccess({ ...base, status }, now)).toBeNull();
		expect(subscriptionAccess({ ...base, endedAt: at("2026-11-05T00:00:00Z") }, now)).toBeNull();
		expect(subscriptionAccess({ ...base, status: "trialing" }, now)?.renews).toBe(false);
	});
});

describe("credit months", () => {
	it("adds calendar months, clamping to shorter months", () => {
		expect(addMonths(at("2026-01-31T10:00:00Z"), 1)).toEqual(at("2026-02-28T10:00:00Z"));
		expect(addMonths(at("2026-11-05T10:00:00Z"), 2)).toEqual(at("2027-01-05T10:00:00Z"));
		expect(addMonths(at("2028-02-29T00:00:00Z"), 12)).toEqual(at("2029-02-28T00:00:00Z"));
	});

	it("is the whole period for a monthly subscription", () => {
		const period = { start: at("2026-11-05T10:00:00Z"), end: at("2026-12-05T10:00:00Z") };
		expect(creditMonth(period, "month", at("2026-11-20T00:00:00Z"))).toEqual(period);
		expect(creditMonth(period, "month", at("2026-12-05T10:00:00Z"))).toBeNull();
		expect(creditMonth(period, "month", at("2026-11-01T00:00:00Z"))).toBeNull();
	});

	it("is one calendar month of a yearly period, the last ending with it", () => {
		const period = { start: at("2026-11-05T10:00:00Z"), end: at("2027-11-05T10:00:00Z") };
		expect(creditMonth(period, "year", at("2026-11-05T10:00:00Z"))).toEqual({
			start: at("2026-11-05T10:00:00Z"),
			end: at("2026-12-05T10:00:00Z"),
		});
		expect(creditMonth(period, "year", at("2027-02-10T00:00:00Z"))).toEqual({
			start: at("2027-02-05T10:00:00Z"),
			end: at("2027-03-05T10:00:00Z"),
		});
		expect(creditMonth(period, "year", at("2027-11-01T00:00:00Z"))).toEqual({
			start: at("2027-10-05T10:00:00Z"),
			end: at("2027-11-05T10:00:00Z"),
		});
		// Twelve months in all.
		const ends = new Set<number>();
		for (let day = 0; day < 365; day += 7) {
			const month = creditMonth(period, "year", new Date(+period.start + day * 86_400_000));
			if (month) ends.add(+month.end);
		}
		expect(ends.size).toBe(12);
	});
});
