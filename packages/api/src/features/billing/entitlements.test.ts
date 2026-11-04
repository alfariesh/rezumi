import type { BillingMode } from "./entitlements";
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
});
