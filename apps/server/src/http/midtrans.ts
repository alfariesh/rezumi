import { handleMidtransNotification } from "@rezumi/api/features/billing/notification";

/** Midtrans' payment notifications. Public, unauthenticated and never redirected: the signature is the check. */
export function handleMidtransPaymentNotification(request: Request): Promise<Response> {
	return handleMidtransNotification(request);
}
