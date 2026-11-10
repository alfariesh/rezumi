import type { BillingCurrency, PlanId, PlanLimits, PlanPrices } from "@rezumi/schema/billing";
import type { Template } from "@rezumi/schema/templates";
import { t } from "@lingui/core/macro";
import {
	DEFAULT_BILLING_CURRENCY,
	FREE_PORTFOLIO_THEMES,
	FREE_TEMPLATES,
	PLANS,
	TRIAL_CREDITS,
} from "@rezumi/schema/billing";
import { templateLineup } from "@rezumi/schema/templates";

/**
 * The hosted plans as the landing page sells them. Prices, limits and credits come from the catalog the server
 * enforces (@rezumi/schema/billing); the copy stays here. By card, paid plans are subscriptions, monthly or yearly,
 * that renew until cancelled; from Indonesia they are QRIS passes in Rupiah for 30 days or a year that don't renew. The
 * pages are prerendered per language, so the Indonesian one shows the Rupiah QRIS prices and the others US dollars; the
 * plan page and checkout use the visitor's country.
 */

/** The templates on the free plan: seven one-column, ATS-safe layouts and one two-column. */
export const freeTemplates: readonly Template[] = FREE_TEMPLATES;

/** The currency a landing page in this language shows. */
export const currencyForLocale = (locale: string): BillingCurrency =>
	locale.toLowerCase().startsWith("id") ? "idr" : DEFAULT_BILLING_CURRENCY;

export type Plan = {
	id: PlanId;
	name: string;
	description: string;
	/** Per month and per year in each currency's smallest unit; null for free. */
	prices: PlanPrices | null;
	features: string[];
	cta: string;
	featured?: boolean;
};

const documentLimits = ({ activeResumes, activeCoverLetters }: PlanLimits) =>
	t`${activeResumes} active resumes and ${activeCoverLetters} cover letters`;

export const getPlans = (portfolioEnabled = false): Plan[] => {
	const freeTemplateCount = freeTemplates.length;
	const templateCount = templateLineup.length;
	const trialCredits = TRIAL_CREDITS.amount;
	const proCredits = PLANS["pro-ai"].creditsPerMonth;
	const freeWorks = PLANS.free.limits.portfolioWorks;
	const freeThemes = FREE_PORTFOLIO_THEMES.length;
	return [
		{
			id: "free",
			name: t`Free`,
			description: t`A resume ready to send, and a place to start applying.`,
			prices: PLANS.free.prices,
			features: [
				documentLimits(PLANS.free.limits),
				t`${freeTemplateCount} templates`,
				t`PDF downloads without a watermark`,
				t`ATS check and basic keyword matching`,
				t`Job tracker with board, calendar and insights`,
				t`${trialCredits} AI credits to try`,
				...(portfolioEnabled ? [t`A web portfolio with ${freeWorks} works and ${freeThemes} themes`] : []),
			],
			cta: t`Start free`,
		},
		{
			id: "plus",
			name: "Plus",
			description: t`Many versions of your application, in every format.`,
			prices: PLANS.plus.prices,
			features: [
				documentLimits(PLANS.plus.limits),
				t`All ${templateCount} templates`,
				t`Tool logos beside your skills`,
				t`Word and ODT downloads`,
				t`Custom styles and your own fonts`,
				t`MCP and API for your own automations`,
				...(portfolioEnabled ? [t`Every portfolio theme, your own domain, no Rezumi badge`] : []),
			],
			cta: t`Try Plus free`,
		},
		{
			id: "pro-ai",
			name: "Pro AI",
			description: t`Tailor applications and prepare for interviews with AI.`,
			prices: PLANS["pro-ai"].prices,
			features: [
				t`Everything in Plus`,
				t`${proCredits} AI credits every month`,
				t`No API key to set up`,
				t`Tailor your resume to each posting`,
				t`Cover letters and recruiter replies`,
				t`Interview practice with feedback`,
			],
			cta: t`Choose Pro AI`,
			featured: true,
		},
	];
};
