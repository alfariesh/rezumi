import { describe, expect, it } from "vite-plus/test";
import { formatTimeSince, isPortfolioLive, portfolioHoldsShortLink, timeSinceParts } from "./sharing";

const published = { isPublic: true, suspendedAt: null };

describe("who the short link opens", () => {
	it("is the portfolio only when it's open to the account, published and not taken down", () => {
		expect(portfolioHoldsShortLink({ enabled: true, portfolio: published })).toBe(true);
		// PORTFOLIO_MODE off (or the account left out): Share reads exactly as before.
		expect(portfolioHoldsShortLink({ enabled: false, portfolio: null })).toBe(false);
		expect(portfolioHoldsShortLink({ enabled: true, portfolio: null })).toBe(false);
		expect(portfolioHoldsShortLink({ enabled: true, portfolio: { isPublic: false, suspendedAt: null } })).toBe(false);
		expect(
			portfolioHoldsShortLink({ enabled: true, portfolio: { isPublic: true, suspendedAt: "2026-11-06T00:00:00Z" } }),
		).toBe(false);
		expect(portfolioHoldsShortLink(undefined)).toBe(false);
	});

	it("calls a portfolio live only when published and not suspended", () => {
		expect(isPortfolioLive(published)).toBe(true);
		expect(isPortfolioLive({ isPublic: true, suspendedAt: new Date() })).toBe(false);
		expect(isPortfolioLive(null)).toBe(false);
	});
});

describe("time since", () => {
	const now = Date.UTC(2026, 10, 22, 12, 0, 0);
	const ago = (ms: number) => new Date(now - ms);
	const MINUTE = 60_000;
	const HOUR = 60 * MINUTE;
	const DAY = 24 * HOUR;

	it("picks the largest whole unit", () => {
		expect(timeSinceParts(ago(0), now)).toEqual({ count: 0, unit: "minute" });
		expect(timeSinceParts(ago(45 * MINUTE), now)).toEqual({ count: 45, unit: "minute" });
		expect(timeSinceParts(ago(59 * MINUTE + 59_000), now)).toEqual({ count: 59, unit: "minute" });
		expect(timeSinceParts(ago(HOUR), now)).toEqual({ count: 1, unit: "hour" });
		expect(timeSinceParts(ago(23 * HOUR), now)).toEqual({ count: 23, unit: "hour" });
		expect(timeSinceParts(ago(3 * DAY), now)).toEqual({ count: 3, unit: "day" });
		expect(timeSinceParts(ago(6 * 7 * DAY), now)).toEqual({ count: 6, unit: "week" });
		expect(timeSinceParts(ago(400 * DAY), now)).toEqual({ count: 1, unit: "year" });
	});

	it("never counts backwards for a moment in the future", () => {
		expect(timeSinceParts(new Date(now + HOUR), now)).toEqual({ count: 0, unit: "minute" });
	});

	it("writes the parts short for the web", () => {
		expect(formatTimeSince(ago(2 * HOUR), "en", now)).toBe("2h");
	});
});
