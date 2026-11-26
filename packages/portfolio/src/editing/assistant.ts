import type { PortfolioEditResult } from "../edits/types";
import type { EditOptions } from "./store";
import type { EditPortfolioOutput, PortfolioEditCard } from "@rezumi/ai/tools/agent-tool-contracts";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import type { Draft } from "immer";
import { create } from "zustand/react";
import { editPortfolioOutputSchema } from "@rezumi/ai/tools/agent-tool-contracts";
import { runPortfolioEdits } from "../edits/apply";
import { assignChanged } from "./assign";

/** One `edit_portfolio` call in a conversation. */
export type ChangeCall = { threadId: string; messageId: string; toolCallId: string };

/** What this visit did with a call's changes. */
export type CallRecord = {
	/** Applied: in the editor (Undo takes them back). Undone: taken back (Redo applies them again). */
	state: "applied" | "undone";
	/** The ids of the call's edits that applied. */
	appliedIds: readonly string[];
	/** Edits that take back what applied, in the order to apply them. */
	inverse: readonly PortfolioEdit[];
	/** The portfolio before the changes applied: what they removed or hid is named from it. */
	before: PortfolioData;
	/**
	 * The data right after the changes applied, and right after Undo: when nothing changed since, Undo and Redo use the
	 * editor's own history, so its Undo and Redo keep lining up with the card's.
	 */
	applied: PortfolioData | null;
	undone: PortfolioData | null;
	/** Why some changes couldn't be applied or taken back here (the engine's words). */
	failed: readonly string[];
};

export const callKey = (call: ChangeCall) => `${call.threadId}:${call.messageId}:${call.toolCallId}`;

type ApplyOptions = {
	/** After a status reached the conversation: what it counts (edits applied) is read again. */
	onRecorded?: (() => void) | undefined;
};

/** A message part, as far as finding an `edit_portfolio` output in it goes. */
export type ToolPartLike = { type: string; state?: string; toolCallId?: string; output?: unknown };

/** Applies resolved edits; an engine that throws (a bug) fails them all instead of the editor. */
function replay(data: PortfolioData, edits: readonly PortfolioEdit[]): PortfolioEditResult {
	try {
		return runPortfolioEdits(data, edits, { mode: "replay" });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { data, applied: [], failed: edits.map((_, index) => ({ index, error: message })) };
	}
}

/** What a card offers, from what this visit did with it, else from the statuses the conversation recorded. */
export type CallStatus =
	/** In the editor; `canUndo` while this visit applied it (the editor's history from before is gone). */
	| { kind: "applied"; canUndo: boolean }
	/** Taken back: Redo applies it again. */
	| { kind: "undone" }
	/** Never applied (the tab closed mid-reply, say): Apply. */
	| { kind: "pending" }
	/** Nothing in it could be applied here. */
	| { kind: "failed" };

export function callStatus(record: CallRecord | undefined, cards: readonly PortfolioEditCard[]): CallStatus {
	// Every edit was refused before it reached the editor (the card lists why).
	if (cards.length === 0) return { kind: "failed" };
	if (record) {
		if (record.state === "undone") return { kind: "undone" };
		return record.appliedIds.length > 0 ? { kind: "applied", canUndo: true } : { kind: "failed" };
	}
	if (cards.some((card) => card.status === "pending")) return { kind: "pending" };
	if (cards.some((card) => card.status === "accepted")) return { kind: "applied", canUndo: false };
	return { kind: "undone" };
}
type AssistantAdapter = {
	getState: () => {
		portfolio: { data: PortfolioData } | null;
		undoStack: readonly PortfolioData[];
		redoStack: readonly PortfolioData[];
		undo: () => void;
		redo: () => void;
		edit: (recipe: (data: Draft<PortfolioData>) => void, options?: EditOptions) => void;
	};
	record: (call: ChangeCall, edits: { id: string; status: PortfolioEditCard["status"] }[]) => Promise<unknown>;
	fillInMedia?: (
		edits: PortfolioEdit[],
		onUpdated: (before: PortfolioData, next: PortfolioData) => void,
	) => Promise<void>;
};

export function createPortfolioAssistant(adapter: AssistantAdapter) {
	const usePortfolioChanges = create<{ calls: Readonly<Record<string, CallRecord>> }>(() => ({ calls: {} }));
	const usePortfolioEditorStore = adapter;

	function editPortfolioTo(next: PortfolioData) {
		const store = adapter.getState();
		const before = store.portfolio?.data;
		if (before) store.edit((draft) => assignChanged(draft, before, next), { structural: true });
	}
	/** Card ids applied during this page's life: each is applied by itself at most once, whatever re-renders. */
	const appliedOnce = new Set<string>();
	/** Calls already looked at for applying by themselves, so a streaming reply doesn't parse every card on each chunk. */
	const considered = new Set<string>();

	const currentData = () => usePortfolioEditorStore.getState().portfolio?.data ?? null;

	function setRecord(key: string, record: CallRecord) {
		usePortfolioChanges.setState((state) => ({ calls: { ...state.calls, [key]: record } }));
	}

	/** Tells the conversation what happened to the call's edits; quiet when it can't (the card shows the truth here). */
	async function recordStatus(
		call: ChangeCall,
		edits: { id: string; status: PortfolioEditCard["status"] }[],
		options: ApplyOptions,
	) {
		if (edits.length === 0) return;
		try {
			await adapter.record(call, edits);
			options.onRecorded?.();
		} catch {
			// The status is a record for past conversations; the change itself is in the editor either way.
		}
	}

	/**
	 * Applies a call's changes as one undo step: Apply on a card from before this visit, Redo after Undo, and the
	 * automatic apply of a call that just arrived. Edits whose target is gone are reported on the card.
	 */
	function applyCall(call: ChangeCall, cards: readonly PortfolioEditCard[], options: ApplyOptions = {}): void {
		const store = usePortfolioEditorStore.getState();
		const before = store.portfolio?.data;
		if (!before || cards.length === 0) return;
		const key = callKey(call);
		for (const card of cards) appliedOnce.add(card.id);

		// Redo straight after Undo, with nothing changed between: the editor's own Redo.
		const record = usePortfolioChanges.getState().calls[key];
		if (
			record?.state === "undone" &&
			record.undone === before &&
			record.applied &&
			store.redoStack.at(-1) === record.applied
		) {
			store.redo();
			setRecord(key, { ...record, state: "applied", applied: currentData(), failed: [] });
			void recordStatus(
				call,
				record.appliedIds.map((id) => ({ id, status: "accepted" as const })),
				options,
			);
			return;
		}

		const result = replay(
			before,
			cards.map((card) => card.edit),
		);
		if (result.applied.length > 0) editPortfolioTo(result.data);
		const appliedIndexes = new Set(result.applied.map((entry) => entry.index));
		const appliedIds = cards.filter((_, index) => appliedIndexes.has(index)).map((card) => card.id);
		setRecord(key, {
			state: "applied",
			appliedIds,
			inverse: result.applied.toReversed().flatMap((entry) => entry.inverse),
			before,
			applied: result.applied.length > 0 ? currentData() : null,
			undone: null,
			failed: result.failed.map((failure) => failure.error),
		});
		void recordStatus(
			call,
			cards.map((card) => ({ id: card.id, status: appliedIds.includes(card.id) ? "accepted" : "rejected" })),
			options,
		);

		// Video and Embed blocks get the picture a pasted link gets (never Link blocks: `media.ts`). The fill-ins belong to
		// the change's step.
		if (result.applied.length > 0)
			void adapter.fillInMedia?.(
				result.applied.map((entry) => entry.edit),
				(previous, next) => {
					const latest = usePortfolioChanges.getState().calls[key];
					if (latest?.state === "applied" && latest.applied === previous) setRecord(key, { ...latest, applied: next });
				},
			);
	}

	/** Takes a call's changes back as one undo step (the editor's own Undo when nothing changed since). */
	function undoCall(call: ChangeCall, options: ApplyOptions = {}): void {
		const key = callKey(call);
		const record = usePortfolioChanges.getState().calls[key];
		const store = usePortfolioEditorStore.getState();
		const current = store.portfolio?.data;
		if (!record || record.state !== "applied" || record.appliedIds.length === 0 || !current) return;

		if (record.applied === current && store.undoStack.length > 0) {
			store.undo();
			setRecord(key, { ...record, state: "undone", undone: currentData(), failed: [] });
		} else {
			const result = replay(current, record.inverse);
			if (result.applied.length > 0) editPortfolioTo(result.data);
			setRecord(key, {
				...record,
				state: "undone",
				undone: currentData(),
				failed: result.failed.map((failure) => failure.error),
			});
		}
		void recordStatus(
			call,
			record.appliedIds.map((id) => ({ id, status: "rejected" as const })),
			options,
		);
	}

	/** The edit_portfolio call a message part holds, once its output is in; null for any other part. */
	function editCallOf(
		threadId: string,
		messageId: string,
		part: ToolPartLike,
	): { call: ChangeCall; output: EditPortfolioOutput } | null {
		if (part.type !== "tool-edit_portfolio" || part.state !== "output-available" || !part.toolCallId) return null;
		const parsed = editPortfolioOutputSchema.safeParse(part.output);
		return parsed.success ? { call: { threadId, messageId, toolCallId: part.toolCallId }, output: parsed.data } : null;
	}

	/**
	 * A call that streamed in during this visit goes on the page at once: only once per page, and only when its edits
	 * are still pending (one recorded elsewhere was dealt with there).
	 */
	function autoApplyPart(threadId: string, messageId: string, part: ToolPartLike, options: ApplyOptions = {}): void {
		if (part.type !== "tool-edit_portfolio" || part.state !== "output-available" || !part.toolCallId) return;
		const key = callKey({ threadId, messageId, toolCallId: part.toolCallId });
		if (considered.has(key)) return;
		considered.add(key);
		const found = editCallOf(threadId, messageId, part);
		if (!found) return;
		const pending = found.output.edits.filter((card) => card.status === "pending");
		if (pending.length === 0 || found.output.edits.some((card) => appliedOnce.has(card.id))) return;
		applyCall(found.call, pending, options);
	}

	/** Applies the changes in replies that streamed in during this visit (the caller leaves out those it opened with). */
	function autoApplyMessages(
		threadId: string,
		messages: readonly { id: string; role: string; parts: readonly ToolPartLike[] }[],
		options: ApplyOptions = {},
	): void {
		for (const message of messages) {
			if (message.role !== "assistant") continue;
			for (const part of message.parts) autoApplyPart(threadId, message.id, part, options);
		}
	}

	function forgetPortfolioChanges() {
		usePortfolioChanges.setState({ calls: {} });
	}

	return {
		usePortfolioChanges,
		forgetPortfolioChanges,
		applyCall,
		undoCall,
		editCallOf,
		autoApplyPart,
		autoApplyMessages,
	};
}
