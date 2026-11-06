import { describe, expect, it } from "vite-plus/test";
import { templateSchema } from "../templates";
import {
	BILLING_CATALOG_VERSION,
	BILLING_PRICES_INCLUDE_TAX,
	BILLING_CURRENCIES,
	BILLING_INTERVALS,
	CREDIT_COSTS,
	creditActionSchema,
	currencyForCountry,
	DEFAULT_BILLING_CURRENCY,
	FREE_TEMPLATES,
	getPlan,
	isFreeTemplate,
	isPaidPlan,
	PLAN_FEATURE_KEYS,
	paidPlanIdSchema,
	planIdSchema,
	planPrice,
	PLANS,
	toMajorUnits,
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
		expect(isFreeTemplate("meridian")).toBe(true);
		expect(isFreeTemplate("senja")).toBe(false);
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

	it("sells paid plans monthly and yearly, in every currency, with yearly cheaper than twelve months", () => {
		expect(paidPlanIdSchema.options).toEqual(["plus", "pro-ai"]);
		expect(isPaidPlan("free")).toBe(false);
		expect(PLANS.free.prices).toBeNull();
		for (const id of paidPlanIdSchema.options) {
			expect(isPaidPlan(id)).toBe(true);
			for (const interval of BILLING_INTERVALS)
				for (const currency of BILLING_CURRENCIES) {
					const price = planPrice(id, interval, currency);
					expect(Number.isInteger(price) && price > 0).toBe(true);
				}
			for (const currency of BILLING_CURRENCIES)
				expect(planPrice(id, "year", currency)).toBeLessThan(planPrice(id, "month", currency) * 12);
		}
	});

	it("matches the launch decisions", () => {
		expect(BILLING_CATALOG_VERSION).toBe(6);
		// A free week before the first charge, on Plus only (2026-11-05); prices are before tax.
		expect([PLANS.free.trialDays, PLANS.plus.trialDays, PLANS["pro-ai"].trialDays]).toEqual([null, 7, null]);
		expect(BILLING_PRICES_INCLUDE_TAX).toBe(false);
		expect(PLANS.plus.prices).toEqual({ month: { usd: 499, idr: 5_900_000 }, year: { usd: 3_900, idr: 45_900_000 } });
		expect(PLANS["pro-ai"].prices).toEqual({
			month: { usd: 999, idr: 12_900_000 },
			year: { usd: 7_900, idr: 99_900_000 },
		});
		expect(PLANS.free.limits).toEqual({ activeResumes: 3, activeCoverLetters: 3 });
		expect(PLANS.plus.limits).toEqual({ activeResumes: 50, activeCoverLetters: 50 });
		expect(PLANS["pro-ai"].limits).toEqual({ activeResumes: 50, activeCoverLetters: 50 });
		expect(Object.values(PLANS.free.features).every((enabled) => !enabled)).toBe(true);
		expect(Object.values(PLANS.plus.features).every(Boolean)).toBe(true);
		expect(PLANS["pro-ai"].features).toEqual(PLANS.plus.features);
		expect(PLANS.plus.creditsPerMonth).toBe(0);
		expect(PLANS["pro-ai"].creditsPerMonth).toBe(100);
		expect(TRIAL_CREDITS).toEqual({ amount: 5, validDays: 14 });
	});

	it("charges visitors from Indonesia in Rupiah and everyone else in US dollars", () => {
		expect(currencyForCountry("ID")).toBe("idr");
		expect(currencyForCountry(" id ")).toBe("idr");
		expect(currencyForCountry("US")).toBe("usd");
		expect(currencyForCountry("SG")).toBe("usd");
		expect(currencyForCountry(null)).toBe(DEFAULT_BILLING_CURRENCY);
		expect(currencyForCountry("XX")).toBe("usd");
	});

	it("reads amounts in each currency's smallest unit", () => {
		expect(toMajorUnits(499, "usd")).toBe(4.99);
		expect(toMajorUnits(5_900_000, "idr")).toBe(59_000);
		expect(toMajorUnits(12_900_000, "IDR")).toBe(129_000);
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
