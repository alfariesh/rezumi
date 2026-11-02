import type { Template } from "@rezumi/schema/templates";
import { t } from "@lingui/core/macro";
import { templateSchema } from "@rezumi/schema/templates";

/**
 * The hosted plans as the landing page sells them (decisions: .agents/docs/plans/membership/00-keputusan-produk.md).
 * Indonesia is the first market, so every locale prices in Rupiah for now. Paid plans are 30-day passes that never
 * renew on their own.
 */

/** The templates on the free plan: three one-column, ATS-safe layouts and one two-column. */
export const freeTemplates: Template[] = ["bronzor", "onyx", "rhyhorn", "azurill"];

export const planCurrency = "IDR";

type PlanId = "free" | "plus" | "pro-ai";

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

export const getPlans = (): Plan[] => {
	const freeTemplateCount = freeTemplates.length;
	const templateCount = templateSchema.options.length;
	return [
		{
			id: "free",
			name: t`Free`,
			description: t`A resume ready to send, and a place to start applying.`,
			price: 0,
			features: [
				t`3 active resumes and 3 cover letters`,
				t`${freeTemplateCount} templates`,
				t`PDF downloads without a watermark`,
				t`ATS check and basic keyword matching`,
				t`Job tracker with board, calendar and insights`,
				t`5 AI credits to try`,
			],
			cta: t`Start free`,
		},
		{
			id: "plus",
			name: "Plus",
			description: t`Many versions of your application, in every format.`,
			price: 29_000,
			features: [
				t`50 active resumes and 50 cover letters`,
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
			price: 79_000,
			features: [
				t`Everything in Plus`,
				t`100 AI credits per purchase`,
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
