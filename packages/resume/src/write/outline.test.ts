import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { addBuiltinSection, findPlacement, getOutlineRows, placeSection } from "./model";
import { applySectionDrop, flattenOutline, resolveDrop } from "./outline";

/** Two pages: experience and education on page 1 (skills in its sidebar), projects on page 2; one entry each. */
const twoPages: ResumeData = produce(structuredClone(defaultResumeData), (data) => {
	data.metadata.layout.pages = [
		{ fullWidth: false, main: ["experience", "education"], sidebar: ["skills"] },
		{ fullWidth: false, main: ["projects"], sidebar: [] },
	];
	for (const type of ["experience", "education", "skills", "projects"] as const) addBuiltinSection(data, type);
});

describe("phone outline", () => {
	it("lists page and sidebar dividers, open sections' entries and an Add row", () => {
		const rows = getOutlineRows(twoPages);
		const flat = flattenOutline(twoPages, rows, new Set(["experience"]));
		expect(flat.map((row) => row.key.split(":")[0] + (row.kind === "section" ? `:${row.row.id}` : ""))).toEqual([
			"p",
			"s:experience",
			"e",
			"a",
			"s:education",
			"b",
			"s:skills",
			"p",
			"s:projects",
		]);
	});

	it("drops a section after the section above it, or at the start of the column a divider opens", () => {
		const flat = flattenOutline(twoPages, getOutlineRows(twoPages), new Set());
		const projects = flat.findIndex((row) => row.kind === "section" && row.row.id === "projects");
		const reordered = [...flat];
		const [moved] = reordered.splice(projects, 1);
		if (!moved) throw new Error("missing");
		const skillsDivider = reordered.findIndex((row) => row.kind === "divider" && row.label === "sidebar");
		reordered.splice(skillsDivider + 1, 0, moved);

		const drop = resolveDrop(reordered, skillsDivider + 1);
		expect(drop).toEqual({ kind: "section", id: "projects", target: { page: 0, column: "sidebar", after: null } });
		if (drop?.kind !== "section") throw new Error("not a section drop");
		const next = produce(twoPages, (draft) => applySectionDrop(draft, drop));
		expect(next.metadata.layout.pages[0]?.sidebar).toEqual(["projects", "skills"]);
		expect(next.metadata.layout.pages[1]?.main).toEqual([]);
	});

	it("keeps an entry in its own section, snapping to the nearer end when dropped outside it", () => {
		const data = produce(twoPages, (draft) => {
			addBuiltinSection(draft, "experience");
		});
		const flat = flattenOutline(data, getOutlineRows(data), new Set(["experience"]));
		const first = flat.findIndex((row) => row.kind === "entry");
		const reordered = [...flat];
		const [entry] = reordered.splice(first, 1);
		if (!entry) throw new Error("missing");
		reordered.push(entry);
		const drop = resolveDrop(reordered, reordered.length - 1);
		expect(drop).toMatchObject({ kind: "entry", sectionId: "experience", to: 1 });
	});

	it("moves a section to a page's column or a new page, and reports where it sits", () => {
		const moved = produce(twoPages, (draft) => placeSection(draft, "education", { page: 1, column: "sidebar" }));
		expect(findPlacement(moved.metadata.layout.pages, "education")).toEqual({ page: 1, column: "sidebar" });
		const newPage = produce(twoPages, (draft) => placeSection(draft, "skills", "new-page"));
		expect(newPage.metadata.layout.pages).toHaveLength(3);
		expect(findPlacement(newPage.metadata.layout.pages, "skills")).toEqual({ page: 2, column: "main" });
	});
});
