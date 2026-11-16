import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { describe, expect, it, vi } from "vite-plus/test";
import { fillLinkDetails, MAX_LINK_LOOKUPS } from "./portfolio-links";

const client = () => ({
	unfurl: vi.fn(),
	addImage: vi.fn(async ({ url }: { url: string }) => ({
		key: `uploads/u/${url.split("/").pop()}`,
		width: 1,
		height: 1,
	})),
});

const addBlock = (item: Record<string, unknown>): PortfolioEdit => ({ op: "add", list: "blocks", workId: "w1", item });

describe("fillLinkDetails", () => {
	it("fills what a link block leaves out and stores its preview picture, keeping what it gives", async () => {
		const portfolio = client();
		portfolio.unfurl.mockResolvedValue({
			kind: "link",
			url: "https://blog.example.com/post",
			title: "From the page",
			description: "Page description",
			siteName: "Blog",
			brandIcon: "medium",
			imageUrl: "https://blog.example.com/og.png",
		});
		const edits = [addBlock({ type: "link", url: "https://blog.example.com/post", title: "Mine" })];
		const result = await fillLinkDetails(portfolio as never, edits);
		expect(result.filled).toBe(1);
		expect(result.edits[0]).toMatchObject({
			item: {
				title: "Mine",
				description: "Page description",
				siteName: "Blog",
				brandIcon: "medium",
				image: { key: "uploads/u/og.png", alt: "Mine" },
			},
		});
		expect(edits[0]).toEqual(addBlock({ type: "link", url: "https://blog.example.com/post", title: "Mine" }));
	});

	it("titles a link with its host when the page can't be read", async () => {
		const portfolio = client();
		portfolio.unfurl.mockRejectedValue(new Error("unreadable"));
		const result = await fillLinkDetails(portfolio as never, [
			{ op: "add", list: "works", item: { title: "W", blocks: [{ type: "link", url: "https://www.example.com/x" }] } },
		]);
		expect(result.edits[0]).toMatchObject({ item: { blocks: [{ title: "example.com" }] } });
		expect(portfolio.addImage).not.toHaveBeenCalled();
	});

	it("titles videos and stores a Vimeo picture, but not YouTube's", async () => {
		const portfolio = client();
		portfolio.unfurl.mockImplementation(async ({ url }: { url: string }) =>
			url.includes("vimeo")
				? {
						kind: "video",
						url,
						provider: "vimeo",
						videoId: "1",
						title: "Vimeo talk",
						thumbnailUrl: "https://i.vimeocdn.com/v.jpg",
					}
				: {
						kind: "video",
						url,
						provider: "youtube",
						videoId: "2",
						title: "YouTube demo",
						thumbnailUrl: "https://i.ytimg.com/y.jpg",
					},
		);
		const result = await fillLinkDetails(portfolio as never, [
			addBlock({ type: "video", url: "https://vimeo.com/1" }),
			addBlock({ type: "video", url: "https://youtu.be/2" }),
		]);
		expect(result.edits[0]).toMatchObject({ item: { title: "Vimeo talk", thumbnail: { key: "uploads/u/v.jpg" } } });
		expect(result.edits[1]).toMatchObject({ item: { title: "YouTube demo" } });
		expect(result.edits[1]).not.toHaveProperty("item.thumbnail");
		expect(portfolio.addImage).toHaveBeenCalledTimes(1);
	});

	it("leaves complete blocks, other edits and updates alone", async () => {
		const portfolio = client();
		const edits: PortfolioEdit[] = [
			addBlock({ type: "link", url: "https://a.example", title: "A", description: "D", image: null }),
			addBlock({ type: "text", html: "<p>Hi</p>" }),
			{ op: "update", list: "blocks", workId: "w1", id: "b1", fields: { url: "https://b.example" } },
		];
		const result = await fillLinkDetails(portfolio as never, edits);
		expect(result).toEqual({ edits, filled: 0 });
		expect(portfolio.unfurl).not.toHaveBeenCalled();
	});

	it("reads each page once and at most a bounded number of pages per call", async () => {
		const portfolio = client();
		portfolio.unfurl.mockImplementation(async ({ url }: { url: string }) => ({ kind: "link", url, title: "T" }));
		const urls = Array.from({ length: MAX_LINK_LOOKUPS + 2 }, (_, index) => `https://example.com/${index}`);
		const result = await fillLinkDetails(portfolio as never, [
			addBlock({ type: "link", url: urls[0] }),
			...urls.map((url) => addBlock({ type: "link", url })),
		]);
		expect(portfolio.unfurl).toHaveBeenCalledTimes(MAX_LINK_LOOKUPS);
		expect(result.edits.at(-1)).toMatchObject({ item: { title: "example.com" } });
	});
});
