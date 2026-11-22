import type { PageBlock } from "./page";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { isSameTarget, placeIssuePins, targetsMentioning } from "./page";

// The target part of a block (its kind and ids); the box is the same for every test block.
const block = (key: string, page: number, target: { kind: PageBlock["kind"]; sectionId?: string; itemId?: string }) =>
	({ key, page, x: 0, y: 0, width: 10, height: 10, ...target }) as PageBlock;

describe("placeIssuePins", () => {
	const blocks = [
		block("header", 0, { kind: "header" }),
		block("exp", 1, { kind: "item", sectionId: "experience", itemId: "a" }),
	];

	it("pins each issue on its block's page, stacking issues on the same block, and skips page-wide ones", () => {
		const issues = [
			{ id: 1, target: { kind: "header" } as const },
			{ id: 2, target: { kind: "header" } as const },
			{ id: 3, target: null },
			{ id: 4, target: { kind: "item", sectionId: "experience", itemId: "a" } as const },
		];
		expect(placeIssuePins(issues, blocks, 0).map((pin) => [pin.issue.id, pin.stack])).toEqual([
			[1, 0],
			[2, 1],
		]);
		expect(placeIssuePins(issues, blocks, 1).map((pin) => pin.issue.id)).toEqual([4]);
	});

	it("compares targets by kind and ids", () => {
		expect(isSameTarget({ kind: "header" }, { kind: "header" })).toBe(true);
		expect(isSameTarget({ kind: "section", sectionId: "a" }, { kind: "item", sectionId: "a", itemId: "b" })).toBe(
			false,
		);
		expect(isSameTarget(null, null)).toBe(true);
	});
});

describe("targetsMentioning", () => {
	it("finds the header, the summary and entries that mention a term", () => {
		const data: ResumeData = produce(defaultResumeData, (draft) => {
			draft.basics.headline = "Figma designer";
			draft.summary.content = "<p>I use figma daily.</p>";
			draft.sections.skills.items = [
				{ id: "s1", hidden: false, icon: "", iconColor: "", name: "Figma", proficiency: "", level: 0, keywords: [] },
				{ id: "s2", hidden: false, icon: "", iconColor: "", name: "Sketch", proficiency: "", level: 0, keywords: [] },
			];
		});
		expect(targetsMentioning(data, "Figma")).toEqual([
			{ kind: "header" },
			{ kind: "section", sectionId: "summary" },
			{ kind: "item", sectionId: "skills", itemId: "s1" },
		]);
	});
});
