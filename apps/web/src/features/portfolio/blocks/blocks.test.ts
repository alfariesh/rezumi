import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import {
	addCaseStudy,
	blockPlace,
	blockRoom,
	caseStudyBlocks,
	insertBlocks,
	insertBlocksAt,
	newImagesBlock,
	newMetricsBlock,
	newTextBlock,
	pictureKeys,
	removeBlock,
	restoreBlock,
} from "./blocks";
import { itemAfterRemoval } from "./list-focus";

const titles = { problem: "Masalah", role: "Peran saya", process: "Proses", result: "Hasil" };

const work = (blocks: PortfolioWork["blocks"] = []): PortfolioWork => ({
	id: "w1",
	slug: "w1",
	previousSlugs: [],
	title: "Work",
	summary: "",
	role: "",
	date: "",
	tags: [],
	blocks,
	featured: false,
	hidden: false,
});

const picture = (name: string) => ({
	key: `uploads/u1/pictures/portfolio/${name}.webp`,
	width: 1200,
	height: 800,
	alt: name,
});

describe("blocks", () => {
	it("inserts at a place, clamped, and only as many as fit", () => {
		const a = newTextBlock("<p>a</p>");
		const b = newTextBlock("<p>b</p>");
		const inserted = produce(work([a]), (draft) => {
			insertBlocks(draft as PortfolioWork, 0, [b]);
			insertBlocks(draft as PortfolioWork, 99, [newMetricsBlock()]);
		});
		expect(inserted.blocks.map((block) => block.type)).toEqual(["text", "text", "metrics"]);
		expect(inserted.blocks[0]?.id).toBe(b.id);

		const full = work(Array.from({ length: PORTFOLIO_LIMITS.blocksPerWork - 1 }, () => newTextBlock()));
		expect(blockRoom(full)).toBe(1);
		const after = produce(full, (draft) => {
			expect(insertBlocks(draft as PortfolioWork, 0, [newTextBlock(), newTextBlock()])).toBe(1);
		});
		expect(after.blocks).toHaveLength(PORTFOLIO_LIMITS.blocksPerWork);
	});

	it("makes a Pictures block from uploaded pictures, at most twelve", () => {
		expect(newImagesBlock([picture("a")]).layout).toBe("full");
		const many = newImagesBlock(Array.from({ length: 14 }, (_, index) => picture(`p${index}`)));
		expect(many.layout).toBe("grid");
		expect(many.images).toHaveLength(PORTFOLIO_LIMITS.imagesPerBlock);
	});

	it("removes a block and the card's metric that was in it", () => {
		const metrics = newMetricsBlock();
		const start = { ...work([newTextBlock(), metrics]), highlightMetricId: metrics.items[0]?.id ?? "" };
		const removed = produce(start, (draft) => removeBlock(draft as PortfolioWork, metrics.id));
		expect(removed.blocks).toHaveLength(1);
		expect(removed.highlightMetricId).toBeUndefined();
	});

	it("starts a case study: four headed text blocks and a Metrics block, valid to save", () => {
		const blocks = caseStudyBlocks({ ...titles, problem: "Problem <1>" });
		expect(blocks.map((block) => block.type)).toEqual(["text", "text", "text", "text", "metrics"]);
		expect(blocks[0]).toMatchObject({ type: "text", html: "<h2>Problem &lt;1&gt;</h2><p></p>" });
		expect(new Set(blocks.map((block) => block.id)).size).toBe(5);

		const withOutline = produce(work([newTextBlock("<p>intro</p>")]), (draft) => {
			expect(addCaseStudy(draft as PortfolioWork, titles)).toBe(5);
		});
		expect(withOutline.blocks[1]).toMatchObject({ html: "<h2>Masalah</h2><p></p>" });
		expect(() => parseWritablePortfolioData({ works: { items: [withOutline] } })).not.toThrow();
	});
});

describe("adding a block after a wait", () => {
	const [a, b, c] = [newTextBlock("<p>a</p>"), newTextBlock("<p>b</p>"), newTextBlock("<p>c</p>")];

	it("reads the place as the block before it, or the end for the last menu", () => {
		const blocks = work([a, b]);
		expect(blockPlace(blocks, 0)).toEqual({ after: null });
		expect(blockPlace(blocks, 1)).toEqual({ after: a.id });
		expect(blockPlace(blocks, 2, true)).toBe("end");
	});

	it("lands after the same block even when blocks moved or arrived meanwhile", () => {
		const late = newMetricsBlock();
		// Chosen between A and B; meanwhile C was added at the top and B moved first.
		const after = produce(work([c, b, a]), (draft) => {
			insertBlocksAt(draft as PortfolioWork, { after: a.id }, [late], 1);
		});
		expect(after.blocks.map((block) => block.id)).toEqual([c.id, b.id, a.id, late.id]);
	});

	it("goes to the top, to the end, or to the old place when the block it followed is gone", () => {
		const late = newMetricsBlock();
		const top = produce(work([a, b]), (draft) => {
			insertBlocksAt(draft as PortfolioWork, { after: null }, [late]);
		});
		expect(top.blocks[0]?.id).toBe(late.id);
		const end = produce(work([a, b]), (draft) => {
			insertBlocksAt(draft as PortfolioWork, "end", [late]);
		});
		expect(end.blocks.at(-1)?.id).toBe(late.id);
		const gone = produce(work([b, c]), (draft) => {
			insertBlocksAt(draft as PortfolioWork, { after: a.id }, [late], 1);
		});
		expect(gone.blocks.map((block) => block.id)).toEqual([b.id, late.id, c.id]);
	});
});

describe("Undo in the block-removed toast", () => {
	it("puts back that block at its old place, with the card's metric it held", () => {
		const metrics = newMetricsBlock();
		const highlight = metrics.items[0]?.id ?? "";
		const start = { ...work([newTextBlock(), metrics, newTextBlock()]), highlightMetricId: highlight };
		const removed = produce(start, (draft) => removeBlock(draft as PortfolioWork, metrics.id));
		// Another edit came after the removal; the block alone comes back.
		const edited = produce(removed, (draft) => {
			draft.title = "Renamed";
		});
		const restored = produce(edited, (draft) => {
			expect(restoreBlock(draft as PortfolioWork, metrics, 1, highlight)).toBe(true);
		});
		expect(restored.blocks[1]?.id).toBe(metrics.id);
		expect(restored).toMatchObject({ title: "Renamed", highlightMetricId: highlight });
	});

	it("does nothing when the block is back already", () => {
		const block = newTextBlock();
		const start = work([block]);
		const after = produce(start, (draft) => {
			expect(restoreBlock(draft as PortfolioWork, block, 0, undefined)).toBe(false);
		});
		expect(after).toBe(start);
	});
});

describe("block editors' helpers", () => {
	it("keys pictures by their file, so a moved picture keeps its fields", () => {
		const [one, two] = [picture("one"), picture("two")];
		expect(pictureKeys([one, two])).toEqual([one.key, two.key]);
		expect(pictureKeys([two, one])).toEqual([two.key, one.key]);
		expect(pictureKeys([one, one])).toEqual([one.key, `${one.key}#1`]);
	});

	it("moves focus to the item that took a removed one's place, else the one before", () => {
		expect(itemAfterRemoval(["a", "c"], 1)).toBe("c");
		expect(itemAfterRemoval(["a", "b"], 2)).toBe("b");
		expect(itemAfterRemoval([], 0)).toBeNull();
	});
});
