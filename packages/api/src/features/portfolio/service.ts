import type { Transaction } from "../billing/account";
import type { DbOrTx } from "@rezumi/db/client";
import type { PortfolioAiViewInput, PortfolioEditPlan, PortfolioUpload } from "@rezumi/portfolio/edits";
import type { PortfolioSource } from "@rezumi/portfolio/view";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import type { PortfolioStatisticsRange } from "@rezumi/schema/portfolio/statistics";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ProfileData } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { ORPCError } from "@orpc/server";
import { hash } from "bcryptjs";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { applyPortfolioEdits, portfolioAiView } from "@rezumi/portfolio/edits";
import { portfolioFileKeys, portfolioFileKeysInStoredData } from "@rezumi/portfolio/files";
import { createInitialPortfolioData, workFromResumeProject } from "@rezumi/portfolio/initial";
import { sanitizePortfolioData } from "@rezumi/portfolio/rich-text";
import { resumeDataFromProfile } from "@rezumi/resume/profile";
import { parsePortfolioData, parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD, portfolioDataBytes } from "@rezumi/schema/portfolio/limits";
import { PROFILE_SECTION_TYPES } from "@rezumi/schema/profile/data";
import { getEntitlements } from "../billing/entitlements";
import { profileService } from "../profile/service";
import { parseStoredResumeData } from "../resume/resume-data-validation";
import { enabledAccount, requireEnabled } from "./access";
import { deletePortfolioMessage, listPortfolioMessages, setPortfolioMessageRead } from "./contact";
import { portfolioEditPlan, unplacedUploads } from "./edits";
import { portfolioErrors } from "./errors";
import { lockPortfolio, markFileUsage, OVERDUE, readStoredData, storedFiles } from "./file-store";
import { portfolioMedia } from "./media";
import { assertPortfolioPlan } from "./plan";
import { portfolioStatistics, portfolioWorkStatistics } from "./statistics";
import { isContactFormConfigured } from "./turnstile";

/** The portfolio's columns but its data, which a save already has and a read parses. */
const rowColumns = {
	id: schema.portfolio.id,
	sourceResumeId: schema.portfolio.sourceResumeId,
	isPublic: schema.portfolio.isPublic,
	showInSearchEngines: schema.portfolio.showInSearchEngines,
	publishedAt: schema.portfolio.publishedAt,
	suspendedAt: schema.portfolio.suspendedAt,
	suspendedReason: schema.portfolio.suspendedReason,
	// Whether visitors need a password; the hash itself never leaves the server.
	hasPassword: sql<boolean>`${schema.portfolio.password} is not null`,
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
	hasPassword: boolean;
	createdAt: Date;
	updatedAt: Date;
};

type SourceResume = { id: string; name: string; slug: string; inTrash: boolean };

export type PortfolioDto = PortfolioRow & {
	data: PortfolioData;
	/**
	 * The source resume, or null when the portfolio reads the Profile instead (`sourceResumeId` null). One in Trash still
	 * shows here, so the editor can ask for another.
	 */
	sourceResume: SourceResume | null;
};

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

/**
 * Where a portfolio's content comes from: its source resume, or the account's Profile when it has none
 * (`sourceResumeId` null). Null for a source resume in Trash: the page then shows no career sections and the editor
 * asks for another.
 */
async function readPortfolioSource(
	userId: string,
	sourceResumeId: string | null,
	client: DbOrTx = db,
): Promise<PortfolioSource | null> {
	if (!sourceResumeId) {
		const { data } = await profileService.read(userId, client);
		return { data: resumeDataFromProfile(data), from: "profile" };
	}
	const resume = await findActiveResume(userId, sourceResumeId, client);
	return resume ? { data: readSourceResume(resume.data), from: "resume" } : null;
}

const hasProfileItems = (profile: ProfileData) =>
	PROFILE_SECTION_TYPES.some((section) => profile.sections[section].length > 0);

/** Where a new portfolio starts from (see `create`), and the resume it keeps as its source, if any. */
async function startingSource(
	userId: string,
	sourceResumeId: string | null | undefined,
): Promise<{ resumeId: string | null; source: PortfolioSource }> {
	const fromResume = (resume: { id: string; data: unknown }) => ({
		resumeId: resume.id,
		source: { data: readSourceResume(resume.data), from: "resume" } satisfies PortfolioSource,
	});
	if (typeof sourceResumeId === "string") {
		const resume = await findActiveResume(userId, sourceResumeId);
		if (!resume) throw portfolioErrors.sourceInvalid();
		return fromResume(resume);
	}
	const { data: profile } = await profileService.read(userId);
	// A Profile with no career yet would start an empty page where a resume has one.
	const resume = sourceResumeId === undefined && !hasProfileItems(profile) ? await defaultSourceResume(userId) : null;
	if (resume) return fromResume(resume);
	return { resumeId: null, source: { data: resumeDataFromProfile(profile), from: "profile" } };
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

async function setVisitorPassword(userId: string, password: string | null): Promise<PortfolioDto> {
	const [row] = await db
		.update(schema.portfolio)
		.set({ password })
		.where(eq(schema.portfolio.userId, userId))
		.returning(portfolioColumns);
	if (!row) throw portfolioErrors.notFound();
	return toDto(row, parsePortfolioData(row.data), userId);
}

/**
 * What AI reads and edits (Phase 14): the saved portfolio, where its career sections come from, whether it's live and
 * where, its version, the pictures uploaded but not placed yet, and what the plan allows. The assistant keeps it as
 * its working copy for a reply; `aiView` turns it into what a model reads.
 */
export type PortfolioAiState = Omit<PortfolioAiViewInput, "plan" | "uploads"> & {
	plan: PortfolioEditPlan;
	/** Pictures uploaded but not placed in the saved data. */
	uploads: PortfolioUpload[];
	updatedAt: Date;
};

async function readAiState(userId: string): Promise<PortfolioAiState> {
	await requireEnabled(userId);
	const [row] = await db
		.select({
			data: schema.portfolio.data,
			sourceResumeId: schema.portfolio.sourceResumeId,
			isPublic: schema.portfolio.isPublic,
			suspendedAt: schema.portfolio.suspendedAt,
			updatedAt: schema.portfolio.updatedAt,
			username: schema.user.username,
		})
		.from(schema.portfolio)
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(eq(schema.portfolio.userId, userId));
	if (!row) throw portfolioErrors.notFound();
	const [source, sourceName, uploads, plan] = await Promise.all([
		// A source resume whose data can't be read leaves the career sections out, as the page does.
		readPortfolioSource(userId, row.sourceResumeId).catch((error: unknown) => {
			if (error instanceof ORPCError && error.code === "PORTFOLIO_SOURCE_INVALID") return null;
			throw error;
		}),
		row.sourceResumeId
			? db
					.select({ name: schema.resume.name })
					.from(schema.resume)
					.where(and(eq(schema.resume.id, row.sourceResumeId), eq(schema.resume.userId, userId)))
					.then(([resume]) => resume?.name ?? null)
			: null,
		unplacedUploads(userId),
		portfolioEditPlan(userId),
	]);
	return {
		data: parsePortfolioData(row.data),
		source: { from: row.sourceResumeId ? "resume" : "profile", name: sourceName, resume: source?.data ?? null },
		status: {
			published: row.isPublic && row.suspendedAt === null,
			url: new URL(`/${encodeURIComponent(row.username)}`, env.APP_URL).href,
		},
		uploads,
		plan,
		updatedAt: row.updatedAt,
	};
}

/** An applied edit as a caller sees it: where it was in the call, what it did, and the id of an item it added. */
type AppliedEditSummary = { index: number; summary: string; id?: string; ref?: string };

export const portfolioService = {
	// Uploads, links and file deletion (`media.ts`).
	...portfolioMedia,

	statistics: async (userId: string, input: { range?: PortfolioStatisticsRange | undefined } = {}) => {
		const portfolio = await ownPortfolio(userId);
		return portfolio
			? portfolioStatistics({
					portfolio,
					userId,
					timeZone: portfolio.timeZone,
					...(input.range ? { range: input.range } : {}),
				})
			: null;
	},

	workStatistics: async (userId: string, input: { workId: string; range?: PortfolioStatisticsRange | undefined }) => {
		const portfolio = await requireOwnPortfolio(userId);
		return portfolioWorkStatistics({
			portfolio,
			userId,
			timeZone: portfolio.timeZone,
			workId: input.workId,
			...(input.range ? { range: input.range } : {}),
		});
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
			/**
			 * A resume to start from; null for the Profile; missing for the Profile when it holds any career items, else
			 * the primary (or latest edited) resume, else the Profile.
			 */
			sourceResumeId?: string | null | undefined;
			theme?: PortfolioTheme | undefined;
			basics?: { name?: string | undefined; headline?: string | undefined; location?: string | undefined } | undefined;
		},
	): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		const { resumeId, source } = await startingSource(userId, input.sourceResumeId);

		const { name, headline, location } = input.basics ?? {};
		const basics = {
			...(name === undefined ? {} : { name }),
			...(headline === undefined ? {} : { headline }),
			...(location === undefined ? {} : { location }),
		};
		const initial = createInitialPortfolioData({
			resume: source,
			...(input.theme ? { theme: input.theme } : {}),
			basics,
		});
		// A source with more projects than the plan's works starts with the first ones, instead of refusing the portfolio.
		const maxWorks = (await getEntitlements(userId)).limits.portfolioWorks;
		if (maxWorks !== null) initial.works.items = initial.works.items.slice(0, maxWorks);
		const next = prepareData(userId, initial);

		return db.transaction(async (tx) => {
			await assertPortfolioPlan(tx, userId, next.data, true);
			// The unique user_id decides between two creates racing each other: one row, the other gets PORTFOLIO_EXISTS.
			const [row] = await tx
				.insert(schema.portfolio)
				.values({ userId, sourceResumeId: resumeId, data: next.data })
				.onConflictDoNothing({ target: schema.portfolio.userId })
				.returning(rowColumns);
			if (!row) throw portfolioErrors.exists();
			await markFileUsage(tx, userId, portfolioFileKeysInStoredData(next.data), { required: next.files });
			return toDto(row, next.data, userId, tx);
		});
	},

	/**
	 * What AI reads for this account: the saved portfolio and its source (the resume, or the Profile), null while its
	 * source resume is in Trash. It writes nothing: AI answers go to the editor, which applies them as edits.
	 */
	aiContext: async (userId: string): Promise<{ data: PortfolioData; source: PortfolioSource | null }> => {
		await requireEnabled(userId);
		const [row] = await db
			.select({ data: schema.portfolio.data, sourceResumeId: schema.portfolio.sourceResumeId })
			.from(schema.portfolio)
			.where(eq(schema.portfolio.userId, userId));
		if (!row) throw portfolioErrors.notFound();
		return { data: parsePortfolioData(row.data), source: await readPortfolioSource(userId, row.sourceResumeId) };
	},

	/** The portfolio as AI works on it (`PortfolioAiState`): the in-app assistant keeps it as a reply's working copy. */
	aiState: readAiState,

	/**
	 * The portfolio as a model reads it (`portfolioAiView`): every item with its id, the career sections from the source
	 * (read-only), the pictures it may place, its limits and what the plan locks. Contact details are never included.
	 */
	aiView: async (userId: string) => {
		const state = await readAiState(userId);
		const placed = new Set(portfolioFileKeys(state.data));
		const uploads: PortfolioUpload[] = state.uploads.filter((upload) => !placed.has(upload.key));
		return {
			view: portfolioAiView({ ...state, uploads }),
			updatedAt: state.updatedAt,
			published: state.status.published,
			url: state.status.url,
			uploads,
			plan: state.plan,
		};
	},

	/**
	 * Applies AI edits (`@rezumi/portfolio/edits`, strict) to the saved portfolio in one transaction under its lock, and
	 * saves the result the way `update` does (cleaned, size-checked, the plan and file usage checked). Edits address
	 * items by id, so they apply to the latest data; `expectedUpdatedAt`, when given, must still be its version. An edit
	 * that fails is reported with the reason and the rest still apply; when none applies, nothing is written and the
	 * version stays. Pictures an edit places are the data's own or this account's uploads not placed yet.
	 */
	applyEdits: async (
		userId: string,
		input: { title?: string | undefined; edits: readonly PortfolioEdit[]; expectedUpdatedAt?: Date | undefined },
	): Promise<{
		title: string | null;
		applied: AppliedEditSummary[];
		failed: { index: number; error: string }[];
		updatedAt: Date;
	}> => {
		await requireEnabled(userId);
		return db.transaction(async (tx) => {
			const existing = await lockPortfolio(tx, userId);
			if (!existing) throw portfolioErrors.notFound();
			if (input.expectedUpdatedAt && existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
				throw portfolioErrors.conflict(existing.updatedAt);
			const current = parsePortfolioData(await readStoredData(tx, userId));
			const [plan, uploads] = await Promise.all([portfolioEditPlan(userId, tx), unplacedUploads(userId, tx)]);
			const result = applyPortfolioEdits(current, input.edits, { mode: "strict", plan, images: uploads });
			const applied = result.applied.map((edit): AppliedEditSummary => ({
				index: edit.index,
				summary: edit.summary,
				...(edit.id ? { id: edit.id } : {}),
				...(edit.ref ? { ref: edit.ref } : {}),
			}));
			const title = input.title ?? null;
			if (!applied.length) return { title, applied, failed: result.failed, updatedAt: existing.updatedAt };
			const next = prepareData(userId, result.data);
			const saved = await saveVersionedData(tx, userId, existing.updatedAt, () => next);
			return { title, applied, failed: result.failed, updatedAt: saved.updatedAt };
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
	 * Adds works copied from projects of the source (the resume, or the Profile), in its order. Projects already copied
	 * are skipped, so asking twice adds nothing twice, and when nothing is added nothing is written (the version stays).
	 * Saved like `update`: the same checks, and the version the editor had.
	 */
	importWorks: async (
		userId: string,
		input: { resumeItemIds: readonly string[]; expectedUpdatedAt: Date },
	): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		return db.transaction((tx) =>
			saveVersionedData(tx, userId, input.expectedUpdatedAt, async (existing) => {
				const source = await readPortfolioSource(userId, existing.sourceResumeId, tx);
				if (!source) throw portfolioErrors.sourceInvalid();
				const projects = source.data.sections.projects.items;

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

	/**
	 * Asks visitors for a password (Phase 13, B16): stores its bcrypt hash, which never leaves the server. Like publishing,
	 * a setting: the data's version stays. Allowed while unpublished or taken down. A new password signs every visitor
	 * out, since their access is bound to the hash (`visitor-access.ts`).
	 */
	setPassword: async (userId: string, input: { password: string }): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		return setVisitorPassword(userId, await hash(input.password, 10));
	},

	/** Opens the portfolio to every visitor again; the data's version stays. */
	removePassword: async (userId: string): Promise<PortfolioDto> => {
		await requireEnabled(userId);
		return setVisitorPassword(userId, null);
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
			const locked = await lockPortfolio(tx, userId);
			if (!locked) throw portfolioErrors.notFound();
			// Only an administrator lifts a takedown, and deleting and recreating would be a way around that. Deleting the
			// account still removes everything.
			if (locked.suspendedAt) throw portfolioErrors.suspended();
			// Reports go with the portfolio. The ones still open stay on record in the moderation log, which outlives it,
			// so deleting and recreating a portfolio leaves a trace of what it was reported for (never who reported it).
			const open = await tx
				.select({
					id: schema.portfolioReport.id,
					reason: schema.portfolioReport.reason,
					createdAt: schema.portfolioReport.createdAt,
				})
				.from(schema.portfolioReport)
				.innerJoin(schema.portfolio, eq(schema.portfolioReport.portfolioId, schema.portfolio.id))
				.where(and(eq(schema.portfolio.userId, userId), eq(schema.portfolioReport.status, "open")));
			if (open.length)
				await tx.insert(schema.portfolioModerationLog).values({
					actorUserId: userId,
					targetUserId: userId,
					action: "deleted",
					reason: null,
					details: { openReports: open.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })) },
				});
			await tx.delete(schema.portfolio).where(eq(schema.portfolio.userId, userId));
			await tx
				.update(schema.portfolioFile)
				.set({ unusedSince: OVERDUE })
				.where(eq(schema.portfolioFile.userId, userId));
		});
	},
};
