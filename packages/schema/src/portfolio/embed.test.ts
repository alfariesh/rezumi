import { describe, expect, it } from "vite-plus/test";
import {
	EMBED_PROVIDERS,
	embedFrameOrigins,
	embedPageUrl,
	embedPlayerUrl,
	embedShape,
	isEmbedRef,
	parseEmbedUrl,
} from "./embed";

const FIGMA_KEY = "AbCdEf0123456789xyz";
const LOOM_ID = "0123456789abcdef0123456789abcdef";
const SPOTIFY_ID = "4uLU6hMCjMI75M1A2tKUQC";
const SLIDES_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-AB";

describe("parseEmbedUrl", () => {
	it.each([
		[`https://www.figma.com/design/${FIGMA_KEY}/My-file?node-id=1-2&t=x`, "figma", `design/${FIGMA_KEY}?node-id=1-2`],
		[`figma.com/proto/${FIGMA_KEY}`, "figma", `proto/${FIGMA_KEY}`],
		[`https://embed.figma.com/board/${FIGMA_KEY}/Board?node-id=3%3A4`, "figma", `board/${FIGMA_KEY}?node-id=3-4`],
		[`https://www.loom.com/share/${LOOM_ID}?sid=1`, "loom", LOOM_ID],
		[`https://loom.com/embed/${LOOM_ID}`, "loom", LOOM_ID],
		[`https://open.spotify.com/track/${SPOTIFY_ID}?si=abc`, "spotify", `track/${SPOTIFY_ID}`],
		[`https://open.spotify.com/intl-id/playlist/${SPOTIFY_ID}`, "spotify", `playlist/${SPOTIFY_ID}`],
		["https://soundcloud.com/nadia-sound/first-track", "soundcloud", "nadia-sound/first-track"],
		["https://m.soundcloud.com/nadia-sound/sets/demo_2025", "soundcloud", "nadia-sound/sets/demo_2025"],
		[`https://docs.google.com/presentation/d/${SLIDES_ID}/edit#slide=id.p`, "google-slides", SLIDES_ID],
		[`https://docs.google.com/presentation/d/e/${SLIDES_ID}/pub?start=false`, "google-slides", `e/${SLIDES_ID}`],
	])("reads %s", (url, provider, ref) => {
		expect(parseEmbedUrl(url)).toEqual({ provider, ref });
	});

	it.each([
		"",
		"javascript:alert(1)",
		`https://evil.example/design/${FIGMA_KEY}`,
		`https://www.figma.com.evil.example/design/${FIGMA_KEY}`,
		`https://www.figma.com/community/file/${FIGMA_KEY}`,
		`https://www.figma.com/design/short`,
		`ftp://www.loom.com/share/${LOOM_ID}`,
		"https://www.loom.com/share/not-hex",
		`https://open.spotify.com/user/${SPOTIFY_ID}`,
		"https://soundcloud.com/discover/sets/x",
		"https://soundcloud.com/nadia-sound",
		"https://soundcloud.com/nadia-sound/track/extra",
		`https://soundcloud.com/a/${"x".repeat(129)}`,
		"https://docs.google.com/document/d/abc/edit",
		`https://user:pass@www.loom.com/share/${LOOM_ID}`,
	])("refuses %s", (url) => {
		expect(parseEmbedUrl(url)).toBeNull();
	});
});

describe("isEmbedRef", () => {
	it("checks each provider's pattern and the length limit", () => {
		expect(isEmbedRef("loom", LOOM_ID)).toBe(true);
		expect(isEmbedRef("loom", `${LOOM_ID}/x`)).toBe(false);
		expect(isEmbedRef("soundcloud", "upload/x")).toBe(false);
		expect(isEmbedRef("google-slides", `e/${"a".repeat(201)}`)).toBe(false);
	});
});

describe("addresses and shapes", () => {
	it("builds the player and page addresses from the reference only", () => {
		const figma = { provider: "figma", ref: `design/${FIGMA_KEY}?node-id=1-2` } as const;
		expect(embedPlayerUrl(figma)).toBe(`https://embed.figma.com/design/${FIGMA_KEY}?embed-host=rezumi&node-id=1-2`);
		expect(embedPageUrl(figma)).toBe(`https://www.figma.com/design/${FIGMA_KEY}?node-id=1-2`);
		const sound = { provider: "soundcloud", ref: "nadia-sound/first-track" } as const;
		expect(embedPlayerUrl(sound)).toBe(
			"https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fnadia-sound%2Ffirst-track&auto_play=true",
		);
		expect(embedPageUrl({ provider: "google-slides", ref: `e/${SLIDES_ID}` })).toBe(
			`https://docs.google.com/presentation/d/e/${SLIDES_ID}/pub`,
		);
		expect(embedPlayerUrl({ provider: "loom", ref: LOOM_ID })).toBe(`https://www.loom.com/embed/${LOOM_ID}`);
	});

	it("sizes audio as a row and lists as tall", () => {
		expect(embedShape({ provider: "spotify", ref: `track/${SPOTIFY_ID}` })).toBe("audio");
		expect(embedShape({ provider: "spotify", ref: `album/${SPOTIFY_ID}` })).toBe("audio-tall");
		expect(embedShape({ provider: "soundcloud", ref: "a/sets/b" })).toBe("audio-tall");
		expect(embedShape({ provider: "figma", ref: `file/${FIGMA_KEY}` })).toBe("wide");
	});

	it("lists each frame origin once, sorted", () => {
		expect(embedFrameOrigins(["loom", "figma", "loom"])).toEqual([
			"https://embed.figma.com",
			"https://www.figma.com",
			"https://www.loom.com",
		]);
		expect(embedFrameOrigins([])).toEqual([]);
		expect(embedFrameOrigins(EMBED_PROVIDERS)).toHaveLength(6);
	});
});
