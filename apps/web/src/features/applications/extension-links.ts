import type { NewDocumentDialogData } from "@/features/documents/new-document-dialog";

/**
 * Links the Rezumi browser extension opens on an application's page (plan: .agents/docs/plans/plugin-browser,
 * 02-teknis.md §10). "Tailor resume" adds `?prepare=resume` (and `from=<resume id>` for the resume to start from), and
 * the page opens "Copy for a job" for that application once, then drops the parameters.
 */
export type ExtensionPrepareSearch = { prepare?: "resume" | undefined; from?: string | undefined };

/** The "Copy for a job" dialog a link asks for, or null when it asks for nothing. */
export function prepareDialogData(search: ExtensionPrepareSearch, applicationId: string): NewDocumentDialogData | null {
	if (search.prepare !== "resume") return null;
	return { step: "copy", applicationId, ...(search.from ? { sourceResumeId: search.from } : {}) };
}
