// Delete forever: the library's only permanent action, so the only one that asks (web: "Delete … now?").
import type { DocumentSummary } from "./filter";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { ConfirmDialog } from "@/ui";

type PurgeDialogProps = {
	document: DocumentSummary | null;
	onClose: () => void;
	onConfirm: (document: DocumentSummary) => void;
};

export function PurgeDialog({ document, onClose, onConfirm }: PurgeDialogProps) {
	const { t } = useLingui();
	// The name stays while the dialog fades out.
	const [shown, setShown] = useState(document);
	if (document && document !== shown) setShown(document);
	return (
		<ConfirmDialog
			isOpen={document !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t`Delete “${shown?.name ?? ""}” forever?`}
			message={t`It will be deleted for good and can't be restored.`}
			confirmLabel={t`Delete forever`}
			cancelLabel={t`Keep in Trash`}
			destructive
			onConfirm={() => {
				if (document) onConfirm(document);
			}}
		/>
	);
}
