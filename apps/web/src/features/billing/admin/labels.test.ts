import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";

vi.mock("@/libs/orpc/client", () => ({ orpc: {} }));
i18n.loadAndActivate({ locale: "en", messages: {} });

const { describeAudit } = await import("./labels");

const change = (from: object | null, to: object, extra: object = {}) =>
	describeAudit({ action: "subscription.changed", details: { from, to, ...extra } }).title;

const proMonthly = { status: "active", planId: "pro-ai", interval: "month", cancelAtPeriodEnd: false };

describe("describeAudit", () => {
	it("names what a subscription change was", () => {
		expect(change(null, proMonthly)).toBe("Subscription started");
		expect(change(proMonthly, { ...proMonthly, cancelAtPeriodEnd: true })).toBe("Set to end at the period end");
		expect(change({ ...proMonthly, cancelAtPeriodEnd: true }, proMonthly)).toBe("Cancellation undone");
		expect(change(proMonthly, { ...proMonthly, interval: "year" })).toBe("Plan changed to Pro AI, yearly");
		expect(change({ ...proMonthly, planId: "plus" }, proMonthly)).toBe("Plan changed to Pro AI, monthly");
		expect(change(proMonthly, { ...proMonthly, status: "past_due" })).toBe("Subscription now: Payment failed");
		expect(change(proMonthly, proMonthly, { pendingPlanChange: true })).toBe("Plan change set for the renewal");
	});

	it("reads older entries, which held less", () => {
		// Before billing periods and cancellations were logged: status and plan only, the interval on `to`.
		expect(
			change({ status: "active", planId: "plus" }, { status: "active", planId: "pro-ai", interval: "month" }),
		).toBe("Plan changed to Pro AI, monthly");
		expect(describeAudit({ action: "subscription.changed", details: {} }).title).toBe("Subscription changed");
		expect(describeAudit({ action: "payment.fulfilled" }).title).toBe("Payment applied");
	});
});
