import { env } from "@rezumi/env/server";

/** Where Sumopod's payment API answers in each mode (Managed Payment → Quick Start, checked 2026-11-10). */
const SUMOPOD_API_URLS = {
	sandbox: "https://api-pay-sandbox.sumopod.com",
	live: "https://api-pay.sumopod.com",
} as const;

export type SumopodConfig = {
	environment: keyof typeof SUMOPOD_API_URLS;
	apiKey: string;
	/** Without it the webhook endpoint is off; payments still arrive through the billing job's status checks. */
	webhookSecret: string | null;
	apiUrl: string;
};

/**
 * The Sumopod project this server takes QRIS payments through, or null when it has no API key (QRIS isn't offered then).
 * Startup already refused a key without its mode.
 */
export function getSumopodConfig(): SumopodConfig | null {
	const apiKey = env.SUMOPOD_API_KEY;
	const environment = env.SUMOPOD_ENVIRONMENT;
	if (!apiKey || !environment) return null;
	return {
		environment,
		apiKey,
		webhookSecret: env.SUMOPOD_WEBHOOK_SECRET ?? null,
		apiUrl: SUMOPOD_API_URLS[environment],
	};
}
