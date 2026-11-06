export const VIDEO_PROVIDERS = ["youtube", "vimeo"] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

/** YouTube IDs are 11 URL-safe characters; Vimeo IDs are numbers; Vimeo's unlisted links add a hex hash. */
export const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/;
export const VIMEO_ID_PATTERN = /^\d{6,12}$/;
export const VIMEO_HASH_PATTERN = /^[\da-f]{6,20}$/;

export type ParsedVideo =
	| { provider: "youtube"; videoId: string }
	| { provider: "vimeo"; videoId: string; hash?: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const YOUTUBE_NOCOOKIE_HOSTS = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"]);

function youtube(videoId: string | null | undefined): ParsedVideo | null {
	return videoId && YOUTUBE_ID_PATTERN.test(videoId) ? { provider: "youtube", videoId } : null;
}

function vimeo(videoId: string | undefined, hash: string | null | undefined): ParsedVideo | null {
	if (!videoId || !VIMEO_ID_PATTERN.test(videoId)) return null;
	return hash && VIMEO_HASH_PATTERN.test(hash) ? { provider: "vimeo", videoId, hash } : { provider: "vimeo", videoId };
}

/**
 * Reads a YouTube or Vimeo address someone pasted: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`,
 * `youtube.com/live/`, `youtube(-nocookie).com/embed/`, `vimeo.com/<id>[/<hash>]`, `vimeo.com/channels/<name>/<id>`
 * and `player.vimeo.com/video/<id>[?h=<hash>]`. Anything else, including a malformed ID, is null.
 */
export function parseVideoUrl(input: string): ParsedVideo | null {
	const text = input.trim();
	if (!text || text.length > 2048) return null;
	let url: URL;
	try {
		url = new URL(/^[a-z][\d+.a-z-]*:/i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	const host = url.hostname.toLowerCase();
	const segments = url.pathname.split("/").filter(Boolean);

	if (YOUTUBE_HOSTS.has(host)) {
		if (url.pathname === "/watch") return youtube(url.searchParams.get("v"));
		const [kind, id] = segments;
		if (kind === "shorts" || kind === "live" || kind === "embed") return youtube(id);
		return null;
	}
	if (host === "youtu.be") return youtube(segments[0]);
	if (YOUTUBE_NOCOOKIE_HOSTS.has(host)) return segments[0] === "embed" ? youtube(segments[1]) : null;

	if (host === "player.vimeo.com")
		return segments[0] === "video" ? vimeo(segments[1], url.searchParams.get("h")) : null;
	if (host === "vimeo.com" || host === "www.vimeo.com") {
		if (segments[0] === "channels" && segments.length === 3) return vimeo(segments[2], url.searchParams.get("h"));
		if (segments.length === 1 || segments.length === 2)
			return vimeo(segments[0], segments[1] ?? url.searchParams.get("h"));
		return null;
	}
	return null;
}

/** YouTube serves a thumbnail for every video at this address; no request is needed to learn it. */
export function youtubeThumbnailUrl(videoId: string): string {
	return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Hosts a stored video thumbnail may come from: YouTube's image CDN and Vimeo's (read through oEmbed). */
export const VIDEO_THUMBNAIL_HOSTS = ["i.ytimg.com", "i.vimeocdn.com"] as const;

export function isVideoThumbnailUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && (VIDEO_THUMBNAIL_HOSTS as readonly string[]).includes(url.hostname);
	} catch {
		return false;
	}
}
