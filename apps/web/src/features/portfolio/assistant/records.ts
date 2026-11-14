import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { create } from "zustand/react";

// What this visit did with the assistant's changes, apart from `apply.ts` so the editor can forget them on leaving
// without loading the edit engine.

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

/** Per conversation call; kept outside the data so it's never an undo step, and gone when the editor is left. */
export const usePortfolioChanges = create<{ calls: Readonly<Record<string, CallRecord>> }>(() => ({ calls: {} }));

export const callKey = (call: Pick<ChangeCall, "messageId" | "toolCallId">) => `${call.messageId}:${call.toolCallId}`;

/** Leaving the editor: its history goes, so cards fall back to what the conversation recorded. */
export function forgetPortfolioChanges(): void {
	usePortfolioChanges.setState({ calls: {} });
}
