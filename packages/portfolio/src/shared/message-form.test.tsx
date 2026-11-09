import { describe, expect, it } from "vite-plus/test";
import { renderTestPage } from "../fixtures.test-helpers";
import { PORTFOLIO_LIVE_SCRIPT } from "../live-script";

const withForm = { contact: { form: true } };
const eventUrl = "/api/portfolio/nadia/event";
const reportUrl = "/nadia?report";
const form = { kind: "form", action: "/api/portfolio/nadia/message", siteKey: "1x00000000000000000000AA" } as const;

describe("contact form on the page", () => {
	it("stays away while Turnstile isn't set up", () => {
		const { html } = renderTestPage(withForm, { live: { eventUrl, reportUrl } });
		expect(html).not.toContain("pf-form");
	});

	it("draws the fields, a trap field people never see, and Turnstile's widget", () => {
		const { html, page } = renderTestPage(withForm, {
			contactFormAvailable: true,
			live: { eventUrl, reportUrl, form },
		});
		expect(html).toContain('action="/api/portfolio/nadia/message"');
		expect(html).toContain('name="website"');
		expect(html).toMatch(/class="pf-form__trap" aria-hidden="true"/);
		expect(html).toContain('data-sitekey="1x00000000000000000000AA"');
		expect(html).toContain('data-pf-live="/api/portfolio/nadia/event"');
		expect(page.script.endsWith(PORTFOLIO_LIVE_SCRIPT)).toBe(true);
	});

	it("hides the form without JavaScript and says why", () => {
		const { html, messages } = renderTestPage(withForm, {
			contactFormAvailable: true,
			live: { eventUrl, reportUrl, form },
		});
		expect(html).toContain(
			`<noscript><style>.pf-form{display:none}</style><p class="pf-form__note">${messages.formNeedsScript}`,
		);
	});

	it("says how a form sent without the page script went", () => {
		const { html, messages } = renderTestPage(withForm, {
			contactFormAvailable: true,
			live: { eventUrl, reportUrl, form: { ...form, status: "sent" } },
		});
		expect(html).toContain(`role="status">${messages.messageSent}</p>`);
	});

	it("opens the form on the app's domain from a custom domain", () => {
		const { html } = renderTestPage(withForm, {
			contactFormAvailable: true,
			live: { eventUrl, reportUrl, form: { kind: "link", url: "https://rezumi.example/nadia#contact" } },
		});
		expect(html).not.toContain("<form");
		expect(html).toContain('href="https://rezumi.example/nadia#contact"');
	});

	it("is inert in the editor's preview, which counts and sends nothing", () => {
		const { html, page } = renderTestPage(withForm, { contactFormAvailable: true });
		expect(html).toContain("<fieldset disabled");
		expect(html).not.toContain("data-pf-live");
		expect(html).not.toContain("data-pf-turnstile");
		expect(page.script).not.toContain("sendBeacon");
	});
});
