// The last search's results on this device, per account, for Jobs opened offline (01-desain 1: every screen shows its
// last content with a marker when offline). Only what the cards show is kept, never the descriptions; sign-out removes
// it with the account's other data (`scopedStoragePrefixes` in src/auth/session.ts).
import type { JobsSearch } from "@rezumi/career/jobs";
import type { JobSearchResult } from "@rezumi/schema/jobs/search";
import Storage from "expo-sqlite/kv-store";
import { jobsSearchSchema } from "@rezumi/career/jobs";
import { jobSearchResultSchema } from "@rezumi/schema/jobs/search";

export const SAVED_JOB_SEARCH_PREFIX = "rezumi:job-search:";
/** Pages kept: the first few the person read. */
const MAX_PAGES = 3;

export type SavedJobSearch = { search: JobsSearch; pages: JobSearchResult[]; savedAt: string };

const keyOf = (scope: string) => `${SAVED_JOB_SEARCH_PREFIX}${scope}:last`;

export type KeyValueStorage = {
	getItemSync: (key: string) => string | null;
	setItemSync: (key: string, value: string) => void;
};

export function readSavedSearch(scope: string | null, storage: KeyValueStorage = Storage): SavedJobSearch | null {
	if (!scope) return null;
	try {
		const raw = storage.getItemSync(keyOf(scope));
		if (!raw) return null;
		const value: unknown = JSON.parse(raw);
		if (!value || typeof value !== "object") return null;
		const { search, pages, savedAt } = value as Record<string, unknown>;
		const parsedSearch = jobsSearchSchema.safeParse(search);
		if (!parsedSearch.success || typeof savedAt !== "string" || !Array.isArray(pages)) return null;
		const parsedPages = pages.slice(0, MAX_PAGES).map((page) => jobSearchResultSchema.safeParse(page));
		if (parsedPages.length === 0 || parsedPages.some((page) => !page.success)) return null;
		return {
			search: parsedSearch.data,
			pages: parsedPages.flatMap((page) => (page.success ? [page.data] : [])),
			savedAt,
		};
	} catch {
		return null;
	}
}

export function writeSavedSearch(
	scope: string | null,
	search: JobsSearch,
	pages: readonly JobSearchResult[],
	storage: KeyValueStorage = Storage,
) {
	if (!scope || pages.length === 0) return;
	const saved: SavedJobSearch = { search, pages: pages.slice(0, MAX_PAGES), savedAt: new Date().toISOString() };
	try {
		storage.setItemSync(keyOf(scope), JSON.stringify(saved));
	} catch {
		// A full or unavailable store only loses the offline copy.
	}
}
