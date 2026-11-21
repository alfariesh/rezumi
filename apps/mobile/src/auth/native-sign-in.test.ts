// The native sign-in engine against a scripted server: what it sends (cookies by hand, a trusted Origin, never the
// platform cookie store), the order consent → authorize → token → sign-out, two-step verification, a client the
// server forgot, and a taken username.
import {
	hasPendingTwoFactor,
	signInWithEmail,
	signInWithIdToken,
	signUpWithEmail,
	verifyTwoFactor,
} from "./native-sign-in";

const origin = "https://rezumi.app";
const mockForgetClient = jest.fn(() => Promise.resolve());
const mockComplete = jest.fn((_pending: unknown, _url: string) =>
	Promise.resolve({ accessToken: "access", refreshToken: "refresh" }),
);
let mockClientCounter = 0;

jest.mock("./oauth", () => ({ forgetClient: () => mockForgetClient() }));
jest.mock("./session", () => ({
	isCurrentAttempt: () => true,
	signInWith: async (server: string, obtain: (origin: string, attempt: number) => Promise<unknown>) =>
		(await obtain(server, 1)) !== null,
	prepareAuthorization: () => {
		mockClientCounter++;
		return Promise.resolve({
			origin: "https://rezumi.app",
			clientId: `client-${mockClientCounter}`,
			url: `https://rezumi.app/api/auth/oauth2/authorize?client_id=client-${mockClientCounter}&prompt=none`,
		});
	},
	completeAuthorization: (pending: unknown, url: string) => mockComplete(pending, url),
}));

type Call = { url: string; init: RequestInit & { headers: Record<string, string> } };
let calls: Call[] = [];
let script: ((call: Call) => Response | undefined)[] = [];

const json = (status: number, body: unknown, cookies: string[] = []) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", ...(cookies.length ? { "set-cookie": cookies.join(", ") } : {}) },
	});
const session = "better-auth.session_token=tok.sig; Path=/; HttpOnly";

beforeEach(() => {
	calls = [];
	script = [];
	mockClientCounter = 0;
	jest.clearAllMocks();
	global.fetch = jest.fn((input: string | URL | Request, init?: RequestInit) => {
		const call = { url: String(input), init: (init ?? {}) as Call["init"] };
		calls.push(call);
		for (const step of script) {
			const answer = step(call);
			if (answer) return Promise.resolve(answer);
		}
		return Promise.resolve(json(200, {}));
	}) as typeof fetch;
});

const paths = () => calls.map(({ url }) => new URL(url).pathname.replace("/api/auth", ""));

describe("native sign-in", () => {
	it("connects a password sign-in through consent, authorize and token, then signs the session out", async () => {
		script.push(({ url }) =>
			url.endsWith("/sign-in/email") ? json(200, { token: "tok", user: { id: "u" } }, [session]) : undefined,
		);
		script.push(({ url }) =>
			url.includes("/oauth2/authorize")
				? json(200, { redirect: true, url: "https://rezumi.app/auth/native-callback?code=c&state=s" })
				: undefined,
		);
		await expect(signInWithEmail(origin, "ana@example.com", "secret")).resolves.toEqual({ status: "signed-in" });
		expect(paths()).toEqual(["/sign-in/email", "/native-app/consent", "/oauth2/authorize", "/sign-out"]);
		for (const call of calls) expect(call.init.credentials).toBe("omit");
		const consent = calls[1];
		expect(consent?.init.headers.origin).toBe(origin);
		expect(consent?.init.headers.cookie).toBe("better-auth.session_token=tok.sig");
		expect(JSON.parse(String(consent?.init.body))).toEqual({ client_id: "client-1", resource: origin });
		expect(calls[2]?.init.headers.cookie).toBe("better-auth.session_token=tok.sig");
		expect(mockComplete).toHaveBeenCalledWith(
			expect.objectContaining({ clientId: "client-1" }),
			"https://rezumi.app/auth/native-callback?code=c&state=s",
		);
	});

	it("waits for the second step and connects only after it", async () => {
		script.push(({ url }) =>
			url.endsWith("/sign-in/email")
				? json(200, { twoFactorRedirect: true }, ["better-auth.two_factor=2fa.sig; Max-Age=600; Path=/"])
				: undefined,
		);
		script.push(({ url }) =>
			url.endsWith("/two-factor/verify-totp")
				? json(200, { token: "tok" }, [session, "better-auth.two_factor=; Max-Age=0; Path=/"])
				: undefined,
		);
		script.push(({ url }) =>
			url.includes("/oauth2/authorize") ? json(200, { url: "https://x/cb?code=c" }) : undefined,
		);
		await expect(signInWithEmail(origin, "ana@example.com", "secret")).resolves.toEqual({ status: "two-factor" });
		expect(paths()).toEqual(["/sign-in/email"]);
		expect(hasPendingTwoFactor()).toBe(true);
		await expect(verifyTwoFactor("123 456", "totp")).resolves.toEqual({ status: "signed-in" });
		expect(calls[1]?.init.headers.cookie).toBe("better-auth.two_factor=2fa.sig");
		expect(JSON.parse(String(calls[1]?.init.body))).toEqual({ code: "123456" });
		expect(calls[2]?.init.headers.cookie).toBe("better-auth.session_token=tok.sig");
		expect(hasPendingTwoFactor()).toBe(false);
		await expect(verifyTwoFactor("123456", "totp")).rejects.toMatchObject({ code: "TWO_FACTOR_EXPIRED" });
	});

	it("registers a new client once when the server forgot this device's client", async () => {
		script.push(({ url }) => (url.endsWith("/sign-in/social") ? json(200, { token: "tok" }, [session]) : undefined));
		let consents = 0;
		script.push(({ url }) =>
			url.endsWith("/native-app/consent") && consents++ === 0 ? json(400, { code: "INVALID_CLIENT" }) : undefined,
		);
		script.push(({ url }) =>
			url.includes("/oauth2/authorize") ? json(200, { url: "https://x/cb?code=c" }) : undefined,
		);
		await expect(signInWithIdToken(origin, { provider: "google", idToken: "id", nonce: "n" })).resolves.toEqual({
			status: "signed-in",
		});
		expect(mockForgetClient).toHaveBeenCalledTimes(1);
		expect(paths()).toEqual([
			"/sign-in/social",
			"/native-app/consent",
			"/native-app/consent",
			"/oauth2/authorize",
			"/sign-out",
		]);
		expect(JSON.parse(String(calls[2]?.init.body))).toMatchObject({ client_id: "client-2" });
		expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
			provider: "google",
			idToken: { token: "id", nonce: "n" },
		});
	});

	it("still signs the session out when connecting fails", async () => {
		script.push(({ url }) => (url.endsWith("/sign-in/email") ? json(200, { token: "tok" }, [session]) : undefined));
		script.push(({ url }) =>
			url.endsWith("/native-app/consent") ? json(401, { code: "SESSION_NOT_FRESH" }) : undefined,
		);
		await expect(signInWithEmail(origin, "ana@example.com", "secret")).rejects.toMatchObject({
			code: "SESSION_NOT_FRESH",
		});
		expect(paths()).toEqual(["/sign-in/email", "/native-app/consent", "/sign-out"]);
	});

	it("tries another username when the one from the email is taken", async () => {
		let signUps = 0;
		script.push(({ url }) => {
			if (!url.endsWith("/sign-up/email")) return undefined;
			return signUps++ === 0
				? json(422, { code: "USERNAME_IS_ALREADY_TAKEN" })
				: json(200, { token: "tok" }, [session]);
		});
		script.push(({ url }) =>
			url.includes("/oauth2/authorize") ? json(200, { url: "https://x/cb?code=c" }) : undefined,
		);
		await expect(
			signUpWithEmail(origin, { name: "Ana", email: "ana.putri@example.com", password: "secret-password" }),
		).resolves.toEqual({ status: "signed-in" });
		const [first, second] = calls
			.filter(({ url }) => url.endsWith("/sign-up/email"))
			.map(({ init }) => JSON.parse(String(init.body)));
		expect(first).toMatchObject({ username: "ana.putri", displayUsername: "ana.putri", name: "Ana" });
		expect(second.username).toMatch(/^ana\.putri\d{4}$/);
	});
});
