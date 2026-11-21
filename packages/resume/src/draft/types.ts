import type { EditOptions } from "./history";
import type { WritableDraft } from "immer";

/**
 * - `offline`: no connection; changes are kept on this device and sent when it reconnects.
 * - `error`: the server rejected the save or couldn't be reached while online; changes are kept and Retry is offered.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

/**
 * The server copy changed since this draft was loaded (a version conflict on save, or a newer copy found on open).
 * - `keep-mine` re-sends the draft without the version check.
 * - `use-theirs` drops the draft and loads the server copy.
 * - `keep-both` saves the draft as a new document and loads the server copy here.
 */
export type ConflictChoice = "keep-mine" | "use-theirs" | "keep-both";

export type DraftConflict<TDocument> = {
	/** The server copy at the time of the conflict. */
	remote: TDocument;
};

export type UpdateOptions = EditOptions;

export type DraftState<TDocument, TData> = {
	/** The document with the draft's data; null until loaded. */
	document: TDocument | null;
	data: TData | null;
	status: SaveStatus;
	/** Locked documents are read-only: `update` does nothing. */
	locked: boolean;
	conflict: DraftConflict<TDocument> | null;
	canUndo: boolean;
	canRedo: boolean;
};

export type DraftActions<TDocument, TData> = {
	/** Loads the document (from the device's draft first, then the server) and starts syncing. */
	open: (id: string) => Promise<void>;
	/** Flushes pending changes and stops syncing. */
	close: () => Promise<void>;
	update: (recipe: (draft: WritableDraft<TData>) => void, options?: UpdateOptions) => void;
	/** Name, tags, visibility and other fields next to the data. Not part of undo. */
	updateDocument: (recipe: (draft: WritableDraft<TDocument>) => void) => void;
	undo: () => void;
	redo: () => void;
	/** Sends the latest unsaved changes again ("Not saved · Retry"). */
	retry: () => void;
	resolveConflict: (choice: ConflictChoice) => Promise<void>;
	/** Saves now instead of after the debounce: on blur, when the app goes to the background, when leaving. */
	flush: () => Promise<void>;
};

export type DraftStore<TDocument, TData> = DraftState<TDocument, TData> & DraftActions<TDocument, TData>;
