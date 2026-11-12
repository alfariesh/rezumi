import { describe, expect, it } from "vite-plus/test";
import { renderPortfolioLockPage, renderPortfolioMissingWorkPage } from "./gate";
import { portfolioMessages } from "./messages";

const messages = portfolioMessages("en-US");
const lock = (status?: "wrong" | "limited") =>
	renderPortfolioLockPage({
		lang: "en-US",
		dir: "ltr",
		action: "/api/portfolio/nadia/unlock",
		next: "work:kopi-app",
		status,
		reportUrl: "/nadia?report",
		messages,
	});

describe("renderPortfolioLockPage", () => {
	it("asks for the password in a plain form that runs no script and stays out of search engines", () => {
		const html = lock();
		expect(html).toMatch(/^<!doctype html><html lang="en-US" dir="ltr">/);
		expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
		expect(html).not.toMatch(/<script|\son[a-z]+="/i);
		expect(html).toContain("<h1>This portfolio is private</h1>");
		expect(html).toContain('<form method="post" action="/api/portfolio/nadia/unlock">');
		expect(html).toContain('<input type="hidden" name="next" value="work:kopi-app">');
		expect(html).toContain('<label for="pf-password">Password</label>');
		expect(html).toContain(
			'<input id="pf-password" type="password" name="password" autocomplete="current-password" minlength="6" maxlength="64" required>',
		);
		expect(html).toContain('<button type="submit">Open portfolio</button>');
		expect(html).toContain('<a href="/nadia?report" rel="nofollow">Report</a>');
		expect(html).not.toContain('role="alert"');
		// Light and dark, from its own small style sheet.
		expect(html).toContain("@media (prefers-color-scheme:dark)");
	});

	it("says why the last try failed, tied to the field", () => {
		expect(lock("wrong")).toContain(
			'aria-invalid="true" aria-describedby="pf-password-alert"><p class="alert" id="pf-password-alert" role="alert">That password isn&#39;t right. Check it and try again.</p>',
		);
		expect(lock("limited")).toContain('role="alert">Too many tries. Try again later.</p>');
	});

	it("escapes everything it writes, and gives a right-to-left page its direction", () => {
		const html = renderPortfolioLockPage({
			lang: 'ar"><script>',
			dir: "rtl",
			action: '/x" onfocus="alert(1)',
			next: '"><img src=x onerror=alert(1)>',
			reportUrl: "javascript:alert(1)\"'",
			messages: { ...messages, lockedTitle: "<b>Private</b>" },
		});
		// Text stays text: no tag or attribute escapes its place.
		expect(html).not.toMatch(/<script|<img|<b>|\son[a-z]+="/);
		expect(html).toContain('dir="rtl"');
		// A sentence in another direction than the page keeps its own (its full stop stays at its end).
		expect(html).toContain("h1,p,label{unicode-bidi:plaintext}");
		expect(html).toContain("&lt;b&gt;Private&lt;/b&gt;");
	});
});

describe("renderPortfolioMissingWorkPage", () => {
	it("says the work is gone and links back to the portfolio, in the page's language", () => {
		const html = renderPortfolioMissingWorkPage({
			lang: "id-ID",
			dir: "ltr",
			homeUrl: "/nadia",
			messages: portfolioMessages("id-ID"),
		});
		expect(html).toMatch(/^<!doctype html><html lang="id-ID" dir="ltr">/);
		expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
		expect(html).toContain(`<h1>${portfolioMessages("id-ID").workMissing}</h1>`);
		expect(html).toContain('<a href="/nadia">');
		expect(html).not.toContain("<script");
	});
});
