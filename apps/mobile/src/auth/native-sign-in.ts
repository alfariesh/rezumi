import { usernameFromEmail } from "@rezumi/utils/string";
/**
 * Native sign-in (K4, 02-teknis.md §4 and §16): the app's own screens call the server's Better Auth endpoints, then
 * turn the fresh Better Auth session into the same OAuth token pair the browser flow issues, without a browser:
 *
 * 1. Sign in (email, sign-up, two-factor, Apple or Google ID token). Cookies stay in this attempt's
 *    `AuthCookies` jar, sent back by hand with the server's `Origin` (auth-http.ts); nothing reaches the platform
 *    cookie store.
 * 2. `POST /native-app/consent` records consent for this device's OAuth client (public, redirects only to the app).
 *    An unknown client (the server's database was replaced) is registered again once.
 * 3. `/oauth2/authorize` with `prompt=none`, PKCE and `resource`, fetched as JSON, then the usual code exchange and
 *    state/issuer checks (session.ts `completeAuthorization`).
 * 4. The Better Auth session is signed out at once: the `offline_access` tokens outlive it. Only the OAuth tokens are
 *    stored (SecureStore, session.ts).
 *
 * Two-step verification is not skipped: an account with it gets no session from step 1, only the pending
 * `two_factor` cookie, kept in memory for its 10 minutes.
 */
import { AuthCookies, AuthError, authRequest } from "./auth-http";
import { forgetClient } from "./oauth";
import { completeAuthorization, isCurrentAttempt, prepareAuthorization, signInWith } from "./session";

export type SignInResult = { status: "signed-in" } | { status: "cancelled" } | { status: "two-factor" };

type BetterAuthUser = { id: string; email: string; emailVerified: boolean; name: string };
type SessionAnswer = { token?: string | null; user?: BetterAuthUser; twoFactorRedirect?: boolean };

const twoFactorLifetime = 10 * 60 * 1000;
let pendingTwoFactor: { origin: string; cookies: AuthCookies; until: number } | null = null;

/** Cookie-bearing POSTs need a trusted `Origin` (Better Auth's CSRF check); the server's own origin is one. */
const post = <T>(origin: string, path: string, body: Record<string, unknown>, cookies?: AuthCookies) =>
	authRequest<T>(origin, path, { body, headers: { origin }, ...(cookies ? { cookies } : {}) });

const hasSession = (cookies: AuthCookies) => cookies.has("better-auth.session_token");

/**
 * Connects the app with the session in `cookies` (steps 2–4) and commits the tokens as the signed-in account. The jar
 * is emptied whatever happens.
 */
async function connect(origin: string, cookies: AuthCookies): Promise<SignInResult> {
	if (!hasSession(cookies)) throw new AuthError("NO_SESSION", 401);
	try {
		const done = await signInWith(origin, async (_origin, attempt) => {
			const pending = await prepareAuthorization(origin, { prompt: "none" });
			try {
				await post(origin, "/native-app/consent", { client_id: pending.clientId, resource: origin }, cookies);
			} catch (error) {
				// The server no longer knows this device's client: register a new one and try once more.
				if (!(error instanceof AuthError) || error.code !== "INVALID_CLIENT") throw error;
				await forgetClient(origin);
				return authorizeWithSession(await prepareAuthorization(origin, { prompt: "none" }), cookies, attempt, true);
			}
			return authorizeWithSession(pending, cookies, attempt, false);
		});
		return done ? { status: "signed-in" } : { status: "cancelled" };
	} finally {
		// Best effort: the session is only a step on the way to the tokens.
		await post(origin, "/sign-out", {}, cookies).catch(() => null);
		cookies.clear();
	}
}

async function authorizeWithSession(
	pending: Awaited<ReturnType<typeof prepareAuthorization>>,
	cookies: AuthCookies,
	attempt: number,
	consentFirst: boolean,
) {
	const { origin } = pending;
	if (consentFirst)
		await post(origin, "/native-app/consent", { client_id: pending.clientId, resource: origin }, cookies);
	if (!isCurrentAttempt(attempt)) return null;
	let response: Response;
	try {
		response = await fetch(pending.url, {
			headers: { accept: "application/json", cookie: cookies.header() ?? "" },
			credentials: "omit",
			signal: AbortSignal.timeout(15_000),
		});
	} catch {
		throw new AuthError("NETWORK", 0);
	}
	const body = (await response.json().catch(() => null)) as { url?: unknown } | null;
	const url = typeof body?.url === "string" ? body.url : response.headers.get("location");
	if (!url) throw new AuthError(`HTTP_${response.status}`, response.status);
	return completeAuthorization(pending, url);
}

/** Email and password. Accounts with two-step verification continue with `verifyTwoFactor`. */
export async function signInWithEmail(origin: string, email: string, password: string): Promise<SignInResult> {
	const cookies = new AuthCookies();
	const answer = await post<SessionAnswer>(origin, "/sign-in/email", { email, password, rememberMe: false }, cookies);
	if (answer.twoFactorRedirect) {
		pendingTwoFactor = { origin, cookies, until: Date.now() + twoFactorLifetime };
		return { status: "two-factor" };
	}
	return connect(origin, cookies);
}

/** Whether a two-step sign-in is waiting for its code (the screen goes back to sign-in when it is not). */
export function hasPendingTwoFactor(): boolean {
	return pendingTwoFactor !== null && pendingTwoFactor.until > Date.now();
}

/** The second step: a code from the authenticator app (`totp`) or a backup code. */
export async function verifyTwoFactor(code: string, kind: "totp" | "backup"): Promise<SignInResult> {
	const pending = pendingTwoFactor;
	if (!pending || pending.until <= Date.now()) {
		pendingTwoFactor = null;
		throw new AuthError("TWO_FACTOR_EXPIRED", 401);
	}
	await post(
		pending.origin,
		kind === "totp" ? "/two-factor/verify-totp" : "/two-factor/verify-backup-code",
		{ code: code.replaceAll(/\s/g, "") },
		pending.cookies,
	);
	pendingTwoFactor = null;
	return connect(pending.origin, pending.cookies);
}

type SignUp = { name: string; email: string; password: string };

/**
 * Creates the account and signs it in, as the web does; the server mails the verification link. The username comes
 * from the email (`usernameFromEmail`); a taken one gets a random number, up to three tries.
 */
export async function signUpWithEmail(origin: string, { name, email, password }: SignUp): Promise<SignInResult> {
	for (let tries = 0; ; tries++) {
		const username = usernameFromEmail(email, tries === 0 ? "" : String(Math.floor(1000 + Math.random() * 9000)));
		const cookies = new AuthCookies();
		try {
			await post(
				origin,
				"/sign-up/email",
				{ name, email, password, username, displayUsername: username, callbackURL: "/dashboard" },
				cookies,
			);
			return connect(origin, cookies);
		} catch (error) {
			if (!(error instanceof AuthError) || error.code !== "USERNAME_IS_ALREADY_TAKEN" || tries >= 2) throw error;
		}
	}
}

export type IdTokenSignIn = {
	provider: "apple" | "google";
	idToken: string;
	/** The raw nonce the app generated; the server compares it (Apple's token carries its SHA-256). */
	nonce: string;
	/** Apple shares the name only on the first sign-in. */
	name?: { firstName: string; lastName: string } | undefined;
};

/** Apple or Google: the server verifies the ID token (signature, issuer, audience, nonce) and signs the account in. */
export async function signInWithIdToken(origin: string, sign: IdTokenSignIn): Promise<SignInResult> {
	const cookies = new AuthCookies();
	await post(
		origin,
		"/sign-in/social",
		{
			provider: sign.provider,
			idToken: { token: sign.idToken, nonce: sign.nonce, ...(sign.name ? { user: { name: sign.name } } : {}) },
		},
		cookies,
	);
	return connect(origin, cookies);
}

/** Mails a reset link. The server answers the same whether or not the address has an account. */
export async function requestPasswordReset(origin: string, email: string): Promise<void> {
	await post(origin, "/request-password-reset", { email, redirectTo: "/auth/reset-password" });
}

/** Sets the new password with the token from the reset link; every other session and app token is signed out. */
export async function resetPassword(origin: string, token: string, newPassword: string): Promise<void> {
	await post(origin, "/reset-password", { token, newPassword });
}

/** Mails the verification link again. */
export async function resendVerificationEmail(origin: string, email: string): Promise<void> {
	await post(origin, "/send-verification-email", { email, callbackURL: "/dashboard" });
}
