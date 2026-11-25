// Proposed edits from the assistant: as cards in the chat, applied to the draft through the M3-T3 store, and marked on
// the Page tab (ported from apps/web/src/features/resume/editor/proposals/proposals.ts).
import type { Proposal } from "@rezumi/resume/proposals";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { useMemo } from "react";
import { create } from "zustand";
import { applyProposal, markProposals, pendingProposals } from "@rezumi/resume/proposals";
import { getAccountScope } from "@/auth/session";
import { useResumeStore } from "@/draft";

/** Apply every current proposal in a single editor undo step. */
export function acceptResumeProposals(proposals: readonly Proposal[]) {
	const store = useResumeStore.getState();
	const scope = getAccountScope();
	const id = store.document?.id;
	if (!scope || !id || !store.data || store.locked) return;
	const applied: Proposal[] = [];
	store.update(
		(draft) => {
			for (const proposal of proposals) if (applyProposal(draft as ResumeData, proposal)) applied.push(proposal);
		},
		{ newStep: true },
	);
	const accepted = useResumeStore.getState().data;
	if (accepted === store.data || !applied.length) return;
	const canUndo = () => {
		const current = useResumeStore.getState();
		return getAccountScope() === scope && current.document?.id === id && current.data === accepted && !current.locked;
	};
	return {
		applied,
		canUndo,
		undo: () => {
			if (canUndo()) useResumeStore.getState().undo();
		},
	};
}

// ---- Page markings ----

const NONE: readonly Proposal[] = [];

/** The assistant's proposals for one resume, kept after the assistant closes so Page can mark them. */
export const useAssistantProposals = create<{ resumeId: string | null; proposals: readonly Proposal[] }>(() => ({
	resumeId: null,
	proposals: [],
}));

/** Skips an unchanged list: a streaming reply rebuilds it on every chunk, and Page re-marks on each publish. */
export const publishProposals = (resumeId: string, proposals: readonly Proposal[]) => {
	const current = useAssistantProposals.getState();
	if (current.resumeId === resumeId && JSON.stringify(current.proposals) === JSON.stringify(proposals)) return;
	useAssistantProposals.setState({ resumeId, proposals });
};

/**
 * For the Page tab: the resume data with this resume's pending assistant edits marked, and how many there are.
 * `data` is the draft's data; pass the result to `usePreview` instead.
 */
export function useMarkedResumeData(resumeId: string, data: ResumeData | null) {
	const proposals = useAssistantProposals((state) => (state.resumeId === resumeId ? state.proposals : NONE));
	return useMemo(
		() =>
			!data || proposals.length === 0
				? { data, pending: 0 }
				: { data: markProposals(data, proposals), pending: pendingProposals(data, proposals).length },
		[data, proposals],
	);
}
