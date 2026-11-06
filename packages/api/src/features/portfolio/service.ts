import type { PortfolioUnfurl, UnfurlProblem } from "./unfurl";
import type { DbOrTx } from "@rezumi/db/client";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { portfolioFileKeys } from "@rezumi/portfolio/files";
import { createInitialPortfolioData, workFromResumeProject } from "@rezumi/portfolio/initial";
import { sanitizePortfolioData } from "@rezumi/portfolio/rich-text";
import { parsePortfolioData, parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { portfolioFilePrefixes } from "@rezumi/schema/portfolio/files";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD, portfolioDataBytes } from "@rezumi/schema/portfolio/limits";
import { parseStoredResumeData } from "../resume/resume-data-validation";
import { getStorageService } from "../storage";
import { readPortfolioImageHeader } from "./image";
import { getPortfolioMode, isPortfolioEnabledFor } from "./mode";
import {
	fetchRemoteImage,
	RemoteImageError,
	readUnfurlCache,
	unfurlUrl,
	UnfurlError,
	writeUnfurlCache,
} from "./unfurl";

const portfolioColumns = {
	id: schema.portfolio.id,
	sourceResumeId: schema.portfolio.sourceResumeId,
	isPublic: schema.portfolio.isPublic,
	showInSearchEngines: schema.portfolio.showInSearchEngines,
	publishedAt: schema.portfolio.publishedAt,
	suspendedAt: schema.portfolio.suspendedAt,
	suspendedReason: schema.portfolio.suspendedReason,
	data: schema.portfolio.data,
	createdAt: schema.portfolio.createdAt,
	updatedAt: schema.portfolio.updatedAt,
};

type PortfolioRow = {
	id: string;
	sourceResumeId: string | null;
	isPublic: boolean;
	showInSearchEngines: boolean;
	publishedAt: Date | null;
	suspendedAt: Date | null;
	suspendedReason: string | null;
	data: unknown;
	createdAt: Date;
	updatedAt: Date;
};

export type PortfolioSourceResume = { id: string; name: string; slug: string; inTrash: boolean };

export type PortfolioDto = Omit<PortfolioRow, "data"> & {
	data: PortfolioData;
	/** The source resume, or null when there is none. One in Trash still shows here, so the editor can ask for another. */
	sourceResume: PortfolioSourceResume | null;
};

export const portfolioErrors = {
	disabled: () =>
		new ORPCError("PORTFOLIO_DISABLED", { status: 403, message: "Portfolios aren't available for this account yet." }),
	exists: () => new ORPCError("PORTFOLIO_EXISTS", { status: 409, message: "This account already has a portfolio." }),
	notFound: () => new ORPCError("NOT_FOUND", { status: 404, message: "This account has no portfolio yet." }),
	sourceInvalid: () =>
		new ORPCError("PORTFOLIO_SOURCE_INVALID", {
			status: 400,
			message: "Choose one of your resumes that isn't in Trash.",
		}),
	conflict: (updatedAt: Date) =>
		new ORPCError("PORTFOLIO_VERSION_CONFLICT", {
			status: 409,
			message: "The portfolio changed somewhere else after you opened it. Reload it, then make your change again.",
			data: { updatedAt: updatedAt.toISOString() },
		}),
	tooLarge: (bytes: number) =>
		new ORPCError("PORTFOLIO_TOO_LARGE", {
			status: 413,
			message: `The portfolio is too large to save (${Math.ceil(bytes / 1024)} KB of ${PORTFOLIO_LIMITS.dataBytes / 1024} KB). Shorten some text or remove a few blocks.`,
			data: { bytes, max: PORTFOLIO_LIMITS.dataBytes },
		}),
	invalid: (cause: unknown) =>
		new ORPCError("BAD_REQUEST", { status: 400, message: "The portfolio data isn't valid.", cause }),
	fileNotFound: (key: string) =>
		new ORPCError("PORTFOLIO_FILE_NOT_FOUND", {
			status: 400,
			message: "A file in this portfolio isn't one of its uploads. Upload it again.",
			data: { key },
		}),
	emailNotVerified: () =>
		new ORPCError("PORTFOLIO_EMAIL_NOT_VERIFIED", {
			status: 403,
			message: "Verify your email address before publishing your portfolio.",
		}),
	suspended: () =>
		new ORPCError("PORTFOLIO_SUSPENDED", {
			status: 403,
			message: "This portfolio was taken down and can't be published. Contact support to appeal.",
		}),
	fileTooLarge: (bytes: number, kind: "picture" | "pdf" | "remote-picture" = "picture") => {
		const max = {
			picture: PORTFOLIO_UPLOAD.imageBytes,
			pdf: PORTFOLIO_UPLOAD.pdfBytes,
			"remote-picture": PORTFOLIO_UPLOAD.remoteImageBytes,
		}[kind];
		const size = `${(bytes / 1024 / 1024).toFixed(1)} MB of ${max / 1024 / 1024} MB`;
		return new ORPCError("PORTFOLIO_FILE_TOO_LARGE", {
			status: 413,
			message: {
				picture: `This picture is too large to upload (${size}).`,
				pdf: `This PDF is too large to upload (${size}). Save a smaller copy and try again.`,
				"remote-picture": `This picture is too large to copy (more than ${max / 1024 / 1024} MB). Upload it yourself instead.`,
			}[kind],
			data: { bytes, max },
		});
	},
	pdfInvalid: (reason: "type") =>
		new ORPCError("PORTFOLIO_PDF_INVALID", {
			status: 400,
			message: "This file isn't a PDF. Upload a PDF file.",
			data: { reason },
		}),
	linkUnreadable: (reason: UnfurlProblem) =>
		new ORPCError("PORTFOLIO_LINK_UNREADABLE", {
			status: 400,
			message: "This site can't be read automatically. Fill in the details yourself.",
			data: { reason },
		}),
	imageInvalid: (reason: "type" | "animated" | "dimensions" | "unreadable") =>
		new ORPCError("PORTFOLIO_IMAGE_INVALID", {
			status: 400,
			message: {
				type: "Upload a JPEG, PNG or WebP picture.",
				animated: "Animated pictures can't be used. Upload a still picture.",
				dimensions: "This picture is larger than the portfolio allows. Upload it again so it's made smaller first.",
				unreadable: "This picture can't be read. Save it again as JPEG, PNG or WebP and upload that.",
			}[reason],
			data: { reason },
		}),
	fileInUse: (key: string) =>
		new ORPCError("PORTFOLIO_FILE_IN_USE", {
			status: 409,
			message: "The portfolio still uses this file. Remove it from the portfolio first.",
			data: { key },
		}),
	worksLimit: () =>
		new ORPCError("PORTFOLIO_WORKS_LIMIT", {
			status: 400,
			message: `A portfolio holds at most ${PORTFOLIO_LIMITS.works} works. Remove some before adding more.`,
			data: { max: PORTFOLIO_LIMITS.works },
		}),
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

async function toDto(row: PortfolioRow, userId: string, client: DbOrTx = db): Promise<PortfolioDto> {
	let sourceResume: PortfolioSourceResume | null = null;
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
	return { ...row, data: parsePortfolioData(row.data), sourceResume };
}

function parseInput(data: unknown): PortfolioData {
	try {
		return parseWritablePortfolioData(data);
	} catch (cause) {
		throw portfolioErrors.invalid(cause);
	}
}

/** Cleans rich text and checks the size and every file the data uses, before it is saved. */
async function prepareData(userId: string, data: PortfolioData, client: DbOrTx = db): Promise<PortfolioData> {
	const clean = sanitizePortfolioData(data);
	const bytes = portfolioDataBytes(clean);
	if (bytes > PORTFOLIO_LIMITS.dataBytes) throw portfolioErrors.tooLarge(bytes);

	const keys = portfolioFileKeys(clean);
	const foreign = keys.find((key) => !key.startsWith(`uploads/${userId}/`));
	if (foreign) throw portfolioErrors.fileNotFound(foreign);
	if (keys.length) {
		const recorded = await client
			.select({ key: schema.portfolioFile.key })
			.from(schema.portfolioFile)
			.where(and(eq(schema.portfolioFile.userId, userId), inArray(schema.portfolioFile.key, keys)));
		const known = new Set(recorded.map((row) => row.key));
		const missing = keys.find((key) => !known.has(key));
		if (missing) throw portfolioErrors.fileNotFound(missing);
	}
	return clean;
}

/**
 * Marks which of the account's files the saved data uses: used files get `unused_since` cleared; files nothing uses
 * anymore start counting from now, and the cleanup job deletes them a day later (`./jobs.ts`).
 */
async function trackFileUsage(userId: string, data: PortfolioData, client: DbOrTx = db): Promise<void> {
	const keys = portfolioFileKeys(data);
	const file = schema.portfolioFile;
	if (keys.length)
		await client
			.update(file)
			.set({ unusedSince: null })
			.where(and(eq(file.userId, userId), inArray(file.key, keys), isNotNull(file.unusedSince)));
	await client
		.update(file)
		.set({ unusedSince: sql`now()` })
		.where(
			and(eq(file.userId, userId), isNull(file.unusedSince), keys.length ? notInArray(file.key, keys) : undefined),
		);
}

/** Locks the account's portfolio row for this transaction: saves, file deletion and the cleanup job take turns. */
async function lockPortfolio(userId: string, tx: DbOrTx) {
	const [row] = await tx
		.select({
			updatedAt: schema.portfolio.updatedAt,
			sourceResumeId: schema.portfolio.sourceResumeId,
			data: schema.portfolio.data,
		})
		.from(schema.portfolio)
		.where(eq(schema.portfolio.userId, userId))
		.for("update");
	return row ?? null;
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

/** Writes files already recorded in `portfolio_file`; when storage fails, removes what was written and the rows. */
async function storeRecordedFiles(files: readonly { key: string; data: Uint8Array; contentType: string }[]) {
	const storage = getStorageService();
	const written: string[] = [];
	try {
		for (const file of files) {
			await storage.write({ key: file.key, data: file.data, contentType: file.contentType });
			written.push(file.key);
		}
	} catch (error) {
		await Promise.allSettled(written.map((key) => storage.delete(key)));
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

async function storageUsage(userId: string): Promise<number> {
	const [row] = await db
		.select({ bytes: sql<string | null>`sum(${schema.portfolioFile.bytes})` })
		.from(schema.portfolioFile)
		.where(eq(schema.portfolioFile.userId, userId));
	return Number(row?.bytes ?? 0);
}

/**
 * Settings changes keep `updatedAt` as it is: it versions the data, so publishing in one tab never makes an editor
 * open in another report a conflict.
 */
const keepUpdatedAt = { updatedAt: sql`${schema.portfolio.updatedAt}` };

export const portfolioService = {
	get: async (userId: string) => {
		const limits = { works: PORTFOLIO_LIMITS.works, storageBytes: null, dataBytes: PORTFOLIO_LIMITS.dataBytes };
		if (!(await enabledAccount(userId)))
			return { enabled: false, portfolio: null, limits, usage: { works: 0, storageBytes: 0 } };
		const [row] = await db.select(portfolioColumns).from(schema.portfolio).where(eq(schema.portfolio.userId, userId));
		const portfolio = row ? await toDto(row, userId) : null;
		return {
			enabled: true,
			portfolio,
			limits,
			usage: { works: portfolio?.data.works.items.length ?? 0, storageBytes: await storageUsage(userId) },
		};
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

		const resume: ResumeData | null = source ? parseStoredResumeData(source.data) : null;
		const { name, headline, location } = input.basics ?? {};
		const basics = {
			...(name === undefined ? {} : { name }),
			...(headline === undefined ? {} : { headline }),
			...(location === undefined ? {} : { location }),
		};
		const data = await prepareData(
			userId,
			createInitialPortfolioData({ resume, ...(input.theme ? { theme: input.theme } : {}), basics }),
		);

		// The unique user_id decides between two creates racing each other: one row, the other gets PORTFOLIO_EXISTS.
		const [row] = await db
			.insert(schema.portfolio)
			.values({ userId, sourceResumeId: source?.id ?? null, data })
			.onConflictDoNothing({ target: schema.portfolio.userId })
			.returning(portfolioColumns);
		if (!row) throw portfolioErrors.exists();
		await trackFileUsage(userId, data);
		return toDto(row, userId);
	},

	update: async (userId: string, input: { data: unknown; expectedUpdatedAt: Date }): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		const parsed = parseInput(input.data);
		return db.transaction(async (tx) => {
			// The row lock comes first, so a file the data uses can't be deleted (by `deleteFile` or the cleanup job)
			// between checking it and saving.
			const existing = await lockPortfolio(userId, tx);
			if (!existing) throw portfolioErrors.notFound();
			const data = await prepareData(userId, parsed, tx);
			// Compared in JavaScript under the row lock, at millisecond precision: Postgres keeps microseconds, so an
			// SQL comparison with a JavaScript date would never match a row stamped by now() (see the resume service).
			if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
				throw portfolioErrors.conflict(existing.updatedAt);
			const [row] = await tx
				.update(schema.portfolio)
				.set({ data })
				.where(eq(schema.portfolio.userId, userId))
				.returning(portfolioColumns);
			if (!row) throw portfolioErrors.notFound();
			await trackFileUsage(userId, data, tx);
			return toDto(row, userId, tx);
		});
	},

	/**
	 * Adds works copied from projects of the source resume, in the resume's order. Projects already copied are skipped,
	 * so asking twice adds nothing twice. Saved like `update`: the same checks, and the version the editor had.
	 */
	importWorks: async (
		userId: string,
		input: { resumeItemIds: readonly string[]; expectedUpdatedAt: Date },
	): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		return db.transaction(async (tx) => {
			const existing = await lockPortfolio(userId, tx);
			if (!existing) throw portfolioErrors.notFound();
			if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
				throw portfolioErrors.conflict(existing.updatedAt);
			const resume = existing.sourceResumeId ? await findActiveResume(userId, existing.sourceResumeId, tx) : null;
			if (!resume) throw portfolioErrors.sourceInvalid();

			const current = parsePortfolioData(existing.data);
			const wanted = new Set(input.resumeItemIds);
			const imported = new Set(current.works.items.flatMap((work) => work.fromResumeItemId ?? []));
			const taken = new Set(current.works.items.map((work) => work.slug));
			const added = parseStoredResumeData(resume.data)
				.sections.projects.items.filter((project) => wanted.has(project.id) && !imported.has(project.id))
				.map((project) => workFromResumeProject(project, taken))
				.filter((work) => work !== null);
			if (current.works.items.length + added.length > PORTFOLIO_LIMITS.works) throw portfolioErrors.worksLimit();

			const data = await prepareData(
				userId,
				parseInput({ ...current, works: { items: [...current.works.items, ...added] } }),
				tx,
			);
			const [row] = await tx
				.update(schema.portfolio)
				.set(added.length ? { data } : { data, updatedAt: sql`${schema.portfolio.updatedAt}` })
				.where(eq(schema.portfolio.userId, userId))
				.returning(portfolioColumns);
			if (!row) throw portfolioErrors.notFound();
			await trackFileUsage(userId, data, tx);
			return toDto(row, userId, tx);
		});
	},

	/**
	 * Stores a picture the browser already shrank and re-encoded (`02-teknis.md` section 8), with its optional small
	 * copy for cards. The file's own bytes decide what it is; the size, type and pixel size are checked again here. The
	 * file is recorded before it's written, so storage never holds a portfolio picture the cleanup job doesn't know of;
	 * it counts as unused until saved data uses it.
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

		await db.insert(schema.portfolioFile).values(
			files.map((file) => ({
				userId,
				kind: "image" as const,
				key: file.key,
				bytes: file.data.byteLength,
				width: file.width,
				height: file.height,
				unusedSince: sql`now()`,
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
	 * unused until saved data uses it, like pictures.
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
		await db.insert(schema.portfolioFile).values({
			userId,
			kind: "pdf",
			key,
			bytes: data.byteLength,
			pages: input.pages,
			unusedSince: sql`now()`,
		});
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
	 * Deletes one of the account's portfolio files that saved data no longer uses (an image removed in the editor). A
	 * file still in use is refused; the editor saves first. Files left behind are deleted by the cleanup job anyway.
	 */
	deleteFile: async (userId: string, input: { key: string }): Promise<void> => {
		await requireEnabled(userId);
		const { key } = input;
		if (!key.startsWith(`uploads/${userId}/`)) throw portfolioErrors.fileNotFound(key);
		await db.transaction(async (tx) => {
			const portfolio = await lockPortfolio(userId, tx);
			const [file] = await tx
				.select({ id: schema.portfolioFile.id })
				.from(schema.portfolioFile)
				.where(and(eq(schema.portfolioFile.userId, userId), eq(schema.portfolioFile.key, key)))
				.for("update");
			if (!file) throw portfolioErrors.fileNotFound(key);
			if (portfolio && portfolioFileKeys(parsePortfolioData(portfolio.data)).includes(key))
				throw portfolioErrors.fileInUse(key);
			// Storage first: when it fails, the row stays and the cleanup job tries again later.
			await getStorageService().delete(key);
			await tx.delete(schema.portfolioFile).where(eq(schema.portfolioFile.id, file.id));
		});
	},

	setPublic: async (userId: string, input: { isPublic: boolean }): Promise<PortfolioDto> => {
		const account = await requireEnabled(userId);
		if (input.isPublic && !account.emailVerified) throw portfolioErrors.emailNotVerified();
		const [row] = await db
			.update(schema.portfolio)
			.set(
				input.isPublic
					? {
							isPublic: true,
							publishedAt: sql`coalesce(${schema.portfolio.publishedAt}, now())`,
							...keepUpdatedAt,
						}
					: { isPublic: false, ...keepUpdatedAt },
			)
			.where(
				and(
					eq(schema.portfolio.userId, userId),
					// A taken-down portfolio can still be unpublished, never published.
					input.isPublic ? isNull(schema.portfolio.suspendedAt) : undefined,
				),
			)
			.returning(portfolioColumns);
		if (row) return toDto(row, userId);
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
		const [row] = await db
			.update(schema.portfolio)
			.set({
				...(input.showInSearchEngines === undefined ? {} : { showInSearchEngines: input.showInSearchEngines }),
				...(input.sourceResumeId === undefined ? {} : { sourceResumeId: input.sourceResumeId }),
				...keepUpdatedAt,
			})
			.where(eq(schema.portfolio.userId, userId))
			.returning(portfolioColumns);
		if (!row) throw portfolioErrors.notFound();
		return toDto(row, userId);
	},

	/** Deletes the portfolio and every file uploaded for it. */
	delete: async (userId: string): Promise<void> => {
		await requireEnabled(userId);
		const [existing] = await db
			.select({ id: schema.portfolio.id })
			.from(schema.portfolio)
			.where(eq(schema.portfolio.userId, userId));
		if (!existing) throw portfolioErrors.notFound();
		// Files first, like account deletion: a failure is logged and the rest still goes.
		const storage = getStorageService();
		for (const prefix of portfolioFilePrefixes(userId)) {
			try {
				await storage.delete(prefix);
			} catch (error) {
				console.error("Failed to delete portfolio files for user %s:", userId, error);
			}
		}
		await db.transaction(async (tx) => {
			await tx.delete(schema.portfolioFile).where(eq(schema.portfolioFile.userId, userId));
			await tx.delete(schema.portfolio).where(eq(schema.portfolio.userId, userId));
		});
	},
};
