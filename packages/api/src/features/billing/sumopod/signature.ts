/**
 * Sumopod signs its webhooks the Svix way (Managed Payment → Quick Start → Verifying Webhook Signatures): HMAC-SHA256
 * over `<svix-id>.<svix-timestamp>.<raw body>` with the bytes of the base64 secret after `whsec_`, base64-encoded. The
 * `svix-signature` header lists `v1,<signature>` entries separated by spaces (more than one for about a day after the
 * secret is rolled). Web Crypto only, so it runs the same on Workers and Node.
 */

/** How far a delivery's timestamp may be from now: older ones are replays, newer ones a skewed clock. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

const encoder = new TextEncoder();

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/** Compares two strings in time that depends only on their length. */
function sameText(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
	return difference === 0;
}

/** The base64 signature of a delivery, as Sumopod computes it. */
export async function signSumopodPayload(input: {
	secret: string;
	id: string;
	timestamp: string;
	body: string;
}): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		base64ToBytes(input.secret.replace(/^whsec_/, "")),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(`${input.id}.${input.timestamp}.${input.body}`),
	);
	return bytesToBase64(new Uint8Array(signature));
}

/**
 * Whether a delivery is Sumopod's: all three headers present, a timestamp within the tolerance, and one of the
 * signatures in the header made with the secret over exactly this body. False for anything else, never a throw.
 */
export async function verifySumopodSignature(input: {
	secret: string;
	id: string;
	timestamp: string;
	signature: string;
	body: string;
	now?: Date;
}): Promise<boolean> {
	if (!input.id || !input.timestamp || !input.signature) return false;
	if (!/^\d{1,12}$/.test(input.timestamp)) return false;
	const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
	if (Math.abs(nowSeconds - Number(input.timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;
	let expected: string;
	try {
		expected = await signSumopodPayload(input);
	} catch {
		// A secret that isn't base64 can't have signed anything.
		return false;
	}
	let matched = false;
	for (const entry of input.signature.split(" ")) {
		const [version, value] = entry.split(",", 2);
		// Every entry is compared, so the time taken doesn't tell which one matched.
		if (version === "v1" && value && sameText(value, expected)) matched = true;
	}
	return matched;
}
