import type { IdTokenSignIn } from "./native-sign-in";
// Sign in with Google. Android: Credential Manager's account picker (modules/google-credential), whose token names the
// web client. iOS: Google's OAuth in ASWebAuthenticationSession with the iOS client and PKCE (what Google's iOS SDK does
// itself), which needs no native module. Either way the server verifies the ID token.
import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { googleCredential } from "../../modules/google-credential";

export type GoogleClientIds = { webClientId: string; iosClientId: string | null };

const discovery: AuthSession.DiscoveryDocument = {
	authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
	tokenEndpoint: "https://oauth2.googleapis.com/token",
};

/** Whether this platform can sign in with Google using the server's client ids. */
export function canUseGoogle(ids: GoogleClientIds | null | undefined): ids is GoogleClientIds {
	if (!ids) return false;
	return Platform.OS === "android" ? googleCredential !== null : Boolean(ids.iosClientId);
}

/** `com.googleusercontent.apps.<id>:/oauthredirect`, the reversed iOS client id Google accepts for iOS clients. */
const iosRedirect = (iosClientId: string) =>
	`com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, "")}:/oauthredirect`;

/** Shows Google's account picker; null when the person cancels. */
export async function getGoogleIdToken(ids: GoogleClientIds): Promise<IdTokenSignIn | null> {
	const nonce = Crypto.randomUUID();
	if (Platform.OS === "android") {
		if (!googleCredential) throw new Error("Google sign-in needs a newer app build.");
		const result = await googleCredential.signIn(ids.webClientId, nonce);
		return result ? { provider: "google", idToken: result.idToken, nonce } : null;
	}
	if (!ids.iosClientId) throw new Error("Google sign-in is not set up for iOS on this server.");
	const request = new AuthSession.AuthRequest({
		clientId: ids.iosClientId,
		redirectUri: iosRedirect(ids.iosClientId),
		scopes: ["openid", "email", "profile"],
		usePKCE: true,
		extraParams: { nonce, prompt: "select_account" },
	});
	const result = await request.promptAsync(discovery);
	if (result.type === "cancel" || result.type === "dismiss") return null;
	if (result.type !== "success") throw new Error(`Google sign-in ${result.type}.`);
	if (result.params.state !== request.state) throw new Error("Google sign-in state mismatch.");
	const code = result.params.code;
	if (!code) throw new Error("Google returned no code.");
	const tokens = await AuthSession.exchangeCodeAsync(
		{
			clientId: ids.iosClientId,
			code,
			redirectUri: request.redirectUri,
			extraParams: { code_verifier: request.codeVerifier ?? "" },
		},
		discovery,
	);
	if (!tokens.idToken) throw new Error("Google returned no ID token.");
	return { provider: "google", idToken: tokens.idToken, nonce };
}

/** Forgets the Android account choice after sign-out, so the picker shows again next time. */
export function forgetGoogleAccount(): Promise<unknown> {
	return googleCredential?.signOut().catch(() => null) ?? Promise.resolve();
}
