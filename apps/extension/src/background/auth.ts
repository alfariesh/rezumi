/**
 * Signing in to Rezumi (02-teknis.md §5): OAuth 2.1 authorization code + PKCE, as the mobile app does
 * (apps/mobile/src/auth/oauth.ts, session.ts), through `chrome.identity.launchWebAuthFlow`.
 *
 * - Discovery from `<server>/.well-known/oauth-authorization-server`; dynamic client registration once, `client_id`
 *   kept in `chrome.storage.local`. Registered again only when the server answers `invalid_client`.
 * - The redirect is `https://<extension id>.chromiumapp.org/`, which only this extension receives. The server counts
 *   the store ids' addresses as Rezumi's own app (`firstPartyRedirectUris`), so the free plan can use it.
 * - `resource=<server origin>` on authorize, token and refresh, or the server issues a token `/api/rpc` rejects.
 * - Mix-up defence: discovery must name this origin as issuer and endpoint host; the redirect must carry the request's
 *   `state` and, when the server advertises RFC 9207, its `iss`.
 * - The access token lives in `chrome.storage.session` (memory, gone when the browser closes); the refresh token and
 *   the client in `chrome.storage.local`. Content scripts can read neither (the session area's access level is left
 *   at its default, trusted contexts only; local storage is the extension's own).
 * - Refresh is single-flight. A refresh the server rejects ends the connection as `expired`: the panel asks to
 *   connect again. Network failures keep the tokens.
 */
import type { Account, AuthState } from "../shared/storage";
import { AUTH_KEYS } from "../shared/storage";

export const CLIENT_NAME = "Rezumi browser extension";
const SCOPES = ["openid", "profile", "email", "offline_access", "api:read", "api:write"];
/** Refresh this long before the access token expires, so a request never leaves with a token about to lapse. */
const EXPIRY_SKEW_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const REVOKE_TIMEOUT_MS = 5_000;

/** The parts of a `chrome.storage` area the sign-in uses. */
type StorageArea = {
	get(keys: string | string[]): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(keys: string | string[]): Promise<void>;
};

export type AuthDeps = {
	/** The Rezumi server's origin (http://localhost:3000 in development builds). */
	origin: string;
	/** `chrome.identity.getRedirectURL()`: https://<id>.chromiumapp.org/ */
	redirectUri: string;
	local: StorageArea;
	session: StorageArea;
	fetch: typeof fetch;
	/** `chrome.identity.launchWebAuthFlow`: resolves with the redirect URL, or rejects (closed window, error). */
	launchWebAuthFlow: (url: string) => Promise<string | undefined>;
	now?: () => number;
};

type Discovery = {
	issuer: string;
	issParameterSupported: boolean;
	authorizationEndpoint: string;
	tokenEndpoint: string;
	registrationEndpoint: string;
	revocationEndpoint?: string | undefined;
};

type StoredClient = { origin: string; clientId: string };
type StoredRefresh = { origin: string; refreshToken: string };
type StoredAccess = { origin: string; accessToken: string; expiresAt: number | null };

/** Why connecting failed, for the panel: the person closed the window, or something went wrong (with a code). */
export class ConnectError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = "ConnectError";
	}
}

const base64Url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");

const randomString = (size = 32) => base64Url(crypto.getRandomValues(new Uint8Array(size)));

async function codeChallenge(verifier: string) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	return base64Url(new Uint8Array(digest));
}

/** The claims of a JWT, read without verifying it (it came straight from the token endpoint; display only). */
function claimsOf(token: string | undefined): Record<string, unknown> {
	try {
		const encoded = token?.split(".")[1];
		if (!encoded) return {};
		const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
		const json = new TextDecoder().decode(
			Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (character) => character.charCodeAt(0)),
		);
		const claims = JSON.parse(json) as unknown;
		return claims && typeof claims === "object" ? (claims as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Only the query counts (the code flow answers there); a protocol parameter in the fragment or twice is refused. */
export function parseRedirect(url: string): Record<string, string> {
	const parsed = new URL(url);
	const protocol = ["code", "state", "iss", "error", "error_description"];
	const fragment = new URLSearchParams(parsed.hash.slice(1));
	if (protocol.some((name) => fragment.has(name))) throw new ConnectError("invalid_response");
	const params: Record<string, string> = {};
	for (const name of protocol) {
		const values = parsed.searchParams.getAll(name);
		if (values.length > 1) throw new ConnectError("invalid_response");
		if (values[0] !== undefined) params[name] = values[0];
	}
	return params;
}

export function createAuth(deps: AuthDeps) {
	const { origin } = deps;
	const now = deps.now ?? Date.now;
	let discovery: Discovery | null = null;
	let refreshing: Promise<string | null> | null = null;
	// Changes on every connect and disconnect: a refresh that started before must not store its result.
	let generation = 0;

	const request = (url: string, init: RequestInit = {}, timeout = REQUEST_TIMEOUT_MS) =>
		deps.fetch(url, {
			...init,
			credentials: "omit",
			headers: { accept: "application/json", ...init.headers },
			signal: AbortSignal.timeout(timeout),
		});

	async function discover(): Promise<Discovery> {
		if (discovery) return discovery;
		const response = await request(`${origin}/.well-known/oauth-authorization-server`);
		if (!response.ok) throw new ConnectError("server_unreachable");
		const metadata = (await response.json()) as Record<string, unknown>;
		const string = (value: unknown) => (typeof value === "string" && value ? value : undefined);
		const onOrigin = (url: string | undefined) => {
			try {
				return url === undefined || new URL(url).origin === origin;
			} catch {
				return false;
			}
		};
		const issuer = string(metadata.issuer);
		const authorizationEndpoint = string(metadata.authorization_endpoint);
		const tokenEndpoint = string(metadata.token_endpoint);
		const registrationEndpoint = string(metadata.registration_endpoint);
		const revocationEndpoint = string(metadata.revocation_endpoint);
		if (!issuer || !authorizationEndpoint || !tokenEndpoint || !registrationEndpoint)
			throw new ConnectError("server_outdated");
		if (![issuer, authorizationEndpoint, tokenEndpoint, registrationEndpoint, revocationEndpoint].every(onOrigin))
			throw new ConnectError("server_mismatch");
		discovery = {
			issuer,
			issParameterSupported: metadata.authorization_response_iss_parameter_supported === true,
			authorizationEndpoint,
			tokenEndpoint,
			registrationEndpoint,
			revocationEndpoint,
		};
		return discovery;
	}

	async function storedClientId(): Promise<string | null> {
		const { [AUTH_KEYS.client]: client } = (await deps.local.get(AUTH_KEYS.client)) as Record<string, StoredClient>;
		return client?.origin === origin ? client.clientId : null;
	}

	async function registerClient(metadata: Discovery): Promise<string> {
		const cached = await storedClientId();
		if (cached) return cached;
		const response = await request(metadata.registrationEndpoint, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				client_name: CLIENT_NAME,
				redirect_uris: [deps.redirectUri],
				token_endpoint_auth_method: "none",
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
				application_type: "web",
				scope: SCOPES.join(" "),
			}),
		});
		const body = (await response.json().catch(() => null)) as { client_id?: unknown } | null;
		if (!response.ok || typeof body?.client_id !== "string") throw new ConnectError("registration_failed");
		await deps.local.set({ [AUTH_KEYS.client]: { origin, clientId: body.client_id } satisfies StoredClient });
		return body.client_id;
	}

	type TokenResponse = {
		access_token?: unknown;
		refresh_token?: unknown;
		expires_in?: unknown;
		id_token?: unknown;
		error?: unknown;
	};

	async function tokenRequest(metadata: Discovery, params: Record<string, string>) {
		const response = await request(metadata.tokenEndpoint, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ ...params, resource: origin }).toString(),
		});
		const body = (await response.json().catch(() => ({}))) as TokenResponse;
		return { ok: response.ok && typeof body.access_token === "string", status: response.status, body };
	}

	async function storeTokens(body: TokenResponse, previousRefresh?: string) {
		const accessToken = body.access_token as string;
		const expiresIn = typeof body.expires_in === "number" ? body.expires_in : null;
		const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : previousRefresh;
		await deps.session.set({
			[AUTH_KEYS.access]: {
				origin,
				accessToken,
				expiresAt: expiresIn === null ? null : now() + expiresIn * 1000,
			} satisfies StoredAccess,
		});
		if (refreshToken) await deps.local.set({ [AUTH_KEYS.refresh]: { origin, refreshToken } satisfies StoredRefresh });
		return accessToken;
	}

	async function clearTokens(state: AuthState) {
		generation++;
		await deps.session.remove(AUTH_KEYS.access);
		await deps.local.remove([AUTH_KEYS.refresh, AUTH_KEYS.account]);
		await deps.local.set({ [AUTH_KEYS.state]: state });
	}

	/** Opens Rezumi's sign-in and consent in a browser window, then stores the tokens. */
	async function connect(): Promise<Account> {
		const metadata = await discover();
		const clientId = await registerClient(metadata);
		const state = randomString();
		const verifier = randomString(48);
		const url = new URL(metadata.authorizationEndpoint);
		url.search = new URLSearchParams({
			response_type: "code",
			client_id: clientId,
			redirect_uri: deps.redirectUri,
			scope: SCOPES.join(" "),
			state,
			code_challenge: await codeChallenge(verifier),
			code_challenge_method: "S256",
			resource: origin,
		}).toString();

		let redirect: string | undefined;
		try {
			redirect = await deps.launchWebAuthFlow(url.toString());
		} catch {
			// Closed by the person, or the browser could not finish: either way nothing changed.
			throw new ConnectError("cancelled");
		}
		if (!redirect?.startsWith(deps.redirectUri)) throw new ConnectError("cancelled");
		const params = parseRedirect(redirect);
		if (params.state !== state) throw new ConnectError("state_mismatch");
		if (
			metadata.issParameterSupported
				? params.iss !== metadata.issuer
				: params.iss !== undefined && params.iss !== metadata.issuer
		)
			throw new ConnectError("issuer_mismatch");
		if (params.error) throw new ConnectError(params.error === "access_denied" ? "cancelled" : params.error);
		if (!params.code) throw new ConnectError("no_code");

		const token = await tokenRequest(metadata, {
			grant_type: "authorization_code",
			code: params.code,
			redirect_uri: deps.redirectUri,
			client_id: clientId,
			code_verifier: verifier,
		});
		if (!token.ok) {
			if (token.body.error === "invalid_client") await deps.local.remove(AUTH_KEYS.client);
			throw new ConnectError(typeof token.body.error === "string" ? token.body.error : "token_failed");
		}
		generation++;
		const accessToken = await storeTokens(token.body);
		const account = await readAccount(metadata, accessToken, token.body.id_token);
		await deps.local.set({ [AUTH_KEYS.account]: account, [AUTH_KEYS.state]: "connected" satisfies AuthState });
		return account;
	}

	/**
	 * Who signed in, for the panel: OpenID userinfo (`<issuer>/oauth2/userinfo`, where Better Auth puts name and email),
	 * else whatever the ID token carries. Display only; never fails the sign-in.
	 */
	async function readAccount(metadata: Discovery, accessToken: string, idToken: unknown): Promise<Account> {
		let claims = claimsOf(typeof idToken === "string" ? idToken : undefined);
		try {
			const response = await request(`${metadata.issuer}/oauth2/userinfo`, {
				headers: { authorization: `Bearer ${accessToken}` },
			});
			if (response.ok) claims = { ...claims, ...((await response.json()) as Record<string, unknown>) };
		} catch {
			// The ID token's claims, if any, are enough to show.
		}
		return { name: text(claims.name), email: text(claims.email) };
	}

	async function refresh(): Promise<string | null> {
		const { [AUTH_KEYS.refresh]: stored } = (await deps.local.get(AUTH_KEYS.refresh)) as Record<string, StoredRefresh>;
		const clientId = await storedClientId();
		if (stored?.origin !== origin || !clientId) {
			if (stored) await clearTokens("expired");
			return null;
		}
		const started = generation;
		let metadata: Discovery;
		let result: Awaited<ReturnType<typeof tokenRequest>>;
		try {
			metadata = await discover();
			result = await tokenRequest(metadata, {
				grant_type: "refresh_token",
				refresh_token: stored.refreshToken,
				client_id: clientId,
			});
		} catch {
			// Offline or the server is down: keep the tokens, the request fails on its own and can be retried.
			throw new ConnectError("network");
		}
		if (started !== generation) return null;
		if (!result.ok) {
			if (result.status >= 500) throw new ConnectError("server_error");
			if (result.body.error === "invalid_client") await deps.local.remove(AUTH_KEYS.client);
			await clearTokens("expired");
			return null;
		}
		return storeTokens(result.body, stored.refreshToken);
	}

	/**
	 * A usable access token: the stored one, refreshed first when it is about to expire (or when `force`, after the
	 * server answered 401 to it). Null when not connected. Throws `ConnectError("network")` when a needed refresh could
	 * not reach the server.
	 */
	async function accessToken(options: { force?: boolean } = {}): Promise<string | null> {
		const { [AUTH_KEYS.access]: stored } = (await deps.session.get(AUTH_KEYS.access)) as Record<string, StoredAccess>;
		const fresh = stored?.origin === origin && (stored.expiresAt === null || stored.expiresAt - EXPIRY_SKEW_MS > now());
		if (fresh && !options.force) return stored.accessToken;
		refreshing ??= refresh().finally(() => {
			refreshing = null;
		});
		return refreshing;
	}

	/** Revokes the refresh token (best effort, bounded), then forgets every token. The client id is kept. */
	async function disconnect(): Promise<void> {
		const { [AUTH_KEYS.refresh]: stored } = (await deps.local.get(AUTH_KEYS.refresh)) as Record<string, StoredRefresh>;
		const clientId = await storedClientId();
		await clearTokens("signed-out");
		if (!stored || stored.origin !== origin || !clientId) return;
		try {
			const metadata = await discover();
			if (!metadata.revocationEndpoint) return;
			await request(
				metadata.revocationEndpoint,
				{
					method: "POST",
					headers: { "content-type": "application/x-www-form-urlencoded" },
					body: new URLSearchParams({
						token: stored.refreshToken,
						token_type_hint: "refresh_token",
						client_id: clientId,
					}).toString(),
				},
				REVOKE_TIMEOUT_MS,
			);
		} catch {
			// The tokens are gone here either way; the server's copy expires on its own.
		}
	}

	/** Whether an account is connected, and which. */
	async function status(): Promise<{ state: AuthState; account: Account | null }> {
		const stored = await deps.local.get([AUTH_KEYS.state, AUTH_KEYS.refresh, AUTH_KEYS.account]);
		const refreshToken = stored[AUTH_KEYS.refresh] as StoredRefresh | undefined;
		if (refreshToken?.origin === origin)
			return { state: "connected", account: (stored[AUTH_KEYS.account] as Account | undefined) ?? null };
		return { state: stored[AUTH_KEYS.state] === "expired" ? "expired" : "signed-out", account: null };
	}

	/** The server stopped accepting this connection (consent revoked in Rezumi's settings, say). */
	async function expire(): Promise<void> {
		await clearTokens("expired");
	}

	return { connect, disconnect, accessToken, status, expire };
}

export type Auth = ReturnType<typeof createAuth>;
