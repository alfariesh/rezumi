import { describe, expect, it } from "vite-plus/test";
import { templateSchema } from "../templates";
import {
	BILLING_CATALOG_VERSION,
	CREDIT_COSTS,
	creditActionSchema,
	FREE_TEMPLATES,
	getPlan,
	isFreeTemplate,
	isPaidPlan,
	PLAN_FEATURE_KEYS,
	paidPlanIdSchema,
	planIdSchema,
	PLANS,
	TRIAL_CREDITS,
} from "./catalog";

describe("billing catalog", () => {
	it("offers only templates that exist, each once", () => {
		for (const id of FREE_TEMPLATES) expect(templateSchema.options).toContain(id);
		expect(new Set(FREE_TEMPLATES).size).toBe(FREE_TEMPLATES.length);
		expect(FREE_TEMPLATES.length).toBeLessThan(templateSchema.options.length);
	});

	it("tells free templates from premium ones", () => {
		for (const id of templateSchema.options)
			expect(isFreeTemplate(id)).toBe((FREE_TEMPLATES as readonly string[]).includes(id));
		expect(isFreeTemplate("onyx")).toBe(true);
		expect(isFreeTemplate("pikachu")).toBe(false);
	});

	it("lists every plan feature once", () => {
		expect(PLAN_FEATURE_KEYS.toSorted()).toEqual(Object.keys(PLANS.free.features).toSorted());
	});

	it("defines every plan under its own id, ranked free < plus < pro-ai", () => {
		expect(Object.keys(PLANS).toSorted()).toEqual(planIdSchema.options.toSorted());
		for (const id of planIdSchema.options) expect(getPlan(id).id).toBe(id);
		expect(PLANS.free.rank).toBeLessThan(PLANS.plus.rank);
		expect(PLANS.plus.rank).toBeLessThan(PLANS["pro-ai"].rank);
	});

	it("sells paid plans as 30-day passes for whole Rupiah", () => {
		expect(paidPlanIdSchema.options).toEqual(["plus", "pro-ai"]);
		for (const id of planIdSchema.options) {
			const plan = getPlan(id);
			expect(isPaidPlan(id)).toBe(id !== "free");
			expect(Number.isInteger(plan.priceIdr)).toBe(true);
			if (isPaidPlan(id)) {
				expect(plan.priceIdr).toBeGreaterThan(0);
				expect(plan.durationDays).toBe(30);
			} else {
				expect(plan.priceIdr).toBe(0);
				expect(plan.durationDays).toBeNull();
			}
		}
	});

	it("matches the launch decisions", () => {
		expect(BILLING_CATALOG_VERSION).toBe(1);
		expect(PLANS.plus.priceIdr).toBe(29_000);
		expect(PLANS["pro-ai"].priceIdr).toBe(79_000);
		expect(PLANS.free.limits).toEqual({ activeResumes: 3, activeCoverLetters: 3 });
		expect(PLANS.plus.limits).toEqual({ activeResumes: 50, activeCoverLetters: 50 });
		expect(PLANS["pro-ai"].limits).toEqual({ activeResumes: 50, activeCoverLetters: 50 });
		expect(Object.values(PLANS.free.features).every((enabled) => !enabled)).toBe(true);
		expect(Object.values(PLANS.plus.features).every(Boolean)).toBe(true);
		expect(PLANS["pro-ai"].features).toEqual(PLANS.plus.features);
		expect(PLANS.plus.creditsPerPurchase).toBe(0);
		expect(PLANS["pro-ai"].creditsPerPurchase).toBe(100);
		expect(TRIAL_CREDITS).toEqual({ amount: 5, validDays: 14 });
	});

	it("prices every kind of Rezumi AI work in whole credits, with the launch weights", () => {
		expect(CREDIT_COSTS).toEqual({
			"short-text": 1,
			"draft-answer": 2,
			"cover-letter": 3,
			"interview-practice": 3,
			"coach-turn": 3,
			review: 4,
			"tailor-resume": 5,
			"import-document": 5,
		});
		for (const cost of Object.values(CREDIT_COSTS)) expect(Number.isInteger(cost) && cost > 0).toBe(true);
		expect(creditActionSchema.options).toEqual(Object.keys(CREDIT_COSTS));
	});
});
