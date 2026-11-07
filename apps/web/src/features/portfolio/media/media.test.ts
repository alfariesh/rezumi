import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { parsePortfolioData, writablePortfolioDataSchema } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { newWork, titleFromFileName } from "../works/works";
import {
	clip,
	linkBlockFromUnfurl,
	readLinkAddress,
	samePlayedVideo,
	siteOf,
	stillPlays,
	videoAddress,
	videoBlockFromUnfurl,
	workFromLink,
} from "./link-blocks";
import { formatFileSize, looksLikePdf, pdfErrorMessage } from "./pdf";
import { unfurlErrorMessage, videoBlockFromUrl, videoThumbnailCandidates } from "./remote";

const unfurl = vi.hoisted(() => vi.fn());
vi.mock("@/libs/orpc/client", () => ({ client: { portfolio: { unfurl } } }));

beforeEach(() => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
	unfurl.mockReset();
});

const empty = (): PortfolioData => parsePortfolioData({});

describe("link and video blocks from a pasted link", () => {
	it("cuts long text at a word, with an ellipsis", () => {
		expect(clip("Short", 10)).toBe("Short");
		expect(clip("How we cut failed payments without adding a step", 30)).toBe("How we cut failed payments…");
		expect(clip("  spaced\n\ttext  ", 40)).toBe("spaced text");
	});

	it("makes a Link block the schema accepts, within its limits", () => {
		const block = linkBlockFromUnfurl({
			kind: "link",
			url: "https://www.behance.net/gallery/1/kopi",
			title: "Kopi app ".repeat(30),
			description: "A long description. ".repeat(30),
			siteName: "Behance",
			imageUrl: "https://mir-s3-cdn-cf.behance.net/project.png",
			brandIcon: "behance",
		});
		expect(block).toMatchObject({ type: "link", url: "https://www.behance.net/gallery/1/kopi", brandIcon: "behance" });
		expect(block.title.length).toBeLessThanOrEqual(140);
		expect(block.description?.length).toBeLessThanOrEqual(300);
		// The suggested picture never goes into the data before it's copied.
		expect(JSON.stringify(block)).not.toContain("behance.net/project.png");
	});

	it("makes a Video block from an unfurled video", () => {
		expect(
			videoBlockFromUnfurl({
				kind: "video",
				url: "https://vimeo.com/76979871/9f2c1a7b3d",
				provider: "vimeo",
				videoId: "76979871",
				hash: "9f2c1a7b3d",
				title: "Checkout demo",
				thumbnailUrl: "https://i.vimeocdn.com/video/1.jpg",
			}),
		).toMatchObject({
			type: "video",
			provider: "vimeo",
			videoId: "76979871",
			hash: "9f2c1a7b3d",
			title: "Checkout demo",
			thumbnailUrl: "https://i.vimeocdn.com/video/1.jpg",
		});
	});

	it("tries YouTube's largest thumbnail first, and Vimeo's own", () => {
		expect(videoThumbnailCandidates({ provider: "youtube", videoId: "dQw4w9WgXcQ" })).toEqual([
			"https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
			"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
		]);
		expect(videoThumbnailCandidates({ provider: "vimeo", videoId: "76979871" })).toEqual([]);
	});

	it("makes a new work with the card, the main link and one block", () => {
		const data = empty();
		data.works.items.push(newWork(data, "Kopi app"));
		const block = linkBlockFromUnfurl({ kind: "link", url: "https://github.com/nadia/kopi", title: "nadia/kopi" });
		const cover = { key: "uploads/u1/pictures/portfolio/cover.webp", width: 1200, height: 600, alt: "Kopi app" };
		const work = workFromLink(
			data,
			{ url: "https://github.com/nadia/kopi", title: "Kopi app", summary: "Ordering in three taps." },
			block,
			cover,
		);
		expect(work).toMatchObject({
			slug: "kopi-app-2",
			title: "Kopi app",
			summary: "Ordering in three taps.",
			primaryLink: { label: "", url: "https://github.com/nadia/kopi" },
			cover,
			blocks: [block],
		});
		data.works.items.push(work);
		expect(writablePortfolioDataSchema.safeParse(data).success).toBe(true);
	});
});

describe("PDF checks in the browser", () => {
	it("knows a PDF by its first bytes", () => {
		expect(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
		expect(looksLikePdf(new TextEncoder().encode("<html>"))).toBe(false);
		expect(looksLikePdf(new Uint8Array())).toBe(false);
	});

	it("titles a PDF after its file name", () => {
		expect(titleFromFileName("case-study_final.PDF", PORTFOLIO_LIMITS.text.mediaTitle)).toBe("case study final");
		expect(titleFromFileName(`${"a".repeat(200)}.pdf`, PORTFOLIO_LIMITS.text.mediaTitle)).toHaveLength(140);
	});

	it("counts sizes the way the limit is counted, in the app's language", () => {
		expect(formatFileSize(10 * 1024 * 1024, "en-US")).toBe("10 MB");
		expect(formatFileSize(1.5 * 1024 * 1024, "id-ID")).toBe("1,5 MB");
		expect(formatFileSize(300, "en-US")).toBe("1 kB");
		expect(pdfErrorMessage(new ORPCError("PORTFOLIO_FILE_TOO_LARGE"))).toBe(
			"This PDF is larger than 10 MB. Make it smaller, then try again.",
		);
		expect(pdfErrorMessage(new ORPCError("BAD_REQUEST"))).toBe(
			"This PDF is larger than 10 MB. Make it smaller, then try again.",
		);
		expect(pdfErrorMessage(new ORPCError("PORTFOLIO_STORAGE_FULL", { status: 413 }))).toBe(
			"Your portfolio's storage is full. Remove pictures or PDFs you don't need, then try again.",
		);
	});
});

describe("pasted link addresses", () => {
	it("takes web pages, adding https:// when it's missing", () => {
		expect(readLinkAddress(" behance.net/gallery/1 ")).toEqual({ ok: true, url: "https://behance.net/gallery/1" });
		expect(readLinkAddress("http://example.com")).toEqual({ ok: true, url: "http://example.com" });
	});

	it("refuses what a Link block can't hold, so a failed read never stops saving", () => {
		expect(readLinkAddress("")).toEqual({ ok: false, problem: "empty" });
		expect(readLinkAddress("mailto:nadia@example.com")).toEqual({ ok: false, problem: "email" });
		expect(readLinkAddress("https://exa mple.com")).toEqual({ ok: false, problem: "invalid" });
		expect(readLinkAddress("javascript:alert(1)")).toEqual({ ok: false, problem: "invalid" });
	});

	it("keeps the pasted address when the page ended up somewhere the data can't hold, and drops odd brand icons", () => {
		const block = linkBlockFromUnfurl(
			{ kind: "link", url: "javascript:alert(1)", title: "Odd", brandIcon: "Not A Brand!" },
			"https://example.com/work",
		);
		expect(block).toMatchObject({ url: "https://example.com/work", title: "Odd" });
		expect(block.brandIcon).toBeUndefined();
	});

	it("words the server's refusals of a link in the app's language", () => {
		expect(unfurlErrorMessage(new ORPCError("PORTFOLIO_LINK_UNREADABLE", { data: { reason: "unsafe-url" } }))).toBe(
			"This address can't be read. Use a public web page.",
		);
		expect(unfurlErrorMessage(new ORPCError("PORTFOLIO_LINK_UNREADABLE", { message: "Raw" }))).toBe(
			"This site can't be read automatically. Fill the card in by hand.",
		);
		expect(unfurlErrorMessage(new Error("Failed to fetch"))).toBe(
			"This site can't be read automatically. Fill the card in by hand.",
		);
	});
});

describe("video blocks", () => {
	it("knows the video a block plays, unlisted Vimeo hash included", () => {
		expect(videoAddress({ provider: "youtube", videoId: "dQw4w9WgXcQ" })).toBe(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		);
		const vimeo = { provider: "vimeo" as const, videoId: "76979871", hash: "9f2c1a7b3d" };
		expect(videoAddress(vimeo)).toBe("https://vimeo.com/76979871/9f2c1a7b3d");
		expect(samePlayedVideo(vimeo, { provider: "vimeo", videoId: "76979871", hash: "9f2c1a7b3d" })).toBe(true);
		expect(samePlayedVideo(vimeo, { provider: "vimeo", videoId: "76979871" })).toBe(false);
		expect(samePlayedVideo(vimeo, { provider: "youtube", videoId: "76979871abc" })).toBe(false);
	});

	it("keeps a late thumbnail only while the block still plays that video", () => {
		const video = { id: "v", type: "video" as const, provider: "youtube" as const, videoId: "dQw4w9WgXcQ" };
		expect(stillPlays(video, video)).toBe(true);
		expect(stillPlays({ ...video, videoId: "aaaaaaaaaaa" }, video)).toBe(false);
		expect(stillPlays(undefined, video)).toBe(false);
	});

	it("makes a block from a pasted address, with what oEmbed says when it can", async () => {
		unfurl.mockResolvedValueOnce({
			kind: "video",
			url: "https://vimeo.com/76979871",
			provider: "vimeo",
			videoId: "76979871",
			title: "Checkout demo",
			thumbnailUrl: "https://i.vimeocdn.com/video/1.jpg",
		});
		expect(await videoBlockFromUrl("https://vimeo.com/76979871")).toMatchObject({
			provider: "vimeo",
			videoId: "76979871",
			title: "Checkout demo",
			thumbnailUrl: "https://i.vimeocdn.com/video/1.jpg",
		});
		unfurl.mockRejectedValueOnce(new ORPCError("PORTFOLIO_LINK_UNREADABLE"));
		const plain = await videoBlockFromUrl("https://youtu.be/dQw4w9WgXcQ");
		expect(plain).toMatchObject({ provider: "youtube", videoId: "dQw4w9WgXcQ" });
		expect(plain?.title).toBeUndefined();
		expect(await videoBlockFromUrl("https://example.com")).toBeNull();
	});

	it("stops when it's cancelled, instead of making a block without details", async () => {
		const controller = new AbortController();
		controller.abort();
		unfurl.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
		await expect(videoBlockFromUrl("https://youtu.be/dQw4w9WgXcQ", controller.signal)).rejects.toThrow();
	});

	it("tells sites apart, so a card's site name goes when its link moves to another site", () => {
		expect(siteOf("https://www.behance.net/gallery/1")).toBe("behance.net");
		expect(siteOf("https://behance.net/other")).toBe("behance.net");
		expect(siteOf("not a url")).toBeNull();
	});
});
