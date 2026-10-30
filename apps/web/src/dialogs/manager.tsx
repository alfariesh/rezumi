import type { DialogSchema } from "./schemas";
import { Modal } from "@heroui/react";
import { Fragment, lazy, Suspense } from "react";
import { useDialogStore } from "./store";

// The dialogs pull in forms, importers and editors; load them on first open so they stay out of every page's bundle.
const DialogContent = lazy(async () => {
	const { renderDialog } = await import("./renderers");
	return { default: ({ dialog }: { dialog: DialogSchema }) => renderDialog(dialog) };
});

export function DialogManager() {
	const { open, activeDialog, openCount, onOpenChange } = useDialogStore();

	return (
		<Modal.Backdrop isOpen={open} onOpenChange={(isOpen) => onOpenChange(isOpen)}>
			<Fragment key={openCount}>
				{activeDialog && (
					<Suspense>
						<DialogContent dialog={activeDialog} />
					</Suspense>
				)}
			</Fragment>
		</Modal.Backdrop>
	);
}
