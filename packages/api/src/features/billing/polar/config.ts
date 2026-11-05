import type { BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import { env } from "@rezumi/env/server";

/** A paid plan and how often it renews: what one Polar product stands for. */
export type PlanProduct = { planId: PaidPlanId; interval: BillingInterval };

export type PolarConfig = {
	environment: "sandbox" | "production";
	accessToken: string;
	/** Without it the webhook endpoint is off; payments still arrive through the billing job's checks. */
	webhookSecret: string | null;
	/** Polar's product id for each plan and interval. */
	products: Record<PaidPlanId, Record<BillingInterval, string>>;
};

/**
 * The Polar organization this server sells through, or null when it has no access token. Startup already refused a
 * token without its environment or without all four products.
 */
export function getPolarConfig(): PolarConfig | null {
	const accessToken = env.POLAR_ACCESS_TOKEN;
	const environment = env.POLAR_ENVIRONMENT;
	const plusMonthly = env.POLAR_PRODUCT_PLUS_MONTHLY;
	const plusYearly = env.POLAR_PRODUCT_PLUS_YEARLY;
	const proMonthly = env.POLAR_PRODUCT_PRO_AI_MONTHLY;
	const proYearly = env.POLAR_PRODUCT_PRO_AI_YEARLY;
	if (!accessToken || !environment || !plusMonthly || !plusYearly || !proMonthly || !proYearly) return null;
	return {
		environment,
		accessToken,
		webhookSecret: env.POLAR_WEBHOOK_SECRET ?? null,
		products: {
			plus: { month: plusMonthly, year: plusYearly },
			"pro-ai": { month: proMonthly, year: proYearly },
		},
	};
}

/** The Polar product a plan and interval are sold as. */
export function productFor(config: PolarConfig, planId: PaidPlanId, interval: BillingInterval): string {
	return config.products[planId][interval];
}

/** The plan and interval a Polar product stands for; null for a product Rezumi doesn't sell (another one in the org). */
export function planForProduct(config: PolarConfig, productId: string | null | undefined): PlanProduct | null {
	if (!productId) return null;
	for (const planId of ["plus", "pro-ai"] as const)
		for (const interval of ["month", "year"] as const)
			if (config.products[planId][interval] === productId) return { planId, interval };
	return null;
}
