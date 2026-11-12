import { and, asc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { portfolioFileKeysInStoredData } from "@rezumi/portfolio/files";
import { portfolioFilePrefixes } from "@rezumi/schema/portfolio/files";
import { PORTFOLIO_UNUSED_FILE_GRACE_MS } from "@rezumi/schema/portfolio/limits";
import { getStorageService } from "../storage";
import { deleteExpiredMessages, sendDueMessageEmails } from "./contact";
import { deleteUnusedFiles, lockPortfolio, markFileUsage, readStoredData, removeStoredFile } from "./file-store";
import { getPortfolioMode } from "./mode";
import { clearHandledReporterEmails } from "./report";

/** How often each portfolio's files are compared with its data and with storage. */
const PORTFOLIO_FILE_SWEEP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
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
 * Deletes files no saved data has used for a day (`deleteUnusedFiles`, one account at a time): the accounts whose
 * oldest due file is oldest first, so a deleted portfolio's files (due at once) go first. An account that fails is
 * logged and the others still run; it's tried again on the next run.
 */
async function deleteUnusedPortfolioFiles(now: Date): Promise<number> {
	const cutoff = new Date(now.getTime() - PORTFOLIO_UNUSED_FILE_GRACE_MS);
	const file = schema.portfolioFile;
	const accounts = await db
		.select({ userId: file.userId })
		.from(file)
		.where(and(isNotNull(file.unusedSince), lt(file.unusedSince, cutoff)))
		.groupBy(file.userId)
		.orderBy(sql`min(${file.unusedSince})`, asc(file.userId))
		.limit(ACCOUNTS_PER_RUN);

	let deleted = 0;
	for (const { userId } of accounts) {
		if (deleted >= FILES_PER_RUN) break;
		deleted += await task(
			() => deleteUnusedFiles(userId, { cutoff, limit: FILES_PER_RUN - deleted }),
			0,
			"Deleting an account's unused portfolio files failed; they are tried again on the next run.",
		);
	}
	return deleted;
}

/**
 * Checks one portfolio's files: under its row lock (skipped while a save holds it) which recorded files the stored
 * data uses, fixing `unused_since` both ways, and the check is claimed; then, outside the lock, storage objects in the
 * portfolio's folders that no row records (an upload whose cleanup failed, a file whose delete failed) are deleted.
 * False when the portfolio was skipped.
 */
async function sweepPortfolio(userId: string, now: Date, due: Date): Promise<boolean> {
	const claim = await db.transaction(async (tx) => {
		const portfolio = await lockPortfolio(tx, userId, { skipLocked: true });
		// Locked by a save, deleted, or checked by another run in the meantime.
		if (!portfolio || (portfolio.filesCheckedAt && portfolio.filesCheckedAt >= due)) return null;
		await markFileUsage(tx, userId, portfolioFileKeysInStoredData(await readStoredData(tx, userId)), { now });
		// The data's version stays as it is, so an open editor never sees a conflict from this check.
		await tx.update(schema.portfolio).set({ filesCheckedAt: now }).where(eq(schema.portfolio.userId, userId));
		return { previous: portfolio.filesCheckedAt };
	});
	if (!claim) return false;

	try {
		// Storage is listed before the rows are read: an upload records its row before writing its file, so a file
		// being uploaded right now already has a row by the time the rows are read.
		const storage = getStorageService();
		const stored = (await Promise.all(portfolioFilePrefixes(userId).map((prefix) => storage.list(prefix)))).flat();
		const file = schema.portfolioFile;
		const rows = await db.select({ key: file.key }).from(file).where(eq(file.userId, userId));
		const recorded = new Set(rows.map((row) => row.key));
		for (const key of stored) if (!recorded.has(key)) await removeStoredFile(key, storage);
	} catch (error) {
		// Storage failed: give the claim back, so a run a minute from now checks this portfolio again, not next week.
		await db
			.update(schema.portfolio)
			.set({ filesCheckedAt: claim.previous })
			.where(and(eq(schema.portfolio.userId, userId), eq(schema.portfolio.filesCheckedAt, now)));
		throw error;
	}
	return true;
}

/**
 * The weekly check of a few portfolios not checked for a week (`sweepPortfolio`), the least recently checked first.
 * A portfolio that fails is logged and the others still run.
 */
async function sweepPortfolioFiles(now: Date): Promise<number> {
	const due = new Date(now.getTime() - PORTFOLIO_FILE_SWEEP_INTERVAL_MS);
	const candidates = await db
		.select({ userId: schema.portfolio.userId })
		.from(schema.portfolio)
		.where(or(isNull(schema.portfolio.filesCheckedAt), lt(schema.portfolio.filesCheckedAt, due)))
		.orderBy(sql`${schema.portfolio.filesCheckedAt} asc nulls first`, asc(schema.portfolio.userId))
		.limit(SWEEPS_PER_RUN);

	let checked = 0;
	for (const { userId } of candidates) {
		const done = await task(
			() => sweepPortfolio(userId, now, due),
			false,
			"Checking a portfolio's files failed; it is checked again on a later run.",
		);
		if (done) checked += 1;
	}
	return checked;
}

/**
 * Portfolio upkeep, run every minute by the Workers cron and the Node scheduler after billing and career jobs. Runs can
 * overlap or repeat: rows are claimed with `SKIP LOCKED` and every step is safe to run twice. No step holds a
 * portfolio's lock while it talks to storage, so saving never waits on storage. While portfolios are off, what removes
 * personal data still runs (expired contact messages, handled reporters' addresses, and files of deleted portfolios or
 * files no saved data uses), because keeping it past its retention isn't an option; sending emails and the weekly check
 * wait until portfolios are back.
 */
export async function runPortfolioJobs(now = new Date()) {
	const deletedMessages = await task(
		() => deleteExpiredMessages(now),
		0,
		"Deleting expired portfolio messages failed; they are tried again on the next run.",
	);
	const clearedReporterEmails = await task(
		() => clearHandledReporterEmails(now),
		0,
		"Clearing handled reporters' addresses failed; they are tried again on the next run.",
	);
	const deletedFiles = await task(
		() => deleteUnusedPortfolioFiles(now),
		0,
		"Deleting unused portfolio files failed; they are tried again on the next run.",
	);
	if (getPortfolioMode() === "off")
		return { deletedFiles, checkedPortfolios: 0, deletedMessages, messageEmails: 0, clearedReporterEmails };
	const messageEmails = await task(
		() => sendDueMessageEmails(now),
		0,
		"Sending merged portfolio message emails failed; they are tried again on the next run.",
	);
	const checkedPortfolios = await task(
		() => sweepPortfolioFiles(now),
		0,
		"Checking portfolio files failed; they are checked again on the next run.",
	);
	return { deletedFiles, checkedPortfolios, deletedMessages, messageEmails, clearedReporterEmails };
}
