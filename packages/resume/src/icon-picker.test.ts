import { describe, expect, it } from "vite-plus/test";
import { iconCategories, icons } from "@rezumi/schema/icons";
import { iconPickerGroups, searchIcons } from "./icon-picker";

describe("iconPickerGroups", () => {
	it("starts with Suggested and offers every resume icon", () => {
		expect(iconPickerGroups[0]?.id).toBe("suggested");
		const offered = new Set(iconPickerGroups.flatMap((group) => group.icons));
		expect(icons.filter((icon) => icon && !offered.has(icon))).toEqual([]);
	});

	it("folds categories of a few icons into Suggested", () => {
		const ids = iconPickerGroups.map((group) => group.id);
		expect(ids).not.toContain("bookmark");
		expect(iconPickerGroups[0]?.icons).toEqual(expect.arrayContaining([...(iconCategories.editing ?? [])]));
		expect(ids.slice(1, 4)).toEqual(["logos", "business", "education"]);
	});
});

describe("searchIcons", () => {
	it("ranks whole-word name matches first", () => {
		expect(searchIcons("mail").slice(0, 2)).toEqual(["mail-01", "mail-02"]);
		expect(searchIcons("linkedin")[0]).toBe("linkedin-02");
	});

	it("finds icons by English and Indonesian synonyms", () => {
		expect(searchIcons("email")).toContain("mail-01");
		expect(searchIcons("surel")).toContain("mail-01");
		expect(searchIcons("pendidikan")).toContain("mortarboard-01");
		expect(searchIcons("telepon")[0]).toBe("call-02");
	});

	it("finds a heading's icons by its shown name, after name matches", () => {
		const results = searchIcons("logo", { labels: { logos: "Logo" } });
		expect(results).toContain("github-01");
		expect(searchIcons("pendidikan", { labels: { education: "Pendidikan" } })).toContain("graduation-scroll");
	});

	it("needs every word to match", () => {
		expect(searchIcons("calendar check")).toContain("calendar-check");
		expect(searchIcons("calendar check")).not.toContain("calendar-01");
		expect(searchIcons("zzzz")).toEqual([]);
	});

	it("keeps to one heading when asked", () => {
		const logos = searchIcons("", { group: "logos" });
		expect(logos).toEqual(iconPickerGroups.find((group) => group.id === "logos")?.icons);
		expect(searchIcons("mail", { group: "logos" })).not.toContain("mail-01");
	});
});
