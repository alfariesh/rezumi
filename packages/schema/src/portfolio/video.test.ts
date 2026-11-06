import { describe, expect, it } from "vite-plus/test";
import { isVideoThumbnailUrl, parseVideoUrl, youtubeThumbnailUrl } from "./video";

describe("parseVideoUrl", () => {
	it.each([
		["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
		["https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=42", "dQw4w9WgXcQ"],
		["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
		["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
		["youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
		["https://www.youtube.com/shorts/aB3_-x9Zq0w", "aB3_-x9Zq0w"],
		["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
		["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1", "dQw4w9WgXcQ"],
		["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
	])("reads YouTube's %s", (url, videoId) => {
		expect(parseVideoUrl(url)).toEqual({ provider: "youtube", videoId });
	});

	it.each([
		["https://vimeo.com/76979871", { videoId: "76979871" }],
		["https://vimeo.com/76979871/9f2c1a7b3d", { videoId: "76979871", hash: "9f2c1a7b3d" }],
		["https://vimeo.com/channels/staffpicks/76979871", { videoId: "76979871" }],
		["https://player.vimeo.com/video/76979871?h=9f2c1a7b3d&dnt=1", { videoId: "76979871", hash: "9f2c1a7b3d" }],
	])("reads Vimeo's %s", (url, expected) => {
		expect(parseVideoUrl(url)).toEqual({ provider: "vimeo", ...expected });
	});

	it.each([
		"",
		"not a url",
		"https://www.youtube.com/watch?v=short",
		"https://www.youtube.com/watch?v=dQw4w9WgXcQ<script>",
		"https://www.youtube.com/@channel",
		"https://youtu.be/",
		"https://evil.example/watch?v=dQw4w9WgXcQ",
		"https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
		"javascript:alert(1)//youtu.be/dQw4w9WgXcQ",
		"https://vimeo.com/abc",
		"https://vimeo.com/12",
		"https://player.vimeo.com/76979871",
	])("refuses %s", (url) => {
		expect(parseVideoUrl(url)).toBeNull();
	});

	it("drops a malformed Vimeo hash", () => {
		for (const url of ["https://player.vimeo.com/video/76979871?h=<b>", "https://vimeo.com/76979871/not-a-hash"])
			expect(parseVideoUrl(url)).toEqual({ provider: "vimeo", videoId: "76979871" });
	});
});

describe("video thumbnails", () => {
	it("knows YouTube's thumbnail address and only trusts the providers' image servers", () => {
		expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
		expect(isVideoThumbnailUrl(youtubeThumbnailUrl("dQw4w9WgXcQ"))).toBe(true);
		expect(isVideoThumbnailUrl("https://i.vimeocdn.com/video/1.jpg")).toBe(true);
		expect(isVideoThumbnailUrl("http://i.ytimg.com/vi/x/hqdefault.jpg")).toBe(false);
		expect(isVideoThumbnailUrl("https://example.com/pixel.gif")).toBe(false);
	});
});
