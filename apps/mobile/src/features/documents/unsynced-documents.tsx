// Documents with edits on this device that never reached the server (made or changed offline): listed above the
// library until they sync, so local work can always be found and opened again.
import type { PendingDocument } from "@/draft/types";
import { useLingui } from "@lingui/react/macro";
import { documentKey } from "./filter";
import { ListRow, ListSection } from "@/ui";

type UnsyncedDocumentsProps = {
	documents: readonly PendingDocument[];
	onOpen: (document: PendingDocument) => void;
};

export function UnsyncedDocuments({ documents, onOpen }: UnsyncedDocumentsProps) {
	const { t } = useLingui();
	if (documents.length === 0) return null;
	return (
		<ListSection title={t`Unsynced on this device`} footer={t`Open one to finish saving it.`}>
			{documents.map((document) => (
				<ListRow
					key={documentKey(document)}
					icon="cloud-slash"
					title={document.name}
					description={document.type === "resume" ? t`Resume` : t`Letter`}
					onPress={() => onOpen(document)}
				/>
			))}
		</ListSection>
	);
}
