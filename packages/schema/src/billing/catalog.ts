import type { Template } from "../templates";
import z from "zod";

/**
 * The plans Rezumi sells, as the server enforces them and every app shows them. Business rules live in
 * .agents/docs/plans/membership/00-keputusan-produk.md; marketing copy (translated names, benefit lists) stays in the
 * apps. Changing a price or what a plan includes bumps BILLING_CATALOG_VERSION; payments keep the copy they were
 * created with.
 */

export const planIdSchema = z.enum(["free", "plus", "pro-ai"]);
export type PlanId = z.infer<typeof planIdSchema>;

/** The plans that are bought as passes; membership periods only ever hold these. */
export const paidPlanIdSchema = planIdSchema.exclude(["free"]);
export type PaidPlanId = z.infer<typeof paidPlanIdSchema>;

export type PlanFeatures = {
	/** Templates outside FREE_TEMPLATES. */
	premiumTemplates: boolean;
	/** New Word (.docx) and ODT exports. */
	wordOdtExport: boolean;
	/** Custom Styles (CSS); see docs/applying-custom-styles.mdx. */
	customStyles: boolean;
	/** Uploading fonts of your own. */
	customFonts: boolean;
	/** API keys and third-party OAuth/MCP clients. Rezumi's own web and mobile apps never need it. */
	automationApi: boolean;
};

export type PlanLimits = {
	/** Resumes not in Trash. */
	activeResumes: number;
	/** Cover letters not in Trash. */
	activeCoverLetters: number;
};

export type PlanDefinition = {
	id: PlanId;
	/** Higher ranks are used up first when passes queue: free 0, plus 1, pro-ai 2. */
	rank: number;
	/** Whole Rupiah; 0 for free. Shown as the final price: the seller isn't VAT-registered. */
	priceIdr: number;
	/** How long one purchase lasts, in 24-hour days. Null for free, which never ends. */
	durationDays: number | null;
	limits: PlanLimits;
	features: PlanFeatures;
	/** Rezumi AI credits granted at once when a purchase is paid. */
	creditsPerPurchase: number;
};

export const BILLING_CATALOG_VERSION = 1;

export const BILLING_CURRENCY = "IDR";

/** The templates on the free plan: three one-column, ATS-safe layouts and one two-column. */
export const FREE_TEMPLATES = ["bronzor", "onyx", "rhyhorn", "azurill"] as const satisfies readonly Template[];

/** The one-time Rezumi AI trial: granted on first use to a registered account with a verified email. */
export const TRIAL_CREDITS = { amount: 5, validDays: 14 } as const;

/** Credits each Rezumi AI action costs, by action key. Filled in when metering lands (membership phases 04 and 05). */
export const CREDIT_COSTS = {} as const satisfies Record<string, number>;

const paidFeatures: PlanFeatures = {
	premiumTemplates: true,
	wordOdtExport: true,
	customStyles: true,
	customFonts: true,
	automationApi: true,
};

export const PLANS = {
	free: {
		id: "free",
		rank: 0,
		priceIdr: 0,
		durationDays: null,
		limits: { activeResumes: 3, activeCoverLetters: 3 },
		features: {
			premiumTemplates: false,
			wordOdtExport: false,
			customStyles: false,
			customFonts: false,
			automationApi: false,
		},
		creditsPerPurchase: 0,
	},
	plus: {
		id: "plus",
		rank: 1,
		priceIdr: 29_000,
		durationDays: 30,
		limits: { activeResumes: 50, activeCoverLetters: 50 },
		features: paidFeatures,
		creditsPerPurchase: 0,
	},
	"pro-ai": {
		id: "pro-ai",
		rank: 2,
		priceIdr: 79_000,
		durationDays: 30,
		limits: { activeResumes: 50, activeCoverLetters: 50 },
		features: paidFeatures,
		creditsPerPurchase: 100,
	},
} as const satisfies { readonly [Id in PlanId]: PlanDefinition & { id: Id } };

export function getPlan(id: PlanId): PlanDefinition {
	return PLANS[id];
}

export function isPaidPlan(id: PlanId): id is PaidPlanId {
	return PLANS[id].durationDays !== null;
}
