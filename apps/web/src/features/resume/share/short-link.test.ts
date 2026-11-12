import { describe, expect, it } from "vite-plus/test";
import { portfolioHoldsShortLink } from "./short-link";

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
});
