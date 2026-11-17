/**
 * Locks EmDash's first-run setup API. EmDash lets whoever completes the setup wizard first become the administrator,
 * and its setup routes are public until a user exists. Once blog.rezumi.app is attached, that window is open to
 * anyone, and it reopens if the users table is ever emptied (a D1 restore, a wipe). So outside local development
 * the setup API answers only a browser that proved it holds `BLOG_SETUP_TOKEN`, a Worker secret the owner sets for
 * the few minutes of setup and deletes afterwards: `/_rezumi/setup-unlock` takes the token in a form and leaves a
 * short-lived cookie. Without the secret, setup stays locked. The status check the admin reads stays open.
 */

export const SETUP_UNLOCK_PATH = "/_rezumi/setup-unlock";
const SETUP_API = "/_emdash/api/setup";
const SETUP_STATUS = `${SETUP_API}/status`;
const COOKIE = "__Host-rezumi_setup";
/** Shorter tokens are treated as unset, so a placeholder value can't open setup. */
const MIN_TOKEN_LENGTH = 32;
const COOKIE_MAX_AGE_SECONDS = 60 * 60;

export type SetupLockEnv = { BLOG_SETUP_TOKEN?: string | undefined };

const isLoopback = (hostname: string) =>
	hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";

/** Compares in time that doesn't depend on where the strings first differ. */
function sameSecret(a: string, b: string): boolean {
	const left = new TextEncoder().encode(a);
	const right = new TextEncoder().encode(b);
	let diff = left.length ^ right.length;
	for (let index = 0; index < Math.max(left.length, right.length); index++)
		diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
	return diff === 0;
}

function configuredToken(env: SetupLockEnv): string | null {
	const token = env.BLOG_SETUP_TOKEN?.trim();
	return token && token.length >= MIN_TOKEN_LENGTH ? token : null;
}

function cookieValue(request: Request, name: string): string | null {
	for (const part of (request.headers.get("cookie") ?? "").split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return rest.join("=");
	}
	return null;
}

const unlockPage = (message = "") =>
	new Response(
		`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Unlock setup</title>` +
			`<form method="post" style="font:16px system-ui;max-width:24rem;margin:4rem auto;display:grid;gap:.75rem">` +
			`<label for="token">Setup token</label><input id="token" name="token" type="password" autocomplete="off" required>` +
			`<button type="submit">Unlock setup</button>${message ? `<p>${message}</p>` : ""}</form>`,
		{
			status: message ? 403 : 200,
			headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
		},
	);

const locked = () =>
	Response.json(
		{ error: { code: "SETUP_LOCKED", message: "Setup is locked. Unlock it with the setup token first." } },
		{ status: 403, headers: { "cache-control": "no-store" } },
	);

/**
 * A response that ends the request (the unlock page, or a refusal for the setup API), or null to let EmDash handle it.
 */
export async function guardSetup(request: Request, env: SetupLockEnv): Promise<Response | null> {
	const url = new URL(request.url);
	const isUnlock = url.pathname === SETUP_UNLOCK_PATH;
	const isSetupApi = url.pathname === SETUP_API || url.pathname.startsWith(`${SETUP_API}/`);
	if (!isUnlock && !isSetupApi) return null;
	// `astro dev` keeps EmDash's own loopback rules, and its dev-bypass route.
	if (isLoopback(url.hostname)) return isUnlock ? new Response(null, { status: 404 }) : null;

	const token = configuredToken(env);
	if (isUnlock) {
		if (!token) return new Response(null, { status: 404 });
		if (request.method === "GET" || request.method === "HEAD") return unlockPage();
		if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
		const form = await request.formData().catch(() => null);
		const submitted = form?.get("token");
		if (typeof submitted !== "string" || !sameSecret(submitted.trim(), token)) return unlockPage("Wrong token.");
		return new Response(null, {
			status: 303,
			headers: {
				location: "/_emdash/admin",
				"cache-control": "no-store",
				"set-cookie": `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`,
			},
		});
	}

	if (url.pathname === SETUP_STATUS && (request.method === "GET" || request.method === "HEAD")) return null;
	const cookie = cookieValue(request, COOKIE);
	let presented: string | null = null;
	try {
		presented = cookie === null ? null : decodeURIComponent(cookie);
	} catch {
		presented = null;
	}
	if (token && presented && sameSecret(presented, token)) return null;
	return locked();
}
