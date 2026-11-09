import type { PortfolioReportStatus } from "@rezumi/schema/portfolio/moderation";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { parseStoredResumeData } from "../resume/resume-data-validation";
import { parseCursor } from "./contact";
import { portfolioErrors } from "./errors";

const report = schema.portfolioReport;
const log = schema.portfolioModerationLog;

const REPORT_PAGE = 30;
const HISTORY_LIMIT = 50;

/** One entry of the moderation log, in the caller's transaction. Every action below writes one. */
function recordAction(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	entry: {
		actorUserId: string;
		action: string;
		reason: string | null;
		portfolioId?: string | null | undefined;
		targetUserId?: string | null | undefined;
		details?: Record<string, unknown>;
	},
) {
	return tx.insert(log).values({
		actorUserId: entry.actorUserId,
		action: entry.action,
		reason: entry.reason,
		portfolioId: entry.portfolioId ?? null,
		targetUserId: entry.targetUserId ?? null,
		details: entry.details ?? {},
	});
}

/** Reports for the admin page, newest first, a page at a time, with how many are still open. */
export async function listPortfolioReports(input: {
	status?: PortfolioReportStatus | undefined;
	cursor?: string | undefined;
}) {
	const after = parseCursor(input.cursor);
	const rows = await db
		.select({
			id: report.id,
			reason: report.reason,
			details: report.details,
			reporterEmail: report.reporterEmail,
			status: report.status,
			createdAt: report.createdAt,
			handledAt: report.handledAt,
			portfolioId: report.portfolioId,
			isPublic: schema.portfolio.isPublic,
			suspendedAt: schema.portfolio.suspendedAt,
			username: schema.user.username,
			ownerEmail: schema.user.email,
		})
		.from(report)
		.innerJoin(schema.portfolio, eq(report.portfolioId, schema.portfolio.id))
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(
			and(
				input.status ? eq(report.status, input.status) : undefined,
				after
					? or(lt(report.createdAt, after.at), and(eq(report.createdAt, after.at), lt(report.id, after.id)))
					: undefined,
			),
		)
		.orderBy(desc(report.createdAt), desc(report.id))
		.limit(REPORT_PAGE + 1);
	const [open] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(report)
		.where(eq(report.status, "open"));
	const page = rows.slice(0, REPORT_PAGE);
	const last = page.at(-1);
	return {
		items: page,
		open: open?.total ?? 0,
		nextCursor: rows.length > REPORT_PAGE && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
	};
}

/** The portfolio of an account, found by username or email, so one can be acted on without a report. */
export async function findPortfolioForAdmin(query: string): Promise<{ portfolioId: string }> {
	const value = query.trim().replace(/^@/, "").toLowerCase();
	const [row] = await db
		.select({ portfolioId: schema.portfolio.id })
		.from(schema.portfolio)
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(or(eq(schema.user.username, value), sql`lower(${schema.user.email}) = ${value}`))
		.limit(1);
	if (!row) throw portfolioErrors.notFound();
	return row;
}

/** Everything the review page shows: the portfolio (so a suspended one can still be read), its reports and history. */
export async function getPortfolioForAdmin(portfolioId: string) {
	const [row] = await db
		.select({
			id: schema.portfolio.id,
			isPublic: schema.portfolio.isPublic,
			suspendedAt: schema.portfolio.suspendedAt,
			suspendedReason: schema.portfolio.suspendedReason,
			data: schema.portfolio.data,
			sourceResumeId: schema.portfolio.sourceResumeId,
			ownerId: schema.user.id,
			ownerName: schema.user.name,
			username: schema.user.username,
			ownerEmail: schema.user.email,
			ownerRole: schema.user.role,
			ownerBanned: schema.user.banned,
			ownerBanReason: schema.user.banReason,
			ownerCreatedAt: schema.user.createdAt,
		})
		.from(schema.portfolio)
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(eq(schema.portfolio.id, portfolioId))
		.limit(1);
	if (!row) throw portfolioErrors.notFound();

	const [resume, reports, history] = await Promise.all([
		row.sourceResumeId
			? db
					.select({ data: schema.resume.data })
					.from(schema.resume)
					.where(and(eq(schema.resume.id, row.sourceResumeId), isNull(schema.resume.trashedAt)))
					.limit(1)
					.then(([found]) => found)
			: undefined,
		db
			.select({
				id: report.id,
				reason: report.reason,
				details: report.details,
				reporterEmail: report.reporterEmail,
				status: report.status,
				createdAt: report.createdAt,
				handledAt: report.handledAt,
			})
			.from(report)
			.where(eq(report.portfolioId, portfolioId))
			.orderBy(desc(report.createdAt))
			.limit(HISTORY_LIMIT),
		db
			.select({
				id: log.id,
				action: log.action,
				reason: log.reason,
				createdAt: log.createdAt,
				actorName: schema.user.name,
			})
			.from(log)
			.leftJoin(schema.user, eq(log.actorUserId, schema.user.id))
			.where(eq(log.portfolioId, portfolioId))
			.orderBy(desc(log.createdAt))
			.limit(HISTORY_LIMIT),
	]);

	let resumeData = null;
	try {
		resumeData = resume ? parseStoredResumeData(resume.data) : null;
	} catch {
		console.error(`[portfolio] Source resume of portfolio ${portfolioId} can't be read; reviewed without it`);
	}
	const { data, sourceResumeId: _sourceResumeId, ownerBanned, ...rest } = row;
	return { ...rest, ownerBanned: ownerBanned === true, data: parsePortfolioData(data), resumeData, reports, history };
}

/**
 * Takes a portfolio down (`02-teknis.md` section 14): it counts as unpublished everywhere and only an administrator can
 * lift it. Nothing is deleted, and `updated_at` stays, since it is the data's version and an open editor would report a
 * false conflict. The open reports count as acted on. `reason` is shown to the owner.
 */
export async function suspendPortfolio(actorUserId: string, input: { portfolioId: string; reason: string }) {
	const now = new Date();
	await db.transaction(async (tx) => {
		const [row] = await tx
			.update(schema.portfolio)
			.set({ suspendedAt: now, suspendedReason: input.reason })
			.where(and(eq(schema.portfolio.id, input.portfolioId), isNull(schema.portfolio.suspendedAt)))
			.returning({ userId: schema.portfolio.userId });
		if (!row) throw await unchangedError(tx, input.portfolioId);
		await tx
			.update(report)
			.set({ status: "actioned", handledAt: now, handledByUserId: actorUserId })
			.where(and(eq(report.portfolioId, input.portfolioId), eq(report.status, "open")));
		await recordAction(tx, {
			actorUserId,
			action: "suspended",
			reason: input.reason,
			portfolioId: input.portfolioId,
			targetUserId: row.userId,
		});
	});
	return { ok: true as const };
}

/** Lifts a takedown. Whether the portfolio shows again follows its own Published switch, which a takedown left alone. */
export async function liftPortfolioSuspension(actorUserId: string, input: { portfolioId: string; reason: string }) {
	await db.transaction(async (tx) => {
		const [row] = await tx
			.update(schema.portfolio)
			.set({ suspendedAt: null, suspendedReason: null })
			.where(and(eq(schema.portfolio.id, input.portfolioId), isNotNull(schema.portfolio.suspendedAt)))
			.returning({ userId: schema.portfolio.userId });
		if (!row) throw await unchangedError(tx, input.portfolioId);
		await recordAction(tx, {
			actorUserId,
			action: "lifted",
			reason: input.reason,
			portfolioId: input.portfolioId,
			targetUserId: row.userId,
		});
	});
	return { ok: true as const };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Why an update touched no row: the portfolio is gone, or another administrator got there first. */
async function unchangedError(tx: Transaction, portfolioId: string) {
	const [existing] = await tx
		.select({ id: schema.portfolio.id })
		.from(schema.portfolio)
		.where(eq(schema.portfolio.id, portfolioId));
	return existing ? portfolioErrors.moderationConflict() : portfolioErrors.notFound();
}

/** Marks a report dismissed, acted on, or open again. */
export async function setPortfolioReportStatus(
	actorUserId: string,
	input: { reportId: string; status: PortfolioReportStatus; reason: string },
) {
	const handled = input.status !== "open";
	await db.transaction(async (tx) => {
		const [row] = await tx
			.update(report)
			.set({
				status: input.status,
				handledAt: handled ? new Date() : null,
				handledByUserId: handled ? actorUserId : null,
			})
			.where(eq(report.id, input.reportId))
			.returning({ portfolioId: report.portfolioId });
		if (!row) throw new ORPCError("NOT_FOUND");
		await recordAction(tx, {
			actorUserId,
			action: `report.${input.status}`,
			reason: input.reason,
			portfolioId: row.portfolioId,
			details: { reportId: input.reportId },
		});
	});
	return { ok: true as const };
}

/**
 * Bans or unbans the owner of a portfolio. A ban signs them out and makes every public page of the account 404
 * (`ownerIsNotBanned`, `isPublicUploadOwner`). Administrators can't be banned here, which also stops banning oneself.
 */
export async function setPortfolioOwnerBanned(
	actorUserId: string,
	input: { portfolioId: string; banned: boolean; reason: string },
) {
	await db.transaction(async (tx) => {
		const [target] = await tx
			.select({ userId: schema.portfolio.userId, role: schema.user.role, banned: schema.user.banned })
			.from(schema.portfolio)
			.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
			.where(eq(schema.portfolio.id, input.portfolioId))
			.for("update", { of: schema.user });
		if (!target) throw portfolioErrors.notFound();
		if (target.role === "admin") throw portfolioErrors.cannotBanAdmin();
		if ((target.banned === true) === input.banned) throw portfolioErrors.moderationConflict();
		await tx
			.update(schema.user)
			.set({ banned: input.banned, banReason: input.banned ? input.reason : null, banExpires: null })
			.where(eq(schema.user.id, target.userId));
		if (input.banned) await tx.delete(schema.session).where(eq(schema.session.userId, target.userId));
		await recordAction(tx, {
			actorUserId,
			action: input.banned ? "banned" : "unbanned",
			reason: input.reason,
			portfolioId: input.portfolioId,
			targetUserId: target.userId,
		});
	});
	return { ok: true as const };
}
