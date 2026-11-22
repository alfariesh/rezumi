import { createHash, createHmac, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@rezumi/email/transport", () => ({ sendEmail: vi.fn() }));

// Run only against an explicitly supplied disposable database, after applying migrations.
const databaseURL = process.env.OAUTH_TEST_DATABASE_URL;

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) for a base32 secret, so the test can pass two-step verification. */
function totp(secret: string, offset = 0): string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	let bits = "";
	for (const char of secret.replace(/=+$/, "").toUpperCase())
		bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
	const key = Buffer.from(bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) ?? []);
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offset));
	const digest = createHmac("sha1", key).update(counter).digest();
	const start = (digest.at(-1) ?? 0) & 0xf;
	return String((digest.readUInt32BE(start) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

// The mobile app's native sign-in (apps/mobile/src/auth/native-sign-in.ts): Better Auth endpoints with cookies sent by
// hand plus a trusted Origin, then /native-app/consent and the standard authorize + token requests.
describe.skipIf(!databaseURL)("native app sign-in with PostgreSQL", () => {
	const setup = async () => {
		if (!databaseURL) throw new Error("unreachable");
		process.env.DATABASE_URL = databaseURL;
		process.env.APP_URL = "http://localhost:33930";
		// The same secret as oauth-flow.integration.test.ts: both share CI's database and its encrypted JWKS.
		process.env.AUTH_SECRET = "oauth-integration-test-secret-only";
		const { handleAuth } = await import("./auth");
		const { auth, verifyOAuthToken } = await import("@rezumi/auth/config");
		// Better Auth disables origin checks in test mode; exercise production behavior.
		(await auth.$context).skipOriginCheck = false;
		const origin = process.env.APP_URL;
		const redirectURI = "https://rezumi.app/auth/native-callback";
		const cookiesOf = (response: Response) =>
			response.headers
				.getSetCookie()
				.map((value) => value.split(";", 1)[0])
				.filter((value) => !value?.endsWith("="))
				.join("; ");
		const post = (path: string, body: object, cookie = "", requestOrigin: string | null = origin) =>
			handleAuth(
				new Request(`${origin}/api/auth/${path}`, {
					method: "POST",
					headers: {
						"content-type": "application/json",
						accept: "application/json",
						...(requestOrigin ? { origin: requestOrigin } : {}),
						...(cookie ? { cookie } : {}),
					},
					body: JSON.stringify(body),
				}),
			);
		const register = async (redirectUris = [redirectURI]) => {
			const response = await post(
				"oauth2/register",
				{
					client_name: "Rezumi for iOS",
					redirect_uris: redirectUris,
					token_endpoint_auth_method: "none",
					grant_types: ["authorization_code", "refresh_token"],
					response_types: ["code"],
					application_type: "native",
					scope: "openid profile email offline_access api:read api:write api:delete",
				},
				"",
				null,
			);
			expect(response.status, await response.clone().text()).toBe(201);
			return ((await response.json()) as { client_id: string }).client_id;
		};
		const signUp = async () => {
			const unique = randomBytes(6).toString("hex");
			const email = `native-${unique}@example.com`;
			const password = randomBytes(12).toString("hex");
			const response = await post("sign-up/email", {
				name: "Native Test",
				email,
				password,
				username: `native${unique}`,
				displayUsername: `native${unique}`,
			});
			expect(response.status, await response.clone().text()).toBe(200);
			return { email, password, cookie: cookiesOf(response) };
		};
		/** Consent, authorize (prompt=none, PKCE, resource) and token: what the app runs after any native sign-in. */
		const exchange = async (clientId: string, cookie: string) => {
			const consent = await post("native-app/consent", { client_id: clientId, resource: origin }, cookie);
			expect(consent.status, await consent.clone().text()).toBe(200);
			const verifier = randomBytes(32).toString("base64url");
			const query = new URLSearchParams({
				client_id: clientId,
				redirect_uri: redirectURI,
				response_type: "code",
				scope: "openid profile email offline_access api:read api:write api:delete",
				code_challenge: createHash("sha256").update(verifier).digest("base64url"),
				code_challenge_method: "S256",
				resource: origin,
				state: "native-state",
				prompt: "none",
			});
			const authorize = await handleAuth(
				new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {
					headers: { cookie, accept: "application/json" },
				}),
			);
			const answer = (await authorize.json()) as { url?: string };
			const codeURL = new URL(answer.url ?? authorize.headers.get("location") ?? "");
			expect(codeURL.searchParams.get("state")).toBe("native-state");
			const code = codeURL.searchParams.get("code");
			expect(code, codeURL.toString()).toBeTruthy();
			const token = await handleAuth(
				new Request(`${origin}/api/auth/oauth2/token`, {
					method: "POST",
					headers: { "content-type": "application/x-www-form-urlencoded" },
					body: new URLSearchParams({
						grant_type: "authorization_code",
						client_id: clientId,
						code: code ?? "",
						redirect_uri: redirectURI,
						code_verifier: verifier,
						resource: origin,
					}),
				}),
			);
			expect(token.status, await token.clone().text()).toBe(200);
			return (await token.json()) as { access_token: string; refresh_token: string };
		};
		return { auth, handleAuth, verifyOAuthToken, origin, post, register, signUp, exchange, cookiesOf };
	};

	it("turns a fresh native session into the browser flow's tokens, which outlive the session", async () => {
		const { handleAuth, verifyOAuthToken, origin, post, register, signUp, exchange } = await setup();
		const clientId = await register();
		const { cookie } = await signUp();
		const tokens = await exchange(clientId, cookie);
		const claims = await verifyOAuthToken(tokens.access_token);
		expect(claims.azp).toBe(clientId);
		expect(claims.rr_grant_id).toBeTruthy();

		// The app signs the Better Auth session out at once; offline_access tokens keep working.
		expect((await post("sign-out", {}, cookie)).status).toBe(200);
		await expect(verifyOAuthToken(tokens.access_token)).resolves.toMatchObject({ azp: clientId });
		const refresh = await handleAuth(
			new Request(`${origin}/api/auth/oauth2/token`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "refresh_token",
					client_id: clientId,
					refresh_token: tokens.refresh_token,
					resource: origin,
				}),
			}),
		);
		expect(refresh.status, await refresh.clone().text()).toBe(200);
		// The signed-out session cannot connect the app again.
		expect((await post("native-app/consent", { client_id: clientId, resource: origin }, cookie)).status).toBe(401);
	}, 30_000);

	it("refuses third-party clients, stale sessions, unknown resources and requests without a trusted origin", async () => {
		const { origin, post, register, signUp } = await setup();
		const clientId = await register();
		const thirdParty = await register(["http://127.0.0.1:33931/callback"]);
		const mixed = await register([NATIVE_REDIRECT, "http://127.0.0.1:33931/callback"]);
		const { cookie } = await signUp();
		const consent = (body: object, sent = cookie, requestOrigin: string | null = origin) =>
			post("native-app/consent", body, sent, requestOrigin);

		for (const id of [thirdParty, mixed, "missing-client"]) {
			const response = await consent({ client_id: id, resource: origin });
			expect(response.status).toBe(400);
			await expect(response.json()).resolves.toMatchObject({ code: "INVALID_CLIENT" });
		}
		const unknownResource = await consent({ client_id: clientId, resource: "https://untrusted.example" });
		expect(unknownResource.status).toBe(400);
		expect((await consent({ client_id: clientId, resource: origin }, "")).status).toBe(401);
		expect((await consent({ client_id: clientId, resource: origin }, cookie, "https://untrusted.example")).status).toBe(
			403,
		);
		expect((await consent({ client_id: clientId, resource: origin }, cookie, null)).status).toBe(403);

		// A session older than ten minutes must sign in again.
		const { db } = await import("@rezumi/db/client");
		const schema = await import("@rezumi/db/schema");
		const { eq } = await import("drizzle-orm");
		const token = decodeURIComponent(cookie.split("better-auth.session_token=")[1]?.split(".")[0] ?? "");
		await db
			.update(schema.session)
			.set({ createdAt: new Date(Date.now() - 11 * 60 * 1000) })
			.where(eq(schema.session.token, token));
		const stale = await consent({ client_id: clientId, resource: origin });
		expect(stale.status).toBe(401);
		await expect(stale.json()).resolves.toMatchObject({ code: "SESSION_NOT_FRESH" });
	}, 30_000);

	it("refuses disabled or confidential clients, the development scheme and banned accounts", async () => {
		const { origin, post, register, signUp } = await setup();
		const { db } = await import("@rezumi/db/client");
		const schema = await import("@rezumi/db/schema");
		const { eq } = await import("drizzle-orm");
		const { cookie, email } = await signUp();
		const consent = (clientId: string) => post("native-app/consent", { client_id: clientId, resource: origin }, cookie);
		const expectRefused = async (clientId: string) => {
			const response = await consent(clientId);
			expect(response.status).toBe(400);
			await expect(response.json()).resolves.toMatchObject({ code: "INVALID_CLIENT" });
		};

		const disabled = await register();
		await db.update(schema.oauthClient).set({ disabled: true }).where(eq(schema.oauthClient.clientId, disabled));
		await expectRefused(disabled);

		const withSecret = await register();
		await db
			.update(schema.oauthClient)
			.set({ clientSecret: "hashed-secret" })
			.where(eq(schema.oauthClient.clientId, withSecret));
		await expectRefused(withSecret);

		const basicAuth = await register();
		await db
			.update(schema.oauthClient)
			.set({ tokenEndpointAuthMethod: "client_secret_basic" })
			.where(eq(schema.oauthClient.clientId, basicAuth));
		await expectRefused(basicAuth);

		// Any app can claim the private-use scheme, so it counts only with FLAG_ALLOW_UNSAFE_OAUTH_REDIRECT_URI.
		if (!process.env.FLAG_ALLOW_UNSAFE_OAUTH_REDIRECT_URI) {
			const devScheme = await register();
			await db
				.update(schema.oauthClient)
				.set({ redirectUris: ["app.rezumi:/auth/native-callback"] })
				.where(eq(schema.oauthClient.clientId, devScheme));
			await expectRefused(devScheme);
		}

		const clientId = await register();
		await db.update(schema.user).set({ banned: true }).where(eq(schema.user.email, email));
		const banned = await consent(clientId);
		expect(banned.status).toBeGreaterThanOrEqual(401);
		expect(banned.status).toBeLessThan(500);
		expect(banned.ok).toBe(false);
	}, 30_000);

	it("keeps two-step verification and rejects replayed codes", async () => {
		const { auth, post, register, signUp, exchange, cookiesOf } = await setup();
		const clientId = await register();
		const account = await signUp();
		const enabled = await auth.api.enableTwoFactor({
			body: { password: account.password },
			headers: new Headers({ cookie: account.cookie }),
		});
		if (enabled.method !== "totp") throw new Error("Expected TOTP two-step verification.");
		const secret = new URL(enabled.totpURI).searchParams.get("secret") ?? "";
		const activate = await post("two-factor/verify-totp", { code: totp(secret) }, account.cookie);
		expect(activate.status, await activate.clone().text()).toBe(200);

		const signIn = await post("sign-in/email", { email: account.email, password: account.password });
		expect(signIn.status).toBe(200);
		await expect(signIn.clone().json()).resolves.toMatchObject({ twoFactorRedirect: true });
		const pending = cookiesOf(signIn);
		expect(pending).toContain("better-auth.two_factor=");
		expect(pending).not.toContain("better-auth.session_token=");
		// No session yet: the app cannot connect before the second step.
		expect(
			(await post("native-app/consent", { client_id: clientId, resource: process.env.APP_URL }, pending)).status,
		).toBe(401);
		expect((await post("two-factor/verify-totp", { code: "000000" }, pending)).status).toBe(401);
		// The code that activated two-step verification was already used.
		const code = totp(secret, 1);
		const verified = await post("two-factor/verify-totp", { code }, pending);
		expect(verified.status, await verified.clone().text()).toBe(200);
		const tokens = await exchange(clientId, cookiesOf(verified));
		expect(tokens.access_token).toBeTruthy();
		expect((await post("two-factor/verify-totp", { code }, pending)).status).toBe(401);
	}, 30_000);

	it("rejects forged Apple and Google ID tokens", async () => {
		const { post } = await setup();
		const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "forged" })).toString("base64url");
		const payload = Buffer.from(
			JSON.stringify({ iss: "https://accounts.google.com", aud: "x", sub: "1", email: "a@example.com", exp: 9e9 }),
		).toString("base64url");
		const forged = `${header}.${payload}.${Buffer.from("signature").toString("base64url")}`;
		for (const provider of ["google", "apple"]) {
			const response = await post("sign-in/social", { provider, idToken: { token: forged, nonce: "n" } });
			expect(response.status).toBeGreaterThanOrEqual(400);
			expect(
				response.headers
					.getSetCookie()
					.some((value) => value.includes("session_token=") && !value.includes("session_token=;")),
			).toBe(false);
		}
	}, 30_000);
});

const NATIVE_REDIRECT = "https://rezumi.app/auth/native-callback";
