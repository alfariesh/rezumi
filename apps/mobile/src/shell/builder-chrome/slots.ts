// What screens put into the editor chrome. Every key is optional; the latest mounted screen wins per key, and a key
// disappears when the screen that set it unmounts.
import type { IconName } from "@/ui";
import type { SaveStatus } from "@rezumi/resume/draft";
import type { Href } from "expo-router";
import type { ReactNode } from "react";
import { createSlot } from "../slot";

export type SaveStatusSlot = {
	status: SaveStatus;
	/** Shows "Locked" instead of the save state, and the name can't be renamed. */
	locked?: boolean | undefined;
	/** "Not saved · Retry". */
	onRetry?: (() => void) | undefined;
};

export type HistorySlot = {
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
};

export type BuilderChromeSlots = {
	/** The document name in the top bar. Defaults to "Resume" or "Cover letter". */
	title?: string | undefined;
	/** Renames the document from the top bar (the name becomes a field). Without it the name is plain text. */
	onRename?: ((name: string) => void) | undefined;
	/** The save status line under the name. Hidden until set. */
	save?: SaveStatusSlot | undefined;
	/** Undo and redo in the top bar. */
	history?: HistorySlot | undefined;
	/** Opens the document menu (duplicate, lock, notes, history, trash): a ⋯ button at the end of the top bar. */
	onMenu?: (() => void) | undefined;
	/** Replaces what the Download button does. */
	onExport?: (() => void) | undefined;
	/** Icon buttons before Download (the assistant). */
	actions?: ReactNode;
	/** Under the top bar, full width: the locked banner. The offline note shows by itself when `save.status` is offline. */
	banner?: ReactNode;
	/** Counts on the modes, by pane, for example `{ check: 3 }` for open issues. */
	badges?: Partial<Record<string, number | string>> | undefined;
};

export const slot = createSlot<BuilderChromeSlots>();

/**
 * Fills the editor chrome from a screen inside `app/builder/[id]` or `app/letter/[id]`.
 *
 * @example useBuilderChrome({ badges: { check: issues.length } })
 */
export const useBuilderChrome = slot.useFill;

export type PaneTab<T extends string> = {
	pane: T;
	label: string;
	icon: IconName;
	href: Href;
	/**
	 * The mode's name with its badge, translated by the layout with a plural ("Check, 3 issues"): read by screen readers
	 * on the phone mode bar and shown in the tablet mode switch while the badge is set.
	 */
	badgeLabel?: ((badge: number | string) => string) | undefined;
};
