import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import {
	addLayoutPage,
	deleteLayoutPage,
	moveSection,
	moveSectionToEnd,
	moveSectionToNewPage,
	readSectionBreak,
	setPageFullWidth,
	toggleSectionBreak,
} from "./layout";

type Layout = ResumeData["metadata"]["layout"];

const layout = (pages: Layout["pages"]): Layout => ({ ...defaultResumeData.metadata.layout, pages });
const two = () =>
	layout([
		{ fullWidth: false, main: ["summary", "experience", "education"], sidebar: ["skills", "languages"] },
		{ fullWidth: false, main: ["projects"], sidebar: [] },
	]);

describe("moving sections", () => {
	it("moves a section between columns and pages at the visible index", () => {
		const next = produce(two(), (draft) => {
			expect(moveSection(draft, "skills", { page: 0, column: "main", index: 1 })).toBe(true);
		});
		expect(next.pages[0]?.main).toEqual(["summary", "skills", "experience", "education"]);
		expect(next.pages[0]?.sidebar).toEqual(["languages"]);
	});

	it("counts only visible sections, keeping hidden ones beside their neighbours", () => {
		const visible = (id: string) => id !== "experience";
		const next = produce(two(), (draft) => {
			moveSection(draft, "languages", { page: 0, column: "main", index: 1 }, visible);
		});
		// The visible order was summary, education: index 1 lands before education, after the hidden experience.
		expect(next.pages[0]?.main).toEqual(["summary", "experience", "languages", "education"]);
	});

	it("reports a drop in place as no change", () => {
		const start = two();
		produce(start, (draft) => {
			expect(moveSection(draft, "experience", { page: 0, column: "main", index: 1 })).toBe(false);
			expect(moveSection(draft, "unknown", { page: 0, column: "main", index: 0 })).toBe(false);
		});
	});

	it("moves to the end of a column, or onto a page of its own", () => {
		const ended = produce(two(), (draft) => void moveSectionToEnd(draft, "summary", { page: 1, column: "main" }));
		expect(ended.pages[1]?.main).toEqual(["projects", "summary"]);
		const own = produce(two(), (draft) => moveSectionToNewPage(draft, "skills"));
		expect(own.pages).toHaveLength(3);
		expect(own.pages[2]).toEqual({ fullWidth: false, main: ["skills"], sidebar: [] });
	});
});

describe("pages", () => {
	it("full width moves the sidebar into Main", () => {
		const next = produce(two(), (draft) => setPageFullWidth(draft, 0, true));
		expect(next.pages[0]).toEqual({
			fullWidth: true,
			main: ["summary", "experience", "education", "skills", "languages"],
			sidebar: [],
		});
	});

	it("adds pages, and deleting one moves its sections to the first remaining page", () => {
		const added = produce(two(), (draft) => addLayoutPage(draft));
		expect(added.pages).toHaveLength(3);
		const deleted = produce(two(), (draft) => deleteLayoutPage(draft, 0));
		expect(deleted.pages).toEqual([
			{ fullWidth: false, main: ["projects", "summary", "experience", "education"], sidebar: ["skills", "languages"] },
		]);
	});

	it("puts a deleted sidebar into Main when the remaining page is full width, and keeps the last page", () => {
		const start = layout([
			{ fullWidth: true, main: ["summary"], sidebar: [] },
			{ fullWidth: false, main: ["projects"], sidebar: ["skills"] },
		]);
		const deleted = produce(start, (draft) => deleteLayoutPage(draft, 1));
		expect(deleted.pages).toEqual([{ fullWidth: true, main: ["summary", "projects", "skills"], sidebar: [] }]);
		const last = produce(deleted, (draft) => deleteLayoutPage(draft, 0));
		expect(last.pages).toHaveLength(1);
	});
});

describe("page breaks", () => {
	it("reads and toggles the flags of the summary, standard and custom sections", () => {
		const data = produce(defaultResumeData, (draft) => {
			draft.customSections.push({ ...draft.sections.projects, id: "custom-1", type: "projects" } as never);
		});
		const next = produce(data, (draft) => {
			toggleSectionBreak(draft, "summary", "keepTogether");
			toggleSectionBreak(draft, "skills", "startOnNewPage");
			toggleSectionBreak(draft, "custom-1", "keepTogether");
		});
		expect(readSectionBreak(next, "summary", "keepTogether")).toBe(!data.summary.keepTogether);
		expect(readSectionBreak(next, "skills", "startOnNewPage")).toBe(!data.sections.skills.startOnNewPage);
		expect(readSectionBreak(next, "custom-1", "keepTogether")).toBe(true);
		expect(readSectionBreak(next, "missing", "keepTogether")).toBe(false);
	});
});
