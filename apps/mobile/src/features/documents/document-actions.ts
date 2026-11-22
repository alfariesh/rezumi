// What the document menu, the swipe actions and Trash do to a library document, in the web's words
// (`apps/web/src/features/documents/document-actions.tsx`). Every call goes through `useDocumentOperations`, which runs
// one action at a time, checks the session and network, refreshes the library and reports a failure in a toast.
// Reversible actions run at once (Move to Trash offers Undo); only Delete forever asks first, in the screen.
import type { DocumentSummary } from "./filter";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { documentRef } from "./filter";
import { useNewDocuments } from "./new-documents";
import { useDocumentOperations } from "./queries";
import { client } from "@/api/client";
import { routes } from "@/routes";
import { showToast } from "@/ui";

export type DocumentActions = ReturnType<typeof useDocumentActions>;

export function useDocumentActions() {
	const { t } = useLingui();
	const router = useRouter();
	const operations = useDocumentOperations();

	return {
		busy: operations.busy,

		open: (document: Pick<DocumentSummary, "id" | "type">) => {
			useNewDocuments.getState().markOpened(document);
			router.push(document.type === "resume" ? routes.builder(document.id) : routes.letter(document.id));
		},

		rename: (document: DocumentSummary, name: string) => {
			const trimmed = name.trim();
			if (!trimmed || trimmed === document.name) return Promise.resolve(true);
			return operations.run(() => client.documents.rename({ ...documentRef(document), name: trimmed }));
		},

		duplicate: (document: DocumentSummary) =>
			operations.run(async () => {
				const id =
					document.type === "resume"
						? await client.resume.duplicate({
								id: document.id,
								name: t`${document.name} (copy)`.slice(0, 100),
								tags: document.tags,
							})
						: (await client.coverLetters.duplicate({ id: document.id })).id;
				useNewDocuments.getState().markNew({ id, type: document.type });
				showToast({ title: t`Duplicated “${document.name}”` });
			}),

		/** New → Copy a resume for a job, starting from this one. */
		copyForJob: (document: DocumentSummary) =>
			router.push(`${routes.new()}?step=copy&sourceResumeId=${encodeURIComponent(document.id)}`),

		history: (document: DocumentSummary) => router.push(routes.history(document.id)),

		setLocked: (document: DocumentSummary, isLocked: boolean) =>
			operations.run(() => client.documents.setLocked({ ...documentRef(document), isLocked })),

		/** The menu offers Tags only while the document is unlocked. */
		setTags: (document: DocumentSummary, tags: readonly string[]) =>
			operations.run(() => client.documents.setTags({ ...documentRef(document), tags: [...tags] })),

		link: (document: DocumentSummary, applicationId: string | null) =>
			operations.run(() => client.documents.linkApplication({ ...documentRef(document), applicationId })),

		/** Undoable, so it doesn't ask first. */
		trash: (document: DocumentSummary) => operations.trash(document),

		restore: (document: DocumentSummary) =>
			operations.run(async () => {
				await client.documents.restore(documentRef(document));
				showToast({ title: t`Restored “${document.name}”` });
			}),

		/** The only permanent action; the screen confirms before calling it. */
		purge: (document: DocumentSummary) =>
			operations.run(async () => {
				await client.documents.purge(documentRef(document));
				showToast({ title: t`Deleted “${document.name}”` });
			}),
	};
}
