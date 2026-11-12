import { PORTFOLIO_LIMITS } from "./limits";

/**
 * Content from other services a work's Embed block shows (Phase 13, B17), like the Video block: nothing loads from the
 * provider until a visitor presses the block, and the player's address is always built from a reference checked here,
 * never taken as typed.
 */
export const EMBED_PROVIDERS = ["figma", "loom", "spotify", "soundcloud", "google-slides"] as const;

export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

export const EMBED_PROVIDER_NAMES: Record<EmbedProvider, string> = {
	figma: "Figma",
	loom: "Loom",
	spotify: "Spotify",
	soundcloud: "SoundCloud",
	"google-slides": "Google Slides",
};

/** How the player is sized: 16:9, a single audio row, or a tall audio list (album, playlist, set). */
export type EmbedShape = "wide" | "audio" | "audio-tall";

/** A provider and the part of the address that names the content, from which every other address is built. */
export type ParsedEmbed = { provider: EmbedProvider; ref: string };

const FIGMA_KINDS = "file|design|proto|board|slides|deck";
const SPOTIFY_KINDS = "track|album|playlist|episode|show|artist";
/** SoundCloud pages that aren't a person's tracks or sets. */
const SOUNDCLOUD_RESERVED = new Set(["discover", "search", "stream", "you", "upload", "charts"]);

const REF_PATTERNS: Record<EmbedProvider, RegExp> = {
	figma: new RegExp(`^(${FIGMA_KINDS})/[\\dA-Za-z]{10,64}(\\?node-id=[\\d-]{1,40})?$`),
	loom: /^[\da-f]{32}$/,
	spotify: new RegExp(`^(${SPOTIFY_KINDS})/[\\dA-Za-z]{22}$`),
	soundcloud: /^[\w-]{1,64}\/(sets\/)?[\w-]{1,128}$/,
	"google-slides": /^(e\/)?[\w-]{25,128}$/,
};

/** Whether a reference is one this provider's player can be built from. */
export function isEmbedRef(provider: EmbedProvider, ref: string): boolean {
	if (ref.length > PORTFOLIO_LIMITS.text.embedRef || !REF_PATTERNS[provider].test(ref)) return false;
	return provider !== "soundcloud" || !SOUNDCLOUD_RESERVED.has(ref.split("/")[0] ?? "");
}

const accept = (provider: EmbedProvider, ref: string): ParsedEmbed | null =>
	isEmbedRef(provider, ref) ? { provider, ref } : null;

/** The path's segments, without empty ones. */
const segmentsOf = (url: URL) => url.pathname.split("/").filter(Boolean);

/**
 * The embed a pasted address names, or null for any other address (another site, a page of the provider that isn't
 * content, a reference that doesn't fit). An address without a scheme is read as https.
 */
export function parseEmbedUrl(input: string): ParsedEmbed | null {
	const text = input.trim();
	if (!text) return null;
	let url: URL;
	try {
		url = new URL(/^[a-z][\d+.a-z-]*:/i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	if (url.username || url.password) return null;
	const host = url.hostname.toLowerCase().replace(/\.$/, "");
	const segments = segmentsOf(url);

	if (host === "figma.com" || host === "www.figma.com" || host === "embed.figma.com") {
		const [kind = "", key = ""] = segments;
		const node = url.searchParams.get("node-id")?.replaceAll(":", "-");
		return accept("figma", `${kind}/${key}${node ? `?node-id=${node}` : ""}`);
	}
	if (host === "loom.com" || host === "www.loom.com") {
		const [kind, id = ""] = segments;
		return kind === "share" || kind === "embed" ? accept("loom", id) : null;
	}
	if (host === "open.spotify.com") {
		const rest = segments[0]?.startsWith("intl-") ? segments.slice(1) : segments;
		const [kind = "", id = ""] = rest;
		return accept("spotify", `${kind}/${id}`);
	}
	if (host === "soundcloud.com" || host === "www.soundcloud.com" || host === "m.soundcloud.com") {
		if (segments.length === 2) return accept("soundcloud", segments.join("/"));
		if (segments.length === 3 && segments[1] === "sets") return accept("soundcloud", segments.join("/"));
		return null;
	}
	if (host === "docs.google.com") {
		const [presentation, d, first = "", second = ""] = segments;
		if (presentation !== "presentation" || d !== "d") return null;
		return accept("google-slides", first === "e" ? `e/${second}` : first);
	}
	return null;
}

/** The provider's player, for the frame a visitor's press creates. */
export function embedPlayerUrl(embed: ParsedEmbed): string {
	const { ref } = embed;
	switch (embed.provider) {
		case "figma": {
			const [path = "", query = ""] = ref.split("?");
			const node = new URLSearchParams(query).get("node-id");
			return `https://embed.figma.com/${path}?embed-host=rezumi${node ? `&node-id=${node}` : ""}`;
		}
		case "loom":
			return `https://www.loom.com/embed/${ref}`;
		case "spotify":
			return `https://open.spotify.com/embed/${ref}`;
		case "soundcloud":
			return `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com/${ref}`)}&auto_play=true`;
		case "google-slides":
			return `https://docs.google.com/presentation/d/${ref}/embed?start=false&loop=false`;
	}
}

/** The content's own page on the provider's site: the link without JavaScript, and the one the editor shows. */
export function embedPageUrl(embed: ParsedEmbed): string {
	const { ref } = embed;
	switch (embed.provider) {
		case "figma":
			return `https://www.figma.com/${ref}`;
		case "loom":
			return `https://www.loom.com/share/${ref}`;
		case "spotify":
			return `https://open.spotify.com/${ref}`;
		case "soundcloud":
			return `https://soundcloud.com/${ref}`;
		case "google-slides":
			return `https://docs.google.com/presentation/d/${ref}/${ref.startsWith("e/") ? "pub" : "view"}`;
	}
}

export function embedShape(embed: ParsedEmbed): EmbedShape {
	if (embed.provider === "spotify") return /^(track|episode)\//.test(embed.ref) ? "audio" : "audio-tall";
	if (embed.provider === "soundcloud") return embed.ref.includes("/sets/") ? "audio-tall" : "audio";
	return "wide";
}

/** The origins each provider's player loads in, for a work page's `frame-src`. */
export const EMBED_FRAME_ORIGINS: Record<EmbedProvider, readonly string[]> = {
	figma: ["https://embed.figma.com", "https://www.figma.com"],
	loom: ["https://www.loom.com"],
	spotify: ["https://open.spotify.com"],
	soundcloud: ["https://w.soundcloud.com"],
	"google-slides": ["https://docs.google.com"],
};

/** The frame origins of the providers a page uses: each once, sorted. */
export function embedFrameOrigins(providers: Iterable<EmbedProvider>): string[] {
	const origins = new Set<string>();
	for (const provider of providers) for (const origin of EMBED_FRAME_ORIGINS[provider]) origins.add(origin);
	return [...origins].sort();
}

/** Where the server asks a provider for a title and picture (the page's address is appended, encoded). */
export const EMBED_OEMBED_ENDPOINTS: Partial<Record<EmbedProvider, string>> = {
	figma: "https://www.figma.com/api/oembed?url=",
	loom: "https://www.loom.com/v1/oembed?url=",
	spotify: "https://open.spotify.com/oembed?url=",
	soundcloud: "https://soundcloud.com/oembed?format=json&url=",
};
