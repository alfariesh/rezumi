import type { PortfolioHeroEffect } from "../portfolio/themes";
import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "../portfolio/limits";
import { isFreePortfolioTheme, PORTFOLIO_THEMES, portfolioThemeLineup } from "../portfolio/themes";
import { templateSchema } from "../templates";
import {
	BILLING_CATALOG_VERSION,
	BILLING_CURRENCIES,
	BILLING_INTERVALS,
	CREDIT_COSTS,
	creditActionSchema,
	currencyForCountry,
	DEFAULT_BILLING_CURRENCY,
	FREE_PORTFOLIO_THEMES,
	FREE_TEMPLATES,
	getPlan,
	isFreePortfolioHeroEffect,
	isFreeTemplate,
	isPaidPlan,
	PLAN_FEATURE_KEYS,
	PORTFOLIO_PLAN_FEATURE_KEYS,
	PASS_DAYS,
	PAYMENT_METHOD_CURRENCY,
	paidPlanIdSchema,
	paymentMethodsForCountry,
	planIdSchema,
	planPrice,
	PLANS,
	PRICES_INCLUDE_TAX,
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
		expect(BILLING_CATALOG_VERSION).toBe(8);
		// A free week before the first card charge, on Plus only (2026-11-05). Card prices are before tax; QRIS prices
		// (2026-11-10) are final, for 30 or 365 days.
		expect([PLANS.free.trialDays, PLANS.plus.trialDays, PLANS["pro-ai"].trialDays]).toEqual([null, 7, null]);
		expect(PRICES_INCLUDE_TAX).toEqual({ usd: false, idr: true });
		expect(PASS_DAYS).toEqual({ month: 30, year: 365 });
		expect(PLANS.plus.prices).toEqual({ month: { usd: 499, idr: 2_900_000 }, year: { usd: 3_900, idr: 24_900_000 } });
		expect(PLANS["pro-ai"].prices).toEqual({
			month: { usd: 999, idr: 5_900_000 },
			year: { usd: 7_900, idr: 49_900_000 },
		});
		expect(PLANS.free.limits).toMatchObject({ activeResumes: 3, activeCoverLetters: 3 });
		expect(PLANS.plus.limits).toMatchObject({ activeResumes: 50, activeCoverLetters: 50 });
		expect(PLANS["pro-ai"].limits).toMatchObject({ activeResumes: 50, activeCoverLetters: 50 });
		expect(Object.values(PLANS.free.features).every((enabled) => !enabled)).toBe(true);
		expect(Object.values(PLANS.plus.features).every(Boolean)).toBe(true);
		expect(PLANS["pro-ai"].features).toEqual(PLANS.plus.features);
		expect(PLANS.plus.creditsPerMonth).toBe(0);
		expect(PLANS["pro-ai"].creditsPerMonth).toBe(100);
		expect(TRIAL_CREDITS).toEqual({ amount: 5, validDays: 14 });
	});

	it("offers QRIS in Rupiah first in Indonesia, with a card as the other choice, and only a card elsewhere", () => {
		expect(paymentMethodsForCountry("ID")).toEqual(["qris", "card"]);
		expect(paymentMethodsForCountry(" id ")).toEqual(["qris", "card"]);
		expect(paymentMethodsForCountry("SG")).toEqual(["card"]);
		expect(paymentMethodsForCountry(null)).toEqual(["card"]);
		expect(PAYMENT_METHOD_CURRENCY).toEqual({ card: "usd", qris: "idr" });
	});

	it("shows visitors from Indonesia Rupiah first and everyone else US dollars", () => {
		expect(currencyForCountry("ID")).toBe("idr");
		expect(currencyForCountry(" id ")).toBe("idr");
		expect(currencyForCountry("US")).toBe("usd");
		expect(currencyForCountry("SG")).toBe("usd");
		expect(currencyForCountry(null)).toBe(DEFAULT_BILLING_CURRENCY);
		expect(currencyForCountry("XX")).toBe("usd");
	});

	it("reads amounts in each currency's smallest unit", () => {
		expect(toMajorUnits(499, "usd")).toBe(4.99);
		expect(toMajorUnits(2_900_000, "idr")).toBe(29_000);
		expect(toMajorUnits(49_900_000, "IDR")).toBe(499_000);
	});

	it("prices every kind of Rezumi AI work in whole credits, with the launch weights", () => {
		expect(CREDIT_COSTS).toEqual({
			"short-text": 1,
			"portfolio-rewrite": 1,
			"portfolio-metrics": 1,
			"draft-answer": 2,
			"cover-letter": 3,
			"portfolio-draft": 3,
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

describe("portfolio plans", () => {
	it("sells the free themes and effects the gallery labels", () => {
		expect(FREE_PORTFOLIO_THEMES.toSorted()).toEqual(PORTFOLIO_THEMES.filter(isFreePortfolioTheme).toSorted());
		for (const { effects } of portfolioThemeLineup.filter((theme) => theme.plan === "free"))
			expect(isFreePortfolioHeroEffect(effects[0] as PortfolioHeroEffect)).toBe(true);
	});

	it("keeps paid limits within the technical limits", () => {
		for (const plan of Object.values(PLANS)) {
			expect(plan.limits.portfolioWorks).toBeLessThanOrEqual(PORTFOLIO_LIMITS.works);
			expect(plan.limits.portfolioStorageBytes).toBeLessThanOrEqual(PORTFOLIO_UPLOAD.accountBytes);
		}
		expect(PLANS.free.limits.portfolioWorks).toBe(6);
		expect(PLANS.free.limits.portfolioStorageBytes).toBe(100 * 1024 * 1024);
		expect(PLANS.plus.limits.portfolioStorageBytes).toBe(PORTFOLIO_UPLOAD.accountBytes);
	});

	it("names every portfolio feature for the apps to list", () => {
		expect(PORTFOLIO_PLAN_FEATURE_KEYS).toHaveLength(5);
		for (const feature of PORTFOLIO_PLAN_FEATURE_KEYS) {
			expect(PLAN_FEATURE_KEYS).toContain(feature);
			expect(PLANS.free.features[feature]).toBe(false);
			expect(PLANS.plus.features[feature]).toBe(true);
			expect(PLANS["pro-ai"].features[feature]).toBe(true);
		}
	});
});
