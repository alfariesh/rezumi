import { create } from "zustand/react";

type CoachPanelState = {
	/** Whether the panel is open (beside the page on wide screens, a sheet on narrow ones). */
	open: boolean;
	/** The conversation shown; undefined is a new one. */
	conversationId: string | undefined;
	/** Saved offers added as context ("Plan what to ask" from Offers); stored per conversation once it starts. */
	offerIds: string[];
	/** The last dashboard page shown outside Coach full screen, which its collapse button returns to. */
	lastHref: string | undefined;
};

type CoachPanelActions = {
	setOpen: (open: boolean) => void;
	toggle: () => void;
	/** Opens the panel; with a conversation (or `null` for a new one), shows it, with these offers as context. */
	openCoach: (options?: { conversationId?: string | null | undefined; offerIds?: string[] | undefined }) => void;
	/** Shows a conversation (undefined: a new one). A new one starts without offers. */
	showConversation: (conversationId: string | undefined, offerIds?: string[]) => void;
	setLastHref: (href: string) => void;
};

/** The dashboard's coach panel: open from the navbar on every page, kept open while moving between pages. */
export const useCoachPanelStore = create<CoachPanelState & CoachPanelActions>((set) => ({
	open: false,
	conversationId: undefined,
	offerIds: [],
	lastHref: undefined,

	setOpen: (open) => set({ open }),
	toggle: () => set((state) => ({ open: !state.open })),
	openCoach: (options) =>
		set((state) => {
			if (!options || options.conversationId === undefined) {
				return options?.offerIds?.length
					? { open: true, conversationId: undefined, offerIds: options.offerIds }
					: { open: true, conversationId: state.conversationId, offerIds: state.offerIds };
			}
			return { open: true, conversationId: options.conversationId ?? undefined, offerIds: options.offerIds ?? [] };
		}),
	showConversation: (conversationId, offerIds = []) => set({ conversationId, offerIds }),
	setLastHref: (lastHref) => set({ lastHref }),
}));

/** Opens the coach panel from anywhere (command palette, links). */
export const openCoachPanel = (options?: Parameters<CoachPanelActions["openCoach"]>[0]) =>
	useCoachPanelStore.getState().openCoach(options);
