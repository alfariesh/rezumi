import type { RemoteHop } from "./remote";
import type { VideoProvider } from "@rezumi/schema/portfolio/video";
import { createHash } from "node:crypto";
import z from "zod";
import { getCoordination } from "@rezumi/db/coordination";
import { getRedis, redisKey } from "@rezumi/db/redis";
import { readPortfolioImageHeader } from "@rezumi/portfolio/image-header";
import { truncateText } from "@rezumi/portfolio/text";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import {
	isVideoThumbnailUrl,
	parseVideoUrl,
	VIDEO_PROVIDERS,
	youtubeThumbnailUrl,
} from "@rezumi/schema/portfolio/video";
import { brandIconForUrl } from "./brand";
import { decodePage, parseLinkMeta } from "./link-meta";
import { fetchRemote, RemoteFetchError, remoteDeadline, remoteUrl } from "./remote";

/** What a pasted link becomes (`02-teknis.md` section 20): a video block for YouTube and Vimeo, a link card otherwise. */
export type PortfolioUnfurl =
	| {
			kind: "video";
			/** The video's own page. */
			url: string;
			provider: VideoProvider;
			videoId: string;
			hash?: string;
			title?: string;
			thumbnailUrl?: string;
	  }
	| {
			kind: "link";
			/** Where the link ended up after redirects. */
			url: string;
			title: string;
			description?: string;
			siteName?: string;
			/** The page's preview picture on its own site: a suggestion the owner approves before it's copied. */
			imageUrl?: string;
			brandIcon?: string;
	  };

/** Why a link couldn't be read; the editor then asks the owner to fill the card in. */
export type UnfurlProblem = "unreachable" | "not-a-page" | "timeout" | "unsafe-url" | "blocked";

export class UnfurlError extends Error {
	constructor(readonly reason: UnfurlProblem) {
		super(`The link couldn't be read: ${reason}`);
		this.name = "UnfurlError";
	}
}

export type UnfurlOptions = {
	signal?: AbortSignal | undefined;
	hop?: RemoteHop | undefined;
	isAllowedHost?: ((hostname: string) => boolean) | undefined;
	/** The deadline for the whole link, oEmbed included. */
	timeoutMs?: number | undefined;
};

const UNFURL_TIMEOUT_MS = 5000;
const REMOTE_IMAGE_TIMEOUT_MS = 10_000;
/** A page's head is all a preview needs; anything past this is left unread. */
export const UNFURL_MAX_HTML_BYTES = 1024 * 1024;
const OEMBED_MAX_BYTES = 64 * 1024;

const isHtml = (type: string) => type === "text/html" || type === "application/xhtml+xml";

function toUnfurlError(error: unknown): unknown {
	if (!(error instanceof RemoteFetchError)) return error;
	switch (error.reason) {
		case "wrong-type":
		case "too-large":
			return new UnfurlError("not-a-page");
		default:
			return new UnfurlError(error.reason);
	}
}

/** A video's title and picture from its site's oEmbed answer; nothing when the site won't say. */
async function videoDetails(
	pageUrl: string,
	provider: VideoProvider,
	signal: AbortSignal,
	options: UnfurlOptions,
): Promise<{ title?: string; thumbnailUrl?: string }> {
	const endpoint =
		provider === "youtube"
			? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(pageUrl)}`
			: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(pageUrl)}`;
	try {
		const { bytes } = await fetchRemote(new URL(endpoint), {
			signal,
			accept: "application/json",
			acceptsType: (type) => type === "application/json" || type === "text/json" || type === "text/javascript",
			maxBytes: OEMBED_MAX_BYTES,
			overflow: "refuse",
			hop: options.hop,
			isAllowedHost: options.isAllowedHost,
		});
		const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
		// `null` or a list is valid JSON too, and holds no title.
		if (typeof parsed !== "object" || parsed === null) return {};
		const answer = parsed as { title?: unknown; thumbnail_url?: unknown };
		const title = typeof answer.title === "string" ? answer.title.replace(/\s+/g, " ").trim() : "";
		const thumbnail = typeof answer.thumbnail_url === "string" ? answer.thumbnail_url : "";
		return {
			...(title ? { title: truncateText(title, PORTFOLIO_LIMITS.text.mediaTitle) } : {}),
			...(thumbnail && isVideoThumbnailUrl(thumbnail) ? { thumbnailUrl: thumbnail } : {}),
		};
	} catch (error) {
		// The caller went away: stop. Anything else only costs the video its title.
		if (!(error instanceof RemoteFetchError) && !(error instanceof SyntaxError)) throw error;
		return {};
	}
}

/**
 * Reads a pasted link. YouTube and Vimeo addresses become a video (title and picture from oEmbed, when the site gives
 * them); any other page becomes a link card from its meta tags. Throws `UnfurlError` when the page can't be read.
 */
export async function unfurlUrl(input: string, options: UnfurlOptions = {}): Promise<PortfolioUnfurl> {
	const url = remoteUrl(input, options.isAllowedHost);
	if (!url) throw new UnfurlError("unsafe-url");
	const signal = remoteDeadline(options.timeoutMs ?? UNFURL_TIMEOUT_MS, options.signal);

	const video = parseVideoUrl(url.href);
	if (video) {
		const page =
			video.provider === "youtube"
				? `https://www.youtube.com/watch?v=${video.videoId}`
				: `https://vimeo.com/${video.videoId}${video.provider === "vimeo" && video.hash ? `/${video.hash}` : ""}`;
		const details = await videoDetails(page, video.provider, signal, options);
		const thumbnailUrl =
			details.thumbnailUrl ?? (video.provider === "youtube" ? youtubeThumbnailUrl(video.videoId) : undefined);
		return {
			kind: "video",
			url: page,
			provider: video.provider,
			videoId: video.videoId,
			...(video.provider === "vimeo" && video.hash ? { hash: video.hash } : {}),
			...(details.title ? { title: details.title } : {}),
			...(thumbnailUrl ? { thumbnailUrl } : {}),
		};
	}

	try {
		const page = await fetchRemote(url, {
			signal,
			accept: "text/html,application/xhtml+xml;q=0.9",
			acceptsType: isHtml,
			maxBytes: UNFURL_MAX_HTML_BYTES,
			overflow: "truncate",
			hop: options.hop,
			isAllowedHost: options.isAllowedHost,
		});
		const meta = parseLinkMeta(decodePage(page.bytes, page.headers.get("content-type")), page.url);
		const brandIcon = brandIconForUrl(page.url);
		return {
			kind: "link",
			// Redirects can end at an address longer than a link may be; the pasted one then stands for it.
			url: page.url.href.length <= PORTFOLIO_LIMITS.text.url ? page.url.href : url.href,
			title: meta.title ?? truncateText(page.url.hostname.replace(/^www\./, ""), PORTFOLIO_LIMITS.text.linkTitle),
			...(meta.description ? { description: meta.description } : {}),
			...(meta.siteName ? { siteName: meta.siteName } : {}),
			...(meta.image ? { imageUrl: meta.image } : {}),
			...(brandIcon ? { brandIcon } : {}),
		};
	} catch (error) {
		throw toUnfurlError(error);
	}
}

/** Why a remote picture couldn't be copied. */
export type RemoteImageProblem = UnfurlProblem | "too-large" | "type";

export class RemoteImageError extends Error {
	constructor(readonly reason: RemoteImageProblem) {
		super(`The picture couldn't be fetched: ${reason}`);
		this.name = "RemoteImageError";
	}
}

const GIF_SIGNATURE = /^GIF8[79]a$/;

/**
 * The most pixels a fetched picture may have. The browser decodes it to shrink it, and a small file can unpack into a
 * bitmap large enough to run a phone out of memory; real preview pictures are a few megapixels.
 */
export const REMOTE_IMAGE_MAX_PIXELS = 50_000_000;

type RasterKind = { contentType: string; extension: string; width: number; height: number };

const ascii = (bytes: Uint8Array, start: number, length: number) =>
	String.fromCharCode(...bytes.subarray(start, start + length));
const u16le = (bytes: Uint8Array, at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const u24le = (bytes: Uint8Array, at: number) => u16le(bytes, at) | ((bytes[at + 2] ?? 0) << 16);
const u32be = (bytes: Uint8Array, at: number) =>
	(((bytes[at] ?? 0) << 24) >>> 0) + ((bytes[at + 1] ?? 0) << 16) + ((bytes[at + 2] ?? 0) << 8) + (bytes[at + 3] ?? 0);

/**
 * A GIF's size as a browser draws it: its logical screen, grown to hold every frame, since browsers enlarge the canvas
 * for a frame that reaches past the screen (a 1×1 screen can hold a 30000×30000 frame). Frames are found by walking the
 * blocks; a file that ends early is measured by what it has.
 */
function gifSize(bytes: Uint8Array): { width: number; height: number } {
	let width = u16le(bytes, 6);
	let height = u16le(bytes, 8);
	const tableSize = (packed: number) => (packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0);
	/** The offset after a run of data sub-blocks starting at `at`. */
	const skipSubBlocks = (at: number) => {
		let offset = at;
		while (offset < bytes.length) {
			const size = bytes[offset] ?? 0;
			offset += 1 + size;
			if (size === 0) break;
		}
		return offset;
	};
	let offset = 13 + tableSize(bytes[10] ?? 0);
	while (offset < bytes.length) {
		const block = bytes[offset];
		if (block === 0x21) offset = skipSubBlocks(offset + 2);
		else if (block === 0x2c) {
			width = Math.max(width, u16le(bytes, offset + 1) + u16le(bytes, offset + 5));
			height = Math.max(height, u16le(bytes, offset + 3) + u16le(bytes, offset + 7));
			// Past the descriptor, its colour table and the LZW code size, then the image data.
			offset = skipSubBlocks(offset + 10 + tableSize(bytes[offset + 9] ?? 0) + 1);
		} else break;
	}
	return { width, height };
}

/**
 * What a fetched picture is and its pixel size, from its header: a still JPEG, PNG or WebP, an animated PNG or WebP
 * (its first frame is still a picture the browser can use), or a GIF (the browser refuses animated ones, as for
 * uploads). Null for anything else.
 */
function rasterKind(bytes: Uint8Array): RasterKind | null {
	if (GIF_SIGNATURE.test(ascii(bytes, 0, 6))) return { contentType: "image/gif", extension: "gif", ...gifSize(bytes) };
	const header = readPortfolioImageHeader(bytes);
	if (header.ok) return header.image;
	if (header.reason !== "animated") return null;
	if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n")
		return { contentType: "image/png", extension: "png", width: u32be(bytes, 16), height: u32be(bytes, 20) };
	// An animated WebP is always the extended format, whose header holds the canvas size.
	return {
		contentType: "image/webp",
		extension: "webp",
		width: u24le(bytes, 24) + 1,
		height: u24le(bytes, 27) + 1,
	};
}

/**
 * Fetches a preview picture the owner approved, for the browser to shrink and upload like any other picture (the
 * server can't resize on Workers). Only a JPEG, PNG, WebP or GIF by its own bytes, of at most
 * `REMOTE_IMAGE_MAX_PIXELS`; the browser refuses animated GIFs as it does for uploads.
 */
export async function fetchRemoteImage(
	input: string,
	options: UnfurlOptions = {},
): Promise<{ bytes: Uint8Array; contentType: string; extension: string }> {
	const url = remoteUrl(input, options.isAllowedHost);
	if (!url) throw new RemoteImageError("unsafe-url");
	try {
		const { bytes } = await fetchRemote(url, {
			signal: remoteDeadline(options.timeoutMs ?? REMOTE_IMAGE_TIMEOUT_MS, options.signal),
			accept: "image/webp,image/png,image/jpeg,image/gif;q=0.8",
			// Sites label pictures loosely (octet-stream, none at all); the bytes decide below.
			acceptsType: (type) => !type || type.startsWith("image/") || type === "application/octet-stream",
			maxBytes: PORTFOLIO_UPLOAD.remoteImageBytes,
			overflow: "refuse",
			hop: options.hop,
			isAllowedHost: options.isAllowedHost,
		});
		const kind = rasterKind(bytes);
		if (!kind || kind.width < 1 || kind.height < 1) throw new RemoteImageError("type");
		if (kind.width * kind.height > REMOTE_IMAGE_MAX_PIXELS) throw new RemoteImageError("too-large");
		return { bytes, contentType: kind.contentType, extension: kind.extension };
	} catch (error) {
		if (error instanceof RemoteFetchError) {
			if (error.reason === "too-large") throw new RemoteImageError("too-large");
			if (error.reason === "wrong-type") throw new RemoteImageError("type");
			throw new RemoteImageError(error.reason);
		}
		throw error;
	}
}

// Results by link, for a day: the same link pasted again (another work, an undo) asks the site once.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_CACHE_LIMIT = 500;
const memoryCache = new Map<string, { value: PortfolioUnfurl; expires: number }>();
/** Part of every cache key: a change to what a result holds bumps it, so results in the old shape are never read. */
const CACHE_VERSION = "v2";

const cachedText = (max: number) => z.string().max(max).optional();
const cachedUrl = z
	.string()
	.max(PORTFOLIO_LIMITS.text.url)
	.regex(/^https?:\/\//);

/** What a cached result must look like to be used; anything else (an older shape, a broken value) reads as a miss. */
const cachedUnfurlSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("video"),
		url: cachedUrl,
		provider: z.enum(VIDEO_PROVIDERS),
		videoId: z.string().max(PORTFOLIO_LIMITS.text.id),
		hash: cachedText(PORTFOLIO_LIMITS.text.id),
		// A video is only cached with its title (see `isCompleteUnfurl`).
		title: z.string().min(1).max(PORTFOLIO_LIMITS.text.mediaTitle),
		thumbnailUrl: cachedUrl.optional(),
	}),
	z.object({
		kind: z.literal("link"),
		url: cachedUrl,
		title: z.string().max(PORTFOLIO_LIMITS.text.linkTitle),
		description: cachedText(PORTFOLIO_LIMITS.text.linkDescription),
		siteName: cachedText(PORTFOLIO_LIMITS.text.siteName),
		imageUrl: cachedUrl.optional(),
		brandIcon: cachedText(PORTFOLIO_LIMITS.text.id),
	}),
]);

/**
 * Whether a result is worth keeping for a day. A video whose oEmbed answer failed (timeout, refused, broken JSON) has
 * no title; it's still shown, but the next paste asks again instead of keeping it title-less for a day.
 */
function isCompleteUnfurl(value: PortfolioUnfurl): boolean {
	return value.kind === "link" || Boolean(value.title);
}

function cacheKey(input: string): string | null {
	const url = remoteUrl(input);
	return url ? redisKey("portfolio-unfurl", CACHE_VERSION, createHash("sha256").update(url.href).digest("hex")) : null;
}

/** A stored result, when it is one this version wrote; null otherwise. */
function parseCachedUnfurl(stored: string): PortfolioUnfurl | null {
	let value: unknown;
	try {
		value = JSON.parse(stored);
	} catch {
		return null;
	}
	const parsed = cachedUnfurlSchema.safeParse(value);
	// The schema states exactly `PortfolioUnfurl`; Zod adds no keys for the optional fields left out.
	return parsed.success ? (parsed.data as PortfolioUnfurl) : null;
}

/**
 * The shared cache when there is one (Redis on Node, the coordination Durable Object on Workers), else this
 * process's memory. A cache that fails only means the site is asked again.
 */
export async function readUnfurlCache(input: string, now = Date.now()): Promise<PortfolioUnfurl | null> {
	const key = cacheKey(input);
	if (!key) return null;
	try {
		const redis = getRedis();
		const coordination = getCoordination();
		const stored = redis ? await redis.get(key) : coordination ? await coordination.get(key) : undefined;
		if (stored !== undefined) return stored ? parseCachedUnfurl(stored) : null;
	} catch (error) {
		console.error("[portfolio] Unfurl cache unavailable", error);
		return null;
	}
	const hit = memoryCache.get(key);
	if (!hit) return null;
	if (hit.expires > now) return hit.value;
	memoryCache.delete(key);
	return null;
}

/** Keeps a result for a day; a partial one (a video without its oEmbed title) isn't kept. */
export async function writeUnfurlCache(input: string, value: PortfolioUnfurl, now = Date.now()): Promise<void> {
	const key = cacheKey(input);
	if (!key || !isCompleteUnfurl(value)) return;
	try {
		const redis = getRedis();
		if (redis) {
			await redis.set(key, JSON.stringify(value), "PX", CACHE_TTL_MS);
			return;
		}
		const coordination = getCoordination();
		if (coordination) {
			await coordination.set(key, JSON.stringify(value), CACHE_TTL_MS);
			return;
		}
	} catch (error) {
		console.error("[portfolio] Unfurl cache unavailable", error);
		return;
	}
	if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
		const oldest = memoryCache.keys().next().value;
		if (oldest !== undefined) memoryCache.delete(oldest);
	}
	memoryCache.set(key, { value, expires: now + CACHE_TTL_MS });
}
