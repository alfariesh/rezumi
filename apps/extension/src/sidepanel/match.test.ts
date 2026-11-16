import { describe, expect, it } from "vite-plus/test";
import { matchChips, matchPercent, matchResumeId } from "./match";

describe("matchResumeId (aturan turunan #11)", () => {
	const resumes = [
		{ id: "newest", isPrimary: false },
		{ id: "primary", isPrimary: true },
		{ id: "old", isPrimary: false },
	];

	it("uses the account's primary resume until the person picks one", () => {
		expect(matchResumeId(resumes, null)).toBe("primary");
	});

	it("remembers the pick while that resume exists", () => {
		expect(matchResumeId(resumes, "old")).toBe("old");
		expect(matchResumeId(resumes, "deleted")).toBe("primary");
	});

	it("falls back to the newest resume without a primary one, and to none without resumes", () => {
		expect(
			matchResumeId(
				[
					{ id: "a", isPrimary: false },
					{ id: "b", isPrimary: false },
				],
				null,
			),
		).toBe("a");
		expect(matchResumeId([], "a")).toBeNull();
	});
});

describe("matchPercent", () => {
	it("is the share of terms found, or null without terms", () => {
		expect(matchPercent(3, 4)).toBe(75);
		expect(matchPercent(1, 3)).toBe(33);
		expect(matchPercent(0, 0)).toBeNull();
	});
});

describe("matchChips", () => {
	const terms = (prefix: string, count: number) =>
		Array.from({ length: count }, (_, index) => ({ term: `${prefix}${index}`, label: `${prefix}${index}` }));

	it("shows at most 12, missing first, and counts the rest", () => {
		const chips = matchChips(terms("f", 10), terms("m", 10));
		expect(chips.missing).toHaveLength(8);
		expect(chips.found).toHaveLength(4);
		expect(chips.more).toBe(8);
	});

	it("fills the chips with whichever group has terms", () => {
		expect(matchChips(terms("f", 2), terms("m", 20))).toMatchObject({ more: 10 });
		expect(matchChips(terms("f", 2), terms("m", 20)).missing).toHaveLength(10);
		expect(matchChips(terms("f", 20), [])).toMatchObject({ missing: [], more: 8 });
		expect(matchChips(terms("f", 3), terms("m", 2))).toMatchObject({ more: 0 });
	});
});
