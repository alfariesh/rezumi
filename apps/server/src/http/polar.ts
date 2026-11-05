import { handlePolarWebhook } from "@rezumi/api/features/billing/webhook";

/** Polar's webhooks. Public, unauthenticated and never redirected: the Standard Webhooks signature is the check. */
export function handlePolarPaymentWebhook(request: Request): Promise<Response> {
	return handlePolarWebhook(request);
}
