import type { RouterOutput } from "@/libs/orpc/client";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { ORPCError } from "@orpc/client";
import { produce } from "immer";
import { create } from "zustand/react";
import { writablePortfolioDataSchema } from "@rezumi/schema/portfolio/data";
import { generateId } from "@rezumi/utils/string";
import { client } from "@/libs/orpc/client";

/** The portfolio as the API returns it. */
export type PortfolioRecord = NonNullable<RouterOutput["portfolio"]["get"]["portfolio"]>;

/**
 * `invalid`: a field holds something the server would refuse (fields normally stop that before it reaches here), so
 * nothing is sent until it's fixed. `conflict`: the portfolio was saved somewhere else since this editor loaded it;
 * saving stops until it's reloaded, so neither copy silently overwrites the other.
 */
export type PortfolioSaveStatus = "saved" | "saving" | "error" | "invalid" | "conflict";

type EditOptions = {
	/**
	 * The field being edited: edits to the same field within a second merge into one undo step, so typing a sentence
	 * undoes as a whole. Without one, every edit is a step of its own.
	 */
	key?: string;
	/**
	 * Items moved or removed: fields that keep their own copy of a value (addresses, rich text) start over from the
	 * data, since the item under them changed.
	 */
	structural?: boolean;
};

type PortfolioEditorState = {
	portfolio: PortfolioRecord | null;
	status: PortfolioSaveStatus;
	/** Edits not sent yet. */
	dirty: boolean;
	/** Why the data can't be sent while `status` is `invalid`. */
	problem: string | null;
	undoStack: PortfolioData[];
	redoStack: PortfolioData[];
	/** One editing visit; a save that returns after the editor moved on is ignored. */
	sessionId: string;
	/**
	 * Counts data swapped in from outside the fields (loading, undo, redo). Editors that keep their own copy of a value
	 * (rich text) start over from the data when it changes.
	 */
	revision: number;
};

type PortfolioEditorActions = {
	load: (portfolio: PortfolioRecord) => void;
	/** Changes the data and schedules a save. */
	edit: (recipe: (draft: Draft<PortfolioData>) => void, options?: EditOptions) => void;
	undo: () => void;
	redo: () => void;
	/** Saves everything edited so far. False when it couldn't (the edits stay for the next try). */
	flush: () => Promise<boolean>;
	/** Takes the settings the server returned (published, search engines, source resume), keeping the data as edited. */
	applySettings: (portfolio: PortfolioRecord) => void;
	/**
	 * Takes data the server changed and saved (works imported from the resume): it becomes the edited data, and Undo
	 * goes back to before it. Call after `flush`, so no edit is waiting.
	 */
	applyServerEdit: (portfolio: PortfolioRecord) => void;
	reset: () => void;
};

export type PortfolioEditorStore = PortfolioEditorState & PortfolioEditorActions;

/** Typing pauses this long before a save; the API allows 60 saves a minute. */
export const PORTFOLIO_SAVE_DELAY_MS = 800;
const COALESCE_MS = 1000;
const MAX_HISTORY = 100;

let timer: ReturnType<typeof setTimeout> | undefined;
let inflight: Promise<void> | null = null;
let lastEdit: { key: string | undefined; at: number } = { key: undefined, at: 0 };

const initialState = (): PortfolioEditorState => ({
	portfolio: null,
	status: "saved",
	dirty: false,
	problem: null,
	undoStack: [],
	redoStack: [],
	sessionId: generateId(),
	revision: 0,
});

/** The first problem a save would be refused for, in words, or null when the data can be sent. */
function portfolioDataProblem(data: PortfolioData): string | null {
	const result = writablePortfolioDataSchema.safeParse(data);
	if (result.success) return null;
	const [issue] = result.error.issues;
	return issue ? issue.message : "";
}

export const usePortfolioEditorStore = create<PortfolioEditorStore>()((set, get) => {
	const schedule = () => {
		clearTimeout(timer);
		timer = setTimeout(() => void get().flush(), PORTFOLIO_SAVE_DELAY_MS);
	};

	/** Swaps in other data (an edit, undo or redo) and marks it for saving. */
	const replaceData = (
		data: PortfolioData,
		stacks: Pick<PortfolioEditorState, "undoStack" | "redoStack">,
		fromOutside = false,
	) => {
		set((state) =>
			state.portfolio
				? {
						portfolio: { ...state.portfolio, data },
						...stacks,
						revision: fromOutside ? state.revision + 1 : state.revision,
						dirty: true,
						status: state.status === "conflict" ? "conflict" : "saving",
					}
				: state,
		);
		schedule();
	};

	return {
		...initialState(),

		load: (portfolio) => {
			clearTimeout(timer);
			lastEdit = { key: undefined, at: 0 };
			set((state) => ({ ...initialState(), portfolio, revision: state.revision + 1 }));
		},

		edit: (recipe, options = {}) => {
			const { portfolio, undoStack } = get();
			if (!portfolio) return;
			const data = produce(portfolio.data, recipe);
			if (data === portfolio.data) return;

			const now = Date.now();
			const merge = options.key !== undefined && lastEdit.key === options.key && now - lastEdit.at < COALESCE_MS;
			lastEdit = { key: options.key, at: now };
			replaceData(
				data,
				{ undoStack: merge ? undoStack : [...undoStack, portfolio.data].slice(-MAX_HISTORY), redoStack: [] },
				options.structural === true,
			);
		},

		undo: () => {
			const { portfolio, undoStack, redoStack } = get();
			const previous = undoStack.at(-1);
			if (!portfolio || !previous) return;
			lastEdit = { key: undefined, at: 0 };
			replaceData(previous, { undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, portfolio.data] }, true);
		},

		redo: () => {
			const { portfolio, undoStack, redoStack } = get();
			const next = redoStack.at(-1);
			if (!portfolio || !next) return;
			lastEdit = { key: undefined, at: 0 };
			replaceData(next, { undoStack: [...undoStack, portfolio.data], redoStack: redoStack.slice(0, -1) }, true);
		},

		flush: async () => {
			const { sessionId } = get();
			clearTimeout(timer);
			if (inflight) await inflight;
			if (get().sessionId !== sessionId) return false;

			const { portfolio, dirty, status } = get();
			if (!portfolio || status === "conflict") return false;
			if (!dirty) return status === "saved";

			const submitted = portfolio.data;
			const problem = portfolioDataProblem(submitted);
			if (problem !== null) {
				set({ status: "invalid", problem });
				return false;
			}

			const current = (state: PortfolioEditorStore) => state.sessionId === sessionId && state.portfolio !== null;
			set({ dirty: false, status: "saving", problem: null });
			inflight = (async () => {
				try {
					const saved = await client.portfolio.update({ data: submitted, expectedUpdatedAt: portfolio.updatedAt });
					// What was typed stays as typed (the server cleans rich text as it stores it), and so does anything
					// typed while this save was on its way.
					set((state) =>
						current(state) && state.portfolio
							? {
									portfolio: { ...saved, data: state.portfolio.data },
									status: state.dirty ? "saving" : "saved",
								}
							: state,
					);
				} catch (error) {
					const conflict = error instanceof ORPCError && error.code === "PORTFOLIO_VERSION_CONFLICT";
					set((state) => (current(state) ? { dirty: true, status: conflict ? "conflict" : "error" } : state));
				} finally {
					inflight = null;
				}
			})();
			await inflight;

			if (get().sessionId !== sessionId) return false;
			if (get().status === "saving" && get().dirty) return get().flush();
			return get().status === "saved";
		},

		applySettings: (portfolio) =>
			set((state) =>
				state.portfolio
					? {
							// Settings keep the data's version (`updatedAt`) as it was, so pending edits still save.
							portfolio: { ...portfolio, data: state.portfolio.data, updatedAt: state.portfolio.updatedAt },
						}
					: state,
			),

		applyServerEdit: (portfolio) => {
			const current = get().portfolio;
			if (!current) return;
			lastEdit = { key: undefined, at: 0 };
			set((state) => ({
				portfolio,
				undoStack: [...state.undoStack, current.data].slice(-MAX_HISTORY),
				redoStack: [],
				revision: state.revision + 1,
				dirty: false,
				status: "saved",
				problem: null,
			}));
		},

		reset: () => {
			clearTimeout(timer);
			lastEdit = { key: undefined, at: 0 };
			set((state) => ({ ...initialState(), revision: state.revision + 1 }));
		},
	};
});

/** The portfolio data being edited. Only use inside the editor, where a portfolio is always loaded. */
export function usePortfolioData(): PortfolioData {
	const data = usePortfolioEditorStore((state) => state.portfolio?.data);
	if (!data) throw new Error("No portfolio is open in the editor.");
	return data;
}

export function usePortfolioRecord(): PortfolioRecord {
	const portfolio = usePortfolioEditorStore((state) => state.portfolio);
	if (!portfolio) throw new Error("No portfolio is open in the editor.");
	return portfolio;
}

export const editPortfolio = (recipe: (draft: Draft<PortfolioData>) => void, options?: EditOptions) =>
	usePortfolioEditorStore.getState().edit(recipe, options);
