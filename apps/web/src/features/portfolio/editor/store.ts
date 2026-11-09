import type { PortfolioRetryReason, PortfolioSaveFailure, PortfolioSaveProblem } from "./save-failure";
import type { RouterOutput } from "@/libs/orpc/client";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { ORPCError } from "@orpc/client";
import { isEqual } from "es-toolkit";
import { produce } from "immer";
import { create } from "zustand/react";
import { writablePortfolioDataSchema } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS, portfolioDataBytes } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";
import { classifySaveError, saveRetryDelay } from "./save-failure";
import { getPlanProblem } from "@/features/billing/plan";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { client } from "@/libs/orpc/client";

/** The portfolio as the API returns it. */
export type PortfolioRecord = NonNullable<RouterOutput["portfolio"]["get"]["portfolio"]>;

/**
 * - `saved`: the server has everything.
 * - `saving`: edits wait for a pause in typing, or are on their way.
 * - `error`: a save failed in a way that may pass by itself (the connection, the server, a rate limit). The edits stay,
 *   and saving is tried again after a growing pause, at once when the browser is back online, and on Retry.
 * - `invalid`: the server would refuse the data, or did; `problem` says why and where. Nothing is sent until it
 *   changes.
 * - `conflict`: the portfolio was saved somewhere else since this editor loaded it, with other data. Saving stops
 *   until the person picks a version (`conflict`), so neither copy silently overwrites the other.
 * - `gone`: the portfolio was deleted, or portfolios were switched off for the account (`problem`). Nothing can be
 *   saved.
 */
export type PortfolioSaveStatus = "saved" | "saving" | "error" | "invalid" | "conflict" | "gone";

type PortfolioConflict = {
	/** The version saved elsewhere, when it could be read. */
	server: PortfolioRecord | null;
	/** That version's `updatedAt`: "Keep my version" saves on top of it. Null when the server didn't name it. */
	updatedAt: Date | null;
};

type PortfolioRetry = {
	/** Failed tries in a row. */
	attempt: number;
	/** When the next try starts by itself (milliseconds, `Date.now()`). */
	at: number;
	reason: PortfolioRetryReason;
};

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
	/**
	 * False: the edit is no undo step of its own and what can be redone stays. For data that belongs to an earlier
	 * step, such as the map pictures made for the place that step chose: Undo and Redo then move between steps with it.
	 */
	history?: boolean;
};

type PortfolioEditorState = {
	portfolio: PortfolioRecord | null;
	status: PortfolioSaveStatus;
	/** Edits not saved yet. */
	dirty: boolean;
	/** Why nothing is saved while `status` is `invalid` or `gone`. */
	problem: PortfolioSaveProblem | null;
	/** While `status` is `error`: the failed tries and the next one. */
	retry: PortfolioRetry | null;
	/** While `status` is `conflict`: the other version. */
	conflict: PortfolioConflict | null;
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
	/**
	 * Saves everything edited so far, after any save already on its way, and says whether it all reached the server.
	 * False when something isn't saved (the edits stay for the next try).
	 */
	flush: () => Promise<boolean>;
	/** Takes the settings the server returned (published, search engines, source resume), keeping the data as edited. */
	applySettings: (portfolio: PortfolioRecord) => void;
	/**
	 * Takes data the server changed and saved (works imported from the resume): it becomes the edited data, and Undo
	 * goes back to before it. Call after `flush`, so no edit is waiting.
	 */
	applyServerEdit: (portfolio: PortfolioRecord) => void;
	/** After a conflict: saves this editor's data over the version saved elsewhere. */
	keepMine: () => Promise<boolean>;
	/**
	 * Leaving the editor: edits still waiting for the pause in typing are sent on their own, then the editor starts
	 * over. Edits that already failed to save are dropped (leaving asked about them first).
	 */
	close: () => void;
	reset: () => void;
};

export type PortfolioEditorStore = PortfolioEditorState & PortfolioEditorActions;

/** Typing pauses this long before a save; the API allows 60 saves a minute. */
export const PORTFOLIO_SAVE_DELAY_MS = 800;
const COALESCE_MS = 1000;
const MAX_HISTORY = 100;
/** Copies of sent data kept for telling a lost answer from a real conflict. */
const MAX_UNCONFIRMED = 5;
/** A save without an answer by then is given up and tried again, so it can't hold up every later one. */
const SAVE_TIMEOUT_MS = 30_000;

/** Saves the data at a version, giving up after `SAVE_TIMEOUT_MS`. */
async function update(data: PortfolioData, expectedUpdatedAt: Date) {
	const abort = new AbortController();
	const timeout = setTimeout(() => abort.abort(), SAVE_TIMEOUT_MS);
	try {
		return await client.portfolio.update({ data, expectedUpdatedAt }, { signal: abort.signal });
	} finally {
		clearTimeout(timeout);
	}
}

type SendOutcome = "saved" | "again" | "failed";

let timer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
/** The save on its way: it resolves with the version it made, or null when it failed. */
let inflight: Promise<Date | null> | null = null;
let lastEdit: { key: string | undefined; at: number } = { key: undefined, at: 0 };
/**
 * Data the server may hold at a version this editor hasn't seen: what it had when the editor loaded or last saved,
 * and what was sent without an answer. A conflict whose server copy is one of these isn't a real one.
 */
let known: PortfolioData[] = [];
/**
 * The plan problem the dialog last explained: while a refused change stays in the draft, each pause in typing is
 * refused again, and the save status says so; the dialog opens once, until a save goes through.
 */
let explainedPlanProblem: string | null = null;

function explainPlanProblem(error: unknown) {
	const problem = getPlanProblem(error);
	if (!problem) return;
	const key = problem.kind === "feature" ? problem.feature : problem.limit;
	if (key === explainedPlanProblem) return;
	explainedPlanProblem = key;
	openPlanDialog(problem);
}

/** Data the server refused and why, not sent again until it changes. */
let refused: { data: PortfolioData; problem: PortfolioSaveProblem } | null = null;

const initialState = (): PortfolioEditorState => ({
	portfolio: null,
	status: "saved",
	dirty: false,
	problem: null,
	retry: null,
	conflict: null,
	undoStack: [],
	redoStack: [],
	sessionId: generateId(),
	revision: 0,
});

/** The first place the server's schema would refuse, or null when it would take the data. */
function schemaProblem(data: PortfolioData): PortfolioSaveProblem | null {
	const result = writablePortfolioDataSchema.safeParse(data);
	if (result.success) return null;
	const path = result.error.issues[0]?.path ?? [];
	return { kind: "field", path: path.filter((segment) => typeof segment !== "symbol") };
}

/** Why the server would refuse the data, checked before it's sent: its schema, then its size. */
function localProblem(data: PortfolioData): PortfolioSaveProblem | null {
	const problem = schemaProblem(data);
	if (problem) return problem;
	// The server measures the data after cleaning its rich text, which rarely makes it smaller.
	const bytes = portfolioDataBytes(data);
	const max = PORTFOLIO_LIMITS.dataBytes;
	return bytes > max ? { kind: "too-large", bytes, max } : null;
}

/** Whether the server's copy is one of the copies this editor knows; it cleans rich text, so cleaned copies compare. */
async function holdsOneOf(server: PortfolioData, candidates: readonly PortfolioData[]): Promise<boolean> {
	if (candidates.some((candidate) => isEqual(candidate, server))) return true;
	const { sanitizePortfolioData } = await import("@rezumi/portfolio/rich-text");
	const normal = (data: PortfolioData): unknown => JSON.parse(JSON.stringify(sanitizePortfolioData(data)));
	const target = normal(server);
	return candidates.some((candidate) => isEqual(normal(candidate), target));
}

export const usePortfolioEditorStore = create<PortfolioEditorStore>()((set, get) => {
	const isCurrent = (sessionId: string) => get().sessionId === sessionId && get().portfolio !== null;

	const retryNow = () => {
		if (get().status === "error") void get().flush();
	};

	const stopRetrying = () => {
		clearTimeout(retryTimer);
		if (typeof window !== "undefined") window.removeEventListener("online", retryNow);
	};

	const schedule = () => {
		clearTimeout(timer);
		// While a failed save waits to be tried again (a rate limit, say), edits wait with it.
		const retryAt = get().retry?.at ?? 0;
		timer = setTimeout(() => void get().flush(), Math.max(PORTFOLIO_SAVE_DELAY_MS, retryAt - Date.now()));
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
						// A conflict or a deleted portfolio waits for the person; a failed save keeps saying so until it's tried.
						status:
							state.status === "conflict" || state.status === "gone" || state.status === "error"
								? state.status
								: "saving",
					}
				: state,
		);
		schedule();
	};

	/** The portfolio was saved elsewhere: a lost answer or a settings change is taken quietly; other data is asked about. */
	const resolveConflict = async (
		failure: Extract<PortfolioSaveFailure, { kind: "conflict" }>,
		submitted: PortfolioData,
		sessionId: string,
	): Promise<SendOutcome> => {
		let result: RouterOutput["portfolio"]["get"] | null = null;
		try {
			result = await client.portfolio.get();
		} catch {
			// Unread: the person decides without seeing it.
		}
		if (!isCurrent(sessionId)) return "failed";
		if (result && (!result.enabled || !result.portfolio)) {
			const code = result.enabled ? "NOT_FOUND" : "PORTFOLIO_DISABLED";
			set({ dirty: true, status: "gone", problem: { kind: "gone", code }, retry: null });
			return "failed";
		}

		const server = result?.portfolio ?? null;
		if (server && (await holdsOneOf(server.data, [...known, submitted]))) {
			if (!isCurrent(sessionId)) return "failed";
			// The data there is what this editor saved or loaded; only the version moved on. Save on top of it.
			known = [server.data];
			set((state) =>
				state.portfolio
					? { portfolio: { ...server, data: state.portfolio.data }, dirty: true, status: "saving" }
					: state,
			);
			return "again";
		}

		set({
			dirty: true,
			status: "conflict",
			conflict: { server, updatedAt: server?.updatedAt ?? failure.updatedAt },
			retry: null,
		});
		return "failed";
	};

	/** Marks the save as failed in a way that may pass, and tries again after a growing wait or once back online. */
	const retryLater = (reason: PortfolioRetryReason, notBefore?: number) => {
		const attempt = (get().retry?.attempt ?? 0) + 1;
		const now = Date.now();
		const delay = saveRetryDelay(attempt, notBefore, now);
		set({ dirty: true, status: "error", retry: { attempt, at: now + delay, reason } });
		stopRetrying();
		retryTimer = setTimeout(retryNow, delay);
		if (typeof window !== "undefined") window.addEventListener("online", retryNow);
	};

	/** What a failed save leaves: a conflict reads the server's copy first, so it answers later. */
	const fail = (error: unknown, submitted: PortfolioData, sessionId: string): SendOutcome | Promise<SendOutcome> => {
		if (!isCurrent(sessionId)) return "failed";
		const failure = classifySaveError(error);
		switch (failure.kind) {
			case "conflict":
				return resolveConflict(failure, submitted, sessionId);
			case "retry": {
				if (failure.maybeSaved) known = [...known, submitted].slice(-MAX_UNCONFIRMED);
				retryLater(failure.reason, failure.notBefore);
				return "failed";
			}
			case "problem": {
				let { problem } = failure;
				if (problem.kind === "gone") {
					set({ dirty: true, status: "gone", problem, retry: null });
					return "failed";
				}
				// Refused without saying where: the schema here may know.
				if (problem.kind === "refused" && error instanceof ORPCError && error.code === "BAD_REQUEST")
					problem = schemaProblem(submitted) ?? problem;
				refused = { data: submitted, problem };
				if (problem.kind === "refused") explainPlanProblem(error);
				set({ dirty: true, status: "invalid", problem, retry: null });
				return "failed";
			}
		}
	};

	/** Sends the data as it is now. Only one save is ever on its way: `flush` waits for it before calling this. */
	const send = async (sessionId: string): Promise<SendOutcome> => {
		stopRetrying();
		const { portfolio } = get();
		if (!portfolio) return "failed";
		const submitted = portfolio.data;
		if (refused && submitted === refused.data) {
			// Undo brought back what the server refused, so its reason applies again.
			set({ status: "invalid", problem: refused.problem, retry: null });
			return "failed";
		}
		const problem = localProblem(submitted);
		if (problem) {
			set({ status: "invalid", problem, retry: null });
			return "failed";
		}

		set({ dirty: false, status: "saving", problem: null });
		let outcome: SendOutcome = "failed";
		let request: Promise<Date | null> | null = null;
		request = (async () => {
			try {
				const saved = await update(submitted, portfolio.updatedAt);
				if (!isCurrent(sessionId)) return saved.updatedAt;
				outcome = "saved";
				known = [submitted];
				refused = null;
				explainedPlanProblem = null;
				// Only the version: what was typed stays as typed (the server cleans rich text as it stores it), anything
				// typed meanwhile stays, and so do settings changed while this save was on its way.
				set((state) =>
					state.portfolio
						? {
								portfolio: { ...state.portfolio, updatedAt: saved.updatedAt },
								status: state.dirty ? "saving" : "saved",
								retry: null,
							}
						: state,
				);
				return saved.updatedAt;
			} catch (error) {
				try {
					outcome = await fail(error, submitted, sessionId);
				} catch (unexpected) {
					// Reading the other copy failed in a way nothing expects (a module that didn't load, odd data): try the
					// save again later rather than stay "saving" with nothing left to do.
					console.error("Saving the portfolio failed unexpectedly", unexpected);
					if (isCurrent(sessionId)) retryLater("server");
					outcome = "failed";
				}
				return null;
			} finally {
				if (inflight === request) inflight = null;
			}
		})();
		inflight = request;
		await request;
		return outcome;
	};

	return {
		...initialState(),

		load: (portfolio) => {
			clearTimeout(timer);
			stopRetrying();
			lastEdit = { key: undefined, at: 0 };
			known = [portfolio.data];
			refused = null;
			explainedPlanProblem = null;
			set((state) => ({ ...initialState(), portfolio, revision: state.revision + 1 }));
		},

		edit: (recipe, options = {}) => {
			const { portfolio, undoStack, redoStack } = get();
			if (!portfolio) return;
			const data = produce(portfolio.data, recipe);
			if (data === portfolio.data) return;
			if (options.history === false) {
				// Nor does it end the typing a step is merging.
				replaceData(data, { undoStack, redoStack }, options.structural === true);
				return;
			}

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
			// A conflict taken quietly saves again; twice in a row means someone else keeps saving, so it's asked about.
			let quietConflicts = 0;
			for (;;) {
				// Whoever started the save on its way, everyone who asks waits for it and then for what's left.
				let waited = false;
				while (inflight) {
					waited = true;
					await inflight;
				}
				const state = get();
				if (state.sessionId !== sessionId || !state.portfolio) return false;
				if (state.status === "conflict" || state.status === "gone") return false;
				if (!state.dirty) return state.status === "saved";
				// The save waited for failed in a way that may pass: that's the answer, and the retry timer (or Retry) sends
				// again. After a refusal, edits made since go out (they may fix it); the refused data itself never does.
				if (waited && state.status === "error") return false;
				const outcome = await send(sessionId);
				if (outcome === "saved") continue;
				if (outcome === "again" && quietConflicts++ < 2) continue;
				if (outcome === "again") {
					set({ status: "conflict", conflict: { server: null, updatedAt: get().portfolio?.updatedAt ?? null } });
				}
				return false;
			}
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
			clearTimeout(timer);
			stopRetrying();
			lastEdit = { key: undefined, at: 0 };
			known = [portfolio.data];
			refused = null;
			set((state) => ({
				portfolio,
				undoStack: [...state.undoStack, current.data].slice(-MAX_HISTORY),
				redoStack: [],
				revision: state.revision + 1,
				dirty: false,
				status: "saved",
				problem: null,
				retry: null,
			}));
		},

		keepMine: () => {
			const { status, conflict, portfolio } = get();
			if (status !== "conflict" || !portfolio || !conflict?.updatedAt) return Promise.resolve(false);
			const updatedAt = conflict.updatedAt;
			known = conflict.server ? [conflict.server.data] : [];
			refused = null;
			set({
				portfolio: { ...(conflict.server ?? portfolio), data: portfolio.data, updatedAt },
				status: "saving",
				dirty: true,
				conflict: null,
				problem: null,
			});
			return get().flush();
		},

		close: () => {
			const { portfolio, dirty, status } = get();
			const leftover = portfolio && dirty && status === "saving" ? portfolio : null;
			const before = inflight;
			get().reset();
			if (!leftover) return;
			// Queued behind the save on its way, against the version that save makes, so the two never cross.
			let request: Promise<Date | null> | null = null;
			request = (async () => {
				try {
					const version = (before ? await before : null) ?? leftover.updatedAt;
					return (await update(leftover.data, version)).updatedAt;
				} catch {
					return null;
				} finally {
					if (inflight === request) inflight = null;
				}
			})();
			inflight = request;
		},

		reset: () => {
			clearTimeout(timer);
			stopRetrying();
			lastEdit = { key: undefined, at: 0 };
			known = [];
			refused = null;
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
