import { describe, expect, it, vi } from "vite-plus/test";
import { PLAN_FEATURE_KEYS } from "@rezumi/schema/billing";

vi.mock("@rezumi/env/server", async () => {
	const actual = await vi.importActual<typeof import("@rezumi/env/server")>("@rezumi/env/server");
	return { ...actual, env: { ...actual.env, APP_URL: "https://rezumi.app", BILLING_MODE: "off" } };
});
// Billing off must not read the database at all.
vi.mock("@rezumi/db/client", () => ({
	db: new Proxy(
		{},
		{
			get() {
				throw new Error("The database was touched while billing is off.");
			},
		},
	),
}));

const { designFeaturesNeeded, planFeatureRequired, planLimitReached, assertFeature, precheckDocumentCapacity } =
	await import("./limits");
const { firstPartyRedirectUris, assertAutomationAccess } = await import("./automation");

const css = (text: string) => ({ source: { text } });

describe("designFeaturesNeeded", () => {
	it("asks for premium templates only when one is chosen anew", () => {
		expect(designFeaturesNeeded(null, { template: "onyx" })).toEqual([]);
		expect(designFeaturesNeeded(null, { template: "pikachu" })).toEqual(["premiumTemplates"]);
		expect(designFeaturesNeeded({ template: "onyx" }, { template: "pikachu" })).toEqual(["premiumTemplates"]);
		expect(designFeaturesNeeded({ template: "pikachu" }, { template: "pikachu" })).toEqual([]);
		expect(designFeaturesNeeded({ template: "pikachu" }, { template: "onyx" })).toEqual([]);
		expect(designFeaturesNeeded({ template: "gengar" }, { template: "pikachu" })).toEqual(["premiumTemplates"]);
	});

	it("asks for custom styles only when they're added or changed, not kept or removed", () => {
		expect(designFeaturesNeeded({ template: "onyx" }, { template: "onyx", stylesheet: css("a { b: c }") })).toEqual([
			"customStyles",
		]);
		const before = { template: "onyx", stylesheet: css("a { b: c }") };
		expect(designFeaturesNeeded(before, { template: "onyx", stylesheet: css("  a { b: c }\n") })).toEqual([]);
		expect(designFeaturesNeeded(before, { template: "onyx", stylesheet: css("") })).toEqual([]);
		expect(designFeaturesNeeded(before, { template: "onyx" })).toEqual([]);
		expect(designFeaturesNeeded(before, { template: "onyx", stylesheet: css("a { b: d }") })).toEqual(["customStyles"]);
		expect(designFeaturesNeeded(null, { template: "onyx", stylesheet: css("   ") })).toEqual([]);
	});

	it("reads stored designs of any shape", () => {
		expect(designFeaturesNeeded({ template: 42, stylesheet: "nonsense" }, { template: "onyx" })).toEqual([]);
		expect(designFeaturesNeeded(undefined, { template: "gengar", stylesheet: css("x {}") })).toEqual([
			"premiumTemplates",
			"customStyles",
		]);
	});
});

describe("plan errors", () => {
	const requested = (resumes: number, coverLetters: number) => ({ resumes, coverLetters });

	it("explains a reached limit with the counts and a free way out, in neutral words", () => {
		const error = planLimitReached({
			limit: "activeResumes",
			max: 3,
			used: 3,
			planId: "free",
			requested: requested(1, 0),
		});
		expect(error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			status: 403,
			data: { limit: "activeResumes", max: 3, used: 3, planId: "free", requested: { resumes: 1, coverLetters: 0 } },
		});
		expect(error.message).toBe("The limit of 3 active resumes is reached. Move a resume to Trash to make a new one.");
		const imported = planLimitReached({
			limit: "activeCoverLetters",
			max: 3,
			used: 2,
			planId: "free",
			requested: requested(1, 2),
		});
		expect(imported.message).toContain("This adds 1 resume and 2 cover letters");
		expect(imported.message).toContain("limit of 3 active cover letters (2 in use)");
	});

	it("names no price, purchase or link, except to third-party apps", () => {
		for (const feature of PLAN_FEATURE_KEYS) {
			const error = planFeatureRequired(feature, "free");
			expect(error).toMatchObject({ code: "PLAN_FEATURE_REQUIRED", status: 403, data: { feature, planId: "free" } });
			if (feature === "automationApi") expect(error.message).toContain("https://rezumi.app/dashboard/settings/billing");
			else expect(error.message).not.toMatch(/Rp|\d+\.\d{3}|https?:|\bbuy\b|upgrade|purchase|price/i);
		}
		expect(planFeatureRequired("premiumTemplates", "free").message).toContain("Bronzor, Onyx, Rhyhorn or Azurill");
	});
});

describe("while billing is off", () => {
	it("allows everything without reading the database", async () => {
		await assertFeature("member", "wordOdtExport");
		await precheckDocumentCapacity("member", { resumes: 10 });
		await assertAutomationAccess({ user: { id: "member" }, method: "apiKey" });
		await assertAutomationAccess({ user: { id: "member" }, method: "bearer", clientId: "anything" });
	});
});

describe("firstPartyRedirectUris", () => {
	it("accepts the mobile apps' callbacks on the official host, this server and development builds", () => {
		expect([...firstPartyRedirectUris("https://staging.rezumi.app")]).toEqual([
			"https://rezumi.app/auth/native-callback",
			"https://staging.rezumi.app/auth/native-callback",
			"app.rezumi:/auth/native-callback",
		]);
	});
});
