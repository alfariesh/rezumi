import type { PlanSummary } from "./plan";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";

vi.mock("@/libs/orpc/client", () => ({ orpc: {} }));
i18n.loadAndActivate({ locale: "en", messages: {} });

const {
	describeImportedDesign,
	describePlanProblem,
	getPlanProblem,
	hasPlanFeature,
	isLabelledTemplate,
	isLockedTemplate,
} = await import("./plan");

const summary = (enabled: boolean, paid: boolean): PlanSummary => ({
	enabled,
	planId: paid ? "plus" : "free",
	currentPeriodEndsAt: null,
	upcoming: [],
	limits: { activeResumes: { used: 0, max: 3 }, activeCoverLetters: { used: 0, max: 3 } },
	features: {
		premiumTemplates: paid,
		wordOdtExport: paid,
		customStyles: paid,
		customFonts: paid,
		automationApi: paid,
	},
	credits: null,
	canPurchase: false,
	purchaseBlockedBy: "unavailable",
	pendingPayment: null,
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
			...(["premiumTemplates", "wordOdtExport", "customStyles", "customFonts", "automationApi"] as const).map(
				(feature) => ({ kind: "feature", feature }) as const,
			),
		] as const;
		for (const problem of problems) {
			const copy = describePlanProblem(problem);
			expect(copy.title).not.toBe("");
			expect(`${copy.title} ${copy.description}`).not.toMatch(/Rp|\d+\.\d{3}|https?:|\bbuy\b/i);
		}
		expect(describePlanProblem(problems[1]).description).toContain("a resume and 2 cover letters");
		expect(describePlanProblem({ kind: "feature", feature: "premiumTemplates" }).description).toContain(
			"Meridian, Sterling, Tunas, Wibawa, and Kirana",
		);
	});

	it("says what an import gave up to fit the plan", () => {
		const free = summary(true, false);
		const css = { source: { text: "a { b: c }" } };
		expect(describeImportedDesign(free, { template: "senja", stylesheet: css })).toContain("Meridian");
		expect(describeImportedDesign(free, { template: "meridian", stylesheet: css })).toContain("styles");
		expect(describeImportedDesign(free, { template: "meridian" })).toBeNull();
		expect(describeImportedDesign(summary(true, true), { template: "senja", stylesheet: css })).toBeNull();
	});
});
