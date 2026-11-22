// Reading and writing entries through the open source (Profile or resume), with Undo for what doesn't ask first.
import type { WriteSection } from "@/features/entries/model";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import { useLingui } from "@lingui/react/macro";
import { useCallback } from "react";
import { useWriteData, useWriteSource } from "./source";
import { SECTION_TITLES } from "@/features/entries/fields";
import { createEntry, findEntry, getEntries, getSectionObject } from "@/features/entries/model";
import { showToast } from "@/ui";

/** One entry, re-rendering only when it changes; null once it's deleted. */
export const useEntry = (sectionId: string, entryId: string) =>
	useWriteData((data) => findEntry(data, sectionId, entryId) ?? null, null);

export type EntryWriter = (key: string, mutate: (entry: Record<string, unknown>) => void) => void;

/** Writes one field of an entry. Typing in one field folds into one undo step; another field starts a new one. */
export function useEntryWriter(sectionId: string, entryId: string): EntryWriter {
	const { update } = useWriteSource();
	return useCallback(
		(key, mutate) =>
			update(
				(draft) => {
					const entry = findEntry(draft, sectionId, entryId);
					if (entry) mutate(entry as unknown as Record<string, unknown>);
				},
				{ coalesceKey: `${entryId}:${key}` },
			),
		[update, sectionId, entryId],
	);
}

/** Adding, moving or deleting: always an undo step of its own. */
export function useEdit() {
	const { update } = useWriteSource();
	return useCallback(
		(recipe: (draft: WritableDraft<ResumeData>) => void) => update(recipe, { newStep: true }),
		[update],
	);
}

/** The printed title: the one the person gave, else the section type's name. */
export function useSectionTitle(section: WriteSection | null) {
	const { i18n } = useLingui();
	const title = useWriteData((data) => (section ? (getSectionObject(data, section)?.title ?? "") : ""), "");
	return title.trim() || (section ? i18n._(SECTION_TITLES[section.type]) : "");
}

/** A toast with Undo, for destructive edits that don't ask first. */
export function useUndoToast() {
	const { t } = useLingui();
	const { undo } = useWriteSource();
	return (title: string) => showToast({ title, undo: { label: t`Undo`, onUndo: undo } });
}

/** "+ Add {type}": a draft entry at the end of the section. Returns its id. */
export function useAddEntry() {
	const edit = useEdit();
	return (section: WriteSection): string => {
		const entry = createEntry(section.type);
		edit((draft) => {
			getEntries(draft, section).push(entry);
		});
		return entry.id;
	};
}

export function useDeleteEntry() {
	const { t } = useLingui();
	const edit = useEdit();
	const undoToast = useUndoToast();
	return (section: WriteSection, entryId: string) => {
		edit((draft) => {
			const entries = getEntries(draft, section);
			const index = entries.findIndex((entry) => entry.id === entryId);
			if (index !== -1) entries.splice(index, 1);
		});
		undoToast(t`Entry deleted`);
	};
}

/** Moves an entry one place up or down within its section. */
export function useMoveEntry() {
	const edit = useEdit();
	return (section: WriteSection, entryId: string, by: -1 | 1) =>
		edit((draft) => {
			const entries = getEntries(draft, section);
			const from = entries.findIndex((entry) => entry.id === entryId);
			const to = from + by;
			if (from === -1 || to < 0 || to >= entries.length) return;
			entries.splice(to, 0, ...entries.splice(from, 1));
		});
}

// A new draft entry opens with its first field focused; later openings don't steal focus again.
let focusNext: string | null = null;
export const requestFocus = (entryId: string) => {
	focusNext = entryId;
};
export function consumeFocus(entryId: string) {
	if (focusNext !== entryId) return false;
	focusNext = null;
	return true;
}
