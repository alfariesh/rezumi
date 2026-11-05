import type { GenerateTask } from "../career";
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
	/** Logos of known tools and technologies beside skills (`design.icons.logos`). Other icons are on every plan. */
	brandLogos: boolean;
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

export const BILLING_CATALOG_VERSION = 4;

export const BILLING_CURRENCY = "IDR";

/**
 * The templates on the free plan: seven one-column, ATS-safe layouts and one two-column. Meridian comes first: an
 * import that names a premium template falls back to it.
 */
export const FREE_TEMPLATES = [
	"meridian",
	"sterling",
	"tunas",
	"wibawa",
	"kirana",
	"cerah",
	"teras",
	"lintasan",
] as const satisfies readonly Template[];

/** Whether a template is one of the free plan's; the others need `premiumTemplates`. */
export function isFreeTemplate(template: Template): boolean {
	return (FREE_TEMPLATES as readonly Template[]).includes(template);
}

/** The billing features a plan names, in the order the apps list them. */
export const PLAN_FEATURE_KEYS = [
	"premiumTemplates",
	"brandLogos",
	"wordOdtExport",
	"customStyles",
	"customFonts",
	"automationApi",
] as const satisfies readonly (keyof PlanFeatures)[];

/** The one-time Rezumi AI trial: granted on first use to a registered account with a verified email. */
export const TRIAL_CREDITS = { amount: 5, validDays: 14 } as const;

/**
 * Credits each kind of Rezumi AI work costs, as the user sees it before running it: what the work is worth, not what
 * it costs. The 2026-11-03 benchmark kept the launch weights, since 100 credits spent in full cost a small part of the
 * plan's AI budget on Claude Haiku 5.5 (.agents/docs/research/benchmark-rezumi-ai-2026-11-03.md). Phase 05 maps each AI
 * entry point to one of these keys.
 */
export const CREDIT_COSTS = {
	/** Improve one bullet, write a short summary or read a job posting. */
	"short-text": 1,
	/** Draft one application-form answer or recruiter reply from the user's own experience. */
	"draft-answer": 2,
	/** Draft one cover letter for one job. */
	"cover-letter": 3,
	/** One text interview practice answer with feedback, a preparation brief or a debrief. */
	"interview-practice": 3,
	/** One Coach turn, with limited steps, context and output. */
	"coach-turn": 3,
	/** Review one resume, or match it against one job. */
	review: 4,
	/** Tailor one resume into a new version to review. */
	"tailor-resume": 5,
	/** Import one PDF or Word file with AI; importing without AI stays free. */
	"import-document": 5,
} as const satisfies Record<string, number>;

export type CreditAction = keyof typeof CREDIT_COSTS;

export const creditActionSchema = z.enum(Object.keys(CREDIT_COSTS) as [CreditAction, ...CreditAction[]]);

/**
 * Which AI runs a request: Rezumi AI (the server's AI, paid with credits) or the user's own connection. Requests that
 * name neither come from apps older than Rezumi AI and only ever use the user's own connection.
 */
export const aiSourceSchema = z.enum(["rezumi", "own"]);
export type AiSource = z.infer<typeof aiSourceSchema>;

/** The kind of Rezumi AI work each application workspace task is, for its credit cost. */
export const CAREER_TASK_CREDIT_ACTIONS = {
	fit: "review",
	briefing: "interview-practice",
	practice: "interview-practice",
	debrief: "interview-practice",
	reply: "draft-answer",
	answer: "draft-answer",
} as const satisfies Record<GenerateTask["task"], CreditAction>;

/** Where a grant of Rezumi AI credits came from: the one-time trial, a paid plan, or an administrator. */
export const creditSourceSchema = z.enum(["trial", "plan", "admin"]);
export type CreditSource = z.infer<typeof creditSourceSchema>;

const paidFeatures: PlanFeatures = {
	premiumTemplates: true,
	brandLogos: true,
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
			brandLogos: false,
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
