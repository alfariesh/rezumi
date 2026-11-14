import type { CallRecord, ChangeCall } from "./records";
import type { EditPortfolioOutput, PortfolioEditCard } from "@rezumi/ai/tools/agent-tool-contracts";
import type { PortfolioEditResult } from "@rezumi/portfolio/edits";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { editPortfolioOutputSchema } from "@rezumi/ai/tools/agent-tool-contracts";
import { applyPortfolioEdits } from "@rezumi/portfolio/edits";
import { editPortfolioTo } from "../editor/assign";
import { usePortfolioEditorStore } from "../editor/store";
import { fillInMedia } from "./media";
import { callKey, usePortfolioChanges } from "./records";
import { client } from "@/libs/orpc/client";

// The assistant's changes in the editor (`phase-14-asisten-ai.md` §5). The server applies each `edit_portfolio` call
// to its own copy and returns the edits resolved; here they're replayed on the editor's data as one undo step, so the
// editor stays the only writer (its autosave saves them) and the page updates at once. Each call can then be undone
// and redone from its card. Statuses go back to the conversation: accepted = applied here, rejected = undone (or
// couldn't be applied), pending = not applied yet.

/** Card ids applied during this page's life: each is applied by itself at most once, whatever re-renders. */
const appliedOnce = new Set<string>();
/** Calls already looked at for applying by themselves, so a streaming reply doesn't parse every card on each chunk. */
const considered = new Set<string>();

type ApplyOptions = {
	/** After a status reached the conversation: what it counts (edits applied) is read again. */
	onRecorded?: (() => void) | undefined;
};

/** A message part, as far as finding an `edit_portfolio` output in it goes. */
type ToolPartLike = { type: string; state?: string; toolCallId?: string; output?: unknown };

const currentData = () => usePortfolioEditorStore.getState().portfolio?.data ?? null;

function setRecord(key: string, record: CallRecord) {
	usePortfolioChanges.setState((state) => ({ calls: { ...state.calls, [key]: record } }));
}

/** Applies resolved edits; an engine that throws (a bug) fails them all instead of the editor. */
function replay(data: PortfolioData, edits: readonly PortfolioEdit[]): PortfolioEditResult {
	try {
		return applyPortfolioEdits(data, edits, { mode: "replay" });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { data, applied: [], failed: edits.map((_, index) => ({ index, error: message })) };
	}
}

/** Tells the conversation what happened to the call's edits; quiet when it can't (the card shows the truth here). */
async function recordStatus(
	call: ChangeCall,
	edits: { id: string; status: PortfolioEditCard["status"] }[],
	options: ApplyOptions,
) {
	if (edits.length === 0) return;
	try {
		await client.agent.messages.setEditStatus({ ...call, edits });
		options.onRecorded?.();
	} catch {
		// The status is a record for past conversations; the change itself is in the editor either way.
	}
}

/**
 * Applies a call's changes as one undo step: Apply on a card from before this visit, Redo after Undo, and the
 * automatic apply of a call that just arrived. Edits whose target is gone are reported on the card.
 */
export function applyCall(call: ChangeCall, cards: readonly PortfolioEditCard[], options: ApplyOptions = {}): void {
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
		void fillInMedia(
			result.applied.map((entry) => entry.edit),
			(previous, next) => {
				const latest = usePortfolioChanges.getState().calls[key];
				if (latest?.state === "applied" && latest.applied === previous) setRecord(key, { ...latest, applied: next });
			},
		);
}

/** Takes a call's changes back as one undo step (the editor's own Undo when nothing changed since). */
export function undoCall(call: ChangeCall, options: ApplyOptions = {}): void {
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
export function editCallOf(
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
export function autoApplyPart(
	threadId: string,
	messageId: string,
	part: ToolPartLike,
	options: ApplyOptions = {},
): void {
	if (part.type !== "tool-edit_portfolio" || part.state !== "output-available" || !part.toolCallId) return;
	const key = callKey({ messageId, toolCallId: part.toolCallId });
	if (considered.has(key)) return;
	considered.add(key);
	const found = editCallOf(threadId, messageId, part);
	if (!found) return;
	const pending = found.output.edits.filter((card) => card.status === "pending");
	if (pending.length === 0 || found.output.edits.some((card) => appliedOnce.has(card.id))) return;
	applyCall(found.call, pending, options);
}

/** Applies the changes in replies that streamed in during this visit (the caller leaves out those it opened with). */
export function autoApplyMessages(
	threadId: string,
	messages: readonly { id: string; role: string; parts: readonly ToolPartLike[] }[],
	options: ApplyOptions = {},
): void {
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		for (const part of message.parts) autoApplyPart(threadId, message.id, part, options);
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
