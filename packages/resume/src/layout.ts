// Page layout: which sections sit in Main or Sidebar on each page, and the page-break flags of each section. Shared by
// the web's and the app's Layout editors. Pure: mutates the Immer drafts it is given, no React.
import type { ResumeData, SectionType } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import { findPlacement } from "./write/model";

type Layout = ResumeData["metadata"]["layout"];
export type LayoutColumnId = "main" | "sidebar";
export type LayoutLocation = { page: number; column: LayoutColumnId };
/** Where a moved section lands: a column on a page and the index among that column's visible sections. */
export type LayoutDrop = LayoutLocation & { index: number };

/**
 * Moves `id` to `to`. `to.index` counts only the sections `visible` accepts (what an editor shows); hidden ones keep
 * their place relative to their neighbours. Returns false when nothing changed, so a drop in place adds no undo step.
 */
export function moveSection(
	layout: WritableDraft<Layout>,
	id: string,
	to: LayoutDrop,
	visible: (id: string) => boolean = () => true,
): boolean {
	const from = findPlacement(layout.pages, id);
	const target = layout.pages[to.page]?.[to.column];
	const source = from && layout.pages[from.page]?.[from.column];
	if (!source || !target) return false;
	if (source === target) {
		const order = target.filter((item) => item !== id && visible(item));
		order.splice(to.index, 0, id);
		if (order.join("\n") === target.filter((item) => item === id || visible(item)).join("\n")) return false;
	}
	const before = JSON.stringify(layout.pages);
	source.splice(source.indexOf(id), 1);
	const anchor = target.filter(visible)[to.index];
	const position = anchor === undefined ? target.length : target.indexOf(anchor);
	target.splice(position, 0, id);
	return JSON.stringify(layout.pages) !== before;
}

/** Moves a section to the end of a column (the "Move to" menu). */
export function moveSectionToEnd(layout: WritableDraft<Layout>, id: string, to: LayoutLocation): boolean {
	return moveSection(layout, id, { ...to, index: Number.POSITIVE_INFINITY });
}

/** Moves a section onto a new last page of its own. */
export function moveSectionToNewPage(layout: WritableDraft<Layout>, id: string) {
	const from = findPlacement(layout.pages, id);
	const source = from && layout.pages[from.page]?.[from.column];
	if (!source) return;
	source.splice(source.indexOf(id), 1);
	layout.pages.push({ fullWidth: false, main: [id], sidebar: [] });
}

/** Full width hides the page's sidebar, so its sections move into Main. */
export function setPageFullWidth(layout: WritableDraft<Layout>, page: number, fullWidth: boolean) {
	const value = layout.pages[page];
	if (!value) return;
	value.fullWidth = fullWidth;
	if (fullWidth) {
		value.main.push(...value.sidebar);
		value.sidebar = [];
	}
}

export function addLayoutPage(layout: WritableDraft<Layout>) {
	layout.pages.push({ fullWidth: false, main: [], sidebar: [] });
}

/** Deleting a page moves its sections to the first remaining page. The last page cannot be deleted. */
export function deleteLayoutPage(layout: WritableDraft<Layout>, page: number) {
	if (layout.pages.length <= 1) return;
	const removed = layout.pages[page];
	const target = layout.pages[page === 0 ? 1 : 0];
	if (!removed || !target) return;
	target.main.push(...removed.main);
	// A full-width page hides its sidebar, so the removed sidebar joins Main there, as setPageFullWidth does.
	(target.fullWidth ? target.main : target.sidebar).push(...removed.sidebar);
	layout.pages.splice(page, 1);
}

export type SectionBreakField = "keepTogether" | "startOnNewPage";

type BreakTarget = Pick<ResumeData, "summary" | "sections" | "customSections">;

/** A section's page-break flag (summary, a standard section or a custom one); false for an unknown id. */
export function readSectionBreak(data: BreakTarget, id: string, field: SectionBreakField): boolean {
	if (id === "summary") return data.summary[field];
	if (id in data.sections) return data.sections[id as SectionType][field];
	return data.customSections.find((section) => section.id === id)?.[field] ?? false;
}

export function toggleSectionBreak(data: WritableDraft<BreakTarget>, id: string, field: SectionBreakField) {
	if (id === "summary") data.summary[field] = !data.summary[field];
	else if (id in data.sections) {
		const section = data.sections[id as SectionType];
		section[field] = !section[field];
	} else {
		const custom = data.customSections.find((section) => section.id === id);
		if (custom) custom[field] = !custom[field];
	}
}
