import type { RouterOutput } from "@/libs/orpc/client";

// The library's rules (search, sort, tags, Trash days) are shared with the app's Documents tab.
export {
	changedTags,
	collectTags,
	daysLeftInTrash,
	documentKey,
	filterDocuments,
	isFiltered,
	sharedTags,
	type DocumentSort,
	type DocumentTypeFilter,
} from "@rezumi/resume/documents";

export type DocumentSummary = RouterOutput["documents"]["list"][number];
