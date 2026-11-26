import type { AiSourceRequest } from "../../../billing/ai-source";
import type { AiRun } from "../../../billing/metered-ai";
import type { WebsiteImportEvent, WebsiteImportResult } from "@rezumi/schema/profile/website-import";
import { ORPCError } from "@orpc/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { WEBSITE_IMPORT_DAILY_LIMIT, websiteImportResultSchema } from "@rezumi/schema/profile/website-import";
import { rethrowAiError } from "../../../ai/procedure";
import { resolveAiSource, startResolvedAiRun } from "../../../billing/metered-ai";
import { WebError } from "../../../web/contracts";
import { sourceErrors } from "../errors";
import { websiteAddress } from "../website";
import { readSiteForImport } from "./site";

/**
 * A website import (`.agents/docs/plans/impor-website/02-teknis.md` section 2): its daily limit, its credits (the
 * account's first one on Rezumi AI is free) and its row, around the reading in `site.ts`. It reports its progress as it
 * goes and ends with the result, which is kept a day for review. Nothing is saved to the Profile or the portfolio here.
 */

const ACTION = "profile-website-import" as const;
/** How long a result is kept for the review to pick up again after a reload. */
export const RESULT_TTL_MS = 24 * 60 * 60 * 1000;
/** Attempts an account may start in a day, failed ones included: a failing site can't be retried without end. */
const DAILY_ATTEMPTS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Sites that refuse automated reading or have their own source: the person gets told what to do instead. */
const PLATFORMS: { host: RegExp; message: string }[] = [
	{
		host: /(?:^|\.)linkedin\.com$/,
		message: "Add a LinkedIn profile in the LinkedIn field instead.",
	},
	{
		host: /(?:^|\.)(?:behance\.net|dribbble\.com)$/,
		message: "Behance and Dribbble can't be read yet. Use your own site's address, or add works in the portfolio.",
	},
];

type ImportRequest = AiSourceRequest & { url: string };

const isUniqueViolation = (error: unknown) =>
	(error as { code?: unknown } | null)?.code === "23505" ||
	(error as { cause?: { code?: unknown } } | null)?.cause?.code === "23505";

/** Refuses an import past the day's limits: three finished or running, ten started. */
async function assertDailyLimit(userId: string, now: Date) {
	const since = new Date(now.getTime() - DAY_MS);
	const rows = await db
		.select({ status: schema.websiteImport.status, count: sql<number>`count(*)::int` })
		.from(schema.websiteImport)
		.where(and(eq(schema.websiteImport.userId, userId), gte(schema.websiteImport.createdAt, since)))
		.groupBy(schema.websiteImport.status);
	const attempts = rows.reduce((sum, row) => sum + row.count, 0);
	const used = rows.filter((row) => row.status !== "failed").reduce((sum, row) => sum + row.count, 0);
	if (used >= WEBSITE_IMPORT_DAILY_LIMIT || attempts >= DAILY_ATTEMPTS)
		throw sourceErrors.limit(
			`This account imported ${WEBSITE_IMPORT_DAILY_LIMIT} websites today, the most a day allows. Try again tomorrow.`,
		);
}

/**
 * Starts the run's row: as the account's free import when Rezumi AI runs it and the free one isn't taken (a unique
 * index holds it while it runs, so two tabs can't both have it), otherwise as an ordinary one.
 */
async function startRow(userId: string, url: string, rezumi: boolean): Promise<{ id: string; free: boolean }> {
	if (rezumi) {
		try {
			const [row] = await db
				.insert(schema.websiteImport)
				.values({ userId, url, status: "running", free: true })
				.returning({ id: schema.websiteImport.id });
			if (row) return { id: row.id, free: true };
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;
		}
	}
	const [row] = await db
		.insert(schema.websiteImport)
		.values({ userId, url, status: "running", free: false })
		.returning({ id: schema.websiteImport.id });
	if (!row) throw new Error("The website import was not saved.");
	return { id: row.id, free: false };
}

/** Whether the account's next import on Rezumi AI is free: it has no free import that ran or is running. */
export async function websiteImportIsFree(userId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: schema.websiteImport.id })
		.from(schema.websiteImport)
		.where(
			and(
				eq(schema.websiteImport.userId, userId),
				eq(schema.websiteImport.free, true),
				inArray(schema.websiteImport.status, ["running", "succeeded"]),
			),
		)
		.limit(1);
	return !row;
}

function failureCode(error: unknown) {
	if (error instanceof ORPCError) return error.code;
	if (error instanceof WebError) return error.reason;
	if (error instanceof Error) return error.name === "AbortError" ? "aborted" : error.name || "error";
	return "error";
}

/**
 * Reads the site and yields its progress, then its result. Throws a source or AI error; credits come back on any
 * failure and when the caller stops listening before the end.
 */
export async function* importWebsite(
	userId: string,
	request: ImportRequest,
	signal?: AbortSignal,
): AsyncGenerator<WebsiteImportEvent, void, unknown> {
	const address = websiteAddress(request.url);
	if (!address) throw sourceErrors.invalid("Enter the address of a public website, such as yourname.com.");
	const host = new URL(address).hostname.toLowerCase();
	const platform = PLATFORMS.find((entry) => entry.host.test(host));
	if (platform) throw sourceErrors.invalid(platform.message);

	const now = new Date();
	await assertDailyLimit(userId, now);
	const resolved = await resolveAiSource({ userId, action: ACTION, aiSource: request.aiSource });
	if (!resolved)
		throw new ORPCError("BAD_REQUEST", {
			message: "Test and turn on an AI provider in Settings → AI & developer first.",
		});

	const run = await startRow(userId, address, resolved.rezumi);
	let ai: AiRun | null = null;
	let finished = false;
	let failure: unknown;
	const stats = { pagesRead: 0 };
	try {
		ai = await startResolvedAiRun(resolved, {
			userId,
			action: ACTION,
			idempotencyKey: request.idempotencyKey,
			free: run.free,
		});

		const site = yield* readSiteForImport({ userId, address, model: ai.model, signal, stats });
		const { homeUrl, profile, works, notes } = site;

		const expiresAt = new Date(Date.now() + RESULT_TTL_MS);
		const result: WebsiteImportResult = {
			runId: run.id,
			url: homeUrl,
			profile,
			works,
			notes,
			free: run.free,
			expiresAt,
		};
		await ai.succeed();
		finished = true;
		const spent = ai.spent();
		await db
			.update(schema.websiteImport)
			.set({
				url: homeUrl,
				status: "succeeded",
				credits: ai.credits,
				pagesRead: stats.pagesRead,
				workCount: works.length,
				// A paid run's tokens are on its credit usage row; a free one has none.
				...(run.free && spent
					? { inputTokens: spent.inputTokens, outputTokens: spent.outputTokens, costUsdMicros: spent.costUsdMicros }
					: {}),
				result,
				resultExpiresAt: expiresAt,
				finishedAt: new Date(),
			})
			.where(eq(schema.websiteImport.id, run.id));
		yield { type: "done", result };
	} catch (error) {
		failure = error;
		if (error instanceof SyntaxError)
			throw new ORPCError("BAD_REQUEST", {
				message: "The AI's answer couldn't be read. Try again, or choose another model.",
			});
		if (error instanceof ORPCError || error instanceof WebError) throw error;
		signal?.throwIfAborted();
		rethrowAiError(error, "The AI's answer wasn't in the expected format. Try again, or choose another model.");
	} finally {
		// Also when the caller stopped listening: the run can't finish, so its credits come back.
		if (!finished) {
			// No failure: the caller stopped listening part-way.
			const code = signal?.aborted ? "aborted" : failure === undefined ? "stopped" : failureCode(failure);
			await ai?.fail(code).catch(() => {});
			const spent = ai?.spent();
			await db
				.update(schema.websiteImport)
				.set({
					status: "failed",
					pagesRead: stats.pagesRead,
					errorCode: code.slice(0, 100),
					...(run.free && spent
						? { inputTokens: spent.inputTokens, outputTokens: spent.outputTokens, costUsdMicros: spent.costUsdMicros }
						: {}),
					finishedAt: new Date(),
				})
				.where(eq(schema.websiteImport.id, run.id))
				.catch(() => console.error("[website-import] Marking a run as failed failed; the upkeep fails it later."));
		}
	}
}

/** A finished import's result while it's kept; NOT_FOUND once it's gone or for another account's run. */
export async function readWebsiteImportResult(userId: string, runId: string): Promise<WebsiteImportResult> {
	const [row] = await db
		.select({ result: schema.websiteImport.result, expiresAt: schema.websiteImport.resultExpiresAt })
		.from(schema.websiteImport)
		.where(
			and(
				eq(schema.websiteImport.id, runId),
				eq(schema.websiteImport.userId, userId),
				eq(schema.websiteImport.status, "succeeded"),
			),
		);
	const parsed =
		row?.result && row.expiresAt && row.expiresAt > new Date() ? websiteImportResultSchema.safeParse(row.result) : null;
	if (!parsed?.success) throw sourceErrors.notFound("That import is no longer kept. Import the website again.");
	return parsed.data;
}
