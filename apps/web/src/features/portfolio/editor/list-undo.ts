import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { t } from "@lingui/core/macro";
import { isEqual } from "es-toolkit";
import { toast } from "@rezumi/ui/components/toast";
import { editPortfolio, usePortfolioEditorStore } from "./store";

/**
 * Puts an item back at its old place in a list, unless it's back already (Undo when other edits followed the removal)
 * or the list has no room. Items without an id (intro buttons) count as back when an equal one is there. True when it
 * went in.
 */
export function restoreListItem<T>(list: T[], item: T, index: number, most: number): boolean {
	const back = list.some((entry) =>
		typeof item === "object" && item !== null && "id" in item
			? typeof entry === "object" && entry !== null && "id" in entry && entry.id === item.id
			: isEqual(entry, item),
	);
	if (back || list.length >= most) return false;
	list.splice(Math.min(Math.max(0, index), list.length), 0, item);
	return true;
}

type RemoveWithUndoOptions<T> = {
	/** The list in the draft the item is in. */
	list: (draft: Draft<PortfolioData>) => T[];
	item: T;
	index: number;
	/** The most items the list may hold. */
	most: number;
	/** What the toast calls it: the service's title, the client's name… */
	name: string;
};

/**
 * Removes an item of a list and offers it back in a toast, as blocks do. Its Undo is the editor's Undo while nothing
 * else changed since, else the item alone at its old place, so it never takes back a later edit instead.
 */
export function removeWithUndo<T>({ list, item, index, most, name }: RemoveWithUndoOptions<T>) {
	editPortfolio(
		(draft) => {
			const items = list(draft);
			const at =
				typeof item === "object" && item !== null && "id" in item
					? items.findIndex((entry) => (entry as { id?: unknown }).id === item.id)
					: index;
			if (at >= 0 && at < items.length) items.splice(at, 1);
		},
		{ structural: true },
	);
	const removed = usePortfolioEditorStore.getState().portfolio?.data;
	toast.add({
		description: t`${name} removed`,
		actionProps: {
			children: t`Undo`,
			onPress: () => {
				const store = usePortfolioEditorStore.getState();
				if (removed && store.portfolio?.data === removed) store.undo();
				else
					editPortfolio((draft) => void restoreListItem(list(draft), item, index, most), {
						structural: true,
					});
			},
		},
	});
}
