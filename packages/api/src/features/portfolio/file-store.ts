import type { StorageService } from "../storage";
import type { DbOrTx } from "@rezumi/db/client";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { portfolioFileKeysInStoredData } from "@rezumi/portfolio/files";
import { getStorageService } from "../storage";
import { portfolioErrors } from "./errors";

/**
 * Bookkeeping of the files an account uploads for its portfolio (`portfolio_file`), shared by the service and the
 * upkeep jobs. Locks are always taken in one order, the portfolio's row first and then its file rows, and the cleanup
 * never waits for one (it skips locked rows), so nothing here can deadlock.
 */

/**
 * The `unused_since` of a file that must go on the cleanup job's next run, past any grace period: set when the
 * portfolio is deleted, or the file itself.
 */
export const OVERDUE = new Date(0);

const file = schema.portfolioFile;

/**
 * Locks the account's portfolio row for this transaction. Saves, uploads and deletions take it and wait their turn;
 * the upkeep jobs pass `skipLocked` and leave a portfolio being saved for a later run. Null when the account has no
 * portfolio, or (skipping) when another transaction holds it.
 */
export async function lockPortfolio(tx: DbOrTx, userId: string, options: { skipLocked?: boolean } = {}) {
	const [row] = await tx
		.select({
			updatedAt: schema.portfolio.updatedAt,
			sourceResumeId: schema.portfolio.sourceResumeId,
			filesCheckedAt: schema.portfolio.filesCheckedAt,
		})
		.from(schema.portfolio)
		.where(eq(schema.portfolio.userId, userId))
		.for("update", options.skipLocked ? { skipLocked: true } : {});
	return row ?? null;
}

async function hasPortfolio(tx: DbOrTx, userId: string): Promise<boolean> {
	const [row] = await tx
		.select({ id: schema.portfolio.id })
		.from(schema.portfolio)
		.where(eq(schema.portfolio.userId, userId));
	return row !== undefined;
}

/** The portfolio's data as stored, for `parsePortfolioData` or `portfolioFileKeysInStoredData`; null without one. */
export async function readStoredData(tx: DbOrTx, userId: string): Promise<unknown> {
	const [row] = await tx
		.select({ data: schema.portfolio.data })
		.from(schema.portfolio)
		.where(eq(schema.portfolio.userId, userId));
	return row?.data ?? null;
}

/**
 * Marks which of the account's recorded files the stored data uses, under the portfolio's lock: `used` (every file key
 * in the data, `portfolioFileKeysInStoredData`) get `unused_since` cleared, the rest start counting from `now`, and
 * the cleanup job deletes them once the grace period has passed. `required` (the files a save refers to, a subset of
 * `used`) must be recorded, or the save is refused with `PORTFOLIO_FILE_NOT_FOUND`. They are looked up only after
 * being marked: a file the cleanup job is deleting at that moment is then either kept (marked first) or found
 * missing (deleted first), never saved as used while it's being deleted.
 */
export async function markFileUsage(
	tx: DbOrTx,
	userId: string,
	used: readonly string[],
	options: { required?: readonly string[]; now?: Date } = {},
): Promise<void> {
	const mine = eq(file.userId, userId);
	if (used.length)
		await tx
			.update(file)
			.set({ unusedSince: null })
			.where(and(mine, inArray(file.key, [...used]), isNotNull(file.unusedSince)));
	const required = options.required ?? [];
	if (required.length) {
		const rows = await tx
			.select({ key: file.key })
			.from(file)
			.where(and(mine, inArray(file.key, [...required])));
		const recorded = new Set(rows.map((row) => row.key));
		const missing = required.find((key) => !recorded.has(key));
		if (missing) throw portfolioErrors.fileNotFound(missing);
	}
	await tx
		.update(file)
		.set({ unusedSince: options.now ?? sql`now()` })
		.where(and(mine, isNull(file.unusedSince), used.length ? notInArray(file.key, [...used]) : undefined));
}

/**
 * What the account stores for its portfolio: every recorded file, those waiting out the grace period too, but not those
 * already marked `OVERDUE` (a deleted portfolio's, or one deleted on its own): nothing can use them again, and the job
 * removes them on its next runs, so they don't hold up uploads to a new portfolio meanwhile.
 */
export async function storedFiles(userId: string, client: DbOrTx = db): Promise<{ bytes: number; files: number }> {
	const [row] = await client
		.select({
			bytes: sql`coalesce(sum(${file.bytes}), 0)`.mapWith(Number),
			files: sql`count(*)`.mapWith(Number),
		})
		.from(file)
		.where(and(eq(file.userId, userId), or(isNull(file.unusedSince), gt(file.unusedSince, OVERDUE))));
	return { bytes: row?.bytes ?? 0, files: row?.files ?? 0 };
}

/**
 * Deletes one stored file; true once storage no longer has it. The S3 and local adapters report a failed delete as
 * `false` instead of throwing, and `false` also means the file wasn't there: a listing tells the two apart. Failures
 * are logged, never thrown.
 */
export async function removeStoredFile(key: string, storage: StorageService = getStorageService()): Promise<boolean> {
	try {
		if (await storage.delete(key)) return true;
		if (!(await storage.list(key)).includes(key)) return true;
		console.error("[portfolio] Storage kept a file it was asked to delete: %s", key);
	} catch (error) {
		console.error("[portfolio] Deleting a stored file failed: %s", key, error);
	}
	return false;
}

/**
 * Deletes an account's files that no saved data has used since before `cutoff`, at most `limit` of them (or only
 * `keys`), oldest first, and returns how many it deleted.
 *
 * With a portfolio: under its row lock (skipped while a save holds it; a later run gets to it) the stored data is
 * read again, a file it still names is marked used instead (an undo brought it back), and the rows of the rest are
 * deleted, so no save can use those files anymore (a save needs the row). Storage goes after the commit, outside the
 * lock, so a save never waits for it; a file storage fails to delete stays as a stray for the weekly check.
 *
 * Without one (the portfolio was deleted): nothing can use the files, so each is deleted from storage first and its row
 * only once that worked; a failure keeps the row and the next run tries again. The rows stay locked meanwhile: a new
 * portfolio's save naming one of them waits, then finds it gone.
 */
export async function deleteUnusedFiles(
	userId: string,
	options: { cutoff: Date; limit: number; keys?: readonly string[] },
): Promise<number> {
	const storage = getStorageService();
	const outcome = await db.transaction(async (tx) => {
		const portfolio = await lockPortfolio(tx, userId, { skipLocked: true });
		// Being saved right now: its own transaction holds the lock.
		if (!portfolio && (await hasPortfolio(tx, userId))) return { deleted: 0, unrecorded: [] };
		const due = await tx
			.select({ id: file.id, key: file.key })
			.from(file)
			.where(
				and(
					eq(file.userId, userId),
					isNotNull(file.unusedSince),
					lt(file.unusedSince, options.cutoff),
					options.keys ? inArray(file.key, [...options.keys]) : undefined,
				),
			)
			.orderBy(asc(file.unusedSince), asc(file.id))
			.limit(options.limit)
			.for("update", { skipLocked: true });
		if (!due.length) return { deleted: 0, unrecorded: [] };

		if (!portfolio) {
			const gone: string[] = [];
			for (const row of due) {
				// When storage fails one file it likely fails the rest: they wait for the next run.
				if (!(await removeStoredFile(row.key, storage))) break;
				gone.push(row.id);
			}
			if (gone.length) await tx.delete(file).where(inArray(file.id, gone));
			return { deleted: gone.length, unrecorded: [] };
		}

		const used = new Set(portfolioFileKeysInStoredData(await readStoredData(tx, userId)));
		const back = due.filter((row) => used.has(row.key)).map((row) => row.id);
		const gone = due.filter((row) => !used.has(row.key));
		if (back.length) await tx.update(file).set({ unusedSince: null }).where(inArray(file.id, back));
		if (gone.length)
			await tx.delete(file).where(
				inArray(
					file.id,
					gone.map((row) => row.id),
				),
			);
		return { deleted: gone.length, unrecorded: gone.map((row) => row.key) };
	});
	for (const key of outcome.unrecorded) await removeStoredFile(key, storage);
	return outcome.deleted;
}
