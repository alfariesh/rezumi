import { beforeAll, describe, expect, it } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { portfolioHoldsShortLink, primaryResumeDescription, shortLinkDescription } from "./short-link";

const published = { isPublic: true, suspendedAt: null };

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

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

describe("Share texts", () => {
	it("say the short link opens the portfolio while it's published", () => {
		expect(primaryResumeDescription({ portfolioHolds: true, isPrimary: true, isPublic: true, current: null })).toBe(
			"Your published portfolio opens at your short link and custom domain. This resume opens there again if you unpublish the portfolio.",
		);
		expect(
			primaryResumeDescription({ portfolioHolds: true, isPrimary: false, isPublic: true, current: { name: "CV" } }),
		).toMatch(/^Your published portfolio opens at your short link/);
		expect(shortLinkDescription(true)).toBe("Opens your portfolio.");
	});

	it("stay as they were without a published portfolio", () => {
		expect(primaryResumeDescription({ portfolioHolds: false, isPrimary: true, isPublic: true, current: null })).toBe(
			"Your short link and custom domain open this resume.",
		);
		expect(primaryResumeDescription({ portfolioHolds: false, isPrimary: true, isPublic: false, current: null })).toBe(
			"Your short link and custom domain say this resume isn't shared until you publish it again.",
		);
		expect(
			primaryResumeDescription({
				portfolioHolds: false,
				isPrimary: false,
				isPublic: true,
				current: { name: "Main CV" },
			}),
		).toBe("Your short link and custom domain open “Main CV”.");
		expect(primaryResumeDescription({ portfolioHolds: false, isPrimary: false, isPublic: true, current: null })).toBe(
			"Publish this resume to open it at your short link and custom domain.",
		);
		expect(shortLinkDescription(false)).toBeUndefined();
	});
});
