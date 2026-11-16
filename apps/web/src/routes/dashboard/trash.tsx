import { createFileRoute } from "@tanstack/react-router";
import { DocumentsLayout } from "@/features/documents/documents-layout";
import { TrashPage } from "@/features/documents/trash-page";

export const Route = createFileRoute("/dashboard/trash")({ component: RouteComponent });

/** Trash is the last item of Documents' section menu. */
function RouteComponent() {
	return (
		<DocumentsLayout current="trash">
			<TrashPage />
		</DocumentsLayout>
	);
}
