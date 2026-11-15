import type { AuthDeps } from "./auth";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { AUTH_KEYS } from "../shared/storage";
import { ConnectError, createAuth, parseRedirect } from "./auth";

const origin = "http://localhost:3000";
const redirectUri = "https://fiogmglhgeiaaeajahbpmmehgmojbjjo.chromiumapp.org/";
const issuer = `${origin}/api/auth`;

/** A `chrome.storage` area in memory. */
function memoryArea() {
	const data = new Map<string, unknown>();
	return {
		data,
		get: vi.fn(async (keys: string | string[] | null) => {
			const names = keys === null ? [...data.keys()] : Array.isArray(keys) ? keys : [keys];
			return Object.fromEntries(names.filter((name) => data.has(name)).map((name) => [name, data.get(name)]));
		}),
		set: vi.fn(async (items: Record<string, unknown>) => {
			for (const [key, value] of Object.entries(items)) data.set(key, value);
		}),
		remove: vi.fn(async (keys: string | string[]) => {
			for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
		}),
	};
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const idToken = (claims: Record<string, unknown>) =>
	`e30.${btoa(JSON.stringify(claims)).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_")}.sig`;

type Call = { url: string; init: RequestInit | undefined };

function setup() {
	const local = memoryArea();
	const session = memoryArea();
	const calls: Call[] = [];
	let clock = 1_000_000;
	const tokenAnswers: Response[] = [];
	const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init });
		if (url.endsWith("/.well-known/oauth-authorization-server"))
			return json({
				issuer,
				authorization_endpoint: `${issuer}/oauth2/authorize`,
				token_endpoint: `${issuer}/oauth2/token`,
				registration_endpoint: `${issuer}/oauth2/register`,
				revocation_endpoint: `${issuer}/oauth2/revoke`,
				authorization_response_iss_parameter_supported: true,
			});
		if (url.endsWith("/oauth2/register")) return json({ client_id: "client-1" }, 201);
		if (url.endsWith("/oauth2/token")) return tokenAnswers.shift() ?? json({ error: "invalid_grant" }, 400);
		if (url.endsWith("/oauth2/revoke")) return new Response(null, { status: 200 });
		if (url.endsWith("/oauth2/userinfo"))
			return json({ sub: "user-1", name: "Rina Wijaya", email: "rina@example.test" });
		throw new TypeError("Failed to fetch");
	});
	const launchWebAuthFlow = vi.fn(async (url: string) => {
		const state = new URL(url).searchParams.get("state");
		return `${redirectUri}?code=the-code&state=${state}&iss=${encodeURIComponent(issuer)}`;
	});
	const deps: AuthDeps = {
		origin,
		redirectUri,
		local,
		session,
		fetch: fetch as unknown as typeof globalThis.fetch,
		launchWebAuthFlow,
		now: () => clock,
	};
	return {
		auth: createAuth(deps),
		local,
		session,
		calls,
		fetch,
		launchWebAuthFlow,
		tokenAnswers,
		advance: (ms: number) => {
			clock += ms;
		},
		body: (call: Call | undefined) => new URLSearchParams(String(call?.init?.body ?? "")),
	};
}

const tokens = (access: string, refresh?: string) =>
	json({
		access_token: access,
		...(refresh ? { refresh_token: refresh } : {}),
		expires_in: 3600,
		id_token: idToken({ sub: "user-1" }),
	});

describe("connect", () => {
	let t: ReturnType<typeof setup>;
	beforeEach(async () => {
		t = setup();
		t.tokenAnswers.push(tokens("access-1", "refresh-1"));
		expect(await t.auth.connect()).toEqual({ name: "Rina Wijaya", email: "rina@example.test" });
	});

	it("registers once, signs in with PKCE and the server as resource, and keeps the tokens apart", async () => {
		const register = t.calls.find((call) => call.url.endsWith("/register"));
		expect(JSON.parse(String(register?.init?.body))).toMatchObject({
			client_name: "Rezumi browser extension",
			redirect_uris: [redirectUri],
			token_endpoint_auth_method: "none",
			scope: "openid profile email offline_access api:read api:write",
		});
		const authorize = new URL(t.launchWebAuthFlow.mock.calls[0]?.[0] ?? "");
		expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
			client_id: "client-1",
			redirect_uri: redirectUri,
			code_challenge_method: "S256",
			resource: origin,
		});
		const exchange = t.body(t.calls.find((call) => call.url.endsWith("/token")));
		expect(exchange.get("code")).toBe("the-code");
		expect(exchange.get("resource")).toBe(origin);
		expect(exchange.get("code_verifier")?.length).toBeGreaterThan(43);
		expect(t.calls.every((call) => call.init?.credentials === "omit")).toBe(true);

		expect(t.session.data.get(AUTH_KEYS.access)).toMatchObject({ accessToken: "access-1" });
		expect(t.local.data.get(AUTH_KEYS.refresh)).toEqual({ origin, refreshToken: "refresh-1" });
		expect(t.session.data.has(AUTH_KEYS.refresh)).toBe(false);
		expect(await t.auth.status()).toEqual({
			state: "connected",
			account: { name: "Rina Wijaya", email: "rina@example.test" },
		});

		// A second sign-in reuses the client.
		t.tokenAnswers.push(tokens("access-2", "refresh-2"));
		await t.auth.connect();
		expect(t.calls.filter((call) => call.url.endsWith("/register"))).toHaveLength(1);
	});

	it("serves the stored token, and refreshes it once when it is about to expire", async () => {
		expect(await t.auth.accessToken()).toBe("access-1");
		t.advance(3_600_000 - 30_000);
		t.tokenAnswers.push(tokens("access-2", "refresh-2"));
		const [first, second] = await Promise.all([t.auth.accessToken(), t.auth.accessToken()]);
		expect([first, second]).toEqual(["access-2", "access-2"]);
		const refreshes = t.calls.filter((call) => t.body(call).get("grant_type") === "refresh_token");
		expect(refreshes).toHaveLength(1);
		expect(t.body(refreshes[0]).get("refresh_token")).toBe("refresh-1");
		expect(t.local.data.get(AUTH_KEYS.refresh)).toEqual({ origin, refreshToken: "refresh-2" });
	});

	it("refreshes on demand after a 401, and ends the connection as expired when the refresh is refused", async () => {
		t.tokenAnswers.push(tokens("access-2"));
		expect(await t.auth.accessToken({ force: true })).toBe("access-2");
		// A rotation-less answer keeps the refresh token it had.
		expect(t.local.data.get(AUTH_KEYS.refresh)).toEqual({ origin, refreshToken: "refresh-1" });

		t.tokenAnswers.push(json({ error: "invalid_grant" }, 400));
		expect(await t.auth.accessToken({ force: true })).toBeNull();
		expect(await t.auth.status()).toEqual({ state: "expired", account: null });
		expect(t.session.data.has(AUTH_KEYS.access)).toBe(false);
		expect(t.local.data.has(AUTH_KEYS.refresh)).toBe(false);
		expect(await t.auth.accessToken()).toBeNull();
	});

	it("keeps the tokens when the refresh cannot reach the server", async () => {
		t.fetch.mockImplementationOnce(async () => {
			throw new TypeError("Failed to fetch");
		});
		await expect(t.auth.accessToken({ force: true })).rejects.toThrow(ConnectError);
		expect(t.local.data.get(AUTH_KEYS.refresh)).toEqual({ origin, refreshToken: "refresh-1" });
		expect((await t.auth.status()).state).toBe("connected");
	});

	it("revokes the refresh token and forgets the account on disconnect, keeping the client", async () => {
		await t.auth.disconnect();
		const revoke = t.calls.find((call) => call.url.endsWith("/revoke"));
		expect(t.body(revoke).get("token")).toBe("refresh-1");
		expect(t.body(revoke).get("token_type_hint")).toBe("refresh_token");
		expect(await t.auth.status()).toEqual({ state: "signed-out", account: null });
		expect(t.session.data.has(AUTH_KEYS.access)).toBe(false);
		expect(t.local.data.has(AUTH_KEYS.account)).toBe(false);
		expect(t.local.data.get(AUTH_KEYS.client)).toEqual({ origin, clientId: "client-1" });
	});
});

describe("connect failures", () => {
	it("treats a closed window as cancelled and changes nothing", async () => {
		const t = setup();
		t.launchWebAuthFlow.mockRejectedValueOnce(new Error("The user did not approve access."));
		await expect(t.auth.connect()).rejects.toMatchObject({ code: "cancelled" });
		expect(await t.auth.status()).toEqual({ state: "signed-out", account: null });
	});

	it("refuses a redirect with another state or issuer", async () => {
		const t = setup();
		t.launchWebAuthFlow.mockResolvedValueOnce(`${redirectUri}?code=c&state=forged&iss=${encodeURIComponent(issuer)}`);
		await expect(t.auth.connect()).rejects.toMatchObject({ code: "state_mismatch" });
		t.launchWebAuthFlow.mockImplementationOnce(
			async (url) =>
				`${redirectUri}?code=c&state=${new URL(url).searchParams.get("state")}&iss=https%3A%2F%2Fevil.test`,
		);
		await expect(t.auth.connect()).rejects.toMatchObject({ code: "issuer_mismatch" });
		expect(t.calls.some((call) => call.url.endsWith("/token"))).toBe(false);
	});

	it("refuses a server whose metadata names another origin", async () => {
		const t = setup();
		t.fetch.mockImplementationOnce(async () =>
			json({
				issuer: "https://evil.test",
				authorization_endpoint: "https://evil.test/authorize",
				token_endpoint: "https://evil.test/token",
				registration_endpoint: "https://evil.test/register",
			}),
		);
		await expect(t.auth.connect()).rejects.toMatchObject({ code: "server_mismatch" });
	});

	it("forgets the client when the server no longer knows it", async () => {
		const t = setup();
		t.tokenAnswers.push(json({ error: "invalid_client" }, 401));
		await expect(t.auth.connect()).rejects.toMatchObject({ code: "invalid_client" });
		expect(t.local.data.has(AUTH_KEYS.client)).toBe(false);
	});
});

describe("parseRedirect", () => {
	it("reads the query and refuses protocol parameters in the fragment or twice", () => {
		expect(parseRedirect(`${redirectUri}?code=a&state=b`)).toEqual({ code: "a", state: "b" });
		expect(() => parseRedirect(`${redirectUri}?code=a#iss=x`)).toThrow(ConnectError);
		expect(() => parseRedirect(`${redirectUri}?code=a&code=b`)).toThrow(ConnectError);
	});
});
