import type { CheckIssue, CheckTarget } from "./issues";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { findEntry } from "../write";

/** A block drawn on a page (`PageMapNode` from `@rezumi/pdf/page-map` satisfies it). */
export type PageBlock = CheckTarget & {
	key: string;
	page: number;
	x: number;
	y: number;
	width: number;
	height: number;
};

/** Whether two targets name the same block. */
export function isSameTarget(a: CheckTarget | null, b: CheckTarget | null): boolean {
	if (!a || !b) return a === b;
	if (a.kind !== b.kind) return false;
	if (a.kind === "header") return true;
	if (a.kind === "section" && b.kind === "section") return a.sectionId === b.sectionId;
	if (a.kind === "item" && b.kind === "item") return a.sectionId === b.sectionId && a.itemId === b.itemId;
	return false;
}

/** The target a drawn block stands for, without its position. */
export function toTarget(block: PageBlock): CheckTarget {
	if (block.kind === "item") return { kind: "item", sectionId: block.sectionId, itemId: block.itemId };
	if (block.kind === "section") return { kind: "section", sectionId: block.sectionId };
	return { kind: "header" };
}

/** The first block drawn for a target, on whichever page it starts. */
export const findBlock = <Block extends PageBlock>(blocks: readonly Block[], target: CheckTarget) =>
	blocks.find((block) => isSameTarget(toTarget(block), target));

/**
 * The pins on one page: each issue on the first block drawn for its target. Further issues on the same block get
 * a higher `stack` so their pins sit below the first. Page-wide issues (no target) have no pin.
 */
export function placeIssuePins<Issue extends Pick<CheckIssue, "target">, Block extends PageBlock>(
	issues: readonly Issue[],
	blocks: readonly Block[],
	pageIndex: number,
) {
	const perBlock = new Map<string, number>();
	return issues.flatMap((issue) => {
		const block = issue.target ? findBlock(blocks, issue.target) : undefined;
		if (!block || block.page !== pageIndex) return [];
		const stack = perBlock.get(block.key) ?? 0;
		perBlock.set(block.key, stack + 1);
		return [{ issue, block, stack }];
	});
}

const textOf = (value: unknown): string =>
	typeof value === "string"
		? value
		: typeof value === "object" && value
			? Object.values(value).map(textOf).join(" ")
			: "";

/** The blocks whose text mentions a term: the header, the summary or entries (a job-match term on the page). */
export function targetsMentioning(data: ResumeData, term: string): CheckTarget[] {
	const needle = term.toLowerCase();
	const mentions = (value: unknown) => textOf(value).toLowerCase().includes(needle);
	const targets: CheckTarget[] = [];

	if (mentions(data.basics)) targets.push({ kind: "header" });
	if (mentions(data.summary.content)) targets.push({ kind: "section", sectionId: "summary" });

	const sections = [
		...Object.entries(data.sections).map(([id, section]) => ({ id, items: section.items as { id: string }[] })),
		...data.customSections.map((section) => ({ id: section.id, items: section.items as { id: string }[] })),
	];
	for (const section of sections) {
		for (const item of section.items) {
			if (mentions(findEntry(data, section.id, item.id))) {
				targets.push({ kind: "item", sectionId: section.id, itemId: item.id });
			}
		}
	}

	return targets;
}
