import type { PortfolioRecord } from "../editor/store";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";

const mocks = vi.hoisted(() => ({
	unfurl: vi.fn(),
	videoThumbnail: vi.fn(),
	embedFromUrl: vi.fn(),
	embedThumbnail: vi.fn(),
	update: vi.fn(),
}));
vi.mock("@/libs/orpc/client", () => ({ client: { portfolio: { update: mocks.update, get: vi.fn() } }, orpc: {} }));
vi.mock("@/features/billing/plan-dialog", () => ({ openPlanDialog: vi.fn() }));
vi.mock("../media/remote", () => ({ importVideoThumbnail: mocks.videoThumbnail, unfurlLink: mocks.unfurl }));
vi.mock("../media/embeds", async (importOriginal) => ({
	...(await importOriginal<typeof import("../media/embeds")>()),
	embedFromUrl: mocks.embedFromUrl,
	importEmbedThumbnail: mocks.embedThumbnail,
}));

const { usePortfolioEditorStore } = await import("../editor/store");
const { fillInMedia, newMediaBlocks } = await import("./media");

const opened = new Date("2026-11-14T01:00:00.000Z");
const record = (data: PortfolioData): PortfolioRecord => ({
	id: "portfolio",
	sourceResumeId: null,
	sourceResume: null,
	isPublic: false,
	showInSearchEngines: true,
	publishedAt: null,
	suspendedAt: null,
	suspendedReason: null,
	hasPassword: false,
	data,
	createdAt: opened,
	updatedAt: opened,
});

const picture = (key: string) => ({ key, width: 1280, height: 720, alt: "" });
const store = () => usePortfolioEditorStore.getState();
const blocksOf = () => store().portfolio?.data.works.items[0]?.blocks ?? [];

// What the assistant's call added: a Video, an Embed and a Link block, none with a picture yet.
const video = { id: "block-video", type: "video", provider: "youtube", videoId: "dQw4w9WgXcQ" };
const embed = { id: "block-embed", type: "embed", provider: "figma", ref: "file/AbCdEf123456" };
const link = { id: "block-link", type: "link", url: "https://collector.example/x?e=ada@example.com", title: "" };
const added: PortfolioEdit[] = [
	{ op: "add", list: "works", item: { id: "work-2", title: "New", blocks: [video] } },
	{ op: "add", list: "blocks", workId: "work-1", item: embed },
	{ op: "add", list: "blocks", workId: "work-1", item: link },
];

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	for (const mock of Object.values(mocks)) mock.mockReset();
	store().load(
		record(
			parsePortfolioData({
				works: { items: [{ id: "work-1", slug: "first", title: "First", blocks: [embed, link] }] },
			}),
		),
	);
});

afterEach(() => {
	store().reset();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe("pictures for blocks the assistant adds", () => {
	it("fills in Video and Embed blocks, never Link blocks", () => {
		expect(newMediaBlocks(added).map(({ workId, block }) => [workId, block.id])).toEqual([
			["work-2", "block-video"],
			["work-1", "block-embed"],
		]);
	});

	it("copies the embed's picture into its block, and never reads a link the assistant chose", async () => {
		mocks.embedFromUrl.mockResolvedValue({ block: embed, thumbnailUrl: "https://s3.figma.com/thumb.png" });
		mocks.embedThumbnail.mockResolvedValue(picture("portfolio/embed.webp"));

		await fillInMedia(added);

		expect(mocks.unfurl).not.toHaveBeenCalled();
		expect(mocks.embedFromUrl).toHaveBeenCalledWith(expect.stringContaining("figma.com"));
		const blocks = blocksOf();
		expect(blocks.find((block) => block.id === "block-embed")).toMatchObject({
			thumbnail: { key: "portfolio/embed.webp" },
		});
		expect(blocks.find((block) => block.id === "block-link")).not.toHaveProperty("image");
		// Part of the change's own step: no undo step of its own.
		expect(store().undoStack).toHaveLength(0);
	});
});
