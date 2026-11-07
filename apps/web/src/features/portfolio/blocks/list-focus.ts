import { useEffect, useId, useRef } from "react";

const FOCUSABLE =
	'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** The item that takes a removed one's place: the one now at its index, else the last one left; null when none is. */
export function itemAfterRemoval<T>(items: readonly T[], removedIndex: number): T | null {
	if (!items.length) return null;
	return items[Math.min(Math.max(0, removedIndex), items.length - 1)] ?? null;
}

/** Focuses what `find` gives; a closing dialog takes focus back until it's gone, so this tries again for a moment. */
function focusSoon(find: () => HTMLElement | null) {
	let tries = 0;
	const attempt = () => {
		const target = find();
		if (!target) return;
		target.focus();
		if (document.activeElement !== target && tries++ < 30) requestAnimationFrame(attempt);
	};
	attempt();
}

/**
 * Keeps keyboard focus in a list when an item is removed with its own button, which goes with it: focus moves to the
 * first control of the item that took its place, else of the one before it, else to `fallbackRef` (the list's "Add"
 * button or drop area). Spread `itemProps` on each item's outer element and call `removed(index)` with the removal.
 */
export function useRemovalFocus() {
	const id = useId();
	const fallbackRef = useRef<HTMLDivElement>(null);
	const pending = useRef<number | null>(null);

	// After the render that dropped the item.
	useEffect(() => {
		const index = pending.current;
		if (index === null) return;
		pending.current = null;
		focusSoon(() => {
			const items = [...document.querySelectorAll<HTMLElement>(`[data-list-item="${id}"]`)];
			const item = itemAfterRemoval(items, index);
			const control =
				item?.querySelector<HTMLElement>(FOCUSABLE) ?? fallbackRef.current?.querySelector<HTMLElement>(FOCUSABLE);
			return control ?? null;
		});
	});

	return {
		itemProps: { "data-list-item": id },
		fallbackRef,
		removed: (index: number) => {
			pending.current = index;
		},
	};
}
