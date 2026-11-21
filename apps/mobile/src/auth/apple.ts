import type { IdTokenSignIn } from "./native-sign-in";
// Sign in with Apple (iOS): the system sheet returns an ID token for the app's bundle id, which the server verifies.
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

/**
 * Shows Apple's sheet. Apple receives the SHA-256 of a fresh nonce and puts it in the token; the server gets the raw
 * nonce and compares. Null when the person cancels.
 */
export async function getAppleIdToken(): Promise<IdTokenSignIn | null> {
	const nonce = Crypto.randomUUID();
	const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
	try {
		const credential = await AppleAuthentication.signInAsync({
			requestedScopes: [
				AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
				AppleAuthentication.AppleAuthenticationScope.EMAIL,
			],
			nonce: hashed,
		});
		if (!credential.identityToken) throw new Error("Apple returned no identity token.");
		const { givenName, familyName } = credential.fullName ?? {};
		return {
			provider: "apple",
			idToken: credential.identityToken,
			nonce,
			name: givenName || familyName ? { firstName: givenName ?? "", lastName: familyName ?? "" } : undefined,
		};
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ERR_REQUEST_CANCELED") return null;
		throw error;
	}
}
