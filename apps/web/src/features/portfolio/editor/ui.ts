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
	/** The work open in Work; the preview shows its page. Opening one anywhere (a card in the preview, a new work, "Show me") switches the editor to Work. */
	openWorkId: string | null;
	openWork: (id: string | null) => void;
	/** The work last open in Work, picked again when Work is opened from the rail. */
	lastWorkId: string | null;
	/** Work's canvas: the work as a document to write in, or its page as visitors see it. */
	workView: "edit" | "preview";
	setWorkView: (view: "edit" | "preview") => void;
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
	/** The preview's width: a computer's, or a phone's. The bar switches it. */
	previewDevice: "desktop" | "phone";
	setPreviewDevice: (device: "desktop" | "phone") => void;
	/** Leaving the editor: the next visit starts with nothing open. */
	reset: () => void;
};

const initialUi = {
	openWorkId: null,
	lastWorkId: null,
	workView: "edit",
	openSectionKey: null,
	revealing: null,
	effectReplay: 0,
	uploads: 0,
	keptPhoto: null,
	wantsOwnPhoto: false,
	previewDevice: "desktop",
} satisfies Partial<PortfolioEditorUi>;

/** What the editor shows, apart from the data: kept outside the data store so it never becomes an undo step. */
export const usePortfolioEditorUi = create<PortfolioEditorUi>()((set) => ({
	...initialUi,
	openWork: (openWorkId) => set((state) => ({ openWorkId, lastWorkId: openWorkId ?? state.lastWorkId })),
	setWorkView: (workView) => set({ workView }),
	openSection: (openSectionKey) => set({ openSectionKey }),
	revealSection: (key) => set({ openSectionKey: key, revealing: key }),
	revealed: () => set({ revealing: null }),
	replayEffect: () => set((state) => ({ effectReplay: state.effectReplay + 1 })),
	noteUpload: () => set((state) => ({ uploads: state.uploads + 1 })),
	keepPhoto: (image) => set({ keptPhoto: image ? { image, at: Date.now() } : null }),
	setWantsOwnPhoto: (wantsOwnPhoto) => set({ wantsOwnPhoto }),
	setPreviewDevice: (previewDevice) => set({ previewDevice }),
	reset: () => set(initialUi),
}));
