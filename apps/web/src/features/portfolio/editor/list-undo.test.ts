import { describe, expect, it } from "vite-plus/test";
import { restoreListItem } from "./list-undo";

describe("putting a removed list item back", () => {
	it("goes back to its old place, or the end when the list got shorter", () => {
		const list = [{ id: "a" }, { id: "c" }];
		expect(restoreListItem(list, { id: "b" }, 1, 12)).toBe(true);
		expect(list.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
		const short = [{ id: "a" }];
		expect(restoreListItem(short, { id: "z" }, 5, 12)).toBe(true);
		expect(short.map((entry) => entry.id)).toEqual(["a", "z"]);
	});

	it("doesn't come back twice, nor into a full list", () => {
		const list = [{ id: "a" }, { id: "b" }];
		expect(restoreListItem(list, { id: "b" }, 0, 12)).toBe(false);
		expect(restoreListItem(list, { id: "c" }, 0, 2)).toBe(false);
		expect(list).toHaveLength(2);
	});

	it("tells items without an id apart by their content", () => {
		const buttons = [{ kind: "contact" }];
		expect(restoreListItem(buttons, { kind: "contact" }, 0, 3)).toBe(false);
		expect(restoreListItem(buttons, { kind: "resume" }, 0, 3)).toBe(true);
		expect(buttons).toEqual([{ kind: "resume" }, { kind: "contact" }]);
	});
});
