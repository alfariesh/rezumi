import type { DbOrTx } from "@rezumi/db/client";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { portfolioFileKeys } from "@rezumi/portfolio/files";
import { createInitialPortfolioData } from "@rezumi/portfolio/initial";
import { sanitizePortfolioData } from "@rezumi/portfolio/rich-text";
import { parsePortfolioData, parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { portfolioFilePrefixes } from "@rezumi/schema/portfolio/files";
import { PORTFOLIO_LIMITS, portfolioDataBytes } from "@rezumi/schema/portfolio/limits";
import { parseStoredResumeData } from "../resume/resume-data-validation";
import { getStorageService } from "../storage";
import { getPortfolioMode, isPortfolioEnabledFor } from "./mode";

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
		return toDto(row, userId);
	},

	update: async (userId: string, input: { data: unknown; expectedUpdatedAt: Date }): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		const parsed = parseInput(input.data);
		return db.transaction(async (tx) => {
			const data = await prepareData(userId, parsed, tx);
			const [existing] = await tx
				.select({ updatedAt: schema.portfolio.updatedAt })
				.from(schema.portfolio)
				.where(eq(schema.portfolio.userId, userId))
				.for("update");
			if (!existing) throw portfolioErrors.notFound();
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
			return toDto(row, userId, tx);
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
