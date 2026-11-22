/**
 * Requests to the server's Better Auth endpoints (`/api/auth/*`) for the native sign-in screens.
 *
 * - `credentials: "omit"`: React Native then keeps the platform cookie store out of it (iOS
 *   `HTTPShouldHandleCookies = NO`, Android `CookieJar.NO_COOKIES`), so a Better Auth session cookie never lands in the
 *   store that every other request (`/api/rpc`) would carry. The app authenticates with OAuth bearer tokens only.
 * - The cookies one sign-in needs between its steps (the pending two-factor state, the new session) live in an
 *   `AuthCookies` jar for that attempt only, in memory, and are sent back by hand. They are never stored or logged.
 * - Errors become `AuthError` with Better Auth's code (`INVALID_EMAIL_OR_PASSWORD`, …) and the HTTP status, never the
 *   request or response body.
 */

const requestTimeout = 15_000;

/** A Better Auth error, or `NETWORK` when no answer arrived. */
export class AuthError extends Error {
	constructor(
		readonly code: string,
		readonly status: number,
	) {
		super(code);
		this.name = "AuthError";
	}
}

/** The `better-auth.*` cookies of one sign-in attempt, by name. */
export class AuthCookies {
	private readonly values = new Map<string, string>();

	/** Keeps the Better Auth cookies a response sets; an expired one (`Max-Age=0`) removes it. */
	take(response: Response) {
		const header = response.headers.get("set-cookie");
		if (!header) return;
		for (const cookie of splitSetCookie(header)) {
			const [pair = "", ...attributes] = cookie.split(";");
			const equals = pair.indexOf("=");
			if (equals <= 0) continue;
			const name = pair.slice(0, equals).trim();
			if (!/^(__Secure-)?better-auth\./.test(name)) continue;
			const value = pair.slice(equals + 1).trim();
			const expired = attributes.some((attribute) => /^\s*max-age\s*=\s*0\s*$/i.test(attribute));
			if (expired || !value) this.values.delete(name);
			else this.values.set(name, value);
		}
	}

	/** The `Cookie` request header, or undefined when the jar is empty. */
	header(): string | undefined {
		if (this.values.size === 0) return undefined;
		return Array.from(this.values, ([name, value]) => `${name}=${value}`).join("; ");
	}

	has(name: string): boolean {
		return Array.from(this.values.keys()).some((key) => key === name || key === `__Secure-${name}`);
	}

	clear() {
		this.values.clear();
	}
}

/**
 * Splits a `Set-Cookie` header that the platform folded into one value (both platforms join repeated headers with
 * ", "). A comma inside `Expires=Wed, 21 Oct …` is not a separator: a new cookie starts only at `, name=`.
 */
export function splitSetCookie(header: string): string[] {
	return header
		.split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/)
		.map((part) => part.trim())
		.filter(Boolean);
}

type AuthRequest = {
	method?: "GET" | "POST";
	body?: Record<string, unknown>;
	cookies?: AuthCookies;
	headers?: Record<string, string>;
};

/** POSTs (or GETs) `/api/auth<path>` on `origin`; returns the JSON body or throws `AuthError`. */
export async function authRequest<T>(origin: string, path: string, request: AuthRequest = {}): Promise<T> {
	const headers: Record<string, string> = { accept: "application/json", ...request.headers };
	if (request.body) headers["content-type"] = "application/json";
	const cookie = request.cookies?.header();
	if (cookie) headers.cookie = cookie;
	let response: Response;
	try {
		response = await fetch(`${origin}/api/auth${path}`, {
			method: request.method ?? "POST",
			headers,
			credentials: "omit",
			signal: AbortSignal.timeout(requestTimeout),
			...(request.body ? { body: JSON.stringify(request.body) } : {}),
		});
	} catch {
		throw new AuthError("NETWORK", 0);
	}
	request.cookies?.take(response);
	const body = (await response.json().catch(() => null)) as unknown;
	if (!response.ok) {
		const code =
			body && typeof body === "object" && "code" in body && typeof body.code === "string" ? body.code : undefined;
		throw new AuthError(
			code ?? (response.status === 429 ? "TOO_MANY_REQUESTS" : `HTTP_${response.status}`),
			response.status,
		);
	}
	return body as T;
}
