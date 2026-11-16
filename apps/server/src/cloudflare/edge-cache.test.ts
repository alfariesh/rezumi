import type { Cache } from "@cloudflare/workers-types";
import { describe, expect, it, vi } from "vite-plus/test";
import { withEdgeCache } from "./edge-cache";

function memoryCache() {
	const entries = new Map<string, Response>();
	const cache = {
		match: vi.fn(async (request: Request) => entries.get(request.url)?.clone()),
		put: vi.fn(async (key: string, response: Response) => {
			entries.set(key, response);
		}),
	};
	return { cache: cache as unknown as Cache, mock: cache, entries };
}

const ctx = () => {
	const pending: Promise<unknown>[] = [];
	return { waitUntil: (promise: Promise<unknown>) => void pending.push(promise), settled: () => Promise.all(pending) };
};

const answer = (cacheControl: string, init: ResponseInit = {}) =>
	new Response("picture", { ...init, headers: { "Cache-Control": cacheControl, ...init.headers } });

describe("withEdgeCache", () => {
	it("keeps a public picture and serves the copy without running the handler again", async () => {
		const { cache } = memoryCache();
		const context = ctx();
		const handle = vi.fn(async () => answer("public, max-age=3600"));
		const request = () => new Request("https://rezumi.app/api/uploads/user/pictures/a.jpeg");

		await expect((await withEdgeCache(request(), context, cache, handle)).text()).resolves.toBe("picture");
		await context.settled();
		await expect((await withEdgeCache(request(), context, cache, handle)).text()).resolves.toBe("picture");
		expect(handle).toHaveBeenCalledOnce();
	});

	it.each([
		["private, no-store", {}],
		["private, max-age=3600", {}],
		["public, no-cache", {}],
		["public, max-age=0", {}],
		["public, max-age=3600", { status: 404 }],
		["public, max-age=3600", { headers: { "Set-Cookie": "a=b" } }],
	])("never keeps %s %j", async (cacheControl, init) => {
		const { cache, entries } = memoryCache();
		const context = ctx();
		await withEdgeCache(new Request("https://rezumi.app/uploads/u/pictures/a.png"), context, cache, async () =>
			answer(cacheControl, init),
		);
		await context.settled();
		expect(entries.size).toBe(0);
	});

	it("leaves other routes, other methods and a missing cache alone", async () => {
		const { cache, mock } = memoryCache();
		const handle = async () => answer("public, max-age=3600");
		await withEdgeCache(new Request("https://rezumi.app/api/rpc/x"), ctx(), cache, handle);
		await withEdgeCache(new Request("https://rezumi.app/cards/a.png", { method: "HEAD" }), ctx(), cache, handle);
		await withEdgeCache(new Request("https://rezumi.app/cards/a.png"), ctx(), undefined, handle);
		expect(mock.match).not.toHaveBeenCalled();
		expect(mock.put).not.toHaveBeenCalled();
	});
});
