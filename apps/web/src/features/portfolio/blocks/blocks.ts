import type { PortfolioBlock, PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";
import { dropMissingHighlight, newMetric } from "../metrics/metrics";

export function newTextBlock(html = ""): PortfolioBlockOf<"text"> {
	return { id: generateId(), type: "text", html };
}

/**
 * Keys for a block's pictures that stay with each picture when it moves (so its fields keep focus): its storage key,
 * numbered when the same picture is in the block twice.
 */
export function pictureKeys(images: readonly { key: string }[]): string[] {
	const seen = new Map<string, number>();
	return images.map((image) => {
		const count = seen.get(image.key) ?? 0;
		seen.set(image.key, count + 1);
		return count ? `${image.key}#${count}` : image.key;
	});
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

/**
 * Where a block goes that's added after a wait (an upload, a link being read): after the block that was before the
 * chosen place (`after: null` is the top), wherever that block is by then, or at the end. Counting places instead would
 * put it elsewhere once blocks moved meanwhile.
 */
export type BlockPlace = { after: string | null } | "end";

/** The place "+ Add block" at `index` stands for: after the block before it, or the end when it's the last one. */
export function blockPlace(work: Pick<PortfolioWork, "blocks">, index: number, last = false): BlockPlace {
	if (last) return "end";
	return { after: index > 0 ? (work.blocks[index - 1]?.id ?? null) : null };
}

/**
 * Inserts blocks at a place (`BlockPlace`), as many as the work has room for; when the block they were to follow is
 * gone, at `fallbackIndex`. Returns how many went in.
 */
export function insertBlocksAt(
	work: PortfolioWork,
	place: BlockPlace,
	blocks: readonly PortfolioBlock[],
	fallbackIndex = work.blocks.length,
): number {
	if (place === "end") return insertBlocks(work, work.blocks.length, blocks);
	if (place.after === null) return insertBlocks(work, 0, blocks);
	const anchor = work.blocks.findIndex((block) => block.id === place.after);
	return insertBlocks(work, anchor === -1 ? fallbackIndex : anchor + 1, blocks);
}

/**
 * Puts back a block removed from a work, at its old place, unless it's back already (Undo of a removal when other
 * edits followed it). The card's metric it held comes back too, when the card has none meanwhile.
 */
export function restoreBlock(
	work: PortfolioWork,
	block: PortfolioBlock,
	index: number,
	highlightMetricId: string | undefined,
): boolean {
	if (work.blocks.some((entry) => entry.id === block.id)) return false;
	if (!insertBlocks(work, index, [block])) return false;
	if (highlightMetricId && !work.highlightMetricId && block.type === "metrics")
		if (block.items.some((metric) => metric.id === highlightMetricId)) work.highlightMetricId = highlightMetricId;
	return true;
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
