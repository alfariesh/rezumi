import { and, asc, eq, inArray } from "drizzle-orm";
import z from "zod";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { PORTFOLIO_REPORT_REASONS, PORTFOLIO_REPORT_STATUSES } from "@rezumi/schema/portfolio/moderation";
import { exportPortfolioMessages } from "./contact";
import { exportPortfolioReports } from "./report";

/** Moderation actions on the account itself; report handling stays out, since it would tell who reported what. */
const EXPORTED_MODERATION_ACTIONS = ["suspended", "lifted", "banned", "unbanned"];

export const portfolioExportSchema = z.object({
	portfolio: z
		.object({
			isPublic: z.boolean(),
			showInSearchEngines: z.boolean(),
			publishedAt: z.date().nullable(),
			suspendedAt: z.date().nullable(),
			suspendedReason: z.string().nullable(),
			data: z.unknown().describe("The portfolio's content, exported as it's stored."),
			createdAt: z.date(),
			updatedAt: z.date(),
		})
		.nullable(),
	files: z.array(
		z.object({
			key: z.string(),
			kind: z.enum(schema.PORTFOLIO_FILE_KINDS),
			bytes: z.number().int(),
			width: z.number().int().nullable(),
			height: z.number().int().nullable(),
			pages: z.number().int().nullable(),
			createdAt: z.date(),
		}),
	),
	messages: z.array(
		z.object({
			name: z.string(),
			email: z.string(),
			body: z.string(),
			serviceId: z.string().nullable(),
			createdAt: z.date(),
			readAt: z.date().nullable(),
		}),
	),
	reports: z
		.array(
			z.object({
				reason: z.enum(PORTFOLIO_REPORT_REASONS),
				status: z.enum(PORTFOLIO_REPORT_STATUSES),
				createdAt: z.date(),
				handledAt: z.date().nullable(),
			}),
		)
		.describe("Reports about the portfolio: why and when, never who sent them or what they wrote."),
	statistics: z
		.array(
			z.object({
				date: z.string(),
				views: z.number().int(),
				clicks: z.record(z.string(), z.number()),
				works: z.record(z.string(), z.number()),
				sources: z.record(z.string(), z.number()),
				messages: z.number().int(),
			}),
		)
		.describe("The portfolio's daily numbers, in the owner's time zone."),
	moderation: z
		.array(z.object({ action: z.string(), reason: z.string().nullable(), createdAt: z.date() }))
		.describe("Takedowns and bans of this account and their lifting, with the reason given."),
});

/** The account's portfolio, file list, contact messages, reports, daily numbers and moderation, for its data export. */
export async function exportPortfolioData(userId: string): Promise<z.infer<typeof portfolioExportSchema>> {
	const [row] = await db
		.select({
			id: schema.portfolio.id,
			isPublic: schema.portfolio.isPublic,
			showInSearchEngines: schema.portfolio.showInSearchEngines,
			publishedAt: schema.portfolio.publishedAt,
			suspendedAt: schema.portfolio.suspendedAt,
			suspendedReason: schema.portfolio.suspendedReason,
			data: schema.portfolio.data,
			createdAt: schema.portfolio.createdAt,
			updatedAt: schema.portfolio.updatedAt,
		})
		.from(schema.portfolio)
		.where(eq(schema.portfolio.userId, userId));
	const daily = schema.portfolioStatisticsDaily;
	const log = schema.portfolioModerationLog;
	const [files, messages, reports, statistics, moderation] = await Promise.all([
		db
			.select({
				key: schema.portfolioFile.key,
				kind: schema.portfolioFile.kind,
				bytes: schema.portfolioFile.bytes,
				width: schema.portfolioFile.width,
				height: schema.portfolioFile.height,
				pages: schema.portfolioFile.pages,
				createdAt: schema.portfolioFile.createdAt,
			})
			.from(schema.portfolioFile)
			.where(eq(schema.portfolioFile.userId, userId)),
		exportPortfolioMessages(userId),
		exportPortfolioReports(userId),
		row
			? db
					.select({
						date: daily.date,
						views: daily.views,
						clicks: daily.clicks,
						works: daily.works,
						sources: daily.sources,
						messages: daily.messages,
					})
					.from(daily)
					.where(eq(daily.portfolioId, row.id))
					.orderBy(asc(daily.date))
			: [],
		db
			.select({ action: log.action, reason: log.reason, createdAt: log.createdAt })
			.from(log)
			.where(and(eq(log.targetUserId, userId), inArray(log.action, EXPORTED_MODERATION_ACTIONS)))
			.orderBy(asc(log.createdAt)),
	]);
	// The data as stored, not as read: the lenient read would leave out what this version can't use.
	const portfolio = row ? (({ id: _id, ...stored }) => stored)(row) : null;
	return { portfolio, files, messages, reports, statistics, moderation };
}
