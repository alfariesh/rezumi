import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import {
	addCaseStudy,
	blockRoom,
	caseStudyBlocks,
	insertBlocks,
	newImagesBlock,
	newMetricsBlock,
	newTextBlock,
	removeBlock,
} from "./blocks";

const titles = { problem: "Masalah", role: "Peran saya", process: "Proses", result: "Hasil" };

const work = (blocks: PortfolioWork["blocks"] = []): PortfolioWork => ({
	id: "w1",
	slug: "w1",
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
