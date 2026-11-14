import type { PortfolioData, PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit, PortfolioEditList, PortfolioEditPosition } from "@rezumi/schema/portfolio/edits";
import { refuse } from "./errors";

/** A list item as the engine handles it: any of the lists' items, by its fields. */
export type EditItem = Record<string, unknown> & { id: string };

/** Which list an edit works on, with its ids resolved. */
export type ListTarget = { list: PortfolioEditList; workId?: string | undefined; blockId?: string | undefined };

/** What one item of each list is called in messages. */
export const LIST_NOUNS: Record<PortfolioEditList, string> = {
	works: "work",
	services: "service",
	testimonials: "testimonial",
	clients: "client",
	custom: "section",
	highlights: "highlight",
	blocks: "block",
	metrics: "metric",
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** An item in messages: `work "Lumen redesign"`, `text block`, `testimonial from "Damar"`. */
export function itemLabel(list: PortfolioEditList, item: Record<string, unknown>): string {
	switch (list) {
		case "blocks": {
			const title = text(item.title);
			return `${String(item.type)} block${title ? ` "${title}"` : ""}`;
		}
		case "testimonials":
			return text(item.name) ? `testimonial from "${text(item.name)}"` : "testimonial";
		default: {
			const name = text(item.title) || text(item.name) || text(item.label);
			return name ? `${LIST_NOUNS[list]} "${name}"` : `${LIST_NOUNS[list]} ${String(item.id)}`;
		}
	}
}

const LOOKUP_HINT = "Use an id from the portfolio as you last read it, or a ref from an earlier add in this call.";

/** The work an edit of blocks or metrics names. */
export function findWork(data: PortfolioData, workId: string | undefined): PortfolioWork {
	const work = data.works.items.find((item) => item.id === workId);
	return work ?? refuse(`No work has the id "${workId ?? ""}". ${LOOKUP_HINT}`);
}

/** The items of the list an edit works on: the array inside `data` itself, to change in place on a copy. */
export function listItems(data: PortfolioData, target: ListTarget): EditItem[] {
	switch (target.list) {
		case "works":
			return data.works.items as unknown as EditItem[];
		case "services":
			return data.services.items as unknown as EditItem[];
		case "testimonials":
			return data.testimonials.items as unknown as EditItem[];
		case "clients":
			return data.clients.items as unknown as EditItem[];
		case "custom":
			return data.custom as unknown as EditItem[];
		case "highlights":
			return data.hero.highlights as unknown as EditItem[];
		case "blocks":
			return findWork(data, target.workId).blocks as unknown as EditItem[];
		case "metrics": {
			const work = findWork(data, target.workId);
			const block = work.blocks.find((item) => item.id === target.blockId);
			if (!block)
				return refuse(`Work "${work.title}" has no block with the id "${target.blockId ?? ""}". ${LOOKUP_HINT}`);
			if (block.type !== "metrics")
				return refuse(
					`Block "${block.id}" of work "${work.title}" is a ${block.type} block; metrics belong to a Metrics block.`,
				);
			return block.items as unknown as EditItem[];
		}
	}
}

/** Where the list is, for messages: ` in work "Lumen"`, or nothing for the page's own lists. */
export function ownerLabel(data: PortfolioData, target: ListTarget): string {
	if (target.list !== "blocks" && target.list !== "metrics") return "";
	const work = data.works.items.find((item) => item.id === target.workId);
	return work ? ` in work "${work.title.trim() || work.id}"` : "";
}

/** The index of an item, or a refusal naming what to read again. */
export function indexOf(items: readonly EditItem[], id: string, target: ListTarget): number {
	const index = items.findIndex((item) => item.id === id);
	if (index >= 0) return index;
	return refuse(`No ${LIST_NOUNS[target.list]} has the id "${id}" in ${target.list}. ${LOOKUP_HINT}`);
}

/**
 * Where a position puts an item in `items` (which no longer holds the item being moved): missing or "last" is the
 * end, "first" the start, `before`/`after` next to an item of the same list (its id, refs already resolved).
 */
export function positionIndex(
	items: readonly EditItem[],
	at: PortfolioEditPosition | undefined,
	target: ListTarget,
	movingId?: string,
): number {
	if (at === undefined || at === "last") return items.length;
	if (at === "first") return 0;
	const anchor = "before" in at ? at.before : at.after;
	if (anchor === movingId) return refuse("An item can't be placed before or after itself.");
	const index = indexOf(items, anchor, target);
	return "before" in at ? index : index + 1;
}

/** A position that puts an item back at `index` of `items` (the list without it): "first", or after the one before. */
export function placeAt(items: readonly EditItem[], index: number): PortfolioEditPosition {
	const previous = index > 0 ? items[index - 1] : undefined;
	return previous ? { after: previous.id } : "first";
}

/**
 * The name of the item an edit works on, for a change line: a work's or section's title, a client's or testimonial
 * author's name, a metric's label. Null for \`set\`, an item without one, or one \`data\` doesn't have. Pass the data from
 * before the edit (a removed item is gone after it); an add reads its own item.
 */
export function portfolioEditItemName(data: PortfolioData, edit: PortfolioEdit): string | null {
	if (edit.op === "set") return null;
	let item: Record<string, unknown> | undefined;
	if (edit.op === "add") item = edit.item;
	else
		try {
			item = listItems(data, edit).find((entry) => entry.id === edit.id);
		} catch {
			return null;
		}
	return text(item?.title) || text(item?.name) || text(item?.label) || null;
}
