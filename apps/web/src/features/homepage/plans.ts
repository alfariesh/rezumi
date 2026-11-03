import type { PlanId, PlanLimits } from "@rezumi/schema/billing";
import type { Template } from "@rezumi/schema/templates";
import { t } from "@lingui/core/macro";
import { BILLING_CURRENCY, FREE_TEMPLATES, PLANS, TRIAL_CREDITS } from "@rezumi/schema/billing";
import { templateLineup } from "@rezumi/schema/templates";

/**
 * The hosted plans as the landing page sells them. Prices, limits and credits come from the catalog the server
 * enforces (@rezumi/schema/billing); the copy stays here. Indonesia is the first market, so every locale prices in
 * Rupiah for now. Paid plans are 30-day passes that never renew on their own.
 */

/** The templates on the free plan: three one-column, ATS-safe layouts and one two-column. */
export const freeTemplates: readonly Template[] = FREE_TEMPLATES;

export const planCurrency = BILLING_CURRENCY;

export type Plan = {
	id: PlanId;
	name: string;
	description: string;
	/** In whole Rupiah. */
	price: number;
	features: string[];
	cta: string;
	featured?: boolean;
};

const documentLimits = ({ activeResumes, activeCoverLetters }: PlanLimits) =>
	t`${activeResumes} active resumes and ${activeCoverLetters} cover letters`;

export const getPlans = (): Plan[] => {
	const freeTemplateCount = freeTemplates.length;
	const templateCount = templateLineup.length;
	const trialCredits = TRIAL_CREDITS.amount;
	const proCredits = PLANS["pro-ai"].creditsPerPurchase;
	return [
		{
			id: "free",
			name: t`Free`,
			description: t`A resume ready to send, and a place to start applying.`,
			price: PLANS.free.priceIdr,
			features: [
				documentLimits(PLANS.free.limits),
				t`${freeTemplateCount} templates`,
				t`PDF downloads without a watermark`,
				t`ATS check and basic keyword matching`,
				t`Job tracker with board, calendar and insights`,
				t`${trialCredits} AI credits to try`,
			],
			cta: t`Start free`,
		},
		{
			id: "plus",
			name: "Plus",
			description: t`Many versions of your application, in every format.`,
			price: PLANS.plus.priceIdr,
			features: [
				documentLimits(PLANS.plus.limits),
				t`All ${templateCount} templates`,
				t`Word and ODT downloads`,
				t`Custom styles and your own fonts`,
				t`MCP and API for your own automations`,
			],
			cta: t`Choose Plus`,
		},
		{
			id: "pro-ai",
			name: "Pro AI",
			description: t`Tailor applications and prepare for interviews with AI.`,
			price: PLANS["pro-ai"].priceIdr,
			features: [
				t`Everything in Plus`,
				t`${proCredits} AI credits per purchase`,
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
