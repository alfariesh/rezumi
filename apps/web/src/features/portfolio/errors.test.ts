import { beforeAll, describe, expect, it } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { portfolioErrorCode, portfolioErrorMessage, portfolioRefusalMessage } from "./errors";

const fallback = "Couldn't publish. Try again.";

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

describe("portfolio errors in words", () => {
	it("never show the English of something that isn't the API's answer", () => {
		expect(portfolioErrorMessage(new TypeError("Failed to fetch"), { fallback })).toBe(fallback);
		expect(portfolioErrorMessage("boom", { fallback })).toBe(fallback);
		expect(portfolioErrorCode(new TypeError("Failed to fetch"))).toBeUndefined();
	});

	it("word the API's refusals here, unless the action words a code its own way", () => {
		const unverified = new ORPCError("PORTFOLIO_EMAIL_NOT_VERIFIED", { status: 403, message: "Server English" });
		expect(portfolioErrorMessage(unverified, { fallback })).toBe(
			"Verify your email address before publishing your portfolio.",
		);
		expect(
			portfolioErrorMessage(unverified, { fallback, byCode: { PORTFOLIO_EMAIL_NOT_VERIFIED: "Verify first." } }),
		).toBe("Verify first.");
		expect(
			portfolioErrorMessage(new ORPCError("SOMETHING_NEW", { status: 400, message: "Server English" }), { fallback }),
		).toBe(fallback);
	});

	it("tell a resume that can't be read from one that's gone", () => {
		expect(portfolioRefusalMessage("PORTFOLIO_SOURCE_INVALID", { reason: "unreadable" })).toBe(
			"This resume can't be read. Choose another resume.",
		);
		expect(portfolioRefusalMessage("PORTFOLIO_SOURCE_INVALID", { reason: "unavailable" })).toBe(
			"Choose one of your resumes that isn't in Trash.",
		);
		expect(portfolioRefusalMessage("SOMETHING_NEW")).toBeUndefined();
	});
});
