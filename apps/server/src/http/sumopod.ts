import { handleSumopodWebhook } from "@rezumi/api/features/billing/sumopod/webhook";

/** Sumopod's QRIS webhooks. Public, unauthenticated and never redirected: the Svix signature is the check. */
export function handleSumopodPaymentWebhook(request: Request): Promise<Response> {
	return handleSumopodWebhook(request);
}
