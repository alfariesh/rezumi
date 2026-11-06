import type { RemoteHop } from "./remote";
import type { VideoProvider } from "@rezumi/schema/portfolio/video";
import { createHash } from "node:crypto";
import { getCoordination } from "@rezumi/db/coordination";
import { getRedis, redisKey } from "@rezumi/db/redis";
import { truncateText } from "@rezumi/portfolio/text";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { isVideoThumbnailUrl, parseVideoUrl, youtubeThumbnailUrl } from "@rezumi/schema/portfolio/video";
import { brandIconForUrl } from "./brand";
import { readPortfolioImageHeader } from "./image";
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
		const answer = JSON.parse(new TextDecoder().decode(bytes)) as { title?: unknown; thumbnail_url?: unknown };
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
			url: page.url.href,
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
 * Fetches a preview picture the owner approved, for the browser to shrink and upload like any other picture (the
 * server can't resize on Workers). Only a JPEG, PNG, WebP or GIF by its own bytes; the browser refuses animated
 * GIFs as it does for uploads.
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
		if (GIF_SIGNATURE.test(String.fromCharCode(...bytes.subarray(0, 6))))
			return { bytes, contentType: "image/gif", extension: "gif" };
		const header = readPortfolioImageHeader(bytes);
		// An animated WebP or PNG still has a first frame the browser can use; only the kind of file matters here.
		if (!header.ok && header.reason !== "animated") throw new RemoteImageError("type");
		const kind = header.ok ? header.image : detectRasterKind(bytes);
		if (!kind) throw new RemoteImageError("type");
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

function detectRasterKind(bytes: Uint8Array): { contentType: string; extension: string } | null {
	const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
	if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return { contentType: "image/png", extension: "png" };
	if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { contentType: "image/webp", extension: "webp" };
	return null;
}

// Results by link, for a day: the same link pasted again (another work, an undo) asks the site once.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_CACHE_LIMIT = 500;
const memoryCache = new Map<string, { value: PortfolioUnfurl; expires: number }>();

function cacheKey(input: string): string | null {
	const url = remoteUrl(input);
	return url ? redisKey("portfolio-unfurl", createHash("sha256").update(url.href).digest("hex")) : null;
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
		if (stored !== undefined) return stored ? (JSON.parse(stored) as PortfolioUnfurl) : null;
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

export async function writeUnfurlCache(input: string, value: PortfolioUnfurl, now = Date.now()): Promise<void> {
	const key = cacheKey(input);
	if (!key) return;
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
