import type { DodoPaymentLike, DodoSubscriptionLike } from "./mapping";
import { describe, expect, it } from "vite-plus/test";
import {
	billingReasonOf,
	dodoLocale,
	isInTrial,
	netAmountOf,
	netShare,
	paymentPeriod,
	paymentStatusOf,
	refundedNetOf,
	safeObjectFields,
	subscriptionSnapshot,
	subscriptionStatusOf,
} from "./mapping";

const at = (iso: string) => new Date(iso);

const subscription = (overrides: Partial<DodoSubscriptionLike> = {}): DodoSubscriptionLike => ({
	subscription_id: "sub_1",
	status: "active",
	product_id: "pdt_plus_monthly",
	recurring_pre_tax_amount: 499,
	currency: "USD",
	previous_billing_date: "2026-11-05T10:00:00Z",
	next_billing_date: "2026-12-05T10:00:00Z",
	cancel_at_next_billing_date: false,
	created_at: "2026-11-05T10:00:00Z",
	trial_period_days: 0,
	customer: { customer_id: "cus_1" },
	...overrides,
});

const payment = (overrides: Partial<DodoPaymentLike> = {}): DodoPaymentLike => ({
	payment_id: "pay_1",
	status: "succeeded",
	total_amount: 594,
	tax: 95,
	currency: "USD",
	created_at: "2026-11-05T10:00:00Z",
	customer: { customer_id: "cus_1" },
	...overrides,
});

describe("subscriptions", () => {
	it("reads an active subscription with trial days as trialing until its first period ends", () => {
		const trial = subscription({ trial_period_days: 7, next_billing_date: "2026-11-12T10:00:00Z" });
		expect(isInTrial(trial)).toBe(true);
		expect(subscriptionStatusOf(trial)).toBe("trialing");
		// After the first charge the period moves on a month: the trial is over, the days stay on the subscription.
		const converted = {
			...trial,
			previous_billing_date: "2026-11-12T10:00:00Z",
			next_billing_date: "2026-12-12T10:00:00Z",
		};
		expect(subscriptionStatusOf(converted)).toBe("active");
		expect(subscriptionStatusOf({ ...trial, status: "on_hold" })).toBe("on_hold");
		expect(subscriptionStatusOf(subscription())).toBe("active");
	});

	it("keeps the period, price, pending change and when it was read", () => {
		const observedAt = at("2026-11-06T00:00:00Z");
		expect(
			subscriptionSnapshot(
				subscription({ scheduled_change: { product_id: "pdt_plus_yearly", effective_at: "2026-12-05T10:00:00Z" } }),
				observedAt,
			),
		).toEqual({
			providerSubscriptionId: "sub_1",
			providerCustomerId: "cus_1",
			providerProductId: "pdt_plus_monthly",
			status: "active",
			amount: 499,
			currency: "usd",
			currentPeriodStart: at("2026-11-05T10:00:00Z"),
			currentPeriodEnd: at("2026-12-05T10:00:00Z"),
			cancelAtPeriodEnd: false,
			canceledAt: null,
			startedAt: at("2026-11-05T10:00:00Z"),
			endsAt: null,
			endedAt: null,
			pendingProductId: "pdt_plus_yearly",
			observedAt,
		});
	});

	it("ends a cancelled subscription now, or at its period end when it was cancelled for then", () => {
		const observedAt = at("2026-11-06T00:00:00Z");
		const now = subscriptionSnapshot(
			subscription({ status: "cancelled", cancelled_at: "2026-11-05T20:00:00Z" }),
			observedAt,
		);
		expect(now).toMatchObject({ status: "cancelled", endedAt: at("2026-11-05T20:00:00Z"), endsAt: null });
		const later = subscriptionSnapshot(
			subscription({ status: "cancelled", cancel_at_next_billing_date: true }),
			observedAt,
		);
		expect(later).toMatchObject({ endedAt: at("2026-12-05T10:00:00Z"), endsAt: at("2026-12-05T10:00:00Z") });
		expect(subscriptionSnapshot(subscription({ cancel_at_next_billing_date: true }), observedAt)).toMatchObject({
			status: "active",
			cancelAtPeriodEnd: true,
			endsAt: at("2026-12-05T10:00:00Z"),
			endedAt: null,
		});
		expect(subscriptionSnapshot(subscription({ status: "expired" }), observedAt).endedAt).toEqual(observedAt);
	});
});

describe("payments", () => {
	it("maps Dodo's statuses, then refunds and lost disputes on a succeeded payment", () => {
		expect(paymentStatusOf(payment())).toBe("paid");
		expect(paymentStatusOf(payment({ status: "processing" }))).toBe("pending");
		expect(paymentStatusOf(payment({ status: "requires_customer_action" }))).toBe("pending");
		expect(paymentStatusOf(payment({ status: null }))).toBe("pending");
		expect(paymentStatusOf(payment({ status: "failed" }))).toBe("failed");
		expect(paymentStatusOf(payment({ status: "cancelled" }))).toBe("cancelled");
		expect(paymentStatusOf(payment({ refund_status: "partial" }))).toBe("partially_refunded");
		expect(paymentStatusOf(payment({ refund_status: "full" }))).toBe("refunded");
		expect(paymentStatusOf(payment({ disputes: [{ dispute_id: "dis_1", dispute_status: "dispute_opened" }] }))).toBe(
			"paid",
		);
		expect(paymentStatusOf(payment({ disputes: [{ dispute_id: "dis_1", dispute_status: "dispute_lost" }] }))).toBe(
			"reversed",
		);
	});

	it("reads the reason, the net amount and the period it pays for", () => {
		expect(billingReasonOf("new")).toBe("subscription_create");
		expect(billingReasonOf("renewal")).toBe("subscription_cycle");
		expect(billingReasonOf("plan_change")).toBe("subscription_update");
		expect(billingReasonOf(null)).toBe("purchase");
		expect(netAmountOf(payment())).toBe(499);
		expect(netAmountOf(payment({ tax: null, total_amount: 0 }))).toBe(0);
		const periods = [{ subscription_id: "sub_1", starts_at: "2026-11-05T10:00:00Z", ends_at: "2026-12-05T10:00:00Z" }];
		expect(paymentPeriod({ service_periods: periods }, "sub_1")).toEqual({
			start: at("2026-11-05T10:00:00Z"),
			end: at("2026-12-05T10:00:00Z"),
		});
		expect(paymentPeriod({ service_periods: [] }, "sub_1")).toEqual({ start: null, end: null });
	});

	it("turns refunds Dodo reports with tax into the payment's net share", () => {
		const totals = { amount: 499, totalAmount: 594 };
		expect(netShare(297, totals)).toBe(250);
		expect(netShare(1000, totals)).toBe(499);
		expect(netShare(100, { amount: 0, totalAmount: 0 })).toBe(0);
		expect(refundedNetOf(payment({ refund_status: "full" }), totals)).toBe(499);
		expect(
			refundedNetOf(
				payment({
					refund_status: "partial",
					refunds: [
						{ refund_id: "ref_1", status: "succeeded", amount: 297 },
						{ refund_id: "ref_2", status: "failed", amount: 297 },
					],
				}),
				totals,
			),
		).toBe(250);
	});
});

describe("other mappings", () => {
	it("picks a language Dodo speaks, or English", () => {
		expect(dodoLocale("id-ID")).toBe("id");
		expect(dodoLocale("pt-BR")).toBe("pt");
		expect(dodoLocale("af-ZA")).toBe("en");
		expect(dodoLocale(undefined)).toBe("en");
	});

	it("keeps only safe fields of a Dodo object", () => {
		expect(
			safeObjectFields({
				payment_id: "pay_1",
				status: "succeeded",
				total_amount: 594,
				currency: "USD",
				customer: { email: "someone@example.test", name: "Someone" },
				billing: { street: "Street" },
				card_last_four: "4242",
				metadata: { rezumi_user_id: "user" },
			}),
		).toEqual({ payment_id: "pay_1", status: "succeeded", total_amount: 594, currency: "USD" });
	});
});
