import type { DbOrTx } from "@rezumi/db/client";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";

/** Documents that count against a plan's limits: those not in Trash. */
export async function countActiveDocuments(userId: string, database: DbOrTx = db) {
	const [[resumes], [coverLetters]] = await Promise.all([
		database
			.select({ total: count() })
			.from(schema.resume)
			.where(and(eq(schema.resume.userId, userId), isNull(schema.resume.trashedAt))),
		database
			.select({ total: count() })
			.from(schema.coverLetter)
			.where(and(eq(schema.coverLetter.userId, userId), isNull(schema.coverLetter.trashedAt))),
	]);
	return { activeResumes: resumes?.total ?? 0, activeCoverLetters: coverLetters?.total ?? 0 };
}
