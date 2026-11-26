import type { PortfolioAiDraft } from "@rezumi/portfolio/draft";
import { t } from "@lingui/core/macro";
import { create } from "zustand/react";
import { applyPortfolioDraft, countPortfolioPlaceholders } from "@rezumi/portfolio/draft";
import { toast } from "@rezumi/ui/components/toast";
import { editPortfolio, usePortfolioEditorStore } from "../editor/store";

/** A draft written while the portfolio was being created, waiting for the editor to open. */
export { applyPortfolioDraft, countPortfolioPlaceholders };
export type { PortfolioAiDraft };

const usePendingDraft = create<{ draft: PortfolioAiDraft | null }>(() => ({ draft: null }));

export const keepDraftForEditor = (draft: PortfolioAiDraft) => usePendingDraft.setState({ draft });

/** Says what AI just changed, with an Undo for that change alone: edits made since are never taken back with it. */
export function toastAiChange(description: string): void {
	const applied = usePortfolioEditorStore.getState().portfolio?.data;
	toast.add({
		description,
		actionProps: {
			children: t`Undo`,
			onPress: () => {
				const store = usePortfolioEditorStore.getState();
				if (applied && store.portfolio?.data === applied) store.undo();
				else toast.add({ description: t`You've changed things since. Use Undo at the top of the editor.` });
			},
		},
	});
}

/** Applies a draft as one undoable edit and says what to do next. */
export function applyDraftToEditor(draft: PortfolioAiDraft): void {
	editPortfolio((data) => applyPortfolioDraft(data, draft), { structural: true });
	const applied = usePortfolioEditorStore.getState().portfolio?.data;
	toastAiChange(
		applied && countPortfolioPlaceholders(applied) > 0
			? t`Your draft is in. Fill in the parts in [brackets] before you publish.`
			: t`Your draft is in. Read it through and make it yours.`,
	);
}

/** The editor is open: a draft written during creation goes in now, so Undo goes back to what the resume gave. */
export function applyPendingDraft(): void {
	const { draft } = usePendingDraft.getState();
	if (!draft) return;
	usePendingDraft.setState({ draft: null });
	applyDraftToEditor(draft);
}
