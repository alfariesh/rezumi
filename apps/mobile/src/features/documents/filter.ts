import type { RouterOutput } from "@/api/client";

// The library's rules (search, sort, tags, Trash days) are shared with the web's Documents page.
export {
	changedTags,
	collectTags,
	daysLeftInTrash,
	documentKey,
	filterDocuments,
	sharedTags,
	type DocumentSort,
} from "@rezumi/resume/documents";

export type DocumentSummary = RouterOutput["documents"]["list"][number];
export const documentRef = ({ type, id }: Pick<DocumentSummary, "type" | "id">) => ({ type, id });
