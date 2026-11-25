import type { Proposal } from "@rezumi/resume/proposals";
import { plural, t } from "@lingui/core/macro";
import { applyProposal } from "@rezumi/resume/proposals";
import { toast } from "@rezumi/ui/components/toast";
import { useResumeStore } from "@/features/resume/builder/draft";

export { markChange, markProposals, pendingProposals } from "@rezumi/resume/proposals";

/** Applies proposals to the resume as one undo step; the toast's Undo takes them back, and they show as pending again. */
export function acceptResumeProposals(proposals: readonly Proposal[]) {
	useResumeStore.getState().updateResumeData(
		(draft) => {
			for (const proposal of proposals) applyProposal(draft, proposal);
		},
		{ newStep: true },
	);
	toast.add({
		description: plural(proposals.length, { 1: "Edit applied", other: "# edits applied" }),
		actionProps: { children: t`Undo`, onClick: () => useResumeStore.getState().undo() },
	});
}
