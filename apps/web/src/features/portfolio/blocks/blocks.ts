import type { PortfolioBlock, PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";
import { dropMissingHighlight, newMetric } from "../metrics/metrics";

/** The blocks the editor offers, in its menus' order (`01-desain.md` section 15). */
export const EDITOR_BLOCK_TYPES = ["text", "images", "metrics", "video", "pdf", "link"] as const;
export type EditorBlockType = (typeof EDITOR_BLOCK_TYPES)[number];

export function newTextBlock(html = ""): PortfolioBlockOf<"text"> {
	return { id: generateId(), type: "text", html };
}

/** A Pictures block holds at least one picture, so it's made once the first ones are uploaded. */
export function newImagesBlock(images: readonly PortfolioImage[]): PortfolioBlockOf<"images"> {
	return {
		id: generateId(),
		type: "images",
		images: images.slice(0, PORTFOLIO_LIMITS.imagesPerBlock).map((image) => ({ ...image })),
		layout: images.length === 1 ? "full" : "grid",
	};
}

export function newMetricsBlock(): PortfolioBlockOf<"metrics"> {
	return { id: generateId(), type: "metrics", items: [newMetric()] };
}

/** How many more blocks a work can take. */
export function blockRoom(work: Pick<PortfolioWork, "blocks">): number {
	return Math.max(0, PORTFOLIO_LIMITS.blocksPerWork - work.blocks.length);
}

/** Inserts blocks at `index` (clamped), as many as the work has room for. Returns how many went in. */
export function insertBlocks(work: PortfolioWork, index: number, blocks: readonly PortfolioBlock[]): number {
	const taken = blocks.slice(0, blockRoom(work));
	const at = Math.min(Math.max(0, index), work.blocks.length);
	work.blocks.splice(at, 0, ...taken);
	return taken.length;
}

/** Removes a block; a highlighted metric that was in it leaves the card too. */
export function removeBlock(work: PortfolioWork, blockId: string): void {
	work.blocks = work.blocks.filter((block) => block.id !== blockId);
	dropMissingHighlight(work);
}

export type CaseStudyTitles = { problem: string; role: string; process: string; result: string };

/**
 * "Start from a case study outline": text blocks headed Problem, My role, Process and Result, then an empty Metrics
 * block for the outcome (`01-desain.md` section 15). Headings only; the person writes the rest.
 */
export function caseStudyBlocks(titles: CaseStudyTitles): PortfolioBlock[] {
	const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
	return [
		...[titles.problem, titles.role, titles.process, titles.result].map((title) =>
			newTextBlock(`<h2>${escape(title)}</h2><p></p>`),
		),
		newMetricsBlock(),
	];
}

/** Adds the case study outline after the work's blocks, as far as the work has room. Returns how many went in. */
export function addCaseStudy(work: PortfolioWork, titles: CaseStudyTitles): number {
	return insertBlocks(work, work.blocks.length, caseStudyBlocks(titles));
}
