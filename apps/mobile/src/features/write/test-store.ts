// Tests only: a stand-in for the resume draft store (`@/draft`'s `useResumeStore`) with update, undo and locking, so
// Write's screens run over the real `resumeWriteSource`. Undo steps follow the real store's rule (`joinsUndoStep`):
// typing in one field folds into one step, `newStep` edits stand alone. Use from a `jest.mock("@/draft", …)` factory.
import type { LastEdit, UpdateOptions as EditOptions } from "@rezumi/resume/draft";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import { produce } from "immer";
import { create } from "zustand";
import { joinsUndoStep } from "@rezumi/resume/draft";
import { createEntry } from "@rezumi/resume/write";
import { defaultResumeData } from "@rezumi/schema/resume/default";

type TestDraft = {
	document: { id: string; name: string } | null;
	data: ResumeData | null;
	locked: boolean;
	status: "saved" | "error" | "offline";
	past: ResumeData[];
	last: LastEdit | null;
	update: (recipe: (draft: WritableDraft<ResumeData>) => void, options?: EditOptions) => void;
	undo: () => void;
	flush: () => Promise<void>;
	open: (id: string) => Promise<void>;
};

export function createTestDraftStore() {
	return create<TestDraft>((set, get) => ({
		document: null,
		data: null,
		locked: false,
		status: "saved",
		past: [],
		last: null,
		update: (recipe, options = {}) => {
			const { data, locked, past, last } = get();
			if (!data || locked) return;
			const next = produce(data, recipe);
			if (next === data) return;
			const now = Date.now();
			const join = joinsUndoStep(last, options, now);
			set({
				data: next,
				past: join ? past : [...past, data],
				last: { at: now, key: options.coalesceKey, coalesce: !options.newStep },
			});
		},
		undo: () => {
			const { past } = get();
			const previous = past.at(-1);
			if (previous) set({ data: previous, past: past.slice(0, -1), last: null });
		},
		flush: () => Promise.resolve(),
		open: () => Promise.resolve(),
	}));
}

/** A resume with an experience section holding two entries and a skills section with one. */
export function sampleResume(): ResumeData {
	const data = structuredClone(defaultResumeData);
	const job = (id: string, company: string) => ({ ...createEntry("experience"), id, company, position: "Designer" });
	data.sections.experience.items = [job("job-a", "Nusantara Labs"), job("job-b", "Kopi Studio")] as never;
	data.sections.skills.items = [{ ...createEntry("skills"), id: "skill-a", name: "Figma" }] as never;
	data.basics.name = "Dana Putri";
	return data;
}
