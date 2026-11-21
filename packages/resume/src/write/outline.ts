import type { LayoutColumn, OutlineRow } from "./model";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import { getEntries, removeFromLayout, resolveSection } from "./model";

type Data = ResumeData | WritableDraft<ResumeData>;

// ---------------------------------------------------------------------------------------------------------------
// The phone outline is one flat sortable list: dividers, section rows and, under open sections, entry rows.
// ---------------------------------------------------------------------------------------------------------------

export type FlatRow =
	| { kind: "divider"; key: string; label: "page" | "sidebar" | "hidden"; page: number; column: LayoutColumn }
	| { kind: "section"; key: string; row: OutlineRow }
	| { kind: "entry"; key: string; sectionId: string; entryId: string; index: number; count: number }
	| { kind: "add"; key: string; sectionId: string };

/** Flattens the outline. Open sections list their entries and an Add row (the summary has no entries). */
export function flattenOutline(data: Data, rows: readonly OutlineRow[], open: ReadonlySet<string>): FlatRow[] {
	const flat: FlatRow[] = [];
	const active = rows.filter((row) => !row.hidden);
	const hidden = rows.filter((row) => row.hidden);
	const multiPage = active.some((row) => row.page > 0);

	const pushSection = (row: OutlineRow) => {
		flat.push({ kind: "section", key: `s:${row.id}`, row });
		const section = resolveSection(data, row.id);
		if (!section || section.kind === "summary" || !open.has(row.id)) return;
		const entries = getEntries(data, section);
		entries.forEach((entry, index) =>
			flat.push({
				kind: "entry",
				key: `e:${entry.id}`,
				sectionId: row.id,
				entryId: entry.id,
				index,
				count: entries.length,
			}),
		);
		flat.push({ kind: "add", key: `a:${row.id}`, sectionId: row.id });
	};

	active.forEach((row, index) => {
		const previous = active[index - 1];
		const newPage = multiPage && row.page !== previous?.page;
		if (newPage) flat.push({ kind: "divider", key: `p:${row.page}`, label: "page", page: row.page, column: "main" });
		if (row.column === "sidebar" && (previous?.column !== "sidebar" || newPage))
			flat.push({ kind: "divider", key: `b:${row.page}`, label: "sidebar", page: row.page, column: "sidebar" });
		pushSection(row);
	});

	if (hidden.length > 0) {
		flat.push({ kind: "divider", key: "hidden", label: "hidden", page: -1, column: "main" });
		for (const row of hidden) pushSection(row);
	}
	return flat;
}

export type OutlineDrop =
	| { kind: "section"; id: string; target: { page: number; column: LayoutColumn; after: string | null } }
	| { kind: "entry"; sectionId: string; entryId: string; to: number }
	| null;

/**
 * What dropping a dragged row means, from the list in its new order. A section lands after the section above it
 * (or at the start of the column a divider above it opens); an entry stays in its own section, clamped to its
 * first or last place when dropped outside it. Drops into the hidden group do nothing.
 */
export function resolveDrop(reordered: readonly FlatRow[], to: number): OutlineDrop {
	const moved = reordered[to];
	if (!moved) return null;

	if (moved.kind === "section") {
		for (let index = to - 1; index >= 0; index--) {
			const above = reordered[index];
			if (!above) continue;
			if (above.kind === "divider") {
				if (above.label === "hidden") return null;
				return { kind: "section", id: moved.row.id, target: { page: above.page, column: above.column, after: null } };
			}
			if (above.kind === "section") {
				if (above.row.hidden) return null;
				const { page, column, id } = above.row;
				return { kind: "section", id: moved.row.id, target: { page, column, after: id } };
			}
		}
		return { kind: "section", id: moved.row.id, target: { page: 0, column: "main", after: null } };
	}

	if (moved.kind === "entry") {
		const own = (row: FlatRow | undefined) => row?.kind === "entry" && row.sectionId === moved.sectionId;
		const above = reordered[to - 1];
		if (own(above) || (above?.kind === "section" && above.row.id === moved.sectionId)) {
			let position = 0;
			for (let index = 0; index < to; index++) if (own(reordered[index])) position++;
			return { kind: "entry", sectionId: moved.sectionId, entryId: moved.entryId, to: position };
		}
		// Outside its section: snap back to the nearer end.
		const first = reordered.findIndex((row) => own(row) || (row.kind === "add" && row.sectionId === moved.sectionId));
		return {
			kind: "entry",
			sectionId: moved.sectionId,
			entryId: moved.entryId,
			to: first !== -1 && to > first ? moved.count - 1 : 0,
		};
	}
	return null;
}

/** Applies a section drop to the layout. */
export function applySectionDrop(draft: WritableDraft<ResumeData>, drop: Extract<OutlineDrop, { kind: "section" }>) {
	const { id, target } = drop;
	if (target.after === id || !draft.metadata.layout.pages[target.page]) return;
	// Removing replaces the column arrays, so look the column up afterwards.
	removeFromLayout(draft, id);
	const column = draft.metadata.layout.pages[target.page]?.[target.column];
	column?.splice(target.after ? column.indexOf(target.after) + 1 : 0, 0, id);
}
