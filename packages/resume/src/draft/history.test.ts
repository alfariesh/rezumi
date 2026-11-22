import { describe, expect, it } from "vite-plus/test";
import { changedFields } from "./fields";
import { joinsUndoStep, MAX_HISTORY_ENTRIES, pushBounded, shouldCoalesceEdit } from "./history";

describe("undo history rules", () => {
	it("merges same-field edits within a second and keyless edits within half a second", () => {
		const previous = { at: 0, key: "name", canCoalesce: true };
		expect(shouldCoalesceEdit(previous, { at: 999, key: "name", newStep: false })).toBe(true);
		expect(shouldCoalesceEdit(previous, { at: 1000, key: "name", newStep: false })).toBe(false);
		expect(shouldCoalesceEdit(previous, { at: 10, key: "title", newStep: false })).toBe(false);
		const keyless = { at: 0, key: undefined, canCoalesce: true };
		expect(shouldCoalesceEdit(keyless, { at: 499, key: undefined, newStep: false })).toBe(true);
		expect(shouldCoalesceEdit(keyless, { at: 500, key: undefined, newStep: false })).toBe(false);
	});

	it("joins sameStep edits however late, never after a structural step, open or undo", () => {
		expect(joinsUndoStep(null, { coalesceKey: "a" }, 0)).toBe(false);
		expect(joinsUndoStep({ at: 0, key: "fit", coalesce: true }, { coalesceKey: "fit", sameStep: true }, 60_000)).toBe(
			true,
		);
		expect(joinsUndoStep({ at: 0, key: "fit", coalesce: false }, { coalesceKey: "fit", sameStep: true }, 10)).toBe(
			false,
		);
		expect(joinsUndoStep({ at: 0, key: "a", coalesce: true }, { coalesceKey: "a", newStep: true }, 10)).toBe(false);
	});

	it("bounds stacks", () => {
		const stack = Array.from({ length: MAX_HISTORY_ENTRIES }, (_, index) => index);
		const next = pushBounded(stack, -1);
		expect(next).toHaveLength(MAX_HISTORY_ENTRIES);
		expect(next[0]).toBe(1);
		expect(next.at(-1)).toBe(-1);
	});
});

describe("changedFields", () => {
	it("returns only fields whose JSON differs", () => {
		expect(changedFields({ a: 1, b: { c: [1] }, d: "x" }, { a: 1, b: { c: [2] }, d: "x" })).toEqual({ b: { c: [1] } });
	});
});
