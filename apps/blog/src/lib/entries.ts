import type { ContentEntry, InferCollectionData } from "emdash";

/** A published article as the queries return it; its fields are generated into emdash-env.d.ts from the schema. */
export type PostEntry = ContentEntry<InferCollectionData<"posts">>;

/**
 * An entry's slug without a locale. `entry.id` carries the locale prefix for non-default locales (`id/…`), while
 * `data.slug` never does; routable entries always have one, the fallback only guards old rows.
 */
export function entrySlug(entry: Pick<PostEntry, "id" | "data">): string {
	return entry.data.slug || entry.id.slice(entry.id.lastIndexOf("/") + 1);
}

/** The display names of an entry's bylines, in credit order. */
export function bylineNames(entry: Pick<PostEntry, "data">): string[] {
	return (entry.data.bylines ?? []).map((credit) => credit.byline.displayName).filter(Boolean);
}
