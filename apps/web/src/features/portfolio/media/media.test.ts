import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { describe, expect, it } from "vite-plus/test";
import { parsePortfolioData, writablePortfolioDataSchema } from "@rezumi/schema/portfolio/data";
import { newWork } from "../works/works";
import { clip, linkBlockFromUnfurl, videoBlockFromUnfurl, workFromLink } from "./link-blocks";
import { looksLikePdf, pdfTitleFromName } from "./pdf";
import { videoThumbnailCandidates } from "./remote";

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
		expect(pdfTitleFromName("case-study_final.PDF")).toBe("case study final");
	});
});
