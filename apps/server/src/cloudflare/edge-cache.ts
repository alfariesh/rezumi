import type { Cache, ExecutionContext } from "@cloudflare/workers-types";

/**
 * Public pictures, portfolio files and link-preview cards: the only routes whose answers are the same for everyone and
 * marked so (`Cache-Control: public, max-age=…`). Their handlers already allow shared caches to keep them for up to an
 * hour (see PUBLIC_PICTURE_CACHE_CONTROL in static/uploads.ts), so keeping them at Cloudflare changes no promise, and a
 * hit skips the database, R2 and the card renderer.
 */
const EDGE_CACHED_PATH = /^\/(?:api\/)?uploads\/|^\/cards\//;

/** Only answers every visitor may get: public, fresh for a while, no cookie, nothing personal. */
function isShareable(response: Response): boolean {
	if (response.status !== 200 || response.headers.has("Set-Cookie")) return false;
	const directives = (response.headers.get("Cache-Control") ?? "").toLowerCase().split(/\s*,\s*/);
	if (!directives.includes("public")) return false;
	if (directives.some((directive) => ["private", "no-store", "no-cache"].includes(directive))) return false;
	const maxAge = directives.find((directive) => directive.startsWith("max-age="));
	return Number(maxAge?.slice("max-age=".length)) > 0;
}

/**
 * Serves a cached copy of a public file when this data center has one (the Cache API answers `If-None-Match` itself),
 * otherwise runs `handle` and keeps a shareable answer. Other requests go straight to `handle`.
 */
export async function withEdgeCache(
	request: Request,
	ctx: Pick<ExecutionContext, "waitUntil">,
	cache: Cache | undefined,
	handle: () => Promise<Response>,
): Promise<Response> {
	const url = new URL(request.url);
	if (!cache || request.method !== "GET" || !EDGE_CACHED_PATH.test(url.pathname)) return handle();
	// The key is the address alone: a shareable answer never depends on who asked.
	const key = url.toString();
	const hit = (await cache.match(request as never).catch(() => undefined)) as Response | undefined;
	if (hit) return hit;
	const response = await handle();
	if (isShareable(response)) ctx.waitUntil(cache.put(key, response.clone() as never).catch(() => {}));
	return response;
}
