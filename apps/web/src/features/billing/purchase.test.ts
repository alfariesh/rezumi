import type { Subscription } from "./purchase";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";

vi.mock("@/libs/orpc/client", () => ({ orpc: {} }));
i18n.loadAndActivate({ locale: "en", messages: {} });

const {
	formatPrice,
	getPassKind,
	getPassLabel,
	getPaymentReasonLabel,
	getPurchaseKind,
	getPurchaseLabel,
	getReturnState,
	hasInvoice,
	hasReceipt,
	isLiveSubscription,
	isPaymentFailed,
	isOpenPayment,
	monthlyOfYearly,
	passSuffix,
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
		expect(formatPrice(2_900_000, "idr")).toMatch(/^IDR\s29,000$/);
		expect(priceLabel("pro-ai", "month", "usd")).toBe("$9.99");
		expect(priceLabel("pro-ai", "year", "idr")).toMatch(/^IDR\s499,000$/);
	});

	it("shows what a year saves and costs a month", () => {
		expect(yearlySaving("plus", "usd")).toBe(35);
		expect(yearlySaving("pro-ai", "usd")).toBe(34);
		expect(yearlySaving("plus", "idr")).toBe(28);
		expect(yearlySaving("pro-ai", "idr")).toBe(30);
		expect(monthlyOfYearly("plus", "usd")).toBe("$3.25");
		expect(monthlyOfYearly("plus", "idr")).toMatch(/^IDR\s20,750$/);
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
		const paid = { method: "card" as const, durationDays: null, totalAmount: 499, paidAt: now, trialDays: null };
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
			method: "card" as const,
			durationDays: null,
			billingReason: "subscription_create" as const,
			interval: "month" as const,
			paidAt: now,
			trialDays: 7,
		};
		expect(getPaymentReasonLabel({ ...trial, totalAmount: 0 })).toBe("Free trial");
		expect(getPaymentReasonLabel({ ...trial, totalAmount: 549 })).toBe("New subscription");
		const order = { method: "card" as const, trialDays: null, totalAmount: 499 };
		expect(hasInvoice({ ...order, paidAt: now, providerPaymentId: "pay_1" })).toBe(true);
		expect(hasInvoice({ ...order, paidAt: now, providerPaymentId: null })).toBe(false);
		expect(hasInvoice({ ...order, paidAt: null, providerPaymentId: "pay_1" })).toBe(false);
		expect(hasInvoice({ method: "card", trialDays: 7, totalAmount: 0, paidAt: now, providerPaymentId: "pay_1" })).toBe(
			false,
		);
	});

	it("names QRIS passes and gives them Rezumi's receipt instead of an invoice", () => {
		const pass = {
			method: "qris" as const,
			interval: "month" as const,
			durationDays: 30,
			totalAmount: 2_900_000,
			paidAt: now,
			trialDays: null,
		};
		expect(getPaymentReasonLabel({ ...pass, billingReason: "purchase" })).toBe("30 days, QRIS");
		expect(getPaymentReasonLabel({ ...pass, billingReason: "subscription_cycle" })).toBe("30 more days, QRIS");
		expect(
			getPaymentReasonLabel({ ...pass, billingReason: "subscription_update", interval: "year", durationDays: 365 }),
		).toBe("Upgrade, 365 days, QRIS");
		expect(hasInvoice({ ...pass, providerPaymentId: "p_1" })).toBe(false);
		expect(hasReceipt(pass)).toBe(true);
		expect(hasReceipt({ ...pass, paidAt: null })).toBe(false);
		expect(hasReceipt({ method: "card", paidAt: now })).toBe(false);
	});

	it("tells what a QRIS pass does from where the account stands", () => {
		expect(getPassKind("free", "plus")).toBe("buy");
		expect(getPassKind("plus", "plus")).toBe("extend");
		expect(getPassKind("plus", "pro-ai")).toBe("upgrade");
		expect(getPassKind("pro-ai", "plus")).toBe("later");
		expect(getPassLabel("extend", { planId: "plus", interval: "month" })).toBe("Add 30 days");
		expect(getPassLabel("extend", { planId: "pro-ai", interval: "year" })).toBe("Add a year");
		expect(getPassLabel("upgrade", { planId: "pro-ai", interval: "month" })).toBe("Upgrade to Pro AI");
		expect(getPassLabel("buy", { planId: "plus", interval: "year" })).toBe("Get Plus");
		expect(passSuffix("month")).toBe("/ 30 days");
		expect(passSuffix("year")).toBe("/ year");
	});

	it("shows dates in the browser's zone until the account picks one", () => {
		const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
		expect(planTimeZone("UTC")).toBe(browser);
		expect(planTimeZone(null)).toBe(browser);
		expect(planTimeZone("Asia/Makassar")).toBe("Asia/Makassar");
	});
});
