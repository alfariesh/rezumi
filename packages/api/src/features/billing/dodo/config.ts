import type { BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import { env } from "@rezumi/env/server";

/** A paid plan and how often it renews: what one Dodo Payments product stands for. */
export type PlanProduct = { planId: PaidPlanId; interval: BillingInterval };

export type DodoConfig = {
	environment: "test_mode" | "live_mode";
	apiKey: string;
	/** Without it the webhook endpoint is off; payments still arrive through the billing job's checks. */
	webhookKey: string | null;
	/** Dodo's product id for each plan and interval. */
	products: Record<PaidPlanId, Record<BillingInterval, string>>;
};

/**
 * The Dodo Payments business this server sells through, or null when it has no API key. Startup already refused a key
 * without its mode or without all four products.
 */
export function getDodoConfig(): DodoConfig | null {
	const apiKey = env.DODO_PAYMENTS_API_KEY;
	const environment = env.DODO_PAYMENTS_ENVIRONMENT;
	const plusMonthly = env.DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY;
	const plusYearly = env.DODO_PAYMENTS_PRODUCT_PLUS_YEARLY;
	const proMonthly = env.DODO_PAYMENTS_PRODUCT_PRO_AI_MONTHLY;
	const proYearly = env.DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY;
	if (!apiKey || !environment || !plusMonthly || !plusYearly || !proMonthly || !proYearly) return null;
	return {
		environment,
		apiKey,
		webhookKey: env.DODO_PAYMENTS_WEBHOOK_KEY ?? null,
		products: {
			plus: { month: plusMonthly, year: plusYearly },
			"pro-ai": { month: proMonthly, year: proYearly },
		},
	};
}

/** The Dodo product a plan and interval are sold as. */
export function productFor(config: DodoConfig, planId: PaidPlanId, interval: BillingInterval): string {
	return config.products[planId][interval];
}

/** The plan and interval a Dodo product stands for; null for a product Rezumi doesn't sell (another one in the business). */
export function planForProduct(config: DodoConfig, productId: string | null | undefined): PlanProduct | null {
	if (!productId) return null;
	for (const planId of ["plus", "pro-ai"] as const)
		for (const interval of ["month", "year"] as const)
			if (config.products[planId][interval] === productId) return { planId, interval };
	return null;
}
