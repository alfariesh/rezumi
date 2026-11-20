import type { NormalizedJobSearch } from "./search-key";
import type { JobListing, JobProvider } from "@rezumi/schema/jobs/listing";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { toJobListing } from "./store";

/**
 * The shared answers of searches (`job_search_cache`, `02-teknis.md` sections 6–7) and the listings people hid. An
 * answer is fresh for JOB_SEARCH_CACHE_TTL_MS (K3); an older one is still read when the providers can't be asked,
 * until the daily upkeep removes it (Phase 05).
 */

export const JOB_SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type CachedSearch = {
	key: string;
	/** The normalized search this page answers. */
	query: NormalizedJobSearch;
	providers: JobProvider[];
	listingIds: string[];
	cursors: Partial<Record<JobProvider, string>>;
	fetchedAt: Date;
	expiresAt: Date;
};

export async function readCachedSearch(key: string): Promise<CachedSearch | undefined> {
	const [row] = await db.select().from(schema.jobSearchCache).where(eq(schema.jobSearchCache.key, key));
	if (!row) return undefined;
	return {
		key: row.key,
		query: row.query as NormalizedJobSearch,
		providers: row.providers,
		listingIds: row.listingIds,
		cursors: row.cursors,
		fetchedAt: row.fetchedAt,
		expiresAt: row.expiresAt,
	};
}

export async function writeCachedSearch(entry: Omit<CachedSearch, "expiresAt">): Promise<CachedSearch> {
	const expiresAt = new Date(entry.fetchedAt.getTime() + JOB_SEARCH_CACHE_TTL_MS);
	const values = {
		providers: entry.providers,
		query: { ...entry.query },
		listingIds: entry.listingIds,
		cursors: entry.cursors,
		fetchedAt: entry.fetchedAt,
		expiresAt,
	};
	await db
		.insert(schema.jobSearchCache)
		.values({ key: entry.key, ...values })
		.onConflictDoUpdate({ target: schema.jobSearchCache.key, set: values });
	return { ...entry, expiresAt };
}

/** Stored listings by id, in the order given; ids that no longer exist are skipped. */
export async function listingsByIds(ids: string[]): Promise<JobListing[]> {
	if (ids.length === 0) return [];
	const rows = await db.select().from(schema.jobListing).where(inArray(schema.jobListing.id, ids));
	const byId = new Map(rows.map((row) => [row.id, toJobListing(row)]));
	return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function readListing(id: string): Promise<JobListing | undefined> {
	const [row] = await db.select().from(schema.jobListing).where(eq(schema.jobListing.id, id));
	return row ? toJobListing(row) : undefined;
}

/** Which of `ids` the person hid. */
export async function hiddenListingIds(userId: string, ids: string[]): Promise<Set<string>> {
	if (ids.length === 0) return new Set();
	const rows = await db
		.select({ listingId: schema.jobListingHidden.listingId })
		.from(schema.jobListingHidden)
		.where(and(eq(schema.jobListingHidden.userId, userId), inArray(schema.jobListingHidden.listingId, ids)));
	return new Set(rows.map((row) => row.listingId));
}

/** Hides a listing from the person's results, or shows it again. False when the listing doesn't exist. */
export async function setListingHidden(userId: string, listingId: string, hidden: boolean): Promise<boolean> {
	if (!hidden) {
		await db
			.delete(schema.jobListingHidden)
			.where(and(eq(schema.jobListingHidden.userId, userId), eq(schema.jobListingHidden.listingId, listingId)));
		return true;
	}
	const [listing] = await db
		.select({ id: schema.jobListing.id })
		.from(schema.jobListing)
		.where(eq(schema.jobListing.id, listingId));
	if (!listing) return false;
	await db.insert(schema.jobListingHidden).values({ userId, listingId }).onConflictDoNothing();
	return true;
}
