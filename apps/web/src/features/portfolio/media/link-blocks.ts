import { create } from "zustand/react";

type LinkSuggestions = {
	/** Pictures a pasted page offered, by Link block, until the person uses or declines them. */
	pictures: Record<string, string>;
	suggest: (blockId: string, url: string) => void;
	dismiss: (blockId: string) => void;
};

/** Suggested pictures stay outside the portfolio's data: nothing from another site is saved until it's copied. */
export const useLinkSuggestions = create<LinkSuggestions>()((set) => ({
	pictures: {},
	suggest: (blockId, url) => set((state) => ({ pictures: { ...state.pictures, [blockId]: url } })),
	dismiss: (blockId) =>
		set((state) => {
			if (!(blockId in state.pictures)) return state;
			const { [blockId]: _gone, ...rest } = state.pictures;
			return { pictures: rest };
		}),
}));
