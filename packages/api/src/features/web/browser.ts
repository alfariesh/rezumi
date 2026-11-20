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

/** How long the browser waits for the page to settle; the request's own deadline still applies. */
const PAGE_TIMEOUT_MS = 15_000;

export const isBrowserRunConfigured = () => Boolean(env.CLOUDFLARE_BROWSER_TOKEN && env.CLOUDFLARE_ACCOUNT_ID);

type ContentResponse = { success?: unknown; result?: unknown };

/**
 * The rendered HTML of a public page, and the browser time it took (`X-Browser-Ms-Used`). The caller checks the
 * address is public first. Throws `WebError`; a provider message is never kept, since it can echo the request.
 */
export async function readBrowserPage(url: URL, signal: AbortSignal): Promise<{ html: string; browserMs: number }> {
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
				gotoOptions: { waitUntil: "networkidle2", timeout: PAGE_TIMEOUT_MS },
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
		throw new WebError(
			response.status === 422 ? "unreachable" : response.status === 429 ? "rate-limit" : "unavailable",
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
