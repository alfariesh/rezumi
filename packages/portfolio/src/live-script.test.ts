import { describe, expect, it } from "vite-plus/test";
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
