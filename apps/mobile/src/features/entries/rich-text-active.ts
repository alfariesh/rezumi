// The rich-text editor that has (or last had) focus on the screen, for the one toolbar docked above the keyboard.
import type { RefObject } from "react";
import type { EnrichedTextInputInstance, OnChangeStateEvent } from "react-native-enriched-html";
import { useSyncExternalStore } from "react";

/** "resume": bold, italic, lists, link, text style and Improve. "letter": bold, italic, underline and lists. */
export type RichTextTools = "resume" | "letter";

export type ActiveEditor = {
	ref: RefObject<EnrichedTextInputInstance | null>;
	tools: RichTextTools;
	focused: boolean;
	state: OnChangeStateEvent | null;
	selection: { start: number; end: number; text: string };
	/** Marks the next report as the result of a toolbar command or link, so it's saved even after focus moved. */
	command: () => void;
	/** The caret sits in a line with text, which Improve can work on. */
	canImprove: boolean;
	improve: () => void;
};

let active: ActiveEditor | null = null;
const listeners = new Set<() => void>();

export function setActiveEditor(next: ActiveEditor | null) {
	active = next;
	for (const listener of listeners) listener();
}

export const getActiveEditor = () => active;

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const useActiveEditor = () => useSyncExternalStore(subscribe, getActiveEditor);
