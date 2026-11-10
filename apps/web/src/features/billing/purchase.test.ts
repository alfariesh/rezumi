import type { Subscription } from "./purchase";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";

vi.mock("@/libs/orpc/client", () => ({ orpc: {} }));
i18n.loadAndActivate({ locale: "en", messages: {} });

const {
	formatPrice,
	getPaymentReasonLabel,
	getPurchaseKind,
	getPurchaseLabel,
	getReturnState,
	hasInvoice,
	isLiveSubscription,
	isPaymentFailed,
	isOpenPayment,
	monthlyOfYearly,
	planTimeZone,
	priceLabel,
	yearlySaving,
} = await import("./purchase");

const day = (n: number) => new Date(Date.UTC(2026, 10, n, 7));

const subscription = (overrides: Partial<Subscription> = {}): Subscription => ({
	id: "sub",
	planId: "plus",
	interval: "month",
	status: "active",
	amount: 499,
	currency: "usd",
	currentPeriodStart: day(1),
	currentPeriodEnd: day(31),
	cancelAtPeriodEnd: false,
	pendingChange: null,
	...overrides,
});

describe("plan buttons", () => {
	it("subscribes without a live subscription, and changes it with one", () => {
		expect(getPurchaseKind(null, { planId: "plus", interval: "month" })).toBe("subscribe");
		expect(getPurchaseKind(subscription({ status: "cancelled" }), { planId: "plus", interval: "month" })).toBe(
			"subscribe",
		);
		const plus = subscription();
		expect(getPurchaseKind(plus, { planId: "plus", interval: "month" })).toBe("current");
		expect(getPurchaseKind(plus, { planId: "pro-ai", interval: "month" })).toBe("upgrade");
		expect(getPurchaseKind(plus, { planId: "plus", interval: "year" })).toBe("upgrade");
		expect(getPurchaseKind(plus, { planId: "pro-ai", interval: "year" })).toBe("upgrade");
		const pro = subscription({ planId: "pro-ai", interval: "year" });
		expect(getPurchaseKind(pro, { planId: "plus", interval: "year" })).toBe("downgrade");
		expect(getPurchaseKind(pro, { planId: "pro-ai", interval: "month" })).toBe("downgrade");
		expect(isLiveSubscription(subscription({ status: "past_due" }))).toBe(true);
		expect(isLiveSubscription(subscription({ status: "expired" }))).toBe(false);
		// On hold waits for a new payment method: still the account's subscription, but its payment failed.
		expect(isLiveSubscription(subscription({ status: "on_hold" }))).toBe(true);
		expect(isPaymentFailed(subscription({ status: "on_hold" }))).toBe(true);
		expect(isPaymentFailed(subscription({ status: "past_due" }))).toBe(true);
		expect(isPaymentFailed(subscription())).toBe(false);
	});

	it("labels each button", () => {
		const plus = subscription();
		expect(getPurchaseLabel("subscribe", { planId: "pro-ai", interval: "month" })).toBe("Get Pro AI");
		expect(getPurchaseLabel("current", { planId: "plus", interval: "month" }, plus)).toBe("Your plan");
		expect(getPurchaseLabel("upgrade", { planId: "pro-ai", interval: "month" }, plus)).toBe("Upgrade to Pro AI");
		expect(getPurchaseLabel("upgrade", { planId: "plus", interval: "year" }, plus)).toBe("Switch to yearly");
		const pro = subscription({ planId: "pro-ai", interval: "year" });
		expect(getPurchaseLabel("downgrade", { planId: "plus", interval: "year" }, pro)).toBe("Switch to Plus");
		expect(getPurchaseLabel("downgrade", { planId: "pro-ai", interval: "month" }, pro)).toBe("Switch to monthly");
	});
});

describe("prices", () => {
	it("writes amounts in the currency's way, dropping decimals that are zero", () => {
		expect(formatPrice(499, "usd")).toBe("$4.99");
		expect(formatPrice(3_900, "usd")).toBe("$39");
		expect(formatPrice(5_900_000, "idr")).toMatch(/^IDR\s59,000$/);
		expect(priceLabel("pro-ai", "month", "usd")).toBe("$9.99");
		expect(priceLabel("pro-ai", "year", "idr")).toMatch(/^IDR\s999,000$/);
	});

	it("shows what a year saves and costs a month", () => {
		expect(yearlySaving("plus", "usd")).toBe(35);
		expect(yearlySaving("pro-ai", "usd")).toBe(34);
		expect(yearlySaving("plus", "idr")).toBe(35);
		expect(monthlyOfYearly("plus", "usd")).toBe("$3.25");
		expect(monthlyOfYearly("plus", "idr")).toMatch(/^IDR\s38,250$/);
	});
});

describe("payments", () => {
	const now = day(3);

	it("reads where a returning payment stands from its status, never from the browser's query", () => {
		expect(getReturnState({ status: "paid", expiresAt: day(4) }, now)).toBe("paid");
		expect(getReturnState({ status: "partially_refunded", expiresAt: day(4) }, now)).toBe("paid");
		expect(getReturnState({ status: "pending", expiresAt: day(4) }, now)).toBe("waiting");
		expect(getReturnState({ status: "creating", expiresAt: day(4) }, now)).toBe("waiting");
		expect(getReturnState({ status: "pending", expiresAt: day(2) }, now)).toBe("closed");
		expect(getReturnState({ status: "failed", expiresAt: null }, now)).toBe("failed");
		expect(getReturnState({ status: "cancelled", expiresAt: null }, now)).toBe("failed");
		expect(getReturnState({ status: "expired", expiresAt: day(2) }, now)).toBe("expired");
		expect(getReturnState({ status: "refunded", expiresAt: null }, now)).toBe("refunded");
		expect(getReturnState({ status: "reversed", expiresAt: null }, now)).toBe("refunded");
	});

	it("keeps asking only while a payment can still change on its own", () => {
		expect(isOpenPayment({ status: "pending" })).toBe(true);
		expect(isOpenPayment({ status: "creating" })).toBe(true);
		expect(isOpenPayment({ status: "paid" })).toBe(false);
		expect(isOpenPayment({ status: "expired" })).toBe(false);
	});

	it("names what a payment was for and offers invoices for orders that went through", () => {
		const paid = { totalAmount: 499, paidAt: now, trialDays: null };
		expect(getPaymentReasonLabel({ ...paid, billingReason: "subscription_create", interval: "month" })).toBe(
			"New subscription",
		);
		expect(getPaymentReasonLabel({ ...paid, billingReason: "subscription_cycle", interval: "year" })).toBe("Renewal");
		expect(getPaymentReasonLabel({ ...paid, billingReason: "subscription_update", interval: "month" })).toBe(
			"Plan change",
		);
		expect(getPaymentReasonLabel({ ...paid, billingReason: null, interval: null })).toBe("30-day pass");
		// A trial's $0 start; without a trial (a repeat customer), the full price is a new subscription.
		const trial = {
			billingReason: "subscription_create" as const,
			interval: "month" as const,
			paidAt: now,
			trialDays: 7,
		};
		expect(getPaymentReasonLabel({ ...trial, totalAmount: 0 })).toBe("Free trial");
		expect(getPaymentReasonLabel({ ...trial, totalAmount: 549 })).toBe("New subscription");
		const order = { trialDays: null, totalAmount: 499 };
		expect(hasInvoice({ ...order, paidAt: now, providerPaymentId: "pay_1" })).toBe(true);
		expect(hasInvoice({ ...order, paidAt: now, providerPaymentId: null })).toBe(false);
		expect(hasInvoice({ ...order, paidAt: null, providerPaymentId: "pay_1" })).toBe(false);
		expect(hasInvoice({ trialDays: 7, totalAmount: 0, paidAt: now, providerPaymentId: "pay_1" })).toBe(false);
	});

	it("shows dates in the browser's zone until the account picks one", () => {
		const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
		expect(planTimeZone("UTC")).toBe(browser);
		expect(planTimeZone(null)).toBe(browser);
		expect(planTimeZone("Asia/Makassar")).toBe("Asia/Makassar");
	});
});
