import type { PlanProblem, PlanSummary } from "./plan";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { PLAN_FEATURE_KEYS } from "@rezumi/schema/billing";

vi.mock("@/libs/orpc/client", () => ({ orpc: {} }));
i18n.loadAndActivate({ locale: "en", messages: {} });

const {
	describeImportedDesign,
	describePlanProblem,
	getPlanProblem,
	hasPlanFeature,
	isLabelledTemplate,
	isLockedHeroEffect,
	isLockedPortfolioTheme,
	isLockedTemplate,
} = await import("./plan");

const summary = (enabled: boolean, paid: boolean): PlanSummary => ({
	enabled,
	planId: paid ? "plus" : "free",
	currentPeriodEndsAt: null,
	source: null,
	renews: false,
	subscription: null,
	currency: "usd",
	upcoming: [],
	limits: { activeResumes: { used: 0, max: 3 }, activeCoverLetters: { used: 0, max: 3 } },
	features: {
		premiumTemplates: paid,
		brandLogos: paid,
		wordOdtExport: paid,
		customStyles: paid,
		customFonts: paid,
		automationApi: paid,
		premiumPortfolioThemes: paid,
		premiumHeroEffects: paid,
		hidePortfolioCredit: paid,
		customDomain: paid,
		detailedPortfolioStats: paid,
	},
	credits: null,
	canPurchase: false,
	purchaseBlockedBy: "unavailable",
	pendingPayment: null,
	trialAvailable: false,
});

describe("plan features", () => {
	it("opens everything until the plan loads and while plans don't apply", () => {
		expect(hasPlanFeature(undefined, "wordOdtExport")).toBe(true);
		expect(hasPlanFeature(summary(false, false), "wordOdtExport")).toBe(true);
		expect(hasPlanFeature(summary(true, false), "wordOdtExport")).toBe(false);
		expect(hasPlanFeature(summary(true, true), "wordOdtExport")).toBe(true);
	});

	it("labels premium templates while plans apply, and locks them only without the feature", () => {
		expect(isLabelledTemplate(summary(false, false), "senja")).toBe(false);
		expect(isLabelledTemplate(summary(true, true), "senja")).toBe(true);
		expect(isLabelledTemplate(summary(true, false), "meridian")).toBe(false);
		expect(isLockedTemplate(summary(true, false), "senja")).toBe(true);
		expect(isLockedTemplate(summary(true, false), "meridian")).toBe(false);
		expect(isLockedTemplate(summary(true, true), "senja")).toBe(false);
	});
});

describe("plan problems", () => {
	it("reads limit and feature refusals from the server", () => {
		const limit = new ORPCError("PLAN_LIMIT_REACHED", {
			data: {
				limit: "activeCoverLetters",
				max: 3,
				used: 2,
				planId: "free",
				requested: { resumes: 1, coverLetters: 2 },
			},
		});
		expect(getPlanProblem(limit)).toEqual({
			kind: "limit",
			limit: "activeCoverLetters",
			max: 3,
			used: 2,
			requested: { resumes: 1, coverLetters: 2 },
		});
		expect(getPlanProblem(new ORPCError("PLAN_FEATURE_REQUIRED", { data: { feature: "wordOdtExport" } }))).toEqual({
			kind: "feature",
			feature: "wordOdtExport",
		});
		expect(getPlanProblem(new ORPCError("NOT_FOUND"))).toBeNull();
		expect(getPlanProblem(new Error("PLAN_LIMIT_REACHED"))).toBeNull();
	});

	it("explains each problem with the free way on and no price", () => {
		const problems = [
			{ kind: "limit", limit: "activeResumes", max: 3, used: 3, requested: { resumes: 1, coverLetters: 0 } },
			{ kind: "limit", limit: "activeCoverLetters", max: 3, used: 2, requested: { resumes: 1, coverLetters: 2 } },
			...PLAN_FEATURE_KEYS.map((feature) => ({ kind: "feature", feature }) as const),
		] as const;
		for (const problem of problems) {
			const copy = describePlanProblem(problem);
			expect(copy.title).not.toBe("");
			expect(`${copy.title} ${copy.description}`).not.toMatch(/Rp|\d+\.\d{3}|https?:|\bbuy\b/i);
		}
		expect(describePlanProblem(problems[1]).description).toContain("a resume and 2 cover letters");
		expect(describePlanProblem({ kind: "feature", feature: "premiumTemplates" }).description).toContain(
			"Meridian, Sterling, Tunas, Wibawa, Kirana, Cerah, Teras, and Lintasan",
		);
	});

	it("says what an import gave up to fit the plan", () => {
		const free = summary(true, false);
		const css = { source: { text: "a { b: c }" } };
		expect(describeImportedDesign(free, { template: "senja", stylesheet: css })).toContain("Meridian");
		expect(describeImportedDesign(free, { template: "meridian", stylesheet: css })).toContain("styles");
		expect(describeImportedDesign(free, { template: "meridian" })).toBeNull();
		expect(describeImportedDesign(summary(true, true), { template: "senja", stylesheet: css })).toBeNull();
		const logos = { design: { icons: { logos: true } } } as const;
		expect(describeImportedDesign(free, { template: "meridian", ...logos })).toContain("Tool logos");
		expect(describeImportedDesign(free, { template: "senja", ...logos })).toMatch(/Meridian.*Tool logos/);
		expect(describeImportedDesign(summary(true, true), { template: "meridian", ...logos })).toBeNull();
		expect(describeImportedDesign(free, { template: "meridian", design: { icons: { logos: false } } })).toBeNull();
	});
});

describe("portfolio plan problems", () => {
	const refusal = (code: string, data: unknown) => new ORPCError(code, { status: 403, data });

	it("reads a works or storage refusal from the server", () => {
		expect(getPlanProblem(refusal("PLAN_LIMIT_REACHED", { limit: "portfolioWorks", max: 6, used: 6 }))).toEqual({
			kind: "limit",
			limit: "portfolioWorks",
			max: 6,
			used: 6,
		});
		expect(
			getPlanProblem(
				refusal("PLAN_LIMIT_REACHED", { limit: "portfolioStorageBytes", max: 100 * 1024 * 1024, used: 1 }),
			),
		).toMatchObject({ limit: "portfolioStorageBytes" });
	});

	it("words each portfolio problem without a price", () => {
		const problems: PlanProblem[] = [
			{ kind: "limit", limit: "portfolioWorks", max: 6, used: 6 },
			{ kind: "limit", limit: "portfolioStorageBytes", max: 100 * 1024 * 1024, used: 1 },
			{ kind: "feature", feature: "premiumPortfolioThemes" },
			{ kind: "feature", feature: "premiumHeroEffects" },
			{ kind: "feature", feature: "hidePortfolioCredit" },
			{ kind: "feature", feature: "customDomain" },
			{ kind: "feature", feature: "detailedPortfolioStats" },
		];
		for (const problem of problems) {
			const { title, description } = describePlanProblem(problem);
			expect(title).not.toBe("");
			expect(`${title} ${description}`).not.toMatch(/\$|Rp|buy|upgrade/i);
		}
		expect(describePlanProblem(problems[1] as PlanProblem).description).toContain("100 MB");
	});

	it("locks only premium portfolio themes and effects, only where the plan lacks them", () => {
		const free = summary(true, false);
		const paid = summary(true, true);
		expect(isLockedPortfolioTheme(free, "kanvas")).toBe(true);
		expect(isLockedPortfolioTheme(free, "lugas")).toBe(false);
		expect(isLockedPortfolioTheme(paid, "kanvas")).toBe(false);
		expect(isLockedPortfolioTheme(undefined, "kanvas")).toBe(false);
		expect(isLockedHeroEffect(free, "typewriter")).toBe(true);
		expect(isLockedHeroEffect(free, "shimmer")).toBe(false);
		expect(isLockedHeroEffect(paid, "typewriter")).toBe(false);
	});
});
