import type { RouterOutput } from "@/libs/orpc/client";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { t } from "@lingui/core/macro";
import { create } from "zustand/react";
import { PORTFOLIO_AI_PLACEHOLDER } from "@rezumi/schema/portfolio/ai";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { toast } from "@rezumi/ui/components/toast";
import { newTextBlock } from "../blocks/blocks";
import { editPortfolio, usePortfolioEditorStore } from "../editor/store";

export type PortfolioAiDraft = RouterOutput["portfolio"]["ai"]["draft"];

/**
 * Puts a draft into the portfolio: the greeting, About me, and each work's summary and first Text block (a new one at
 * the top for a work without any). Whatever the AI left empty stays as it was.
 */
export function applyPortfolioDraft(data: Draft<PortfolioData>, draft: PortfolioAiDraft): void {
	if (draft.greeting) data.hero.greeting = draft.greeting;
	if (draft.about) data.about.content = draft.about;
	for (const entry of draft.works) {
		const work = data.works.items.find((item) => item.id === entry.id);
		if (!work) continue;
		if (entry.summary) work.summary = entry.summary;
		if (!entry.html) continue;
		const text = work.blocks.find((block) => block.type === "text");
		if (text) text.html = entry.html;
		else if (work.blocks.length < PORTFOLIO_LIMITS.blocksPerWork) work.blocks.unshift(newTextBlock(entry.html));
	}
}

const placeholdersIn = (text: string) => text.match(PORTFOLIO_AI_PLACEHOLDER)?.length ?? 0;

/** Places a draft left for the person to fill in, such as "[add the result]", still on the page. */
export function countPortfolioPlaceholders(data: PortfolioData): number {
	const works = data.works.items.flatMap((work) => [
		work.summary,
		...work.blocks.flatMap((block) => (block.type === "text" ? [block.html] : [])),
	]);
	return [data.hero.greeting, data.about.content, ...works].reduce((sum, text) => sum + placeholdersIn(text), 0);
}

/** A draft written while the portfolio was being created, waiting for the editor to open. */
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
