import { createHash, timingSafeEqual } from "node:crypto";

/** The fields a Snap notification is signed over, exactly as they arrived. */
export type SignedNotificationFields = {
	order_id?: unknown;
	status_code?: unknown;
	gross_amount?: unknown;
	signature_key?: unknown;
};

/** SHA-512 hex of `order_id + status_code + gross_amount + key`, the key being the account's signing key. */
export function notificationSignature(
	fields: { orderId: string; statusCode: string; grossAmount: string },
	key: string,
) {
	return createHash("sha512").update(`${fields.orderId}${fields.statusCode}${fields.grossAmount}${key}`).digest("hex");
}

/**
 * Whether a notification came from Midtrans, signed with one of `keys`. It hashes the raw strings from the payload:
 * `gross_amount` "79000.00" must stay "79000.00", since reformatting it is the usual way this check breaks.
 */
export function verifyNotificationSignature(
	payload: SignedNotificationFields,
	keys: string | readonly string[],
): boolean {
	const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signature } = payload;
	if (
		typeof orderId !== "string" ||
		typeof statusCode !== "string" ||
		typeof grossAmount !== "string" ||
		typeof signature !== "string" ||
		!/^[\da-f]{128}$/i.test(signature)
	)
		return false;
	const supplied = Buffer.from(signature, "hex");
	// Every key is checked, so the time taken doesn't tell which one matched.
	let valid = false;
	for (const key of typeof keys === "string" ? [keys] : keys) {
		const expected = Buffer.from(notificationSignature({ orderId, statusCode, grossAmount }, key), "hex");
		if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) valid = true;
	}
	return valid;
}
