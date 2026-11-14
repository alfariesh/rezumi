import type { PostingSource } from "@rezumi/schema/applications/data";
import { ORPCError } from "@orpc/client";
import { and, count, eq, gte } from "drizzle-orm";
import z from "zod";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { capturedPostingSchema } from "@rezumi/job-sites/capture";
import { jobPostingsInJson, toPagePosting } from "@rezumi/job-sites/json-ld";
import { canonicalJobUrl, JOB_SITES, jobKey } from "@rezumi/job-sites/sites";
import { applicationStatusSchema } from "@rezumi/schema/applications/data";
import { protectedProcedure } from "../../context";
import { aiRequestRateLimit } from "../../middleware/rate-limit";
import { aiSourceInput } from "../billing/ai-source";
import { fillPostingFields, parsePostingOutput } from "./ai";
import { htmlToText, MAX_POSTING_CHARS } from "./posting";
import { applicationService } from "./service";

/**
 * What the Rezumi browser extension calls besides the ordinary applications procedures (plan:
 * .agents/docs/plans/plugin-browser/02-teknis.md §6). Kept out of the public API and its OpenAPI spec.
 */
const route = { tags: ["Internal"] };

/** At most this many page reports per account an hour (02-teknis.md §6.3). */
export const CAPTURE_REPORTS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

const existingSchema = z
	.object({
		id: z.string(),
		role: z.string(),
		company: z.string(),
		status: applicationStatusSchema,
		updatedAt: z.date(),
	})
	.nullable()
	.describe("The newest application already saved for this posting, if any.");

const readCaptureOutput = parsePostingOutput.extend({
	validThrough: z.string().nullable().describe("When the employer stops taking applications, as the page states it."),
	existing: existingSchema,
});

/** The posting's address to save: the board's permanent one when the server knows it, else what the extension sent. */
const savedAddress = (capture: { url: string; canonicalUrl: string }) =>
	canonicalJobUrl(capture.canonicalUrl) ?? canonicalJobUrl(capture.url) ?? capture.canonicalUrl;

/** The one JobPosting the page's JSON-LD describes, or null (none, several, or unreadable blocks). */
function pagePosting(blocks: readonly string[]) {
	const values = blocks.flatMap((block) => {
		try {
			return [JSON.parse(block) as unknown];
		} catch {
			return [];
		}
	});
	const postings = jobPostingsInJson(values);
	return postings.length === 1 && postings[0] ? toPagePosting(postings[0], htmlToText) : null;
}

const reportInput = z.object({
	url: z.url({ protocol: /^https?$/ }).max(2_000),
	site: z.enum(JOB_SITES).nullable(),
	extensionVersion: z
		.string()
		.trim()
		.regex(/^\d+\.\d+\.\d+$/),
	missing: z.array(z.string().trim().min(1).max(40)).max(12),
});

export const extensionRouter = {
	savedKeys: protectedProcedure
		.route({ ...route, method: "GET", path: "/applications/extension/saved-keys" })
		.output(
			z.object({
				keys: z.array(
					z.object({ key: z.string(), id: z.string(), status: applicationStatusSchema, updatedAt: z.date() }),
				),
			}),
		)
		.handler(async ({ context }) => ({ keys: await applicationService.savedKeys({ userId: context.user.id }) })),

	// The extension read the open page in the person's browser; nothing here fetches a URL (unlike parsePosting).
	readCapture: protectedProcedure
		.route({ ...route, method: "POST", path: "/applications/extension/read-capture" })
		.use(aiRequestRateLimit)
		.input(capturedPostingSchema.extend(aiSourceInput))
		.output(readCaptureOutput)
		.errors({
			BAD_GATEWAY: {
				message: "The AI provider returned an error or couldn't be reached. Try again, or check its settings.",
				status: 502,
			},
		})
		.handler(async ({ context, input, signal }) => {
			const { aiSource: _aiSource, idempotencyKey: _idempotencyKey, ...capture } = input;
			const page = pagePosting(capture.jsonLd);
			const fields = capture.fields ?? {};
			// What the person selected wins; then the posting's own description, then the page's text.
			const text = capture.selection?.trim() || page?.description || capture.text;
			const truncated = text.length > MAX_POSTING_CHARS;
			const sourceUrl = savedAddress(capture);
			const postingSource: PostingSource = {
				method: "extension",
				format: "text",
				requestedUrl: capture.url,
				resolvedUrl: sourceUrl,
				retrievedAt: new Date().toISOString(),
				truncated,
				completeness: truncated ? "incomplete" : "unknown",
			};
			const fromPage = {
				role: fields.role || page?.role || "",
				company: fields.company || page?.company || "",
				location: fields.location || page?.location || "",
				salary: fields.salary || "",
			};
			const key = jobKey(sourceUrl);
			const [parsed, existing] = await Promise.all([
				fillPostingFields({
					userId: context.user.id,
					request: input,
					jobDescription: text.slice(0, MAX_POSTING_CHARS),
					fromPage,
					readFromPage: Object.values(fromPage).some(Boolean),
					sourceUrl,
					postingSource,
					signal,
				}),
				key ? applicationService.findBySourceKey({ userId: context.user.id, key }) : null,
			]);
			return { ...parsed, validThrough: fields.validThrough || page?.closesAt || null, existing };
		}),

	// A page the extension could not read. Only the address, board, version and missing fields: never the page's text.
	reportCapture: protectedProcedure
		.route({ ...route, method: "POST", path: "/applications/extension/report-capture" })
		.input(reportInput)
		.output(z.object({ ok: z.literal(true) }))
		.errors({ RATE_LIMIT_EXCEEDED: { message: "Too many reports. Try again later.", status: 429 } })
		.handler(async ({ context, input }) => {
			const userId = context.user.id;
			const since = new Date(Date.now() - HOUR_MS);
			const [recent] = await db
				.select({ total: count() })
				.from(schema.extensionCaptureReport)
				.where(
					and(eq(schema.extensionCaptureReport.userId, userId), gte(schema.extensionCaptureReport.createdAt, since)),
				);
			if ((recent?.total ?? 0) >= CAPTURE_REPORTS_PER_HOUR) throw new ORPCError("RATE_LIMIT_EXCEEDED", { status: 429 });
			await db.insert(schema.extensionCaptureReport).values({
				userId,
				url: input.url,
				site: input.site,
				extensionVersion: input.extensionVersion,
				missing: [...new Set(input.missing)],
			});
			return { ok: true as const };
		}),
};
