import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { PortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import { create } from "zustand/react";
import { PORTFOLIO_UNUSED_FILE_GRACE_MS } from "@rezumi/schema/portfolio/limits";

/**
 * How long a portfolio-only photo stays ready to come back after the resume's photo was chosen. The server deletes an
 * upload once no saved data has used it for `PORTFOLIO_UNUSED_FILE_GRACE_MS`; half of that leaves room for the save
 * that stops using it.
 */
export const KEPT_PHOTO_MS = PORTFOLIO_UNUSED_FILE_GRACE_MS / 2;

type PortfolioEditorUi = {
	/** The work open in the content panel; the preview shows its detail. */
	openWorkId: string | null;
	openWork: (id: string | null) => void;
	/** The section open in Content's list. */
	openSectionKey: PortfolioSectionKey | null;
	openSection: (key: PortfolioSectionKey | null) => void;
	/** A section to open and scroll to once Content's list shows it (the save status's "Show me"). */
	revealing: PortfolioSectionKey | null;
	revealSection: (key: PortfolioSectionKey) => void;
	/** The section was scrolled to. */
	revealed: () => void;
	/** Bumped to play the intro effect again in the preview ("Replay", or a newly chosen effect). */
	effectReplay: number;
	/** Goes up after every upload: the storage meter reads the usage again. */
	uploads: number;
	noteUpload: () => void;
	replayEffect: () => void;
	/**
	 * A portfolio-only photo taken out of the data when the resume's photo was chosen, and when: choosing "A photo for
	 * the portfolio only" again puts it back instead of asking for another upload, as long as the server still keeps
	 * it (`KEPT_PHOTO_MS`).
	 */
	keptPhoto: { image: PortfolioImage; at: number } | null;
	keepPhoto: (image: PortfolioImage | null) => void;
	/** "A photo for the portfolio only" is chosen and its photo is still to be uploaded. */
	wantsOwnPhoto: boolean;
	setWantsOwnPhoto: (wants: boolean) => void;
	/** Leaving the editor: the next visit starts with nothing open. */
	reset: () => void;
};

const initialUi = {
	openWorkId: null,
	openSectionKey: null,
	revealing: null,
	effectReplay: 0,
	uploads: 0,
	keptPhoto: null,
	wantsOwnPhoto: false,
} satisfies Partial<PortfolioEditorUi>;

/** What the editor shows, apart from the data: kept outside the data store so it never becomes an undo step. */
export const usePortfolioEditorUi = create<PortfolioEditorUi>()((set) => ({
	...initialUi,
	openWork: (openWorkId) => set({ openWorkId }),
	openSection: (openSectionKey) => set({ openSectionKey }),
	revealSection: (key) => set({ openSectionKey: key, revealing: key }),
	revealed: () => set({ revealing: null }),
	replayEffect: () => set((state) => ({ effectReplay: state.effectReplay + 1 })),
	noteUpload: () => set((state) => ({ uploads: state.uploads + 1 })),
	keepPhoto: (image) => set({ keptPhoto: image ? { image, at: Date.now() } : null }),
	setWantsOwnPhoto: (wantsOwnPhoto) => set({ wantsOwnPhoto }),
	reset: () => set(initialUi),
}));
