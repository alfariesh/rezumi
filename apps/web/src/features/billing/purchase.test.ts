import type { PurchasePreview } from "./purchase";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";

vi.mock("@/libs/orpc/client", () => ({ orpc: {} }));
i18n.loadAndActivate({ locale: "en", messages: {} });

const {
	formatPrice,
	getPaymentMethodName,
	getPurchaseKind,
	getPurchaseLabel,
	getReturnState,
	hasReceipt,
	isOpenPayment,
	paymentIdFromOrderId,
	splitPurchase,
	planTimeZone,
} = await import("./purchase");

const day = (n: number) => new Date(Date.UTC(2026, 10, n, 7));

const preview = (schedule: PurchasePreview["schedule"]): PurchasePreview => ({
	planId: "pro-ai",
	amount: 79_000,
	currency: "IDR",
	durationDays: 30,
	credits: 100,
	schedule,
});

describe("buy buttons", () => {
	it("offers a first pass, more days, an upgrade or a queued Plus from where the account stands", () => {
		expect(getPurchaseKind("free", "plus")).toBe("buy");
		expect(getPurchaseKind("free", "pro-ai")).toBe("buy");
		expect(getPurchaseKind("plus", "plus")).toBe("extend");
		expect(getPurchaseKind("plus", "pro-ai")).toBe("upgrade");
		expect(getPurchaseKind("pro-ai", "pro-ai")).toBe("extend");
		expect(getPurchaseKind("pro-ai", "plus")).toBe("queue");
	});

	it("labels each button", () => {
		expect(getPurchaseLabel("buy", "pro-ai")).toBe("Buy Pro AI");
		expect(getPurchaseLabel("extend", "plus")).toBe("Extend 30 days");
		expect(getPurchaseLabel("upgrade", "pro-ai")).toBe("Upgrade to Pro AI");
		expect(getPurchaseLabel("queue", "plus")).toBe("Buy Plus");
	});

	it("writes prices in whole Rupiah", () => {
		expect(formatPrice(79_000)).toMatch(/^IDR\s79,000$/);
	});
});

describe("splitPurchase", () => {
	it("starts a first pass once it's paid", () => {
		const pass = { planId: "pro-ai", startsAt: day(3), endsAt: day(33), purchase: true } as const;
		expect(splitPurchase(preview([pass]))).toEqual({ pass, waitsFor: null, after: [] });
	});

	it("puts the rest of Plus after an upgrade", () => {
		const rest = { planId: "plus", startsAt: day(33), endsAt: day(53), purchase: false } as const;
		const split = splitPurchase(
			preview([{ planId: "pro-ai", startsAt: day(3), endsAt: day(33), purchase: true }, rest]),
		);
		expect(split?.after).toEqual([rest]);
		expect(split?.waitsFor).toBeNull();
	});

	it("queues a pass behind the time already paid for", () => {
		const pro = { planId: "pro-ai", startsAt: day(3), endsAt: day(20), purchase: false } as const;
		const split = splitPurchase(preview([pro, { planId: "plus", startsAt: day(20), endsAt: day(50), purchase: true }]));
		expect(split?.waitsFor).toEqual(pro);
		expect(split?.pass.planId).toBe("plus");
	});

	it("is empty without the new pass", () => {
		expect(splitPurchase(preview([]))).toBeNull();
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

	it("finds the payment behind a Midtrans order number, and nothing behind anything else", () => {
		const id = "01a19ef4-a65a-7256-91f4-54f7c9b40fbf";
		expect(paymentIdFromOrderId(`RZ-${id}`)).toBe(id);
		expect(paymentIdFromOrderId(` RZ-${id.toUpperCase()} `)).toBe(id);
		expect(paymentIdFromOrderId(id)).toBeNull();
		expect(paymentIdFromOrderId("RZ-../admin")).toBeNull();
		expect(paymentIdFromOrderId(undefined)).toBeNull();
	});

	it("names methods and gives receipts to payments that went through", () => {
		expect(getPaymentMethodName("qris")).toBe("QRIS");
		expect(getPaymentMethodName("bank_transfer")).toBe("Virtual account");
		expect(getPaymentMethodName(null)).toBe("—");
		expect(getPaymentMethodName("new_wallet")).toBe("new_wallet");
		expect(hasReceipt({ paidAt: now })).toBe(true);
		expect(hasReceipt({ paidAt: null })).toBe(false);
	});

	it("shows dates in WIB until the account picks a timezone", () => {
		expect(planTimeZone("UTC")).toBe("Asia/Jakarta");
		expect(planTimeZone(null)).toBe("Asia/Jakarta");
		expect(planTimeZone("Asia/Makassar")).toBe("Asia/Makassar");
	});
});
