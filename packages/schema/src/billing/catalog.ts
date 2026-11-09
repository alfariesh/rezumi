import type { GenerateTask } from "../career";
import type { PortfolioHeroEffect, PortfolioTheme } from "../portfolio/themes";
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

/** The plans that are paid for; subscriptions and periods only ever hold these. */
export const paidPlanIdSchema = planIdSchema.exclude(["free"]);
export type PaidPlanId = z.infer<typeof paidPlanIdSchema>;

/** How often a subscription renews. Each paid plan is sold monthly and yearly. */
export const BILLING_INTERVALS = ["month", "year"] as const;
export const billingIntervalSchema = z.enum(BILLING_INTERVALS);
export type BillingInterval = z.infer<typeof billingIntervalSchema>;

/**
 * The currencies prices are set in (Polar's lowercase codes). Visitors from Indonesia pay in Rupiah; everyone else in
 * US dollars, the default.
 */
export const BILLING_CURRENCIES = ["usd", "idr"] as const;
export const billingCurrencySchema = z.enum(BILLING_CURRENCIES);
export type BillingCurrency = z.infer<typeof billingCurrencySchema>;
export const DEFAULT_BILLING_CURRENCY: BillingCurrency = "usd";

/** The currency a visitor from a country (ISO 3166 alpha-2, as Cloudflare's CF-IPCountry gives it) is charged in. */
export function currencyForCountry(country: string | null | undefined): BillingCurrency {
	return country?.trim().toUpperCase() === "ID" ? "idr" : DEFAULT_BILLING_CURRENCY;
}

/**
 * Amounts are integers in the currency's smallest unit, as Polar takes them: US cents, and for the Rupiah also two
 * decimals (Rp59.000 is 5_900_000; checked on Polar's sandbox checkout, 2026-11-05).
 */
export const CURRENCY_DECIMALS: Record<BillingCurrency, number> = { usd: 2, idr: 2 };

/** An amount in a currency's smallest unit, as a plain number of units (499 cents → 4.99). */
export function toMajorUnits(amount: number, currency: string): number {
	const decimals = CURRENCY_DECIMALS[currency.toLowerCase() as BillingCurrency] ?? 2;
	return amount / 10 ** decimals;
}

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
	/** Portfolio themes outside FREE_PORTFOLIO_THEMES. */
	premiumPortfolioThemes: boolean;
	/** Portfolio intro effects outside FREE_PORTFOLIO_HERO_EFFECTS. */
	premiumHeroEffects: boolean;
	/** Hiding the "Made with Rezumi" badge on the portfolio. */
	hidePortfolioCredit: boolean;
	/** Connecting the account's own domain, whether it opens the portfolio or the primary resume. */
	customDomain: boolean;
	/** The portfolio's statistics by country, device, referrer and work; every plan has the basic numbers. */
	detailedPortfolioStats: boolean;
};

export type PlanLimits = {
	/** Resumes not in Trash. */
	activeResumes: number;
	/** Cover letters not in Trash. */
	activeCoverLetters: number;
	/** Works in the portfolio. Never above PORTFOLIO_LIMITS.works, the technical limit. */
	portfolioWorks: number;
	/** Bytes of pictures and PDFs stored for the portfolio. Never above PORTFOLIO_UPLOAD.accountBytes. */
	portfolioStorageBytes: number;
};

/** A paid plan's price per renewal, in each currency's smallest unit. Prices include tax where tax is inclusive. */
export type PlanPrices = Record<BillingInterval, Record<BillingCurrency, number>>;

export type PlanDefinition = {
	id: PlanId;
	/** Higher ranks win when an account has more than one source of access: free 0, plus 1, pro-ai 2. */
	rank: number;
	/** What one renewal costs; null for free, which costs nothing and never ends. */
	prices: PlanPrices | null;
	limits: PlanLimits;
	features: PlanFeatures;
	/** Rezumi AI credits granted for each month of the plan, yearly subscriptions included; they don't roll over. */
	creditsPerMonth: number;
	/**
	 * Free days before the first charge of an account's first subscription to this plan (a card is still taken at
	 * checkout); null for none. Plan changes into a plan without one end a running trial.
	 */
	trialDays: number | null;
};

export const BILLING_CATALOG_VERSION = 7;

/**
 * Prices are before tax: Polar adds the tax for the buyer's location at checkout and on every renewal. Polar's
 * "Default tax behavior" (or each price's) must be Exclusive to match; the apps say so next to prices.
 */
export const BILLING_PRICES_INCLUDE_TAX = false;

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

/** The portfolio themes on the free plan; the others need `premiumPortfolioThemes`. */
export const FREE_PORTFOLIO_THEMES = ["lugas", "prima"] as const satisfies readonly PortfolioTheme[];

/** The portfolio intro effects on the free plan; the others need `premiumHeroEffects`. */
export const FREE_PORTFOLIO_HERO_EFFECTS = [
	"none",
	"fade-up",
	"shimmer",
] as const satisfies readonly PortfolioHeroEffect[];

export const isFreePortfolioHeroEffect = (effect: PortfolioHeroEffect): boolean =>
	(FREE_PORTFOLIO_HERO_EFFECTS as readonly PortfolioHeroEffect[]).includes(effect);

/** The features about documents and automation, the ones every app lists. */
export const DOCUMENT_PLAN_FEATURE_KEYS = [
	"premiumTemplates",
	"brandLogos",
	"wordOdtExport",
	"customStyles",
	"customFonts",
	"automationApi",
] as const satisfies readonly (keyof PlanFeatures)[];

/** The features about the portfolio; apps list them only where portfolios are open to the account. */
export const PORTFOLIO_PLAN_FEATURE_KEYS = [
	"premiumPortfolioThemes",
	"premiumHeroEffects",
	"hidePortfolioCredit",
	"customDomain",
	"detailedPortfolioStats",
] as const satisfies readonly (keyof PlanFeatures)[];

/** The billing features a plan names, in the order the apps list them. */
export const PLAN_FEATURE_KEYS = [...DOCUMENT_PLAN_FEATURE_KEYS, ...PORTFOLIO_PLAN_FEATURE_KEYS] as const;

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
	/** Rewrite one portfolio field: shorter, more professional, or in the page's language. */
	"portfolio-rewrite": 1,
	/** Find the results written in a resume, as metrics to pick from. */
	"portfolio-metrics": 1,
	/** Draft one application-form answer or recruiter reply from the user's own experience. */
	"draft-answer": 2,
	/** Draft one cover letter for one job. */
	"cover-letter": 3,
	/** Draft a portfolio from its resume: the greeting, About me and each work's story. */
	"portfolio-draft": 3,
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
	premiumPortfolioThemes: true,
	premiumHeroEffects: true,
	hidePortfolioCredit: true,
	customDomain: true,
	detailedPortfolioStats: true,
};

const MEGABYTE = 1024 * 1024;

/** What every paid plan may keep in its portfolio: the technical limits of works and storage. */
const paidPortfolioLimits = { portfolioWorks: 50, portfolioStorageBytes: 1024 * MEGABYTE };

export const PLANS = {
	free: {
		id: "free",
		rank: 0,
		prices: null,
		limits: { activeResumes: 3, activeCoverLetters: 3, portfolioWorks: 6, portfolioStorageBytes: 100 * MEGABYTE },
		features: {
			premiumTemplates: false,
			brandLogos: false,
			wordOdtExport: false,
			customStyles: false,
			customFonts: false,
			automationApi: false,
			premiumPortfolioThemes: false,
			premiumHeroEffects: false,
			hidePortfolioCredit: false,
			customDomain: false,
			detailedPortfolioStats: false,
		},
		creditsPerMonth: 0,
		trialDays: null,
	},
	plus: {
		id: "plus",
		rank: 1,
		prices: {
			month: { usd: 499, idr: 5_900_000 },
			year: { usd: 3_900, idr: 45_900_000 },
		},
		limits: { activeResumes: 50, activeCoverLetters: 50, ...paidPortfolioLimits },
		features: paidFeatures,
		creditsPerMonth: 0,
		trialDays: 7,
	},
	"pro-ai": {
		id: "pro-ai",
		rank: 2,
		prices: {
			month: { usd: 999, idr: 12_900_000 },
			year: { usd: 7_900, idr: 99_900_000 },
		},
		limits: { activeResumes: 50, activeCoverLetters: 50, ...paidPortfolioLimits },
		features: paidFeatures,
		creditsPerMonth: 100,
		trialDays: null,
	},
} as const satisfies { readonly [Id in PlanId]: PlanDefinition & { id: Id } };

export function getPlan(id: PlanId): PlanDefinition {
	return PLANS[id];
}

export function isPaidPlan(id: PlanId): id is PaidPlanId {
	return PLANS[id].prices !== null;
}

/** What one renewal of a paid plan costs, in the currency's smallest unit. */
export function planPrice(planId: PaidPlanId, interval: BillingInterval, currency: BillingCurrency): number {
	return PLANS[planId].prices[interval][currency];
}

/** How many months one renewal covers, for monthly credits on yearly subscriptions. */
export const INTERVAL_MONTHS: Record<BillingInterval, number> = { month: 1, year: 12 };
