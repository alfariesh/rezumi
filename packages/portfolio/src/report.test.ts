import { describe, expect, it } from "vite-plus/test";
import { escapeHtml } from "@rezumi/utils/string";
import { portfolioMessages } from "./messages";
import { renderPortfolioReportPage } from "./report";

const base = {
	lang: "en-US",
	dir: "ltr" as const,
	name: "Nadia",
	pageUrl: "/nadia",
	action: "/api/portfolio/nadia/report",
	siteKey: "site-key",
	supportEmail: "hi@rezumi.app",
	messages: portfolioMessages("en-US"),
};

describe("renderPortfolioReportPage", () => {
	it("is a form that posts to the report address, with Turnstile and the trap field", () => {
		const html = renderPortfolioReportPage(base);
		expect(html).toContain('action="/api/portfolio/nadia/report"');
		expect(html).toContain('data-sitekey="site-key"');
		expect(html).toContain('name="website"');
		expect(html).toContain("turnstile/v0/api.js");
		for (const reason of ["fraud", "illegal", "rights", "fake_testimonial", "other"])
			expect(html).toContain(`value="${reason}"`);
	});

	it("never indexes", () => {
		expect(renderPortfolioReportPage(base)).toContain('content="noindex, nofollow"');
	});

	it("escapes the person's name", () => {
		const html = renderPortfolioReportPage({ ...base, name: "<script>alert(1)</script>" });
		expect(html).not.toContain("<script>alert(1)");
		expect(html).toContain("&lt;script&gt;");
	});

	it("gives an email address instead of a form without Turnstile keys", () => {
		const html = renderPortfolioReportPage({ ...base, siteKey: null });
		expect(html).not.toContain("<form");
		expect(html).toContain('href="mailto:hi@rezumi.app"');
	});

	it("shows the outcome of a send", () => {
		const sent = renderPortfolioReportPage({ ...base, status: "sent" });
		expect(sent).toContain(base.messages.reportSent);
		expect(sent).not.toContain("<form");
		expect(renderPortfolioReportPage({ ...base, status: "failed" })).toContain(escapeHtml(base.messages.reportFailed));
	});

	it("is in the portfolio's language", () => {
		expect(renderPortfolioReportPage({ ...base, lang: "id-ID", messages: portfolioMessages("id-ID") })).toContain(
			"Laporkan portofolio ini",
		);
	});
});
