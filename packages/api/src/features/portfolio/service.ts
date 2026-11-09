import type { Transaction } from "../billing/account";
import type { PortfolioUnfurl } from "./unfurl";
import type { DbOrTx } from "@rezumi/db/client";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { portfolioFileKeys, portfolioFileKeysInStoredData } from "@rezumi/portfolio/files";
import { readPortfolioImageHeader } from "@rezumi/portfolio/image-header";
import { createInitialPortfolioData, workFromResumeProject } from "@rezumi/portfolio/initial";
import { sanitizePortfolioData } from "@rezumi/portfolio/rich-text";
import { parsePortfolioData, parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import {
	PORTFOLIO_LIMITS,
	PORTFOLIO_UNUSED_FILE_GRACE_MS,
	PORTFOLIO_UPLOAD,
	portfolioDataBytes,
} from "@rezumi/schema/portfolio/limits";
import { lockBillingAccount } from "../billing/account";
import { getEntitlements, isBillingAppliedTo } from "../billing/entitlements";
import { portfolioLimitReached } from "../billing/limits";
import { parseStoredResumeData } from "../resume/resume-data-validation";
import { getStorageService } from "../storage";
import { deletePortfolioMessage, listPortfolioMessages, setPortfolioMessageRead } from "./contact";
import { portfolioErrors } from "./errors";
import {
	deleteUnusedFiles,
	lockPortfolio,
	markFileUsage,
	OVERDUE,
	readStoredData,
	removeStoredFile,
	storedFiles,
} from "./file-store";
import { getPortfolioMode, isPortfolioEnabledFor } from "./mode";
import { assertPortfolioPlan } from "./plan";
import { portfolioStatistics } from "./statistics";
import { isContactFormConfigured } from "./turnstile";
import {
	fetchRemoteImage,
	RemoteImageError,
	readUnfurlCache,
	unfurlUrl,
	UnfurlError,
	writeUnfurlCache,
} from "./unfurl";

/** The portfolio's columns but its data, which a save already has and a read parses. */
const rowColumns = {
	id: schema.portfolio.id,
	sourceResumeId: schema.portfolio.sourceResumeId,
	isPublic: schema.portfolio.isPublic,
	showInSearchEngines: schema.portfolio.showInSearchEngines,
	publishedAt: schema.portfolio.publishedAt,
	suspendedAt: schema.portfolio.suspendedAt,
	suspendedReason: schema.portfolio.suspendedReason,
	createdAt: schema.portfolio.createdAt,
	updatedAt: schema.portfolio.updatedAt,
};
const portfolioColumns = { ...rowColumns, data: schema.portfolio.data };

type PortfolioRow = {
	id: string;
	sourceResumeId: string | null;
	isPublic: boolean;
	showInSearchEngines: boolean;
	publishedAt: Date | null;
	suspendedAt: Date | null;
	suspendedReason: string | null;
	createdAt: Date;
	updatedAt: Date;
};

type SourceResume = { id: string; name: string; slug: string; inTrash: boolean };

export type PortfolioDto = PortfolioRow & {
	data: PortfolioData;
	/** The source resume, or null when there is none. One in Trash still shows here, so the editor can ask for another. */
	sourceResume: SourceResume | null;
};

type Account = { role: string | null; isAnonymous: boolean; emailVerified: boolean };

async function loadAccount(userId: string, client: DbOrTx = db): Promise<Account | null> {
	const [account] = await client
		.select({ role: schema.user.role, isAnonymous: schema.user.isAnonymous, emailVerified: schema.user.emailVerified })
		.from(schema.user)
		.where(eq(schema.user.id, userId));
	return account ?? null;
}

/** The account, when portfolios are open to it. Reads nothing while the mode is off. */
async function enabledAccount(userId: string): Promise<Account | null> {
	const mode = getPortfolioMode();
	if (mode === "off") return null;
	const account = await loadAccount(userId);
	return account && isPortfolioEnabledFor(account, mode) ? account : null;
}

async function requireEnabled(userId: string): Promise<Account> {
	const account = await enabledAccount(userId);
	if (!account) throw portfolioErrors.disabled();
	return account;
}

/** A resume the account owns that isn't in Trash, with its data. */
async function findActiveResume(userId: string, resumeId: string, client: DbOrTx = db) {
	const [row] = await client
		.select({ id: schema.resume.id, data: schema.resume.data })
		.from(schema.resume)
		.where(and(eq(schema.resume.id, resumeId), eq(schema.resume.userId, userId), isNull(schema.resume.trashedAt)));
	return row ?? null;
}

/** The resume a new portfolio starts from when none is chosen: the primary resume, else the latest edited one. */
async function defaultSourceResume(userId: string) {
	const [row] = await db
		.select({ id: schema.resume.id, data: schema.resume.data })
		.from(schema.resume)
		.where(and(eq(schema.resume.userId, userId), isNull(schema.resume.trashedAt)))
		.orderBy(desc(schema.resume.isPrimary), desc(schema.resume.updatedAt))
		.limit(1);
	return row ?? null;
}

/** A source resume's data; stored data that can't be read is `PORTFOLIO_SOURCE_INVALID`, never a server error. */
function readSourceResume(data: unknown): ResumeData {
	try {
		return parseStoredResumeData(data);
	} catch (cause) {
		throw portfolioErrors.sourceInvalid("unreadable", cause);
	}
}

async function toDto(row: PortfolioRow, data: PortfolioData, userId: string, client: DbOrTx = db) {
	let sourceResume: SourceResume | null = null;
	if (row.sourceResumeId) {
		const [resume] = await client
			.select({
				id: schema.resume.id,
				name: schema.resume.name,
				slug: schema.resume.slug,
				trashedAt: schema.resume.trashedAt,
			})
			.from(schema.resume)
			.where(and(eq(schema.resume.id, row.sourceResumeId), eq(schema.resume.userId, userId)));
		if (resume)
			sourceResume = { id: resume.id, name: resume.name, slug: resume.slug, inTrash: resume.trashedAt !== null };
	}
	return { ...row, data, sourceResume } satisfies PortfolioDto;
}

/** Data a save writes: cleaned, within the size limit, and the files it refers to (the account's own). */
type PreparedData = { data: PortfolioData; files: string[] };

/**
 * Cleans rich text, then checks the size and that every file the data refers to is under the account's folder.
 * Whether each is recorded is checked as the data is saved (`markFileUsage`). It needs no database, so a save runs it
 * before taking the portfolio's lock.
 */
function prepareData(userId: string, data: PortfolioData): PreparedData {
	const clean = sanitizePortfolioData(data);
	const bytes = portfolioDataBytes(clean);
	if (bytes > PORTFOLIO_LIMITS.dataBytes) throw portfolioErrors.tooLarge(bytes);
	const files = portfolioFileKeys(clean);
	const foreign = files.find((key) => !key.startsWith(`uploads/${userId}/`));
	if (foreign) throw portfolioErrors.fileNotFound(foreign);
	return { data: clean, files };
}

/** Strictly checks data the server built from stored data (`importWorks`); the router checks what clients send. */
function parseBuiltData(data: unknown): PortfolioData {
	try {
		return parseWritablePortfolioData(data);
	} catch (cause) {
		throw portfolioErrors.invalid(cause);
	}
}

type LockedPortfolio = NonNullable<Awaited<ReturnType<typeof lockPortfolio>>>;

/**
 * The one way data is saved over the version an editor had (`update`, `importWorks`), in the caller's transaction:
 * lock the portfolio's row, compare the version (cheap, so a stale editor costs nothing more), build the new data
 * (`build` returns null when nothing changes: then nothing is written and the version stays), check it against the
 * plan, write it with a new version, and mark which files it uses (refusing files that aren't recorded).
 */
async function saveVersionedData(
	tx: Transaction,
	userId: string,
	expectedUpdatedAt: Date,
	build: (existing: LockedPortfolio) => PreparedData | null | Promise<PreparedData | null>,
): Promise<PortfolioDto> {
	const existing = await lockPortfolio(tx, userId);
	if (!existing) throw portfolioErrors.notFound();
	// Compared in JavaScript, at millisecond precision: Postgres keeps microseconds, so an SQL comparison with a
	// JavaScript date would never match a row stamped by now() (see the resume service).
	if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw portfolioErrors.conflict(existing.updatedAt);

	const next = await build(existing);
	if (!next) {
		const [row] = await tx.select(portfolioColumns).from(schema.portfolio).where(eq(schema.portfolio.userId, userId));
		if (!row) throw portfolioErrors.notFound();
		return toDto(row, parsePortfolioData(row.data), userId, tx);
	}

	await assertPortfolioPlan(tx, userId, next.data);

	// Always later than the version replaced, even within one millisecond or with a server clock behind another's.
	const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
	const [row] = await tx
		.update(schema.portfolio)
		.set({ data: next.data, updatedAt })
		.where(eq(schema.portfolio.userId, userId))
		.returning(rowColumns);
	if (!row) throw portfolioErrors.notFound();
	await markFileUsage(tx, userId, portfolioFileKeysInStoredData(next.data), { required: next.files });
	return toDto(row, next.data, userId, tx);
}

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

async function requirePortfolio(userId: string): Promise<void> {
	const [portfolio] = await db
		.select({ id: schema.portfolio.id })
		.from(schema.portfolio)
		.where(eq(schema.portfolio.userId, userId));
	if (!portfolio) throw portfolioErrors.notFound();
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

/** The account's portfolio for its own statistics and inbox; null while it has none. */
async function ownPortfolio(userId: string) {
	const account = await requireEnabled(userId);
	const [row] = await db
		.select({ id: schema.portfolio.id, data: schema.portfolio.data, timeZone: schema.user.timezone })
		.from(schema.portfolio)
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(eq(schema.portfolio.userId, userId))
		.limit(1);
	return row && account ? { id: row.id, data: parsePortfolioData(row.data), timeZone: row.timeZone } : null;
}

async function requireOwnPortfolio(userId: string) {
	const portfolio = await ownPortfolio(userId);
	if (!portfolio) throw portfolioErrors.notFound();
	return portfolio;
}

export const portfolioService = {
	statistics: async (userId: string) => {
		const portfolio = await ownPortfolio(userId);
		return portfolio ? portfolioStatistics({ portfolio, userId, timeZone: portfolio.timeZone }) : null;
	},

	messages: {
		list: async (userId: string, input: { cursor?: string | undefined; limit?: number | undefined }) => {
			const portfolio = await requireOwnPortfolio(userId);
			return listPortfolioMessages({ id: portfolio.id, services: portfolio.data.services.items }, input);
		},
		markRead: async (userId: string, input: { id: string; read: boolean }) =>
			setPortfolioMessageRead((await requireOwnPortfolio(userId)).id, input.id, input.read),
		delete: async (userId: string, input: { id: string }) =>
			deletePortfolioMessage((await requireOwnPortfolio(userId)).id, input.id),
	},

	get: async (userId: string) => {
		const technical = {
			works: PORTFOLIO_LIMITS.works,
			storageBytes: PORTFOLIO_UPLOAD.accountBytes,
			dataBytes: PORTFOLIO_LIMITS.dataBytes,
		};
		if (!(await enabledAccount(userId)))
			return {
				enabled: false,
				portfolio: null,
				contactFormAvailable: false,
				limits: technical,
				usage: { works: 0, storageBytes: 0 },
			};
		const plan = (await getEntitlements(userId)).limits;
		const limits = {
			...technical,
			works: Math.min(plan.portfolioWorks ?? technical.works, technical.works),
			storageBytes: Math.min(plan.portfolioStorageBytes ?? technical.storageBytes, technical.storageBytes),
		};
		const [row] = await db.select(portfolioColumns).from(schema.portfolio).where(eq(schema.portfolio.userId, userId));
		const portfolio = row ? await toDto(row, parsePortfolioData(row.data), userId) : null;
		return {
			enabled: true,
			portfolio,
			contactFormAvailable: isContactFormConfigured(),
			limits,
			usage: { works: portfolio?.data.works.items.length ?? 0, storageBytes: (await storedFiles(userId)).bytes },
		};
	},

	/**
	 * Whether portfolios are open to the account and, when it has one, whether it's published or taken down: what the
	 * app's menu and the resume's Share panel need, without the data, the storage sum or the source resume that `get`
	 * reads. Reads nothing while the mode is off.
	 */
	status: async (userId: string) => {
		if (!(await enabledAccount(userId))) return { enabled: false, portfolio: null };
		const [row] = await db
			.select({ isPublic: schema.portfolio.isPublic, suspendedAt: schema.portfolio.suspendedAt })
			.from(schema.portfolio)
			.where(eq(schema.portfolio.userId, userId));
		return { enabled: true, portfolio: row ?? null };
	},

	create: async (
		userId: string,
		input: {
			/** A resume to start from; null for none; missing for the primary (or latest edited) resume. */
			sourceResumeId?: string | null | undefined;
			theme?: PortfolioTheme | undefined;
			basics?: { name?: string | undefined; headline?: string | undefined; location?: string | undefined } | undefined;
		},
	): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		let source: { id: string; data: unknown } | null = null;
		if (typeof input.sourceResumeId === "string") {
			source = await findActiveResume(userId, input.sourceResumeId);
			if (!source) throw portfolioErrors.sourceInvalid();
		} else if (input.sourceResumeId === undefined) {
			source = await defaultSourceResume(userId);
		}

		const resume = source ? readSourceResume(source.data) : null;
		const { name, headline, location } = input.basics ?? {};
		const basics = {
			...(name === undefined ? {} : { name }),
			...(headline === undefined ? {} : { headline }),
			...(location === undefined ? {} : { location }),
		};
		const initial = createInitialPortfolioData({ resume, ...(input.theme ? { theme: input.theme } : {}), basics });
		// A resume with more projects than the plan's works starts with the first ones, instead of refusing the portfolio.
		const maxWorks = (await getEntitlements(userId)).limits.portfolioWorks;
		if (maxWorks !== null) initial.works.items = initial.works.items.slice(0, maxWorks);
		const next = prepareData(userId, initial);

		return db.transaction(async (tx) => {
			await assertPortfolioPlan(tx, userId, next.data, true);
			// The unique user_id decides between two creates racing each other: one row, the other gets PORTFOLIO_EXISTS.
			const [row] = await tx
				.insert(schema.portfolio)
				.values({ userId, sourceResumeId: source?.id ?? null, data: next.data })
				.onConflictDoNothing({ target: schema.portfolio.userId })
				.returning(rowColumns);
			if (!row) throw portfolioErrors.exists();
			await markFileUsage(tx, userId, portfolioFileKeysInStoredData(next.data), { required: next.files });
			return toDto(row, next.data, userId, tx);
		});
	},

	/**
	 * Saves the editor's data over the version it had. `data` has passed the router's strict schema; it is cleaned and
	 * size-checked before the portfolio's lock is taken (`saveVersionedData`).
	 */
	update: async (userId: string, input: { data: PortfolioData; expectedUpdatedAt: Date }): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		const next = prepareData(userId, input.data);
		return db.transaction((tx) => saveVersionedData(tx, userId, input.expectedUpdatedAt, () => next));
	},

	/**
	 * Adds works copied from projects of the source resume, in the resume's order. Projects already copied are skipped,
	 * so asking twice adds nothing twice, and when nothing is added nothing is written (the version stays). Saved like
	 * `update`: the same checks, and the version the editor had.
	 */
	importWorks: async (
		userId: string,
		input: { resumeItemIds: readonly string[]; expectedUpdatedAt: Date },
	): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		return db.transaction((tx) =>
			saveVersionedData(tx, userId, input.expectedUpdatedAt, async (existing) => {
				const resume = existing.sourceResumeId ? await findActiveResume(userId, existing.sourceResumeId, tx) : null;
				if (!resume) throw portfolioErrors.sourceInvalid();
				const projects = readSourceResume(resume.data).sections.projects.items;

				const current = parsePortfolioData(await readStoredData(tx, userId));
				const wanted = new Set(input.resumeItemIds);
				const imported = new Set(current.works.items.flatMap((work) => work.fromResumeItemId ?? []));
				const taken = new Set(current.works.items.map((work) => work.slug));
				const added = projects
					.filter((project) => wanted.has(project.id) && !imported.has(project.id))
					.map((project) => workFromResumeProject(project, taken))
					.filter((work) => work !== null);
				if (!added.length) return null;
				if (current.works.items.length + added.length > PORTFOLIO_LIMITS.works) throw portfolioErrors.worksLimit();
				return prepareData(
					userId,
					parseBuiltData({ ...current, works: { items: [...current.works.items, ...added] } }),
				);
			}),
		);
	},

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

	setPublic: async (userId: string, input: { isPublic: boolean }): Promise<PortfolioDto> => {
		const account = await requireEnabled(userId);
		if (input.isPublic && !account.emailVerified) throw portfolioErrors.emailNotVerified();
		// Settings never move `updatedAt`, the data's version: publishing in one tab never makes an editor open in
		// another report a conflict.
		const [row] = await db
			.update(schema.portfolio)
			.set(
				input.isPublic
					? { isPublic: true, publishedAt: sql`coalesce(${schema.portfolio.publishedAt}, now())` }
					: { isPublic: false },
			)
			.where(
				and(
					eq(schema.portfolio.userId, userId),
					// A taken-down portfolio can still be unpublished, never published.
					input.isPublic ? isNull(schema.portfolio.suspendedAt) : undefined,
				),
			)
			.returning(portfolioColumns);
		if (row) return toDto(row, parsePortfolioData(row.data), userId);
		const [existing] = await db
			.select({ id: schema.portfolio.id })
			.from(schema.portfolio)
			.where(eq(schema.portfolio.userId, userId));
		throw existing ? portfolioErrors.suspended() : portfolioErrors.notFound();
	},

	updateSettings: async (
		userId: string,
		input: { showInSearchEngines?: boolean | undefined; sourceResumeId?: string | null | undefined },
	): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		if (typeof input.sourceResumeId === "string" && !(await findActiveResume(userId, input.sourceResumeId)))
			throw portfolioErrors.sourceInvalid();
		const changes = {
			...(input.showInSearchEngines === undefined ? {} : { showInSearchEngines: input.showInSearchEngines }),
			...(input.sourceResumeId === undefined ? {} : { sourceResumeId: input.sourceResumeId }),
		};
		const mine = eq(schema.portfolio.userId, userId);
		// Like publishing, settings keep `updatedAt`.
		const [row] = Object.keys(changes).length
			? await db.update(schema.portfolio).set(changes).where(mine).returning(portfolioColumns)
			: await db.select(portfolioColumns).from(schema.portfolio).where(mine);
		if (!row) throw portfolioErrors.notFound();
		return toDto(row, parsePortfolioData(row.data), userId);
	},

	/**
	 * Deletes the portfolio, and with it every file uploaded for it: the files are made due at once, and the cleanup
	 * job deletes them from storage and their rows on its next run (retrying any storage fails on). The public upload
	 * route stops serving them as soon as no saved data uses them.
	 */
	delete: async (userId: string): Promise<void> => {
		await requireEnabled(userId);
		await db.transaction(async (tx) => {
			// The portfolio's row first, then its files: the order every save, upload and job takes them in.
			if (!(await lockPortfolio(tx, userId))) throw portfolioErrors.notFound();
			await tx.delete(schema.portfolio).where(eq(schema.portfolio.userId, userId));
			await tx
				.update(schema.portfolioFile)
				.set({ unusedSince: OVERDUE })
				.where(eq(schema.portfolioFile.userId, userId));
		});
	},
};
