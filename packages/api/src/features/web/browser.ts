import type { WebFailure } from "./contracts";
import { env } from "@rezumi/env/server";
import { readCapped } from "./builtin";
import { WebError } from "./contracts";

/**
 * Cloudflare Browser Run's Quick Actions `/content` endpoint: a real browser on Cloudflare's network opens the page,
 * runs its JavaScript and answers the rendered HTML. Used only after the direct reader found nothing to read
 * (`02-teknis.md` section 11). The REST API works the same from Workers and a Node server; the token
 * (`CLOUDFLARE_BROWSER_TOKEN`, permission Browser Run Edit) and account id stay on the server.
 */

const API = "https://api.cloudflare.com/client/v4/accounts";

/**
 * How the browser decides a page is ready. `settled`: its network goes quiet (`networkidle2`), the surest sign a page
 * drawn by JavaScript is done; some pages never go quiet (Notion keeps connections open), so when that times out the
 * page is opened again as `loaded`. `loaded`: read a short while after its HTML is in, for its script to draw; a website
 * import reads up to eleven pages and starts there. The request's own deadline still covers it all.
 */
export type BrowserWait = "settled" | "loaded";

const SETTLED = { gotoOptions: { waitUntil: "networkidle2", timeout: 10_000 } } as const;
const LOADED = { gotoOptions: { waitUntil: "domcontentloaded", timeout: 10_000 }, waitForTimeout: 5_000 } as const;

export const isBrowserRunConfigured = () => Boolean(env.CLOUDFLARE_BROWSER_TOKEN && env.CLOUDFLARE_ACCOUNT_ID);

type ContentResponse = { success?: unknown; result?: unknown };

/** A failed browser read, with the browser time it still took. */
class BrowserFailure extends WebError {
	constructor(
		reason: WebFailure,
		readonly browserMs: number,
	) {
		super(reason);
	}
}

/**
 * The rendered HTML of a public page, and the browser time it took (`X-Browser-Ms-Used`). The caller checks the
 * address is public first. Throws `WebError`; a provider message is never kept, since it can echo the request.
 */
export async function readBrowserPage(
	url: URL,
	signal: AbortSignal,
	wait: BrowserWait = "settled",
): Promise<{ html: string; browserMs: number }> {
	if (wait === "loaded") return openInBrowser(url, LOADED, signal);
	try {
		return await openInBrowser(url, SETTLED, signal);
	} catch (error) {
		// A page whose network never goes quiet: read it once its HTML is in, after a moment for its script to draw.
		if (!(error instanceof BrowserFailure) || error.reason !== "unreachable") throw error;
		const retry = await openInBrowser(url, LOADED, signal);
		return { html: retry.html, browserMs: retry.browserMs + error.browserMs };
	}
}

async function openInBrowser(
	url: URL,
	waiting: typeof SETTLED | typeof LOADED,
	signal: AbortSignal,
): Promise<{ html: string; browserMs: number }> {
	const token = env.CLOUDFLARE_BROWSER_TOKEN;
	const account = env.CLOUDFLARE_ACCOUNT_ID;
	if (!token || !account) throw new WebError("unavailable");
	signal.throwIfAborted();
	let response: Response;
	try {
		response = await fetch(`${API}/${encodeURIComponent(account)}/browser-run/content`, {
			method: "POST",
			signal,
			redirect: "error",
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: JSON.stringify({
				url: url.href,
				...waiting,
				// Only the page's markup is read; skipping these makes the browser finish sooner.
				rejectResourceTypes: ["image", "media", "font", "stylesheet"],
			}),
		});
	} catch {
		signal.throwIfAborted();
		throw new WebError("unavailable");
	}
	const browserMs = Number(response.headers.get("x-browser-ms-used")) || 0;
	if (!response.ok) {
		await response.body?.cancel();
		// 422: the page didn't load in time or the browser couldn't open it. 429: Browser Run's own limits.
		throw new BrowserFailure(
			response.status === 422 ? "unreachable" : response.status === 429 ? "rate-limit" : "unavailable",
			browserMs,
		);
	}
	if (!response.body) throw new WebError("empty");
	let body: ContentResponse;
	try {
		body = JSON.parse((await readCapped(response.body, signal)).toString("utf8")) as ContentResponse;
	} catch (error) {
		signal.throwIfAborted();
		if (error instanceof WebError) throw error;
		throw new WebError("malformed");
	}
	if (body.success !== true || typeof body.result !== "string") throw new WebError("malformed");
	return { html: body.result, browserMs };
}
