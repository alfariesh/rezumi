// The document library's rules, shared by the web's Documents page and the app's Documents tab: which documents a
// search, type, tags and the Public chip keep and in what order, the tags in use, the tags a group of documents
// shares (and the change a tag edit makes to each), and the days a trashed document has left.

export type DocumentType = "resume" | "letter";
export type DocumentTypeFilter = "all" | DocumentType;
export type DocumentSort = "edited" | "name" | "created";

/** What the rules read from a library row (`documents.list`). */
export type LibraryDocument = {
	type: DocumentType;
	id: string;
	name: string;
	tags: readonly string[];
	isPublic: boolean;
	createdAt: Date;
	updatedAt: Date;
	application?: { company?: string | null | undefined; role?: string | null | undefined } | null | undefined;
};

export type DocumentFilters = {
	type: DocumentTypeFilter;
	q: string;
	tags: readonly string[];
	sort: DocumentSort;
	/** Only resumes whose public link is on. */
	public?: boolean | undefined;
};

/** Trashed documents are deleted for good after this many days. */
export const TRASH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const byName = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** One key per document across both types (a resume and a letter can share an id). */
export const documentKey = (document: Pick<LibraryDocument, "type" | "id">) => `${document.type}:${document.id}`;

/**
 * Search covers titles, tags and linked applications; every chosen tag must be on the document, and Public keeps
 * shared resumes. Names sort A to Z (numbers in order), dates newest first.
 */
export function filterDocuments<T extends LibraryDocument>(documents: readonly T[], filters: DocumentFilters): T[] {
	const query = filters.q.trim().toLocaleLowerCase();

	return documents
		.filter((document) => filters.type === "all" || document.type === filters.type)
		.filter((document) => filters.tags.every((tag) => document.tags.includes(tag)))
		.filter((document) => !filters.public || document.isPublic)
		.filter((document) => {
			if (!query) return true;
			const haystack = [document.name, ...document.tags, document.application?.company, document.application?.role];
			return haystack.some((text) => text?.toLocaleLowerCase().includes(query));
		})
		.sort((a, b) => {
			if (filters.sort === "name") return byName.compare(a.name, b.name);
			if (filters.sort === "created") return b.createdAt.getTime() - a.createdAt.getTime();
			return b.updatedAt.getTime() - a.updatedAt.getTime();
		});
}

/** Whether a search, a tag or Public narrows the library (a type alone does not). */
export const isFiltered = (filters: Pick<DocumentFilters, "q" | "tags" | "public">) =>
	filters.q.trim() !== "" || filters.tags.length > 0 || filters.public === true;

/** Every tag in use, alphabetically; the tag chips appear only when there are some. */
export const collectTags = (documents: readonly Pick<LibraryDocument, "tags">[]) =>
	[...new Set(documents.flatMap((document) => document.tags))].sort(byName.compare);

/** The tags every one of these documents has, in the first one's order. */
export const sharedTags = (documents: readonly Pick<LibraryDocument, "tags">[]) =>
	documents[0]?.tags.filter((tag) => documents.every((document) => document.tags.includes(tag))) ?? [];

/**
 * A document's tags after editing the shared ones from `shared` to `next`: a tag added goes on, a tag removed comes
 * off, and the document's other tags stay.
 */
export function changedTags(
	document: Pick<LibraryDocument, "tags">,
	shared: readonly string[],
	next: readonly string[],
): string[] {
	const removed = shared.filter((tag) => !next.includes(tag));
	const added = next.filter((tag) => !shared.includes(tag));
	return [
		...document.tags.filter((tag) => !removed.includes(tag)),
		...added.filter((tag) => !document.tags.includes(tag)),
	];
}

/** Days until a document in Trash is deleted for good (at least 0). */
export function daysLeftInTrash(trashedAt: Date, now = Date.now()) {
	const left = trashedAt.getTime() + TRASH_DAYS * DAY_MS - now;
	return Math.max(0, Math.ceil(left / DAY_MS));
}
