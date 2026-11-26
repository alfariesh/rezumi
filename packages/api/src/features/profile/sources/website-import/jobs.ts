import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";

/** A run still marked running after this long was cut off (the server stopped mid-run); the upkeep fails it. */
export const STALE_RUN_MS = 15 * 60 * 1000;

/**
 * Upkeep, every minute with the other scheduled work: clears results past their day and fails runs a stopped server
 * left running, which frees an account's free import that never finished.
 */
export async function runWebsiteImportJobs(now = new Date()) {
	const cleared = await db
		.update(schema.websiteImport)
		.set({ result: null })
		.where(and(isNotNull(schema.websiteImport.result), lt(schema.websiteImport.resultExpiresAt, now)))
		.returning({ id: schema.websiteImport.id });
	const stale = await db
		.update(schema.websiteImport)
		.set({ status: "failed", errorCode: "stale", finishedAt: now })
		.where(
			and(
				eq(schema.websiteImport.status, "running"),
				lt(schema.websiteImport.createdAt, new Date(now.getTime() - STALE_RUN_MS)),
			),
		)
		.returning({ id: schema.websiteImport.id });
	return { clearedResults: cleared.length, failedStale: stale.length };
}
