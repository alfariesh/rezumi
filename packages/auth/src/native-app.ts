/**
 * Native sign-in for Rezumi's own mobile apps (mobile plan 02-teknis.md §4 and §16).
 *
 * The app signs in on its own screens through Better Auth's endpoints (email, sign-up, two-factor, Apple and Google ID
 * tokens, guest), which leaves a fresh Better Auth session. It then turns that session into the same OAuth token pair
 * the browser flow issues: `POST /native-app/consent` records the account's consent for the app's client, after which
 * the app runs the standard `/oauth2/authorize` (prompt=none, PKCE, `resource`) and `/oauth2/token` requests, and
 * finally signs the session out. Tokens, claims (`rr_grant_id`) and revocation stay exactly as in the browser flow.
 *
 * Why this does not weaken consent for anyone else:
 * - Only public clients whose every redirect URI is one of the app's own callbacks qualify. Such a client can only send
 *   codes back to the Rezumi app, never to a third party.
 * - The request must carry a session created minutes ago, sent as a cookie with a trusted `Origin` (Better Auth checks
 *   it on every cookie-bearing POST). A web page cannot make a browser send that cross-site, and whoever already holds
 *   the session cookie holds the account anyway.
 * - `/oauth2/authorize` and the consent page are unchanged for every other client.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { and, eq, isNull } from "drizzle-orm";
import z from "zod";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";

/** The host the official apps are associated with (Universal Links / App Links). */
export const OFFICIAL_APP_HOST = "rezumi.app";

/** The path the apps receive OAuth redirects on. */
export const NATIVE_CALLBACK_PATH = "/auth/native-callback";

/**
 * The redirect URIs Rezumi's mobile apps register (apps/mobile/src/auth/oauth.ts): the official host's callback, this
 * server's own (the same in production) and, only with `FLAG_ALLOW_UNSAFE_OAUTH_REDIRECT_URI`, the private-use scheme
 * development builds use against a local server.
 */
export function nativeAppRedirectUris(
	appUrl = env.APP_URL,
	allowDevelopmentScheme = env.FLAG_ALLOW_UNSAFE_OAUTH_REDIRECT_URI,
): ReadonlySet<string> {
	return new Set([
		`https://${OFFICIAL_APP_HOST}${NATIVE_CALLBACK_PATH}`,
		`https://${new URL(appUrl).host}${NATIVE_CALLBACK_PATH}`,
		// Any app can claim a private-use scheme, so it counts only where development servers allow it at all.
		...(allowDevelopmentScheme ? [`app.rezumi:${NATIVE_CALLBACK_PATH}`] : []),
	]);
}

/** The scopes the app asks for; consent covers no more than the client registered. */
export const NATIVE_APP_SCOPES = [
	"openid",
	"profile",
	"email",
	"offline_access",
	"api:read",
	"api:write",
	"api:delete",
];

/** A session older than this cannot be turned into app tokens: sign in again. */
export const NATIVE_SESSION_MAX_AGE_MS = 10 * 60 * 1000;

export const nativeAppRateLimit = { window: 60, max: 10 } as const;

type NativeAppOptions = {
	/** The OAuth resources (audiences) the server accepts; consent may name only these. */
	resources: readonly string[];
	rateLimitEnabled: boolean;
};

const consentBody = z.object({
	client_id: z.string().min(1).max(256),
	resource: z.string().min(1).max(512),
});

export const nativeApp = ({ resources, rateLimitEnabled }: NativeAppOptions) =>
	({
		id: "native-app",
		endpoints: {
			nativeAppConsent: createAuthEndpoint(
				"/native-app/consent",
				{ method: "POST", body: consentBody, use: [sessionMiddleware], metadata: { SERVER_ONLY: false } },
				async (ctx) => {
					const { session, user } = ctx.context.session;
					if (user.banned) throw new APIError("FORBIDDEN", { code: "BANNED_USER", message: "This account is banned." });
					const createdAt = new Date(session.createdAt).getTime();
					if (!Number.isFinite(createdAt) || Date.now() - createdAt > NATIVE_SESSION_MAX_AGE_MS)
						throw new APIError("UNAUTHORIZED", {
							code: "SESSION_NOT_FRESH",
							message: "Sign in again to connect the app.",
						});
					if (!resources.includes(ctx.body.resource))
						throw new APIError("BAD_REQUEST", { code: "INVALID_TARGET", message: "Unknown resource." });

					const [client] = await db
						.select({
							clientId: schema.oauthClient.clientId,
							clientSecret: schema.oauthClient.clientSecret,
							disabled: schema.oauthClient.disabled,
							redirectUris: schema.oauthClient.redirectUris,
							scopes: schema.oauthClient.scopes,
							tokenEndpointAuthMethod: schema.oauthClient.tokenEndpointAuthMethod,
						})
						.from(schema.oauthClient)
						.where(eq(schema.oauthClient.clientId, ctx.body.client_id))
						.limit(1);
					const allowed = nativeAppRedirectUris();
					const isNativeApp =
						client &&
						!client.disabled &&
						!client.clientSecret &&
						client.tokenEndpointAuthMethod === "none" &&
						client.redirectUris.length > 0 &&
						client.redirectUris.every((uri) => allowed.has(uri));
					// One answer for unknown and unqualified clients: the app re-registers on `INVALID_CLIENT`.
					if (!isNativeApp)
						throw new APIError("BAD_REQUEST", {
							code: "INVALID_CLIENT",
							message: "This client cannot use native sign-in.",
						});

					const scopes = NATIVE_APP_SCOPES.filter((scope) => !client.scopes || client.scopes.includes(scope));
					const where = and(
						eq(schema.oauthConsent.clientId, client.clientId),
						eq(schema.oauthConsent.userId, user.id),
						isNull(schema.oauthConsent.referenceId),
					);
					await db.transaction(async (tx) => {
						const [existing] = await tx
							.select({
								id: schema.oauthConsent.id,
								scopes: schema.oauthConsent.scopes,
								resources: schema.oauthConsent.resources,
							})
							.from(schema.oauthConsent)
							.where(where)
							.limit(1);
						if (existing) {
							await tx
								.update(schema.oauthConsent)
								.set({
									scopes: [...new Set([...existing.scopes, ...scopes])],
									resources: [...new Set([...(existing.resources ?? []), ctx.body.resource])],
								})
								.where(eq(schema.oauthConsent.id, existing.id));
						} else {
							await tx.insert(schema.oauthConsent).values({
								clientId: client.clientId,
								userId: user.id,
								scopes,
								resources: [ctx.body.resource],
							});
						}
					});
					return ctx.json({ scopes });
				},
			),
		},
		rateLimit: rateLimitEnabled
			? [{ pathMatcher: (path: string) => path === "/native-app/consent", ...nativeAppRateLimit }]
			: [],
	}) satisfies BetterAuthPlugin;
