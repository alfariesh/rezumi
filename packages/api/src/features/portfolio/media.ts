import type { PortfolioUnfurl } from "./unfurl";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { portfolioFileKeysInStoredData } from "@rezumi/portfolio/files";
import { readPortfolioImageHeader } from "@rezumi/portfolio/image-header";
import { PORTFOLIO_UNUSED_FILE_GRACE_MS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { lockBillingAccount } from "../billing/account";
import { getEntitlements, isBillingAppliedTo } from "../billing/entitlements";
import { portfolioLimitReached } from "../billing/limits";
import { getStorageService } from "../storage";
import { requireEnabled, requirePortfolio } from "./access";
import { portfolioErrors } from "./errors";
import { deleteUnusedFiles, lockPortfolio, OVERDUE, readStoredData, removeStoredFile, storedFiles } from "./file-store";
import {
	fetchRemoteImage,
	RemoteImageError,
	readUnfurlCache,
	unfurlUrl,
	UnfurlError,
	writeUnfurlCache,
} from "./unfurl";

/**
 * What the editor brings into a portfolio: uploaded pictures and PDFs, pasted links and their preview pictures, and
 * deleting an upload it no longer needs. Part of `portfolioService`; files are recorded in `portfolio_file` before
 * they're stored (`file-store.ts` keeps that bookkeeping).
 */

/** A picture's bytes and what it really is, or the error saying why it can't be stored. */
async function readUploadedPicture(file: File, maxSide: number) {
	if (file.size > PORTFOLIO_UPLOAD.imageBytes) throw portfolioErrors.fileTooLarge(file.size);
	const data = new Uint8Array(await file.arrayBuffer());
	if (data.byteLength > PORTFOLIO_UPLOAD.imageBytes) throw portfolioErrors.fileTooLarge(data.byteLength);
	const header = readPortfolioImageHeader(data);
	if (!header.ok) throw portfolioErrors.imageInvalid(header.reason);
	if (Math.max(header.image.width, header.image.height) > maxSide) throw portfolioErrors.imageInvalid("dimensions");
	return { data, ...header.image };
}

type NewFile = { key: string; bytes: number } & (
	| { kind: "image"; width: number; height: number }
	| { kind: "pdf"; pages: number }
);

/**
 * Records uploads before they're written, in one transaction under the portfolio's lock with the checks of the plan's
 * storage quota and the account's ceiling (`PORTFOLIO_UPLOAD.accountBytes` and `accountFiles`), so two uploads at once
 * can't both take the last room. Every recorded file counts, ones waiting for the cleanup job too: the number the
 * storage meter shows is the one enforced. Files already over a quota stay; only new ones are refused. Locks are taken
 * portfolio, then billing account, then file rows. A recorded file is unused until saved data uses it.
 */
async function recordUploads(userId: string, files: readonly NewFile[]): Promise<void> {
	await db.transaction(async (tx) => {
		if (!(await lockPortfolio(tx, userId))) throw portfolioErrors.notFound();
		if (await isBillingAppliedTo(userId, tx)) await lockBillingAccount(tx, userId);
		const entitlements = await getEntitlements(userId, new Date(), tx);
		const stored = await storedFiles(userId, tx);
		const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
		const quota = entitlements.limits.portfolioStorageBytes;
		// A quota at the account's ceiling is the ceiling: no plan offers more, so it's refused as storage being full.
		if (quota !== null && quota < PORTFOLIO_UPLOAD.accountBytes && stored.bytes + bytes > quota)
			throw portfolioLimitReached({
				limit: "portfolioStorageBytes",
				max: quota,
				used: stored.bytes,
				planId: entitlements.planId,
			});
		if (
			stored.bytes + bytes > PORTFOLIO_UPLOAD.accountBytes ||
			stored.files + files.length > PORTFOLIO_UPLOAD.accountFiles
		)
			throw portfolioErrors.storageFull(stored);
		await tx.insert(schema.portfolioFile).values(files.map((file) => ({ ...file, userId, unusedSince: sql`now()` })));
	});
}

/**
 * Writes files already recorded in `portfolio_file`, after their transaction committed. When storage fails, what was
 * written is deleted again and the rows go, so storage never keeps a file without a row for long (a stray left by a
 * failed delete is the weekly check's).
 */
async function storeRecordedFiles(files: readonly { key: string; data: Uint8Array; contentType: string }[]) {
	const storage = getStorageService();
	try {
		for (const file of files) await storage.write({ key: file.key, data: file.data, contentType: file.contentType });
	} catch (error) {
		for (const file of files) await removeStoredFile(file.key, storage);
		await db.delete(schema.portfolioFile).where(
			inArray(
				schema.portfolioFile.key,
				files.map((file) => file.key),
			),
		);
		throw error;
	}
}

const PDF_SIGNATURE = "%PDF-";

export const portfolioMedia = {
	/**
	 * Stores a picture the browser already shrank and re-encoded (`02-teknis.md` section 8), with its optional small
	 * copy for cards. The file's own bytes decide what it is; the size, type and pixel size are checked again here. The
	 * file is recorded before it's written (`recordUploads`, which also checks the account's storage ceiling), so
	 * storage never holds a portfolio picture the cleanup job doesn't know of; it counts as unused until saved data
	 * uses it.
	 */
	uploadImage: async (userId: string, input: { file: File; thumbnail?: File | undefined }) => {
		await requireEnabled(userId);
		await requirePortfolio(userId);

		const main = await readUploadedPicture(input.file, PORTFOLIO_UPLOAD.imageSide);
		const small = input.thumbnail ? await readUploadedPicture(input.thumbnail, PORTFOLIO_UPLOAD.thumbSide) : null;
		const id = randomUUID();
		const folder = `uploads/${userId}/pictures/portfolio`;
		const files = [
			{ ...main, key: `${folder}/${id}.${main.extension}` },
			...(small ? [{ ...small, key: `${folder}/${id}-sm.${small.extension}` }] : []),
		];

		await recordUploads(
			userId,
			files.map((file) => ({
				kind: "image",
				key: file.key,
				bytes: file.data.byteLength,
				width: file.width,
				height: file.height,
			})),
		);
		await storeRecordedFiles(files);

		const [first, second] = files;
		return {
			key: first?.key as string,
			...(second ? { thumbKey: second.key } : {}),
			width: main.width,
			height: main.height,
			bytes: files.reduce((sum, file) => sum + file.data.byteLength, 0),
		};
	},

	/**
	 * Stores a PDF for a work's PDF block (`02-teknis.md` section 19). The browser already checked it opens without a
	 * password and counted its pages; the server checks the size and that the bytes are a PDF, and the public route
	 * serves it locked down. The picture of its first page goes through `uploadImage`. Recorded before it's written,
	 * within the storage ceiling, unused until saved data uses it, like pictures.
	 */
	uploadPdf: async (userId: string, input: { file: File; pages: number }) => {
		await requireEnabled(userId);
		await requirePortfolio(userId);
		const max = PORTFOLIO_UPLOAD.pdfBytes;
		if (input.file.size > max) throw portfolioErrors.fileTooLarge(input.file.size, "pdf");
		const data = new Uint8Array(await input.file.arrayBuffer());
		if (data.byteLength > max) throw portfolioErrors.fileTooLarge(data.byteLength, "pdf");
		if (String.fromCharCode(...data.subarray(0, PDF_SIGNATURE.length)) !== PDF_SIGNATURE)
			throw portfolioErrors.pdfInvalid("type");

		const key = `uploads/${userId}/documents/portfolio/${randomUUID()}.pdf`;
		await recordUploads(userId, [{ kind: "pdf", key, bytes: data.byteLength, pages: input.pages }]);
		await storeRecordedFiles([{ key, data, contentType: "application/pdf" }]);
		return { key, bytes: data.byteLength, pages: input.pages };
	},

	/**
	 * Reads a pasted link into a video or a link card (`02-teknis.md` section 20), remembered for a day per link. A
	 * site that can't be read is `PORTFOLIO_LINK_UNREADABLE`, and the editor lets the owner fill the card in.
	 */
	unfurl: async (userId: string, input: { url: string }, signal?: AbortSignal): Promise<PortfolioUnfurl> => {
		await requireEnabled(userId);
		const cached = await readUnfurlCache(input.url);
		if (cached) return cached;
		try {
			const result = await unfurlUrl(input.url, { signal });
			await writeUnfurlCache(input.url, result);
			return result;
		} catch (error) {
			if (error instanceof UnfurlError) throw portfolioErrors.linkUnreadable(error.reason);
			throw error;
		}
	},

	/**
	 * Fetches a link's preview picture once the owner approves it, for the browser to shrink and store through
	 * `uploadImage`: the portfolio keeps its own copy and the page never loads pictures from other sites.
	 */
	fetchRemoteImage: async (userId: string, input: { url: string }, signal?: AbortSignal): Promise<File> => {
		await requireEnabled(userId);
		await requirePortfolio(userId);
		try {
			const picture = await fetchRemoteImage(input.url, { signal });
			return new File([picture.bytes as Uint8Array<ArrayBuffer>], `picture.${picture.extension}`, {
				type: picture.contentType,
			});
		} catch (error) {
			if (!(error instanceof RemoteImageError)) throw error;
			if (error.reason === "too-large")
				throw portfolioErrors.fileTooLarge(PORTFOLIO_UPLOAD.remoteImageBytes + 1, "remote-picture");
			if (error.reason === "type") throw portfolioErrors.imageInvalid("type");
			throw portfolioErrors.linkUnreadable(error.reason);
		}
	},

	/**
	 * Deletes one of the account's portfolio files that the saved data no longer names (an upload the editor
	 * discarded). A file still named anywhere in the stored data is refused; the editor saves first. Under the
	 * portfolio's lock the file is made due, then deleted the way the cleanup job deletes files (`deleteUnusedFiles`),
	 * storage outside the lock; when that can't happen now (a save holds the portfolio), the job's next run does it.
	 */
	deleteFile: async (userId: string, input: { key: string }): Promise<void> => {
		await requireEnabled(userId);
		const { key } = input;
		if (!key.startsWith(`uploads/${userId}/`)) throw portfolioErrors.fileNotFound(key);
		await db.transaction(async (tx) => {
			const portfolio = await lockPortfolio(tx, userId);
			const [row] = await tx
				.select({ id: schema.portfolioFile.id })
				.from(schema.portfolioFile)
				.where(and(eq(schema.portfolioFile.userId, userId), eq(schema.portfolioFile.key, key)))
				.for("update");
			if (!row) throw portfolioErrors.fileNotFound(key);
			if (portfolio && portfolioFileKeysInStoredData(await readStoredData(tx, userId)).includes(key))
				throw portfolioErrors.fileInUse(key);
			await tx.update(schema.portfolioFile).set({ unusedSince: OVERDUE }).where(eq(schema.portfolioFile.id, row.id));
		});
		const cutoff = new Date(Date.now() - PORTFOLIO_UNUSED_FILE_GRACE_MS);
		await deleteUnusedFiles(userId, { cutoff, limit: 1, keys: [key] }).catch((error: unknown) => {
			console.error("[portfolio] Deleting a file failed; the cleanup job deletes it on its next run.", error);
		});
	},
};
