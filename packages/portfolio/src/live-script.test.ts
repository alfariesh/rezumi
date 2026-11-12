// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_LIVE_SCRIPT } from "./live-script";
import { PORTFOLIO_PAGE_SCRIPT } from "./script";

/** What a page sends, without its spaces: the production bundle minifies the page's scripts. */
const shippedSize = (script: string) => new TextEncoder().encode(script.replace(/\s+/g, "")).byteLength;

describe("the published page's script", () => {
	it("stays small next to the page script", () => {
		expect(shippedSize(PORTFOLIO_LIVE_SCRIPT)).toBeLessThanOrEqual(1.75 * 1024);
		expect(shippedSize(PORTFOLIO_PAGE_SCRIPT + PORTFOLIO_LIVE_SCRIPT)).toBeLessThanOrEqual(5.5 * 1024);
	});

	it("is safe to inline: no backticks or template holes", () => {
		expect(PORTFOLIO_LIVE_SCRIPT).not.toMatch(/`|\$\{/);
	});

	it("loads Turnstile only by explicit render, and only from Cloudflare", () => {
		expect(PORTFOLIO_LIVE_SCRIPT).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
		expect(PORTFOLIO_LIVE_SCRIPT.match(/https?:\/\/[^"]+/g)).toHaveLength(1);
	});
});

type Sent = { url: string; body: unknown };

/** Listeners each run adds, removed after every test so one page's script never answers for the next. */
const cleanups: (() => void)[] = [];

function trackListeners(target: EventTarget) {
	const original = target.addEventListener;
	target.addEventListener = function add(type, listener, options) {
		cleanups.push(() => target.removeEventListener(type, listener, options));
		original.call(this, type, listener, options);
	};
	cleanups.push(() => {
		target.addEventListener = original;
	});
}

afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

/** Runs the live script in a page whose root sends beacons to `/event`, collecting what it sends. */
/**
 * Runs the live script in a page whose root sends beacons to `/event` (a work's page when `work` is given), collecting
 * what it sends.
 */
function runLive(html: string, { prerendering = false, work = "", referrer = "" } = {}): Sent[] {
	const sent: Sent[] = [];
	document.body.innerHTML = `<div class="pf" data-pf-live="/event"${work ? ` data-pf-work="${work}"` : ""}>${html}</div>`;
	Object.defineProperty(document, "prerendering", { configurable: true, value: prerendering });
	Object.defineProperty(document, "referrer", { configurable: true, value: referrer });
	Object.defineProperty(navigator, "sendBeacon", {
		configurable: true,
		value: (url: string, body: string) => {
			sent.push({ url, body: JSON.parse(body) });
			return true;
		},
	});
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
	trackListeners(document);
	trackListeners(window);
	// oxlint-disable-next-line no-new-func -- runs the inlined script against the test page.
	new Function(PORTFOLIO_LIVE_SCRIPT)();
	return sent;
}

describe("the published page's script in a page", () => {
	it("sends no view on a normal load: the server counts that visit", () => {
		const sent = runLive('<a href="#x" data-pf-event="link">x</a>');
		expect(sent).toEqual([]);
		document.querySelector("a")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(sent).toEqual([{ url: "/event", body: { kind: "link" } }]);
	});

	it("sends the form to its own address and says how it went", async () => {
		const posted: string[] = [];
		globalThis.fetch = (async (url: string) => {
			posted.push(String(url));
			return new Response(JSON.stringify({ ok: true }));
		}) as typeof fetch;
		runLive(
			'<form data-pf-contact data-sent="Sent" data-failed="Failed" action="/api/portfolio/nadia/message"><textarea name="message"></textarea><button>Send</button><p role="status"></p></form>',
		);
		document.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(posted).toEqual([new URL("/api/portfolio/nadia/message", location.href).href]);
		expect(document.querySelector("[role=status]")?.textContent).toBe("Sent");
	});

	it("counts a prerendered page once, when the visitor opens it, with where they came from", () => {
		const sent = runLive("", { prerendering: true, referrer: `https://www.linkedin.com/feed/${"x".repeat(400)}` });
		expect(sent).toEqual([]);
		document.dispatchEvent(new Event("prerenderingchange"));
		expect(sent).toHaveLength(1);
		const [view] = sent as [Sent];
		expect(view.body).toMatchObject({ kind: "view" });
		expect((view.body as { ref: string }).ref).toHaveLength(300);
		expect((view.body as { ref: string }).ref.startsWith("https://www.linkedin.com/feed/")).toBe(true);
		// Without a referrer the beacon says nothing about one.
		const direct = runLive("", { prerendering: true });
		document.dispatchEvent(new Event("prerenderingchange"));
		expect(direct).toEqual([{ url: "/event", body: { kind: "view" } }]);
	});

	it("sends the work's id with every beacon on a work's page, and never a work beacon of its own", () => {
		expect(PORTFOLIO_LIVE_SCRIPT).not.toContain('"work"');
		const sent = runLive('<a href="https://example.test" data-pf-event="embed">x</a>', {
			work: "w1",
			prerendering: true,
		});
		document.querySelector("a")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		document.dispatchEvent(new Event("prerenderingchange"));
		expect(sent).toEqual([
			{ url: "/event", body: { kind: "embed", id: "w1" } },
			{ url: "/event", body: { kind: "view", id: "w1" } },
		]);
	});
});
