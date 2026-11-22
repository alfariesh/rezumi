// Tests only: a stand-in for the resume draft store (`@/draft`'s `useResumeStore`) with update, undo and locking, so
// Write's screens run over the real `resumeWriteSource`. Use from a `jest.mock("@/draft", …)` factory.
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import { produce } from "immer";
import { create } from "zustand";
import { createEntry } from "@rezumi/resume/write";
import { defaultResumeData } from "@rezumi/schema/resume/default";

type TestDraft = {
	document: { id: string; name: string } | null;
	data: ResumeData | null;
	locked: boolean;
	status: "saved" | "error" | "offline";
	past: ResumeData[];
	update: (recipe: (draft: WritableDraft<ResumeData>) => void) => void;
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
		update: (recipe) => {
			const { data, locked, past } = get();
			if (!data || locked) return;
			set({ data: produce(data, recipe), past: [...past, data] });
		},
		undo: () => {
			const { past } = get();
			const previous = past.at(-1);
			if (previous) set({ data: previous, past: past.slice(0, -1) });
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
