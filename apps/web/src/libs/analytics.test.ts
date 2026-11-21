import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { analyticsLocation, trackSignUp } from "./analytics";

declare global {
	var gtag: unknown;
}

describe("analyticsLocation", () => {
	const origin = "https://rezumi.app";

	it("records the route pattern, not the ids in the path", () => {
		expect(analyticsLocation(origin, "/builder/$resumeId/", "")).toBe("https://rezumi.app/builder/$resumeId");
	});

	it("drops pathless layout segments and keeps the home page as /", () => {
		expect(analyticsLocation(origin, "/_home/", "")).toBe("https://rezumi.app/");
		expect(analyticsLocation(origin, "/_home/ats-checker", "")).toBe("https://rezumi.app/ats-checker");
	});

	it("keeps only campaign parameters from the query", () => {
		expect(analyticsLocation(origin, "/_home/", "?utm_source=blog&email=a%40b.c&gclid=x")).toBe(
			"https://rezumi.app/?utm_source=blog&gclid=x",
		);
	});
});

describe("trackSignUp", () => {
	const session = (createdAt: Date) =>
		({ user: { id: "user-1", createdAt } }) as unknown as Parameters<typeof trackSignUp>[0];

	beforeEach(() => {
		const stored = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => stored.get(key) ?? null,
			setItem: (key: string, value: string) => stored.set(key, value),
		});
		vi.stubGlobal("gtag", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("counts a new account once in this browser", () => {
		const now = Date.now();
		trackSignUp(session(new Date(now - 60_000)), now);
		trackSignUp(session(new Date(now - 60_000)), now);
		expect(globalThis.gtag).toHaveBeenCalledTimes(1);
		expect(globalThis.gtag).toHaveBeenCalledWith("event", "sign_up", {});
	});

	it("ignores older accounts and signed-out visits", () => {
		const now = Date.now();
		trackSignUp(session(new Date(now - 2 * 60 * 60_000)), now);
		trackSignUp(null, now);
		expect(globalThis.gtag).not.toHaveBeenCalled();
	});
});
