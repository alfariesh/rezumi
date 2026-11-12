import type { RemoteHop } from "./remote";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { createServer } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import sharp from "sharp";

// No shared cache in these tests: the in-process one is used.
vi.mock("@rezumi/db/redis", () => ({ getRedis: () => null, redisKey: (...parts: string[]) => parts.join(":") }));
vi.mock("@rezumi/db/coordination", () => ({ getCoordination: () => undefined }));

const { fetchRemote, RemoteFetchError } = await import("./remote");
const {
	fetchRemoteImage,
	readUnfurlCache,
	REMOTE_IMAGE_MAX_PIXELS,
	RemoteImageError,
	unfurlUrl,
	UnfurlError,
	UNFURL_MAX_HTML_BYTES,
	writeUnfurlCache,
} = await import("./unfurl");

/**
 * A fake internet on 127.0.0.1. The fetch layer refuses loopback addresses, so the sites below have public-looking
 * names (`*.example.test`, the real YouTube and Vimeo hosts) that the test transport sends here instead. The address
 * checks themselves stay the real ones: links and redirects to 127.0.0.1, localhost or 10.x are still refused.
 */
type Route = (request: IncomingMessage, response: ServerResponse) => void;
const routes = new Map<string, Route>();
const requests: { host: string; path: string; headers: IncomingMessage["headers"] }[] = [];
let server: Server;
let port = 0;

const hop: RemoteHop = (url, init) => {
	const target = new URL(url);
	const host = target.host;
	target.protocol = "http:";
	target.hostname = "127.0.0.1";
	target.port = String(port);
	return fetch(target, { headers: { ...init.headers, "x-test-host": host }, signal: init.signal, redirect: "manual" });
};

const options = { hop };

const html =
	(body: string, type = "text/html; charset=utf-8"): Route =>
	(_request, response) => {
		response.writeHead(200, { "content-type": type });
		response.end(body);
	};

beforeAll(async () => {
	server = createServer((request, response) => {
		const host = String(request.headers["x-test-host"] ?? "");
		const path = request.url ?? "/";
		requests.push({ host, path, headers: request.headers });
		const route = routes.get(`${host.replace(/:\d+$/, "")}${path.split("?")[0]}`);
		if (route) return route(request, response);
		response.writeHead(404, { "content-type": "text/plain" });
		response.end("not found");
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	port = (server.address() as AddressInfo).port;

	routes.set(
		"studio.example.test/work/kopi",
		html(`<head><title>Kopi Senja</title><meta property="og:description" content="A café identity.">
			<meta property="og:image" content="/cover.jpg"><meta property="og:site_name" content="Studio"></head>`),
	);
	routes.set("short.example.test/k", (_request, response) => {
		response.writeHead(301, { location: "https://www.behance.net/gallery/1/kopi" });
		response.end();
	});
	routes.set("www.behance.net/gallery/1/kopi", html(`<meta property="og:title" content="Kopi on Behance">`));
	for (let index = 0; index < 5; index++)
		routes.set(`loop.example.test/${index}`, (_request, response) => {
			response.writeHead(302, { location: `/${index + 1}` });
			response.end();
		});
	routes.set("evil.example.test/to-loopback", (_request, response) => {
		response.writeHead(302, { location: `http://127.0.0.1:${port}/secret` });
		response.end();
	});
	routes.set("evil.example.test/to-private", (_request, response) => {
		response.writeHead(307, { location: "http://10.0.0.5/admin" });
		response.end();
	});
	routes.set("evil.example.test/to-localhost", (_request, response) => {
		response.writeHead(302, { location: "http://localhost/" });
		response.end();
	});
	routes.set("secure.example.test/downgrade", (_request, response) => {
		response.writeHead(302, { location: "http://studio.example.test/work/kopi" });
		response.end();
	});
	routes.set("big.example.test/page", (_request, response) => {
		response.writeHead(200, { "content-type": "text/html" });
		response.write(`<head><meta property="og:title" content="Big page"></head><body>`);
		// 2 MB after the head: only the first megabyte is read.
		for (let index = 0; index < 32; index++) response.write("x".repeat(64 * 1024));
		response.end("</body>");
	});
	routes.set("slow.example.test/headers", (_request, response) => {
		setTimeout(() => {
			response.writeHead(200, { "content-type": "text/html" });
			response.end("<title>late</title>");
		}, 2000);
	});
	routes.set("slow.example.test/body", (_request, response) => {
		response.writeHead(200, { "content-type": "text/html" });
		response.write("<head><title>Never ends");
	});
	routes.set("api.example.test/data", html(`{"title":"json"}`, "application/json"));
	routes.set("blocked.example.test/", (_request, response) => {
		response.writeHead(403, { "content-type": "text/html" });
		response.end("<title>Go away</title>");
	});
	routes.set("busy.example.test/", (_request, response) => {
		response.writeHead(429);
		response.end();
	});
	routes.set("www.youtube.com/oembed", (request, response) => {
		const url = new URL(request.url ?? "/", "http://x");
		const video = url.searchParams.get("url") ?? "";
		if (video.includes("nullanswer1")) {
			response.writeHead(200, { "content-type": "application/json" });
			response.end("null");
		} else if (video.includes("dQw4w9WgXcQ")) {
			response.writeHead(200, { "content-type": "application/json" });
			response.end(
				JSON.stringify({ title: "  Kopi   Senja — making of  ", thumbnail_url: "https://evil.example.test/x.jpg" }),
			);
		} else {
			response.writeHead(401);
			response.end("Unauthorized");
		}
	});
	routes.set("vimeo.com/api/oembed.json", (_request, response) => {
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify({ title: "Reel 2025", thumbnail_url: "https://i.vimeocdn.com/video/123_640" }));
	});

	const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#336699" } })
		.png()
		.toBuffer();
	const jpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#336699" } })
		.jpeg()
		.toBuffer();
	const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } })
		.gif()
		.toBuffer();
	const send =
		(body: Uint8Array | string, type?: string): Route =>
		(_request, response) => {
			response.writeHead(200, type ? { "content-type": type } : {});
			response.end(body);
		};
	routes.set("cdn.example.test/cover.png", send(png, "image/png"));
	routes.set("cdn.example.test/cover.bin", send(jpeg, "application/octet-stream"));
	routes.set("cdn.example.test/still.gif", send(gif, "image/gif"));
	routes.set("cdn.example.test/logo.svg", send('<svg xmlns="http://www.w3.org/2000/svg"/>', "image/svg+xml"));
	routes.set("cdn.example.test/page.html", send("<title>not a picture</title>", "text/html"));
	routes.set("cdn.example.test/fake.jpg", send("GIF? no, just text", "image/jpeg"));
	routes.set("cdn.example.test/huge.jpg", (_request, response) => {
		response.writeHead(200, { "content-type": "image/jpeg" });
		const chunk = new Uint8Array(1024 * 1024);
		chunk.set([0xff, 0xd8, 0xff]);
		for (let index = 0; index < 11; index++) response.write(chunk);
		response.end();
	});
});

afterAll(async () => {
	server.closeAllConnections();
	await new Promise((resolve) => server.close(resolve));
});

const unreadable = (reason: string) => expect.objectContaining({ name: "UnfurlError", reason });

describe("unfurlUrl: embeds (Phase 13, B17)", () => {
	const LOOM = "0123456789abcdef0123456789abcdef";

	it("turns a provider's link into an embed with its oEmbed title and picture, without reading the page", async () => {
		routes.set("www.loom.com/v1/oembed", (request, response) => {
			const asked = new URL(request.url ?? "/", "http://x").searchParams.get("url");
			response.writeHead(200, { "content-type": "application/json" });
			response.end(
				JSON.stringify(
					asked === `https://www.loom.com/share/${LOOM}`
						? { title: "  Walkthrough   of the app ", thumbnail_url: "https://cdn.loom.com/sessions/thumb.gif" }
						: {},
				),
			);
		});
		requests.length = 0;
		await expect(unfurlUrl(`https://www.loom.com/share/${LOOM}?sid=1`, options)).resolves.toEqual({
			kind: "embed",
			url: `https://www.loom.com/share/${LOOM}`,
			provider: "loom",
			ref: LOOM,
			title: "Walkthrough of the app",
			thumbnailUrl: "https://cdn.loom.com/sessions/thumb.gif",
		});
		expect(requests.map((request) => request.host)).toEqual(["www.loom.com"]);
	});

	it("still makes the embed when oEmbed fails, and asks nobody for Google Slides", async () => {
		routes.set("open.spotify.com/oembed", (_request, response) => {
			response.writeHead(500);
			response.end();
		});
		await expect(unfurlUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", options)).resolves.toEqual({
			kind: "embed",
			url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
			provider: "spotify",
			ref: "track/4uLU6hMCjMI75M1A2tKUQC",
		});
		requests.length = 0;
		const slides = "1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789";
		await expect(unfurlUrl(`https://docs.google.com/presentation/d/${slides}/edit`, options)).resolves.toMatchObject({
			kind: "embed",
			provider: "google-slides",
			ref: slides,
		});
		expect(requests).toEqual([]);
	});

	it("follows a short SoundCloud link to the track it names", async () => {
		routes.set("on.soundcloud.com/abc", (_request, response) => {
			response.writeHead(302, { location: "https://soundcloud.com/nadia-sound/first-track?si=x" });
			response.end();
		});
		routes.set("soundcloud.com/nadia-sound/first-track", html("<title>Track</title>"));
		routes.set("soundcloud.com/oembed", (_request, response) => {
			response.writeHead(200, { "content-type": "application/json" });
			response.end(JSON.stringify({ title: "First track", thumbnail_url: "javascript:alert(1)" }));
		});
		await expect(unfurlUrl("https://on.soundcloud.com/abc", options)).resolves.toEqual({
			kind: "embed",
			url: "https://soundcloud.com/nadia-sound/first-track",
			provider: "soundcloud",
			ref: "nadia-sound/first-track",
			title: "First track",
		});
	});

	it("keeps an embed for a day, reading back only a playable one", async () => {
		const value = {
			kind: "embed" as const,
			url: `https://www.loom.com/share/${LOOM}`,
			provider: "loom" as const,
			ref: LOOM,
		};
		await writeUnfurlCache(`https://www.loom.com/share/${LOOM}`, value);
		await expect(readUnfurlCache(`https://www.loom.com/share/${LOOM}`)).resolves.toEqual(value);
	});
});

describe("unfurlUrl: links", () => {
	it("reads a page's card: title, description, site, picture as a suggestion", async () => {
		await expect(unfurlUrl("https://studio.example.test/work/kopi#top", options)).resolves.toEqual({
			kind: "link",
			url: "https://studio.example.test/work/kopi",
			title: "Kopi Senja",
			description: "A café identity.",
			siteName: "Studio",
			imageUrl: "https://studio.example.test/cover.jpg",
		});
	});

	it("follows redirects to the final page, whose site gives the logo", async () => {
		await expect(unfurlUrl("short.example.test/k", options)).resolves.toEqual({
			kind: "link",
			url: "https://www.behance.net/gallery/1/kopi",
			title: "Kopi on Behance",
			brandIcon: "behance-01",
		});
	});

	it("names a page without a title after its site", async () => {
		routes.set("www.bare.example.test/", html("<p>hi</p>"));
		await expect(unfurlUrl("https://www.bare.example.test/", options)).resolves.toMatchObject({
			title: "bare.example.test",
		});
	});

	it("sends no cookies, credentials or user data, only a generic agent", async () => {
		requests.length = 0;
		await unfurlUrl("https://studio.example.test/work/kopi?x=1", options);
		const [sent] = requests;
		expect(sent?.headers["user-agent"]).toBe("Mozilla/5.0 (compatible; Rezumi; link preview)");
		expect(sent?.headers.cookie).toBeUndefined();
		expect(sent?.headers.authorization).toBeUndefined();
	});

	it("never asks a private or loopback address, also through a redirect", async () => {
		requests.length = 0;
		for (const url of [
			`http://127.0.0.1:${port}/`,
			"http://localhost/",
			"http://[::1]/",
			"http://10.0.0.1/",
			"http://192.168.1.1/",
			"http://169.254.169.254/latest/meta-data",
			"file:///etc/passwd",
			"ftp://studio.example.test/",
			"https://user:secret@studio.example.test/",
		])
			await expect(unfurlUrl(url, options), url).rejects.toEqual(unreadable("unsafe-url"));
		expect(requests).toEqual([]);

		for (const path of ["to-loopback", "to-private", "to-localhost"])
			await expect(unfurlUrl(`https://evil.example.test/${path}`, options), path).rejects.toEqual(
				unreadable("unsafe-url"),
			);
		expect(requests.map((request) => request.host)).toEqual(Array(3).fill("evil.example.test"));
	});

	it("refuses a redirect from https down to http, and more than three redirects", async () => {
		await expect(unfurlUrl("https://secure.example.test/downgrade", options)).rejects.toEqual(unreadable("unsafe-url"));
		requests.length = 0;
		await expect(unfurlUrl("https://loop.example.test/0", options)).rejects.toEqual(unreadable("unreachable"));
		expect(requests).toHaveLength(4);
	});

	it("reads only the first megabyte of a large page", async () => {
		await expect(unfurlUrl("https://big.example.test/page", options)).resolves.toMatchObject({ title: "Big page" });
		const page = await fetchRemote(new URL("https://big.example.test/page"), {
			signal: AbortSignal.timeout(5000),
			accept: "text/html",
			acceptsType: () => true,
			maxBytes: UNFURL_MAX_HTML_BYTES,
			overflow: "truncate",
			hop,
		});
		expect(page.truncated).toBe(true);
		expect(page.bytes.byteLength).toBe(UNFURL_MAX_HTML_BYTES);
	});

	it("gives up after its deadline, whether the answer or its body is slow", async () => {
		await expect(unfurlUrl("https://slow.example.test/headers", { ...options, timeoutMs: 200 })).rejects.toEqual(
			unreadable("timeout"),
		);
		await expect(unfurlUrl("https://slow.example.test/body", { ...options, timeoutMs: 200 })).rejects.toEqual(
			unreadable("timeout"),
		);
	});

	it("stops at once when the caller goes away, without calling it a timeout", async () => {
		const controller = new AbortController();
		const reading = unfurlUrl("https://slow.example.test/headers", { ...options, signal: controller.signal });
		controller.abort(new Error("cancelled"));
		await expect(reading).rejects.toThrow("cancelled");
	});

	it("tells pages that aren't HTML, refuse bots or are missing apart", async () => {
		await expect(unfurlUrl("https://api.example.test/data", options)).rejects.toEqual(unreadable("not-a-page"));
		await expect(unfurlUrl("https://cdn.example.test/cover.png", options)).rejects.toEqual(unreadable("not-a-page"));
		await expect(unfurlUrl("https://blocked.example.test/", options)).rejects.toEqual(unreadable("blocked"));
		await expect(unfurlUrl("https://busy.example.test/", options)).rejects.toEqual(unreadable("blocked"));
		await expect(unfurlUrl("https://studio.example.test/missing", options)).rejects.toEqual(unreadable("unreachable"));
		await expect(unfurlUrl("not a link at all", options)).rejects.toBeInstanceOf(UnfurlError);
	});
});

describe("unfurlUrl: videos", () => {
	it("turns a YouTube link into a video with its oEmbed title and the YouTube picture", async () => {
		await expect(unfurlUrl("https://youtu.be/dQw4w9WgXcQ?t=10", options)).resolves.toEqual({
			kind: "video",
			url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			provider: "youtube",
			videoId: "dQw4w9WgXcQ",
			title: "Kopi Senja — making of",
			// The oEmbed picture isn't on YouTube's image server, so the usual one is used.
			thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
		});
	});

	it("still makes the video when oEmbed refuses", async () => {
		await expect(unfurlUrl("https://www.youtube.com/watch?v=aaaaaaaaaaa", options)).resolves.toEqual({
			kind: "video",
			url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
			provider: "youtube",
			videoId: "aaaaaaaaaaa",
			thumbnailUrl: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg",
		});
	});

	it("still makes the video when oEmbed answers with something that isn't an object", async () => {
		await expect(unfurlUrl("https://www.youtube.com/watch?v=nullanswer1", options)).resolves.toEqual({
			kind: "video",
			url: "https://www.youtube.com/watch?v=nullanswer1",
			provider: "youtube",
			videoId: "nullanswer1",
			thumbnailUrl: "https://i.ytimg.com/vi/nullanswer1/hqdefault.jpg",
		});
	});

	it("reads Vimeo's title and picture, keeping an unlisted video's hash", async () => {
		requests.length = 0;
		await expect(unfurlUrl("https://vimeo.com/123456789/abcdef1234", options)).resolves.toEqual({
			kind: "video",
			url: "https://vimeo.com/123456789/abcdef1234",
			provider: "vimeo",
			videoId: "123456789",
			hash: "abcdef1234",
			title: "Reel 2025",
			thumbnailUrl: "https://i.vimeocdn.com/video/123_640",
		});
		expect(requests.map((request) => request.host)).toEqual(["vimeo.com"]);
		expect(decodeURIComponent(requests[0]?.path ?? "")).toContain("url=https://vimeo.com/123456789/abcdef1234");
	});
});

describe("fetchRemoteImage", () => {
	it("returns a picture the bytes prove to be JPEG, PNG, WebP or GIF, whatever the site calls it", async () => {
		await expect(fetchRemoteImage("https://cdn.example.test/cover.png", options)).resolves.toMatchObject({
			contentType: "image/png",
			extension: "png",
		});
		await expect(fetchRemoteImage("https://cdn.example.test/cover.bin", options)).resolves.toMatchObject({
			contentType: "image/jpeg",
		});
		await expect(fetchRemoteImage("https://cdn.example.test/still.gif", options)).resolves.toMatchObject({
			contentType: "image/gif",
		});
	});

	it("refuses pictures with more pixels than a browser should decode, whatever their file size", async () => {
		const problem = (reason: string) => expect.objectContaining({ name: "RemoteImageError", reason });
		const side = Math.ceil(Math.sqrt(REMOTE_IMAGE_MAX_PIXELS)) + 1;
		// Headers that promise a huge canvas in a few bytes, each format's own way.
		const gif = new Uint8Array([...new TextEncoder().encode("GIF89a"), side & 0xff, side >> 8, side & 0xff, side >> 8]);
		const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#000" } })
			.png()
			.toBuffer();
		const bigPng = new Uint8Array(png);
		new DataView(bigPng.buffer).setUint32(16, side);
		new DataView(bigPng.buffer).setUint32(20, side);
		routes.set("cdn.example.test/bomb.gif", (_request, response) => {
			response.writeHead(200, { "content-type": "image/gif" });
			response.end(gif);
		});
		routes.set("cdn.example.test/bomb.png", (_request, response) => {
			response.writeHead(200, { "content-type": "image/png" });
			response.end(bigPng);
		});
		await expect(fetchRemoteImage("https://cdn.example.test/bomb.gif", options)).rejects.toEqual(problem("too-large"));
		await expect(fetchRemoteImage("https://cdn.example.test/bomb.png", options)).rejects.toEqual(problem("too-large"));
		// A GIF whose header says nothing about its size isn't a picture.
		routes.set("cdn.example.test/empty.gif", (_request, response) => {
			response.writeHead(200, { "content-type": "image/gif" });
			response.end(new TextEncoder().encode("GIF89a"));
		});
		await expect(fetchRemoteImage("https://cdn.example.test/empty.gif", options)).rejects.toEqual(problem("type"));
		// A 1×1 screen holding one huge frame: browsers grow the canvas to the frame, so the frame's size counts.
		const le = (value: number) => [value & 0xff, value >> 8];
		const framed = new Uint8Array([
			...new TextEncoder().encode("GIF89a"),
			...le(1),
			...le(1),
			0,
			0,
			0,
			// A graphic control extension, then the image descriptor.
			0x21,
			0xf9,
			4,
			0,
			0,
			0,
			0,
			0,
			0x2c,
			...le(0),
			...le(0),
			...le(side),
			...le(side),
			0,
			2,
			0,
			0x3b,
		]);
		routes.set("cdn.example.test/framed.gif", (_request, response) => {
			response.writeHead(200, { "content-type": "image/gif" });
			response.end(framed);
		});
		await expect(fetchRemoteImage("https://cdn.example.test/framed.gif", options)).rejects.toEqual(
			problem("too-large"),
		);
	});

	it("refuses anything else, too large pictures, and private addresses", async () => {
		const problem = (reason: string) => expect.objectContaining({ name: "RemoteImageError", reason });
		await expect(fetchRemoteImage("https://cdn.example.test/logo.svg", options)).rejects.toEqual(problem("type"));
		await expect(fetchRemoteImage("https://cdn.example.test/page.html", options)).rejects.toEqual(problem("type"));
		await expect(fetchRemoteImage("https://cdn.example.test/fake.jpg", options)).rejects.toEqual(problem("type"));
		await expect(fetchRemoteImage("https://cdn.example.test/huge.jpg", options)).rejects.toEqual(problem("too-large"));
		await expect(fetchRemoteImage("https://blocked.example.test/", options)).rejects.toEqual(problem("blocked"));
		await expect(fetchRemoteImage(`http://127.0.0.1:${port}/cover.png`, options)).rejects.toEqual(
			problem("unsafe-url"),
		);
		await expect(fetchRemoteImage("https://evil.example.test/to-private", options)).rejects.toBeInstanceOf(
			RemoteImageError,
		);
	});
});

describe("the unfurl cache", () => {
	it("keeps a result for a day per link, ignoring the part after #", async () => {
		const now = Date.now();
		const value = { kind: "link" as const, url: "https://cache.example.test/a", title: "Cached" };
		await writeUnfurlCache("https://cache.example.test/a#top", value, now);
		await expect(readUnfurlCache("https://cache.example.test/a", now + 1000)).resolves.toEqual(value);
		await expect(readUnfurlCache("https://cache.example.test/b", now)).resolves.toBeNull();
		await expect(readUnfurlCache("https://cache.example.test/a", now + 25 * 60 * 60 * 1000)).resolves.toBeNull();
	});

	it("doesn't keep a video whose oEmbed answer failed, so the next paste asks again", async () => {
		const now = Date.now();
		const link = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
		const partial = await unfurlUrl(link, options);
		expect(partial).toMatchObject({ kind: "video", videoId: "bbbbbbbbbbb" });
		expect(partial).not.toHaveProperty("title");
		await writeUnfurlCache(link, partial, now);
		await expect(readUnfurlCache(link, now + 1000)).resolves.toBeNull();

		const complete = await unfurlUrl("https://youtu.be/dQw4w9WgXcQ", options);
		await writeUnfurlCache("https://youtu.be/dQw4w9WgXcQ", complete, now);
		await expect(readUnfurlCache("https://youtu.be/dQw4w9WgXcQ", now + 1000)).resolves.toEqual(complete);
	});
});

describe("the shared unfurl cache", () => {
	const store = new Map<string, string>();
	const shared = {
		get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
		set: vi.fn((key: string, value: string) => {
			store.set(key, value);
			return Promise.resolve();
		}),
	};

	afterEach(() => {
		vi.doUnmock("@rezumi/db/coordination");
		vi.resetModules();
	});

	it("is versioned and reads only results in today's shape", async () => {
		vi.resetModules();
		vi.doMock("@rezumi/db/coordination", () => ({ getCoordination: () => shared }));
		const cache = await import("./unfurl");
		const value = { kind: "link" as const, url: "https://shared.example.test/a", title: "Shared", siteName: "Site" };
		await cache.writeUnfurlCache("https://shared.example.test/a", value);
		const [key] = [...store.keys()];
		expect(key).toMatch(/^portfolio-unfurl:v3:[\da-f]{64}$/);
		await expect(cache.readUnfurlCache("https://shared.example.test/a")).resolves.toEqual(value);

		// Broken JSON, an older shape, or values no result can hold read as a miss, not as a result.
		for (const stored of [
			"{not json",
			JSON.stringify({ kind: "link", url: "https://shared.example.test/a" }),
			JSON.stringify({ ...value, url: "javascript:alert(1)" }),
			JSON.stringify({ ...value, imageUrl: "data:image/png;base64,AAAA" }),
			JSON.stringify({
				kind: "video",
				url: "https://www.youtube.com/watch?v=x",
				provider: "dailymotion",
				videoId: "x",
			}),
		]) {
			store.set(key as string, stored);
			await expect(cache.readUnfurlCache("https://shared.example.test/a"), stored).resolves.toBeNull();
		}
	});
});

describe("the default transport", () => {
	it("refuses loopback even when the address check is skipped, worded like a name that doesn't resolve", async () => {
		const reading = fetchRemote(new URL("http://127.0.0.1/"), {
			signal: AbortSignal.timeout(5000),
			accept: "*/*",
			acceptsType: () => true,
			maxBytes: 1024,
			overflow: "refuse",
			isAllowedHost: () => true,
		});
		await expect(reading).rejects.toBeInstanceOf(RemoteFetchError);
		// The transport refused before connecting; the reason doesn't say so.
		await expect(reading).rejects.toEqual(
			expect.objectContaining({ reason: "unreachable", cause: expect.objectContaining({ cause: "unsafe-url" }) }),
		);
	});

	it("asks only a site's default port, also after a redirect", async () => {
		routes.set("hop.example.test/to-port", (_request, response) => {
			response.writeHead(302, { location: "https://studio.example.test:8443/work/kopi" });
			response.end();
		});
		requests.length = 0;
		for (const url of ["https://studio.example.test:8443/work/kopi", "http://studio.example.test:6379/"])
			await expect(unfurlUrl(url, options), url).rejects.toEqual(unreadable("unsafe-url"));
		await expect(fetchRemoteImage("https://cdn.example.test:8080/cover.png", options)).rejects.toEqual(
			expect.objectContaining({ name: "RemoteImageError", reason: "unsafe-url" }),
		);
		expect(requests).toEqual([]);
		await expect(unfurlUrl("https://hop.example.test/to-port", options)).rejects.toEqual(unreadable("unsafe-url"));
		expect(requests.map((request) => request.host)).toEqual(["hop.example.test"]);
		// The scheme's own port, written out, is the same address.
		await expect(unfurlUrl("https://studio.example.test:443/work/kopi", options)).resolves.toMatchObject({
			title: "Kopi Senja",
		});
	});
});
