import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const fixture = vi.hoisted(() => ({
	secret: "0x4AAAArealSecretValue" as string | undefined,
	site: "0x4AAAAsite" as string | undefined,
}));
vi.mock("@rezumi/env/server", () => ({
	env: {
		APP_URL: "https://rezumi.app",
		APP_ALIAS_URL: "https://vitaekit.app",
		get TURNSTILE_SECRET_KEY() {
			return fixture.secret;
		},
		get TURNSTILE_SITE_KEY() {
			return fixture.site;
		},
	},
}));

const { isContactFormConfigured, verifyTurnstileToken } = await import("./turnstile");

const respond = (body: unknown, status = 200) =>
	vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

afterEach(() => {
	vi.unstubAllGlobals();
	fixture.secret = "0x4AAAArealSecretValue";
	fixture.site = "0x4AAAAsite";
});

describe("verifyTurnstileToken", () => {
	it("accepts a genuine token for this site or its alias", async () => {
		vi.stubGlobal("fetch", respond({ success: true, hostname: "rezumi.app" }));
		expect(await verifyTurnstileToken("token", "203.0.113.9")).toBe(true);
		vi.stubGlobal("fetch", respond({ success: true, hostname: "vitaekit.app" }));
		expect(await verifyTurnstileToken("token")).toBe(true);
	});

	it("sends the secret, token and address only to Cloudflare, as a form", async () => {
		const fetchMock = respond({ success: true, hostname: "rezumi.app" });
		vi.stubGlobal("fetch", fetchMock);
		await verifyTurnstileToken("the-token", "203.0.113.9");
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
		const body = init.body as URLSearchParams;
		expect(body.get("secret")).toBe("0x4AAAArealSecretValue");
		expect(body.get("response")).toBe("the-token");
		expect(body.get("remoteip")).toBe("203.0.113.9");
	});

	it("rejects what siteverify rejects", async () => {
		vi.stubGlobal("fetch", respond({ success: false, "error-codes": ["invalid-input-response"] }));
		expect(await verifyTurnstileToken("token")).toBe(false);
	});

	it("rejects a token made for another site", async () => {
		vi.stubGlobal("fetch", respond({ success: true, hostname: "evil.example" }));
		expect(await verifyTurnstileToken("token")).toBe(false);
	});

	it("trusts the example.com hostname only from Cloudflare's test secrets", async () => {
		fixture.secret = "1x0000000000000000000000000000000AA";
		vi.stubGlobal("fetch", respond({ success: true, hostname: "example.com" }));
		expect(await verifyTurnstileToken("XXXX.DUMMY.TOKEN.XXXX")).toBe(true);
	});

	it("doesn't ask Cloudflare about an empty or oversized token", async () => {
		const fetchMock = respond({ success: true, hostname: "rezumi.app" });
		vi.stubGlobal("fetch", fetchMock);
		expect(await verifyTurnstileToken("")).toBe(false);
		expect(await verifyTurnstileToken("x".repeat(2049))).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("fails closed when Cloudflare can't be reached, without logging secret or token", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(new Error("network"))),
		);
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		expect(await verifyTurnstileToken("private-token")).toBe(false);
		const logged = JSON.stringify(log.mock.calls);
		expect(logged).not.toContain("private-token");
		expect(logged).not.toContain("0x4AAAArealSecretValue");
		log.mockRestore();
	});
});

describe("isContactFormConfigured", () => {
	it("needs both keys", () => {
		expect(isContactFormConfigured()).toBe(true);
		fixture.secret = undefined;
		expect(isContactFormConfigured()).toBe(false);
		fixture.secret = "x";
		fixture.site = undefined;
		expect(isContactFormConfigured()).toBe(false);
	});
});
