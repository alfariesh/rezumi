import { AuthCookies, AuthError, authRequest, splitSetCookie } from "./auth-http";

const response = (status: number, body: unknown, setCookie?: string) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", ...(setCookie ? { "set-cookie": setCookie } : {}) },
	});

describe("splitSetCookie", () => {
	it("splits folded headers without breaking Expires dates", () => {
		expect(
			splitSetCookie(
				"better-auth.two_factor=abc.sig; Max-Age=600; Path=/; HttpOnly, theme=dark; Expires=Wed, 21 Oct 2026 07:28:00 GMT, better-auth.session_token=tok.sig; Path=/",
			),
		).toEqual([
			"better-auth.two_factor=abc.sig; Max-Age=600; Path=/; HttpOnly",
			"theme=dark; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
			"better-auth.session_token=tok.sig; Path=/",
		]);
	});
});

describe("AuthCookies", () => {
	it("keeps only Better Auth cookies and drops expired ones", () => {
		const jar = new AuthCookies();
		jar.take(response(200, {}, "better-auth.two_factor=abc.sig; Path=/, other=1; Path=/"));
		expect(jar.header()).toBe("better-auth.two_factor=abc.sig");
		jar.take(
			response(200, {}, "better-auth.two_factor=; Max-Age=0; Path=/, __Secure-better-auth.session_token=t.s; Path=/"),
		);
		expect(jar.header()).toBe("__Secure-better-auth.session_token=t.s");
		expect(jar.has("better-auth.session_token")).toBe(true);
		jar.clear();
		expect(jar.header()).toBeUndefined();
	});
});

describe("authRequest", () => {
	const fetchMock = jest.fn();
	beforeEach(() => {
		fetchMock.mockReset();
		global.fetch = fetchMock;
	});

	it("omits platform cookies and sends the attempt's jar by hand", async () => {
		const jar = new AuthCookies();
		jar.take(response(200, {}, "better-auth.two_factor=abc.sig; Path=/"));
		fetchMock.mockResolvedValue(response(200, { token: "t" }));
		await expect(
			authRequest("https://rezumi.app", "/two-factor/verify-totp", { body: { code: "1" }, cookies: jar }),
		).resolves.toEqual({ token: "t" });
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
		expect(url).toBe("https://rezumi.app/api/auth/two-factor/verify-totp");
		expect(init.credentials).toBe("omit");
		expect(init.headers.cookie).toBe("better-auth.two_factor=abc.sig");
	});

	it("maps error bodies, rate limits and network failures to AuthError", async () => {
		fetchMock.mockResolvedValueOnce(response(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "x" }));
		await expect(authRequest("https://rezumi.app", "/sign-in/email", { body: {} })).rejects.toEqual(
			new AuthError("INVALID_EMAIL_OR_PASSWORD", 401),
		);
		fetchMock.mockResolvedValueOnce(response(429, {}));
		await expect(authRequest("https://rezumi.app", "/sign-in/email", { body: {} })).rejects.toMatchObject({
			code: "TOO_MANY_REQUESTS",
			status: 429,
		});
		fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
		await expect(authRequest("https://rezumi.app", "/sign-in/email", { body: {} })).rejects.toMatchObject({
			code: "NETWORK",
		});
	});
});
