import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@rezumi/env/server", async (original) => {
	const { env } = await original<typeof import("@rezumi/env/server")>();
	return { env: { ...env, AUTH_SECRET: "test-secret-test-secret-test-secret", APP_URL: "https://rezumi.example" } };
});

const { grantPortfolioAccess, hasPortfolioAccess, PORTFOLIO_ACCESS_TTL_SECONDS } = await import("./visitor-access");

/** The request headers a browser sends back after `grantPortfolioAccess`. */
function cookieFor(portfolioId: string, passwordHash: string): Headers {
	const response = new Headers();
	grantPortfolioAccess(response, portfolioId, passwordHash);
	return new Headers({ cookie: (response.get("set-cookie") ?? "").split(";")[0] ?? "" });
}

afterEach(() => vi.useRealTimers());

describe("the access cookie", () => {
	it("is set for 12 hours on this host only, HttpOnly and Secure over https", () => {
		const response = new Headers();
		grantPortfolioAccess(response, "pf1", "$2a$10$hash");
		const cookie = response.get("set-cookie") ?? "";
		expect(cookie).toMatch(/^portfolio_access_pf1=\d+\.[\da-f]{64}; /);
		expect(cookie).toContain(`Max-Age=${PORTFOLIO_ACCESS_TTL_SECONDS}`);
		expect(PORTFOLIO_ACCESS_TTL_SECONDS).toBe(43_200);
		expect(cookie).toContain("Path=/; ");
		expect(cookie).toContain("SameSite=Lax; HttpOnly; Secure");
		expect(cookie).not.toMatch(/Domain=/i);
		expect(cookie).not.toContain("$2a$10$hash");
	});

	it("opens only the portfolio and password it was made for, until it expires", () => {
		const headers = cookieFor("pf1", "hash-a");
		expect(hasPortfolioAccess(headers, "pf1", "hash-a")).toBe(true);
		expect(hasPortfolioAccess(headers, "pf1", "hash-b")).toBe(false);
		expect(hasPortfolioAccess(headers, "pf2", "hash-a")).toBe(false);
		expect(hasPortfolioAccess(headers, "pf1", null)).toBe(false);
		vi.useFakeTimers({ now: Date.now() + PORTFOLIO_ACCESS_TTL_SECONDS * 1000 + 1, toFake: ["Date"] });
		expect(hasPortfolioAccess(headers, "pf1", "hash-a")).toBe(false);
	});

	it("refuses a cookie that's broken or forged", () => {
		const future = Date.now() + 60_000;
		for (const value of ["", "x", `${future}`, `${future}.${"0".repeat(64)}`, `abc.${"a".repeat(64)}`]) {
			const headers = new Headers({ cookie: `portfolio_access_pf1=${value}` });
			expect(hasPortfolioAccess(headers, "pf1", "hash-a"), value).toBe(false);
		}
		// Moving the expiry forward breaks the signature.
		const real = cookieFor("pf1", "hash-a").get("cookie") ?? "";
		const [, signature] = real.split("=")[1]?.split(".") ?? [];
		const stretched = new Headers({ cookie: `portfolio_access_pf1=${future + 10 ** 9}.${signature}` });
		expect(hasPortfolioAccess(stretched, "pf1", "hash-a")).toBe(false);
	});
});
