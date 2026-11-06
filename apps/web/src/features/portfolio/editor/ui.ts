import { create } from "zustand/react";

type PortfolioEditorUi = {
	/** The work open in the content panel; the preview shows its detail. */
	openWorkId: string | null;
	openWork: (id: string | null) => void;
	/** Bumped to play the intro effect again in the preview ("Replay", or a newly chosen effect). */
	effectReplay: number;
	replayEffect: () => void;
};

/** What the editor shows, apart from the data: kept outside the data store so it never becomes an undo step. */
export const usePortfolioEditorUi = create<PortfolioEditorUi>()((set) => ({
	openWorkId: null,
	openWork: (openWorkId) => set({ openWorkId }),
	effectReplay: 0,
	replayEffect: () => set((state) => ({ effectReplay: state.effectReplay + 1 })),
}));
