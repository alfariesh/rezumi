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

const {
	designFeaturesNeeded,
	planFeatureRequired,
	planLimitReached,
	assertFeature,
	assertDesignChange,
	fitImportedDesign,
	precheckDocumentCapacity,
} = await import("./limits");
const { firstPartyRedirectUris, assertAutomationAccess } = await import("./automation");

const css = (text: string) => ({ source: { text } });

describe("designFeaturesNeeded", () => {
	it("asks for premium templates only when one is chosen anew", () => {
		expect(designFeaturesNeeded(null, { template: "meridian" })).toEqual([]);
		expect(designFeaturesNeeded(null, { template: "senja" })).toEqual(["premiumTemplates"]);
		expect(designFeaturesNeeded({ template: "meridian" }, { template: "senja" })).toEqual(["premiumTemplates"]);
		expect(designFeaturesNeeded({ template: "senja" }, { template: "senja" })).toEqual([]);
		expect(designFeaturesNeeded({ template: "senja" }, { template: "meridian" })).toEqual([]);
		expect(designFeaturesNeeded({ template: "linen" }, { template: "senja" })).toEqual(["premiumTemplates"]);
	});

	it("counts a former template as its successor on both sides", () => {
		// Ditgar became Purnama and Pikachu became Horizon: keeping either is free, switching to another is not.
		expect(designFeaturesNeeded({ template: "ditgar" }, { template: "purnama" })).toEqual([]);
		expect(designFeaturesNeeded({ template: "pikachu" }, { template: "horizon" })).toEqual([]);
		expect(designFeaturesNeeded({ template: "pikachu" }, { template: "senja" })).toEqual(["premiumTemplates"]);
		expect(designFeaturesNeeded({ template: "onyx" }, { template: "meridian" })).toEqual([]);
		expect(designFeaturesNeeded({ template: "nosepass" }, { template: "senja" })).toEqual(["premiumTemplates"]);
	});

	it("asks for custom styles only when they're added or changed, not kept or removed", () => {
		expect(
			designFeaturesNeeded({ template: "meridian" }, { template: "meridian", stylesheet: css("a { b: c }") }),
		).toEqual(["customStyles"]);
		const before = { template: "meridian", stylesheet: css("a { b: c }") };
		expect(designFeaturesNeeded(before, { template: "meridian", stylesheet: css("  a { b: c }\n") })).toEqual([]);
		expect(designFeaturesNeeded(before, { template: "meridian", stylesheet: css("") })).toEqual([]);
		expect(designFeaturesNeeded(before, { template: "meridian" })).toEqual([]);
		expect(designFeaturesNeeded(before, { template: "meridian", stylesheet: css("a { b: d }") })).toEqual([
			"customStyles",
		]);
		expect(designFeaturesNeeded(null, { template: "meridian", stylesheet: css("   ") })).toEqual([]);
	});

	it("asks for your own fonts only when a face is added, not kept or removed", () => {
		const font = (url: string) => ({ typography: { customFonts: [{ url }] } });
		const a = "https://rezumi.app/api/uploads/member/fonts/a.ttf";
		const b = "https://rezumi.app/api/uploads/member/fonts/b.otf";
		expect(designFeaturesNeeded(null, { template: "meridian", ...font(a) })).toEqual(["customFonts"]);
		expect(designFeaturesNeeded({ template: "meridian", ...font(a) }, { template: "meridian", ...font(a) })).toEqual(
			[],
		);
		expect(designFeaturesNeeded({ template: "meridian", ...font(a) }, { template: "meridian" })).toEqual([]);
		expect(designFeaturesNeeded({ template: "meridian", ...font(a) }, { template: "meridian", ...font(b) })).toEqual([
			"customFonts",
		]);
		expect(designFeaturesNeeded({ template: "meridian", typography: "nonsense" }, { template: "meridian" })).toEqual(
			[],
		);
	});

	it("asks for tool logos only when they're switched on, not kept or switched off", () => {
		const logos = (on: boolean) => ({ template: "meridian" as const, design: { icons: { logos: on } } });
		expect(designFeaturesNeeded(null, logos(true))).toEqual(["brandLogos"]);
		expect(designFeaturesNeeded(logos(false), logos(true))).toEqual(["brandLogos"]);
		expect(designFeaturesNeeded({ template: "meridian" }, logos(true))).toEqual(["brandLogos"]);
		expect(designFeaturesNeeded(logos(true), logos(true))).toEqual([]);
		expect(designFeaturesNeeded(logos(true), logos(false))).toEqual([]);
		expect(designFeaturesNeeded(logos(true), { template: "meridian" })).toEqual([]);
		expect(designFeaturesNeeded(null, logos(false))).toEqual([]);
		// Other icon settings, such as the style or turning every icon off and on, are on every plan.
		expect(
			designFeaturesNeeded({ template: "meridian", design: { icons: { logos: true, enabled: false } } }, {
				template: "meridian",
				design: { icons: { logos: true, enabled: true, style: "sharp" } },
			} as never),
		).toEqual([]);
	});

	it("reads stored designs of any shape", () => {
		expect(designFeaturesNeeded({ template: 42, stylesheet: "nonsense" }, { template: "meridian" })).toEqual([]);
		expect(designFeaturesNeeded({ template: "meridian", design: "nonsense" }, { template: "meridian" })).toEqual([]);
		expect(
			designFeaturesNeeded(
				{ template: "meridian", design: { icons: { logos: "yes" } } },
				{ template: "meridian", design: { icons: { logos: true } } },
			),
		).toEqual(["brandLogos"]);
		expect(designFeaturesNeeded(undefined, { template: "linen", stylesheet: css("x {}") })).toEqual([
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
		expect(planFeatureRequired("premiumTemplates", "free").message).toContain(
			"Meridian, Sterling, Tunas, Wibawa or Kirana",
		);
	});
});

describe("while billing is off", () => {
	it("allows everything without reading the database", async () => {
		await assertFeature("member", "wordOdtExport");
		await precheckDocumentCapacity("member", { resumes: 10 });
		await assertAutomationAccess({ user: { id: "member" }, method: "apiKey" });
		await assertAutomationAccess({ user: { id: "member" }, method: "bearer", clientId: "anything" });
	});

	it("still only lets a document gain fonts its owner uploaded", async () => {
		const design = (url: string) => ({ template: "meridian" as const, typography: { customFonts: [{ url }] } });
		const own = "https://rezumi.app/api/uploads/member/fonts/a.ttf";
		await assertDesignChange("member", null, design(own));
		await assertDesignChange("member", design("https://evil.example/x.ttf"), design("https://evil.example/x.ttf"));
		for (const url of [
			"https://rezumi.app/api/uploads/someone-else/fonts/a.ttf",
			"https://evil.example/api/uploads/member/fonts/a.ttf",
			"http://169.254.169.254/latest",
		])
			await expect(assertDesignChange("member", null, design(url))).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("leaves another account's fonts out of an import", async () => {
		const imported = {
			template: "meridian" as const,
			typography: {
				customFonts: [
					{ url: "https://rezumi.app/api/uploads/member/fonts/a.ttf" },
					{ url: "https://rezumi.app/api/uploads/someone-else/fonts/b.ttf" },
				],
			},
		};
		expect(await fitImportedDesign("member", imported)).toEqual({
			template: false,
			logos: false,
			stylesheet: false,
			fonts: true,
		});
		expect(imported.typography.customFonts).toEqual([{ url: "https://rezumi.app/api/uploads/member/fonts/a.ttf" }]);
	});

	it("keeps an imported file's tool logos", async () => {
		const imported = { template: "meridian" as const, design: { icons: { logos: true } } };
		expect((await fitImportedDesign("member", imported)).logos).toBe(false);
		expect(imported.design.icons.logos).toBe(true);
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
