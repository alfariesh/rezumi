import type { BillingMode } from "./entitlements";
import type { SubscriptionState } from "./polar/mapping";
import type { DbOrTx } from "@rezumi/db/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PLANS } from "@rezumi/schema/billing";
import { DAY_MS } from "./timeline";

const fixture = vi.hoisted(() => ({ mode: "off" as BillingMode }));
vi.mock("@rezumi/env/server", async () => {
	const actual = await vi.importActual<typeof import("@rezumi/env/server")>("@rezumi/env/server");
	return {
		...actual,
		env: {
			...actual.env,
			get BILLING_MODE() {
				return fixture.mode;
			},
		},
	};
});

const { getBillingMode, getEntitlements, isBillingActiveFor, resolveEntitlements } = await import("./entitlements");

const now = new Date("2026-11-02T07:00:00.000Z");
const at = (days: number) => new Date(now.getTime() + days * DAY_MS);

/** A database that fails the test on any use: unlimited accounts must not cost a query. */
const untouchable = new Proxy({} as DbOrTx, {
	get(_, property) {
		throw new Error(`Billing touched the database (${String(property)}) while it doesn't apply.`);
	},
});

/** Answers the role lookup and fails on anything else. */
function withRole(role: string | null): DbOrTx {
	return {
		select: () => ({ from: () => ({ where: async () => [{ role }] }) }),
	} as unknown as DbOrTx;
}

const unlimited = {
	enabled: false,
	planId: "free",
	features: {
		premiumTemplates: true,
		brandLogos: true,
		wordOdtExport: true,
		customStyles: true,
		customFonts: true,
		automationApi: true,
	},
	limits: { activeResumes: null, activeCoverLetters: null },
	currentPeriodEndsAt: null,
	source: null,
	renews: false,
	upcoming: [],
};

beforeEach(() => {
	fixture.mode = "off";
});

describe("isBillingActiveFor", () => {
	it("applies plans to everyone when on, to admins while testing, and to nobody when off", () => {
		expect(isBillingActiveFor({ role: "admin" }, "off")).toBe(false);
		expect(isBillingActiveFor({ role: "user" }, "off")).toBe(false);
		expect(isBillingActiveFor({ role: "admin" }, "admins")).toBe(true);
		expect(isBillingActiveFor({ role: "user" }, "admins")).toBe(false);
		expect(isBillingActiveFor({ role: null }, "admins")).toBe(false);
		expect(isBillingActiveFor({}, "admins")).toBe(false);
		expect(isBillingActiveFor({ role: "user" }, "on")).toBe(true);
	});

	it("reads the mode from BILLING_MODE", () => {
		expect(getBillingMode()).toBe("off");
		fixture.mode = "admins";
		expect(isBillingActiveFor({ role: "admin" })).toBe(true);
		expect(isBillingActiveFor({ role: "user" })).toBe(false);
	});
});

describe("getEntitlements", () => {
	it("keeps every account unlimited without a query when billing is off", async () => {
		await expect(getEntitlements("anyone", now, untouchable)).resolves.toEqual(unlimited);
	});

	it("keeps accounts other than admins unlimited while testing with admins", async () => {
		fixture.mode = "admins";
		await expect(getEntitlements("member", now, withRole("user"))).resolves.toEqual(unlimited);
		await expect(getEntitlements("member", now, withRole(null))).resolves.toEqual(unlimited);
	});

	it("returns a fresh object each time", async () => {
		const first = await getEntitlements("anyone", now, untouchable);
		first.features.premiumTemplates = false;
		await expect(getEntitlements("anyone", now, untouchable)).resolves.toEqual(unlimited);
	});
});

describe("resolveEntitlements", () => {
	it("puts an account without a running pass on free", () => {
		expect(resolveEntitlements([], now)).toEqual({
			enabled: true,
			planId: "free",
			features: PLANS.free.features,
			limits: PLANS.free.limits,
			currentPeriodEndsAt: null,
			source: null,
			renews: false,
			upcoming: [],
		});
	});

	it("reads the running pass and what queues after it", () => {
		const result = resolveEntitlements(
			[
				{ planId: "pro-ai", startsAt: at(-5), endsAt: at(25) },
				{ planId: "plus", startsAt: at(25), endsAt: at(45) },
			],
			now,
		);
		expect(result).toMatchObject({
			enabled: true,
			planId: "pro-ai",
			features: PLANS["pro-ai"].features,
			limits: PLANS["pro-ai"].limits,
			currentPeriodEndsAt: at(25),
			upcoming: [{ planId: "plus", startsAt: at(25), endsAt: at(45) }],
		});
	});

	it("reads back-to-back passes of one plan as one stretch", () => {
		const result = resolveEntitlements(
			[
				{ planId: "plus", startsAt: at(-10), endsAt: at(20) },
				{ planId: "plus", startsAt: at(20), endsAt: at(50) },
				{ planId: "plus", startsAt: at(50), endsAt: at(80) },
			],
			now,
		);
		expect(result.planId).toBe("plus");
		expect(result.currentPeriodEndsAt).toEqual(at(80));
		expect(result.upcoming).toEqual([]);
	});

	it("leaves ended passes out and the boundary to the next pass", () => {
		const result = resolveEntitlements(
			[
				{ planId: "pro-ai", startsAt: at(-30), endsAt: now },
				{ planId: "plus", startsAt: now, endsAt: at(30) },
			],
			now,
		);
		expect(result.planId).toBe("plus");
		expect(result.currentPeriodEndsAt).toEqual(at(30));
	});

	const subscription = (overrides: Partial<SubscriptionState> = {}): SubscriptionState => ({
		planId: "plus",
		interval: "month",
		status: "active",
		currentPeriodStart: at(-10),
		currentPeriodEnd: at(20),
		paidThrough: at(20),
		cancelAtPeriodEnd: false,
		endedAt: null,
		...overrides,
	});

	it("gives an active subscription's plan until its period ends, renewing", () => {
		expect(resolveEntitlements([], now, [subscription()])).toMatchObject({
			planId: "plus",
			currentPeriodEndsAt: at(20),
			source: "subscription",
			renews: true,
		});
		expect(resolveEntitlements([], now, [subscription({ cancelAtPeriodEnd: true })])).toMatchObject({
			planId: "plus",
			renews: false,
		});
	});

	it("keeps access for a few hours past the period end while the renewal arrives", () => {
		const ended = subscription({ currentPeriodStart: at(-30), currentPeriodEnd: new Date(+now - 60 * 60 * 1000) });
		expect(resolveEntitlements([], now, [ended]).planId).toBe("plus");
		const longAgo = subscription({ currentPeriodStart: at(-31), currentPeriodEnd: at(-1) });
		expect(resolveEntitlements([], now, [longAgo]).planId).toBe("free");
	});

	it("stops a past_due subscription at the last paid period, and the others at once", () => {
		expect(resolveEntitlements([], now, [subscription({ status: "past_due", paidThrough: at(-1) })]).planId).toBe(
			"free",
		);
		expect(resolveEntitlements([], now, [subscription({ status: "past_due", paidThrough: at(2) })])).toMatchObject({
			planId: "plus",
			currentPeriodEndsAt: at(2),
			renews: false,
		});
		for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const)
			expect(resolveEntitlements([], now, [subscription({ status })]).planId).toBe("free");
		expect(resolveEntitlements([], now, [subscription({ endedAt: at(-1) })]).planId).toBe("free");
	});

	it("takes the higher plan of a granted period and a subscription", () => {
		const granted = [{ planId: "pro-ai" as const, startsAt: at(-1), endsAt: at(5) }];
		expect(resolveEntitlements(granted, now, [subscription()])).toMatchObject({
			planId: "pro-ai",
			source: "period",
			currentPeriodEndsAt: at(5),
		});
		const plus = [{ planId: "plus" as const, startsAt: at(-1), endsAt: at(40) }];
		expect(resolveEntitlements(plus, now, [subscription({ planId: "pro-ai" })])).toMatchObject({
			planId: "pro-ai",
			source: "subscription",
		});
		expect(resolveEntitlements(plus, now, [subscription()])).toMatchObject({ planId: "plus", source: "subscription" });
	});
});
