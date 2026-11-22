// Fills the editor chrome from a draft store once for every pane: the name (renamed in place), the save state, undo
// and redo, and ⌘Z / ⇧⌘Z. The resume and letter layouts both use it.
import type { SaveStatus } from "@rezumi/resume/draft";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useKeyCommands } from "../key-commands";
import { useUnsavedChangesGuard } from "../unsaved-changes";
import { useBuilderChrome } from "./slots";

type DraftView = {
	document: { name: string } | null;
	status: SaveStatus;
	locked: boolean;
	canUndo: boolean;
	canRedo: boolean;
	undo: () => void;
	redo: () => void;
	retry: () => void;
	updateDocument: (recipe: (draft: { name: string }) => void) => void;
};

type DraftHook = {
	<T>(select: (state: DraftView) => T): T;
	getState: () => DraftView;
};

type DraftChromeProps = { useStore: DraftHook; actions?: ReactNode };

export function DraftChrome({ useStore, actions }: DraftChromeProps) {
	const { t } = useLingui();
	const name = useStore((state) => state.document?.name);
	const status = useStore((state) => state.status);
	const locked = useStore((state) => state.locked);
	const canUndo = useStore((state) => state.canUndo);
	const canRedo = useStore((state) => state.canRedo);
	const undo = () => useStore.getState().undo();
	const redo = () => useStore.getState().redo();

	useBuilderChrome({
		title: name,
		onRename: name
			? (next) =>
					useStore.getState().updateDocument((document) => {
						document.name = next;
					})
			: undefined,
		save: name ? { status, locked, onRetry: () => useStore.getState().retry() } : undefined,
		history: name ? { canUndo, canRedo, onUndo: undo, onRedo: redo } : undefined,
		actions,
	});
	useKeyCommands([
		{ id: "undo", input: "z", title: t`Undo`, run: undo },
		{ id: "redo", input: "z", shift: true, title: t`Redo`, run: redo },
	]);
	// Leaving with a save the server refused: the changes stay on this device, but say so before going.
	useUnsavedChangesGuard({
		dirty: status === "error" && !locked,
		title: t`Leave before saving?`,
		message: t`Your latest changes aren't on the server yet. They stay on this device and are sent when it can reach the server again.`,
		leaveLabel: t`Leave`,
	});
	return null;
}
