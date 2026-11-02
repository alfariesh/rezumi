import type { MIDTRANS_PAYMENT_CODES } from "@rezumi/env/server";
import { env } from "@rezumi/env/server";

export type MidtransPaymentCode = (typeof MIDTRANS_PAYMENT_CODES)[number];

export type MidtransConfig = {
	environment: "sandbox" | "production";
	serverKey: string;
	/**
	 * The keys a notification may be signed with: the account's Signature Secret Key when set (Midtrans' newer
	 * credentials, which allow several server keys), and the server key, which signs them on older accounts.
	 */
	signatureKeys: readonly string[];
	enabledPayments: readonly MidtransPaymentCode[];
	/** Snap: creating payment pages. */
	snapBaseUrl: string;
	/** Core API: status, cancel and expire. A different host from Snap's; mixing them up answers 404. */
	coreBaseUrl: string;
};

/**
 * The Midtrans account this server pays into, or null when no server key is set. Startup already refused a key that
 * doesn't match its environment.
 */
export function getMidtransConfig(): MidtransConfig | null {
	const serverKey = env.MIDTRANS_SERVER_KEY;
	const environment = env.MIDTRANS_ENVIRONMENT;
	if (!serverKey || !environment) return null;
	const sandbox = environment === "sandbox";
	return {
		environment,
		serverKey,
		signatureKeys: [...new Set([env.MIDTRANS_SIGNATURE_KEY, serverKey].filter((key): key is string => Boolean(key)))],
		enabledPayments: env.MIDTRANS_ENABLED_PAYMENTS?.length ? env.MIDTRANS_ENABLED_PAYMENTS : ["other_qris"],
		snapBaseUrl: sandbox ? "https://app.sandbox.midtrans.com" : "https://app.midtrans.com",
		coreBaseUrl: sandbox ? "https://api.sandbox.midtrans.com" : "https://api.midtrans.com",
	};
}
