import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const fixture = vi.hoisted(() => ({ mode: "on" as "off" | "admins" | "on", disabled: false }));
vi.mock("@rezumi/env/server", async () => {
	const actual = await vi.importActual<typeof import("@rezumi/env/server")>("@rezumi/env/server");
	return {
		...actual,
		env: {
			...actual.env,
			get PORTFOLIO_MODE() {
				return fixture.mode;
			},
			get FLAG_DISABLE_API_RATE_LIMIT() {
				return fixture.disabled;
			},
		},
	};
});

const { configurePortfolioPublicLimiter, publicPortfolioRequestAllowed, tooManyPortfolioRequests } =
	await import("./public-limit");

const refuse = { limit: vi.fn(() => Promise.resolve({ success: false })) };

describe("publicPortfolioRequestAllowed", () => {
	beforeEach(() => {
		fixture.mode = "on";
		fixture.disabled = false;
		refuse.limit.mockClear();
		configurePortfolioPublicLimiter(() => refuse);
	});

	it("asks the platform's limiter, by address", async () => {
		expect(await publicPortfolioRequestAllowed("203.0.113.9")).toBe(false);
		expect(refuse.limit).toHaveBeenCalledWith({ key: "203.0.113.9" });
	});

	it("does nothing while portfolios are off", async () => {
		fixture.mode = "off";
		expect(await publicPortfolioRequestAllowed("203.0.113.9")).toBe(true);
		expect(refuse.limit).not.toHaveBeenCalled();
	});

	it("honours the switch end-to-end tests use", async () => {
		fixture.disabled = true;
		expect(await publicPortfolioRequestAllowed("203.0.113.9")).toBe(true);
	});

	it("doesn't put everyone with no known address in one bucket", async () => {
		expect(await publicPortfolioRequestAllowed("unknown")).toBe(true);
		expect(await publicPortfolioRequestAllowed(undefined)).toBe(true);
		expect(refuse.limit).not.toHaveBeenCalled();
	});

	it("lets the request through when the limiter fails", async () => {
		configurePortfolioPublicLimiter(() => ({ limit: () => Promise.reject(new Error("down")) }));
		expect(await publicPortfolioRequestAllowed("203.0.113.9")).toBe(true);
	});

	it("limits per process where there is no platform limiter", async () => {
		configurePortfolioPublicLimiter(() => undefined);
		const address = "203.0.113.77";
		for (let request = 0; request < 600; request += 1) expect(await publicPortfolioRequestAllowed(address)).toBe(true);
		expect(await publicPortfolioRequestAllowed(address)).toBe(false);
	});

	it("answers 429 with when to retry", () => {
		const response = tooManyPortfolioRequests();
		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("60");
	});
});
