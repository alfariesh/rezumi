import { create } from "zustand/react";

type PortfolioEditorUi = {
	/** The work open in the content panel; the preview shows its detail. */
	openWorkId: string | null;
	openWork: (id: string | null) => void;
};

/** What the editor shows, apart from the data: kept outside the data store so it never becomes an undo step. */
export const usePortfolioEditorUi = create<PortfolioEditorUi>()((set) => ({
	openWorkId: null,
	openWork: (openWorkId) => set({ openWorkId }),
}));
