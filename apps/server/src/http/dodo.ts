import { handleDodoWebhook } from "@rezumi/api/features/billing/webhook";

/** Dodo Payments' webhooks. Public, unauthenticated and never redirected: the Standard Webhooks signature is the check. */
export function handleDodoPaymentWebhook(request: Request): Promise<Response> {
	return handleDodoWebhook(request);
}
