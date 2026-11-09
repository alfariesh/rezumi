import { eq } from "drizzle-orm";
import z from "zod";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_REPORT_REASONS, PORTFOLIO_REPORT_STATUSES } from "@rezumi/schema/portfolio/moderation";
import { exportPortfolioMessages } from "./contact";
import { exportPortfolioReports } from "./report";

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
});

/** The account's portfolio, file list, contact messages and reports, for its data export. */
export async function exportPortfolioData(userId: string): Promise<z.infer<typeof portfolioExportSchema>> {
	const [row] = await db
		.select({
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
	const [files, messages, reports] = await Promise.all([
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
	]);
	return { portfolio: row ? { ...row, data: parsePortfolioData(row.data) } : null, files, messages, reports };
}
