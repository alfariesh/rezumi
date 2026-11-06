import { and, asc, eq, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { portfolioFileKeys } from "@rezumi/portfolio/files";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { portfolioFilePrefixes } from "@rezumi/schema/portfolio/files";
import { getStorageService } from "../storage";
import { getPortfolioMode } from "./mode";

/** A file nothing uses is kept this long first: an upload not saved yet, or one an undo would bring back. */
export const PORTFOLIO_UNUSED_FILE_GRACE_MS = 24 * 60 * 60 * 1000;
/** How often each portfolio's files are compared with its data and with storage. */
export const PORTFOLIO_FILE_SWEEP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const ACCOUNTS_PER_RUN = 20;
const FILES_PER_RUN = 100;
const SWEEPS_PER_RUN = 5;

/** Runs one task, logging its failure instead of throwing, so the next task still runs. */
async function task<T>(work: () => Promise<T>, fallback: T, failure: string): Promise<T> {
	try {
		return await work();
	} catch (error) {
		console.error(`[portfolio] ${failure}`, error);
		return fallback;
	}
}

/**
 * Deletes files no saved data has used for a day. Each account is handled under its portfolio's row lock, the lock
 * saves take: a portfolio being saved is skipped until a later run, and the data is read again under the lock, so a
 * file an undo brought back is kept. Storage goes first; when that fails the row stays and the next run retries.
 */
export async function deleteUnusedPortfolioFiles(now = new Date()): Promise<number> {
	const cutoff = new Date(now.getTime() - PORTFOLIO_UNUSED_FILE_GRACE_MS);
	const file = schema.portfolioFile;
	const accounts = await db
		.selectDistinct({ userId: file.userId })
		.from(file)
		.where(and(isNotNull(file.unusedSince), lt(file.unusedSince, cutoff)))
		.limit(ACCOUNTS_PER_RUN);

	let deleted = 0;
	for (const { userId } of accounts) {
		if (deleted >= FILES_PER_RUN) break;
		deleted += await db.transaction(async (tx) => {
			const [portfolio] = await tx
				.select({ data: schema.portfolio.data })
				.from(schema.portfolio)
				.where(eq(schema.portfolio.userId, userId))
				.for("update", { skipLocked: true });
			// Being saved right now: its own transaction holds the lock. A later run gets to it.
			if (!portfolio) {
				const [exists] = await tx
					.select({ id: schema.portfolio.id })
					.from(schema.portfolio)
					.where(eq(schema.portfolio.userId, userId));
				if (exists) return 0;
			}
			const used = new Set(portfolio ? portfolioFileKeys(parsePortfolioData(portfolio.data)) : []);
			const due = await tx
				.select({ id: file.id, key: file.key })
				.from(file)
				.where(and(eq(file.userId, userId), isNotNull(file.unusedSince), lt(file.unusedSince, cutoff)))
				.orderBy(asc(file.unusedSince))
				.limit(FILES_PER_RUN - deleted)
				.for("update", { skipLocked: true });

			const storage = getStorageService();
			const gone: string[] = [];
			const back: string[] = [];
			for (const row of due) {
				if (used.has(row.key)) {
					back.push(row.id);
					continue;
				}
				try {
					await storage.delete(row.key);
					gone.push(row.id);
				} catch (error) {
					console.error("[portfolio] Deleting an unused file failed; it is tried again later.", error);
				}
			}
			if (back.length) await tx.update(file).set({ unusedSince: null }).where(inArray(file.id, back));
			if (gone.length) await tx.delete(file).where(inArray(file.id, gone));
			return gone.length;
		});
	}
	return deleted;
}

/**
 * The weekly check of a few portfolios not checked for a week: which recorded files the data uses (fixing
 * `unused_since` both ways), and storage objects in the portfolio's folders that no row records (an upload whose
 * cleanup failed), which are deleted. Each portfolio is checked under its row lock and skipped while being saved.
 */
export async function sweepPortfolioFiles(now = new Date()): Promise<number> {
	const due = new Date(now.getTime() - PORTFOLIO_FILE_SWEEP_INTERVAL_MS);
	const candidates = await db
		.select({ userId: schema.portfolio.userId })
		.from(schema.portfolio)
		.where(or(isNull(schema.portfolio.filesCheckedAt), lt(schema.portfolio.filesCheckedAt, due)))
		.orderBy(sql`${schema.portfolio.filesCheckedAt} asc nulls first`)
		.limit(SWEEPS_PER_RUN);

	let checked = 0;
	for (const { userId } of candidates) {
		const done = await db.transaction(async (tx) => {
			const [portfolio] = await tx
				.select({ data: schema.portfolio.data, filesCheckedAt: schema.portfolio.filesCheckedAt })
				.from(schema.portfolio)
				.where(eq(schema.portfolio.userId, userId))
				.for("update", { skipLocked: true });
			// Locked by a save, or checked by another run in the meantime.
			if (!portfolio || (portfolio.filesCheckedAt && portfolio.filesCheckedAt >= due)) return false;

			const file = schema.portfolioFile;
			const keys = portfolioFileKeys(parsePortfolioData(portfolio.data));
			if (keys.length)
				await tx
					.update(file)
					.set({ unusedSince: null })
					.where(and(eq(file.userId, userId), inArray(file.key, keys), isNotNull(file.unusedSince)));
			await tx
				.update(file)
				.set({ unusedSince: now })
				.where(
					and(eq(file.userId, userId), isNull(file.unusedSince), keys.length ? notInArray(file.key, keys) : undefined),
				);

			// Storage is listed before the rows are read: an upload records its row before writing the file, so any file
			// listed here that is being uploaded right now already has a row by the time the rows are read.
			const storage = getStorageService();
			const stored = (await Promise.all(portfolioFilePrefixes(userId).map((prefix) => storage.list(prefix)))).flat();
			const recorded = new Set(
				(await tx.select({ key: file.key }).from(file).where(eq(file.userId, userId))).map((row) => row.key),
			);
			for (const key of stored) {
				if (recorded.has(key)) continue;
				await storage.delete(key).catch((error: unknown) => {
					console.error("[portfolio] Deleting a stray portfolio file failed; the next check retries.", error);
				});
			}
			await tx
				.update(schema.portfolio)
				// The data's version stays as it is, so an open editor never sees a conflict from this check.
				.set({ filesCheckedAt: now, updatedAt: sql`${schema.portfolio.updatedAt}` })
				.where(eq(schema.portfolio.userId, userId));
			return true;
		});
		if (done) checked += 1;
	}
	return checked;
}

/**
 * Portfolio upkeep, run every minute by the Workers cron and the Node scheduler after billing and career jobs. Runs can
 * overlap or repeat: rows are claimed with `SKIP LOCKED` and every step is safe to run twice. Nothing runs while
 * portfolios are off.
 */
export async function runPortfolioJobs(now = new Date()) {
	if (getPortfolioMode() === "off") return { deletedFiles: 0, checkedPortfolios: 0 };
	const deletedFiles = await task(
		() => deleteUnusedPortfolioFiles(now),
		0,
		"Deleting unused portfolio files failed; they are tried again on the next run.",
	);
	const checkedPortfolios = await task(
		() => sweepPortfolioFiles(now),
		0,
		"Checking portfolio files failed; they are checked again on the next run.",
	);
	return { deletedFiles, checkedPortfolios };
}
