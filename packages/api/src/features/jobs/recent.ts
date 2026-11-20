import type { JobCounters } from "./counters";
import type { JobSearchCriteria, JobSearchRecent } from "@rezumi/schema/jobs/search";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { jobSearchCriteriaSchema, MAX_RECENT_JOB_SEARCHES } from "@rezumi/schema/jobs/search";
import { pageSeenToday, quotaDay } from "./allowance";
import { SEARCH_PROVIDERS } from "./routing";
import { jobSearchKey, normalizeJobSearch, stableJson } from "./search-key";

/**
 * A person's recent job searches (the Jobs page's "Recent job searches", MCP `api_jobs_recent`). Recorded after each
 * search whose first page answered; at most MAX_RECENT_JOB_SEARCHES per account, newest first. Each says whether its
 * first page was opened today, so opening it again is free (the day's searches count pages, `allowance.ts`).
 */

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The same search however it was typed: the normalized search, hashed. */
const criteriaKey = (criteria: JobSearchCriteria) => sha256(stableJson(normalizeJobSearch({ ...criteria })));

/** Remembers a search (or moves it to the top), then drops the oldest past the limit. */
export async function recordRecentSearch(userId: string, criteria: JobSearchCriteria, now: Date): Promise<void> {
	const key = await criteriaKey(criteria);
	await db.transaction(async (tx) => {
		await tx
			.insert(schema.jobSearchRecent)
			.values({ userId, criteriaKey: key, criteria, searchedAt: now })
			.onConflictDoUpdate({
				target: [schema.jobSearchRecent.userId, schema.jobSearchRecent.criteriaKey],
				set: { criteria, searchedAt: now },
			});
		const kept = tx
			.select({ id: schema.jobSearchRecent.id })
			.from(schema.jobSearchRecent)
			.where(eq(schema.jobSearchRecent.userId, userId))
			.orderBy(desc(schema.jobSearchRecent.searchedAt), desc(schema.jobSearchRecent.id))
			.limit(MAX_RECENT_JOB_SEARCHES);
		await tx
			.delete(schema.jobSearchRecent)
			.where(and(eq(schema.jobSearchRecent.userId, userId), notInArray(schema.jobSearchRecent.id, kept)));
	});
}

/** The person's recent searches, newest first, each with whether opening it again today is free. */
export async function listRecentSearches(userId: string, counters: JobCounters, now: Date): Promise<JobSearchRecent[]> {
	const rows = await db
		.select()
		.from(schema.jobSearchRecent)
		.where(eq(schema.jobSearchRecent.userId, userId))
		.orderBy(desc(schema.jobSearchRecent.searchedAt), desc(schema.jobSearchRecent.id))
		.limit(MAX_RECENT_JOB_SEARCHES);
	if (rows.length === 0) return [];
	const quota = await quotaDay(userId, now);
	const searches = await Promise.all(
		rows.map(async (row) => {
			// A row saved by an older shape of the search that no longer reads is left out rather than failing the list.
			const parsed = jobSearchCriteriaSchema.safeParse(row.criteria);
			if (!parsed.success) return null;
			const firstPage = await jobSearchKey(normalizeJobSearch({ ...parsed.data }), SEARCH_PROVIDERS);
			return {
				id: row.id,
				criteria: parsed.data,
				searchedAt: row.searchedAt.toISOString(),
				seenToday: await pageSeenToday(counters, userId, quota, firstPage, now),
			};
		}),
	);
	return searches.filter((search) => search !== null);
}

/** Forgets one recent search, or every one without an id. Only the person's own: another account's id does nothing. */
export async function forgetRecentSearches(userId: string, id?: string): Promise<void> {
	await db
		.delete(schema.jobSearchRecent)
		.where(
			and(eq(schema.jobSearchRecent.userId, userId), id === undefined ? undefined : eq(schema.jobSearchRecent.id, id)),
		);
}
