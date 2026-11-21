import type { NativeModule } from "expo";
import { requireOptionalNativeModule } from "expo";

declare class GoogleCredentialModule extends NativeModule {
	/**
	 * Shows Android's "Sign in with Google" account picker (Credential Manager). Resolves with the Google ID token, whose
	 * audience is `webClientId`, or null when the person closed the picker. Rejects with `ERR_NO_ACCOUNT` when the device
	 * has no Google account, `ERR_SIGN_IN_FAILED` otherwise.
	 */
	signIn(webClientId: string, nonce: string | null): Promise<{ idToken: string } | null>;
	/** Clears the remembered account so the next sign-in shows the picker again. */
	signOut(): Promise<null>;
}

/** Android only; null on iOS and in development clients built before this module existed. */
export const googleCredential = requireOptionalNativeModule<GoogleCredentialModule>("GoogleCredential");
