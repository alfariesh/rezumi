/** Bounded undo/redo stacks. Entries share structure (Immer), so 200 steps stay cheap. */
export const MAX_HISTORY_ENTRIES = 200;
/** Edits without a field key (dragging, a slider) merge within this window. */
export const HISTORY_COALESCE_MS = 500;
/** Edits to the same field (typing a sentence) merge within this window. */
export const FIELD_COALESCE_MS = 1000;

/** Whether the next edit merges into the current undo step. Resumes, letters and the Profile keep history this way. */
export function shouldCoalesceEdit(
	previous: { at: number; key: string | undefined; canCoalesce: boolean },
	next: { at: number; key: string | undefined; newStep: boolean },
): boolean {
	if (next.newStep || !previous.canCoalesce || previous.key !== next.key) return false;
	const window = next.key === undefined ? HISTORY_COALESCE_MS : FIELD_COALESCE_MS;
	return next.at - previous.at < window;
}

export type LastEdit = { at: number; key: string | undefined; coalesce: boolean };

export type EditOptions = {
	/** The field being edited. Consecutive edits with the same key within 1 s merge into one undo step. */
	coalesceKey?: string | undefined;
	/** Always a step of its own (adding, moving or deleting). */
	newStep?: boolean | undefined;
	/** Merges into the current step when the previous edit had the same key, however long ago. */
	sameStep?: boolean | undefined;
};

/**
 * Whether an edit made at `at` joins the current undo step, given the previous edit (null after opening, undo or
 * redo). `sameStep` joins a step with the same key regardless of time: one action made of several edits.
 */
export function joinsUndoStep(last: LastEdit | null, options: EditOptions, at: number): boolean {
	if (!last || options.newStep) return false;
	if (options.sameStep && options.coalesceKey !== undefined && last.coalesce && last.key === options.coalesceKey)
		return true;
	return shouldCoalesceEdit(
		{ at: last.at, key: last.key, canCoalesce: last.coalesce },
		{ at, key: options.coalesceKey, newStep: false },
	);
}

/** Pushes `entry` onto a bounded stack, dropping the oldest step past `MAX_HISTORY_ENTRIES`. */
export function pushBounded<T>(stack: readonly T[], entry: T): T[] {
	return [...stack.slice(-(MAX_HISTORY_ENTRIES - 1)), entry];
}
