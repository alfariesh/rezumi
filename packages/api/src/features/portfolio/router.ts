import z from "zod";
import { portfolioDataSchema, writablePortfolioDataSchema } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { PORTFOLIO_CLICK_KINDS, PORTFOLIO_DEVICES, PORTFOLIO_VISIT_SOURCES } from "@rezumi/schema/portfolio/statistics";
import { portfolioThemeSchema } from "@rezumi/schema/portfolio/themes";
import { VIDEO_PROVIDERS } from "@rezumi/schema/portfolio/video";
import { protectedProcedure } from "../../context";
import {
	portfolioFileDeleteRateLimit,
	portfolioMutationRateLimit,
	portfolioRemoteImageRateLimit,
	portfolioUnfurlRateLimit,
	portfolioUpdateRateLimit,
	portfolioUploadRateLimit,
} from "../../middleware/rate-limit";
import { portfolioAiRouter } from "./ai/router";
import { portfolioErrorMap, portfolioErrors } from "./errors";
import { portfolioService } from "./service";

// Kept out of the public API and its OpenAPI spec until portfolios launch (portfolio plan Phase 12).
const route = { tags: ["Internal"] };

// Every rate limit here is keyed by account alone, so it runs before the input is checked (`.use` before `.input`):
// an account over its limit costs no parsing, however large or broken its input.

const resumeIdSchema = z.string().min(1).max(64);

const remoteUrlSchema = z
	.string()
	.trim()
	.min(1)
	.max(PORTFOLIO_LIMITS.text.url)
	.describe("A public http(s) address; one without a scheme is read as https.");

const MB = 1024 * 1024;

/**
 * Raw data longer than this many characters of JSON is over `PORTFOLIO_LIMITS.dataBytes` by any measure (UTF-8 takes
 * at least a byte per character), with room for markup the sanitizer would strip.
 */
const PORTFOLIO_INPUT_CHARACTERS = 4 * PORTFOLIO_LIMITS.dataBytes;

/**
 * Refuses portfolio data far over the size limit (`PORTFOLIO_TOO_LARGE`) from its raw JSON, before the schema parses
 * it and the service sanitizes its rich text: both take time in proportion to the input, and every field can be
 * within its own limit while the whole is hundreds of times too large.
 */
function rejectOversizedData(input: unknown): void {
	const data = typeof input === "object" && input !== null && "data" in input ? input.data : undefined;
	let json: string | undefined;
	try {
		json = JSON.stringify(data);
	} catch {
		return; // Not JSON at all (a BigInt, say): the schema refuses it next.
	}
	if (json === undefined || json.length <= PORTFOLIO_INPUT_CHARACTERS) return;
	throw portfolioErrors.tooLarge(new TextEncoder().encode(json).byteLength);
}

const unfurlSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("video"),
		url: z.string().describe("The video's own page."),
		provider: z.enum(VIDEO_PROVIDERS),
		videoId: z.string(),
		hash: z.string().optional().describe("The hash of an unlisted Vimeo video."),
		title: z.string().optional(),
		thumbnailUrl: z.string().optional().describe("The video's picture on YouTube's or Vimeo's image server."),
	}),
	z.object({
		kind: z.literal("link"),
		url: z.string().describe("Where the link ended up after redirects."),
		title: z.string(),
		description: z.string().optional(),
		siteName: z.string().optional(),
		imageUrl: z
			.string()
			.optional()
			.describe("The page's preview picture on its own site; copy it with fetchRemoteImage + uploadImage."),
		brandIcon: z.string().optional().describe("The site's logo in the resume icon set, for known sites."),
	}),
]);

const portfolioSchema = z.object({
	id: z.string(),
	sourceResumeId: z.string().nullable().describe("The resume its career sections come from; null for none."),
	sourceResume: z
		.object({ id: z.string(), name: z.string(), slug: z.string(), inTrash: z.boolean() })
		.nullable()
		.describe("The source resume. One in Trash still shows, so the editor can ask for another."),
	isPublic: z.boolean().describe("Whether it is published at /<username>."),
	showInSearchEngines: z.boolean(),
	publishedAt: z.date().nullable().describe("When it was first published."),
	suspendedAt: z.date().nullable().describe("When an admin took it down; it can't be published until lifted."),
	suspendedReason: z.string().nullable(),
	data: portfolioDataSchema,
	createdAt: z.date(),
	updatedAt: z.date().describe("Changes with every save of data; send it back with the next save."),
});

const countsOf = <const K extends string>(keys: readonly K[]) =>
	z.object(Object.fromEntries(keys.map((key) => [key, z.number().int()])) as Record<K, z.ZodNumber>);

const statisticsSchema = z.object({
	days: z.array(z.object({ date: z.string(), views: z.number().int() })).describe("30 days, oldest first."),
	totals: z.object({
		views: z.number().int(),
		clicks: countsOf(PORTFOLIO_CLICK_KINDS),
		messages: z.number().int(),
	}),
	sources: countsOf(PORTFOLIO_VISIT_SOURCES),
	works: z.array(z.object({ id: z.string(), title: z.string(), opens: z.number().int() })),
	details: z.discriminatedUnion("state", [
		z.object({ state: z.literal("locked") }),
		z.object({ state: z.literal("unavailable") }),
		z.object({
			state: z.literal("ready"),
			countries: z.array(z.object({ code: z.string(), views: z.number().int() })),
			devices: z.array(z.object({ device: z.enum(PORTFOLIO_DEVICES), views: z.number().int() })),
			referrers: z.array(z.object({ domain: z.string(), views: z.number().int() })),
			workDays: z.array(z.object({ date: z.string(), workId: z.string(), title: z.string(), opens: z.number().int() })),
		}),
	]),
});

const messageIdSchema = z.string().min(1).max(64);

export const portfolioRouter = {
	ai: portfolioAiRouter,

	statistics: protectedProcedure
		.route({
			...route,
			method: "GET",
			path: "/portfolio/statistics",
			operationId: "getPortfolioStatistics",
			summary: "The portfolio's numbers for the last 30 days",
		})
		.input(z.object({}).optional())
		.output(statisticsSchema.nullable())
		.handler(({ context }) => portfolioService.statistics(context.user.id)),

	messages: {
		list: protectedProcedure
			.route({
				...route,
				method: "GET",
				path: "/portfolio/messages",
				operationId: "listPortfolioMessages",
				summary: "Messages sent through the contact form, newest first",
			})
			.input(
				z
					.object({ cursor: z.string().max(120).optional(), limit: z.number().int().min(1).max(50).optional() })
					.optional(),
			)
			.output(
				z.object({
					items: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							email: z.string(),
							body: z.string(),
							serviceTitle: z.string().nullable(),
							createdAt: z.date(),
							readAt: z.date().nullable(),
						}),
					),
					unread: z.number().int(),
					nextCursor: z.string().nullable(),
				}),
			)
			.handler(({ context, input }) => portfolioService.messages.list(context.user.id, input ?? {})),

		markRead: protectedProcedure
			.route({
				...route,
				method: "PATCH",
				path: "/portfolio/messages/{id}",
				operationId: "markPortfolioMessage",
				summary: "Mark a message read or unread",
			})
			.use(portfolioUpdateRateLimit)
			.input(z.object({ id: messageIdSchema, read: z.boolean() }))
			.output(z.object({ ok: z.literal(true) }))
			.handler(({ context, input }) => portfolioService.messages.markRead(context.user.id, input)),

		delete: protectedProcedure
			.route({
				...route,
				method: "DELETE",
				path: "/portfolio/messages/{id}",
				operationId: "deletePortfolioMessage",
				summary: "Delete a message",
			})
			.use(portfolioMutationRateLimit)
			.input(z.object({ id: messageIdSchema }))
			.output(z.object({ ok: z.literal(true) }))
			.handler(({ context, input }) => portfolioService.messages.delete(context.user.id, input)),
	},

	get: protectedProcedure
		.route({ ...route, method: "GET", path: "/portfolio", operationId: "getPortfolio", summary: "Get the portfolio" })
		.input(z.object({}).optional())
		.output(
			z.object({
				enabled: z.boolean().describe("Whether portfolios are open to this account; false hides the feature."),
				portfolio: portfolioSchema.nullable(),
				contactFormAvailable: z
					.boolean()
					.describe("Whether the contact form can be turned on: its anti-spam check is set up here."),
				limits: z.object({
					works: z.number().int(),
					storageBytes: z
						.number()
						.int()
						.describe("The most bytes the account may store for its portfolio, files waiting for cleanup included."),
					dataBytes: z.number().int(),
				}),
				usage: z.object({
					works: z.number().int(),
					storageBytes: z.number().int().describe("Bytes stored, files waiting for cleanup included."),
				}),
			}),
		)
		.handler(({ context }) => portfolioService.get(context.user.id)),

	status: protectedProcedure
		.route({
			...route,
			method: "GET",
			path: "/portfolio/status",
			operationId: "getPortfolioStatus",
			summary: "Whether the account has a portfolio, and whether it's live",
			description: "What the app's menu and share panels need, without reading the portfolio itself.",
		})
		.input(z.object({}).optional())
		.output(
			z.object({
				enabled: z.boolean().describe("Whether portfolios are open to this account; false hides the feature."),
				portfolio: z
					.object({
						isPublic: z.boolean().describe("Whether it is published at /<username>."),
						suspendedAt: z.date().nullable().describe("When an admin took it down; it isn't shown while set."),
					})
					.nullable()
					.describe("Null while the account has no portfolio."),
			}),
		)
		.handler(({ context }) => portfolioService.status(context.user.id)),

	create: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio",
			operationId: "createPortfolio",
			summary: "Create the portfolio",
		})
		.use(portfolioMutationRateLimit)
		.input(
			z.object({
				sourceResumeId: resumeIdSchema
					.nullable()
					.optional()
					.describe("A resume to start from; null for none; missing for the primary resume."),
				theme: portfolioThemeSchema.optional(),
				basics: z
					.object({
						name: z.string().max(PORTFOLIO_LIMITS.text.name).optional(),
						headline: z.string().max(PORTFOLIO_LIMITS.text.headline).optional(),
						location: z.string().max(PORTFOLIO_LIMITS.text.location).optional(),
					})
					.optional()
					.describe("For a portfolio without a resume."),
			}),
		)
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED", "PORTFOLIO_SOURCE_INVALID", "PORTFOLIO_EXISTS"))
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.create(context.user.id, input)),

	update: protectedProcedure
		.route({
			...route,
			method: "PUT",
			path: "/portfolio",
			operationId: "updatePortfolio",
			summary: "Save the portfolio's data",
		})
		.use(portfolioUpdateRateLimit)
		.use(({ next }, input) => {
			rejectOversizedData(input);
			return next();
		})
		.input(
			z.object({
				data: writablePortfolioDataSchema,
				expectedUpdatedAt: z.coerce
					.date()
					.describe("The updatedAt this save was made from; a different one means it changed elsewhere."),
			}),
		)
		.errors(
			portfolioErrorMap(
				"PORTFOLIO_DISABLED",
				"NOT_FOUND",
				"PORTFOLIO_VERSION_CONFLICT",
				"PORTFOLIO_FILE_NOT_FOUND",
				"PORTFOLIO_TOO_LARGE",
			),
		)
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.update(context.user.id, input)),

	setPublic: protectedProcedure
		.route({
			...route,
			method: "PUT",
			path: "/portfolio/public",
			operationId: "setPortfolioPublic",
			summary: "Publish or unpublish the portfolio",
		})
		.use(portfolioMutationRateLimit)
		.input(z.object({ isPublic: z.boolean() }))
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED", "NOT_FOUND", "PORTFOLIO_EMAIL_NOT_VERIFIED", "PORTFOLIO_SUSPENDED"))
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.setPublic(context.user.id, input)),

	updateSettings: protectedProcedure
		.route({
			...route,
			method: "PATCH",
			path: "/portfolio/settings",
			operationId: "updatePortfolioSettings",
			summary: "Change the portfolio's settings",
		})
		.use(portfolioMutationRateLimit)
		.input(
			z.object({
				showInSearchEngines: z.boolean().optional(),
				sourceResumeId: resumeIdSchema
					.nullable()
					.optional()
					.describe("Another resume of the account, or null for none."),
			}),
		)
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED", "NOT_FOUND", "PORTFOLIO_SOURCE_INVALID"))
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.updateSettings(context.user.id, input)),

	delete: protectedProcedure
		.route({
			...route,
			method: "DELETE",
			path: "/portfolio",
			operationId: "deletePortfolio",
			summary: "Delete the portfolio",
			description: "Its files stop being served at once and are deleted from storage shortly after.",
		})
		.use(portfolioMutationRateLimit)
		.input(z.object({}).optional())
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED", "NOT_FOUND"))
		.output(z.void())
		.handler(({ context }) => portfolioService.delete(context.user.id)),

	importWorks: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/works/import",
			operationId: "importPortfolioWorks",
			summary: "Add works from the source resume's projects",
		})
		.use(portfolioMutationRateLimit)
		.input(
			z.object({
				resumeItemIds: z
					.array(z.string().min(1).max(PORTFOLIO_LIMITS.text.id))
					.min(1)
					.max(PORTFOLIO_LIMITS.works)
					.describe("Projects of the source resume to add; ones already added are skipped."),
				expectedUpdatedAt: z.coerce.date().describe("The updatedAt the editor has; a different one is a conflict."),
			}),
		)
		.errors(
			portfolioErrorMap(
				"PORTFOLIO_DISABLED",
				"NOT_FOUND",
				"PORTFOLIO_SOURCE_INVALID",
				"PORTFOLIO_VERSION_CONFLICT",
				"PORTFOLIO_FILE_NOT_FOUND",
				"PORTFOLIO_TOO_LARGE",
				"PORTFOLIO_WORKS_LIMIT",
			),
		)
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.importWorks(context.user.id, input)),

	uploadImage: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/files/images",
			operationId: "uploadPortfolioImage",
			summary: "Upload a picture for the portfolio",
			description: `A JPEG, PNG or WebP picture the browser already made smaller: at most ${PORTFOLIO_UPLOAD.imageBytes / MB} MB and ${PORTFOLIO_UPLOAD.imageSide} px on its longest side, with an optional small copy of at most ${PORTFOLIO_UPLOAD.thumbSide} px. Unused until saved data refers to its key. An account stores at most ${PORTFOLIO_UPLOAD.accountBytes / MB} MB in ${PORTFOLIO_UPLOAD.accountFiles} files for its portfolio.`,
		})
		.use(portfolioUploadRateLimit)
		.input(
			z.object({
				file: z.file().max(PORTFOLIO_UPLOAD.imageBytes).describe("The picture."),
				thumbnail: z.file().max(PORTFOLIO_UPLOAD.imageBytes).optional().describe("A small copy for cards and lists."),
			}),
		)
		.errors(
			portfolioErrorMap(
				"PORTFOLIO_DISABLED",
				"NOT_FOUND",
				"PORTFOLIO_FILE_TOO_LARGE",
				"PORTFOLIO_IMAGE_INVALID",
				"PORTFOLIO_STORAGE_FULL",
			),
		)
		.output(
			z.object({
				key: z.string().describe("The picture's storage key, for the portfolio's data."),
				thumbKey: z.string().optional().describe("The small copy's key."),
				width: z.number().int(),
				height: z.number().int(),
				bytes: z.number().int().describe("Bytes stored, both copies together."),
			}),
		)
		.handler(({ context, input }) => portfolioService.uploadImage(context.user.id, input)),

	uploadPdf: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/files/pdfs",
			operationId: "uploadPortfolioPdf",
			summary: "Upload a PDF for a work",
			description: `A PDF of at most ${PORTFOLIO_UPLOAD.pdfBytes / MB} MB that opens without a password, with the page count the browser read. Its first page's picture is uploaded with uploadImage. Unused until saved data refers to its key.`,
		})
		.use(portfolioUploadRateLimit)
		.input(
			z.object({
				file: z.file().max(PORTFOLIO_UPLOAD.pdfBytes).describe("The PDF."),
				pages: z.coerce.number().int().min(1).max(PORTFOLIO_LIMITS.pdfPages).describe("How many pages it has."),
			}),
		)
		.errors(
			portfolioErrorMap(
				"PORTFOLIO_DISABLED",
				"NOT_FOUND",
				"PORTFOLIO_FILE_TOO_LARGE",
				"PORTFOLIO_PDF_INVALID",
				"PORTFOLIO_STORAGE_FULL",
			),
		)
		.output(
			z.object({
				key: z.string().describe("The PDF's storage key, for the portfolio's data."),
				bytes: z.number().int(),
				pages: z.number().int(),
			}),
		)
		.handler(({ context, input }) => portfolioService.uploadPdf(context.user.id, input)),

	unfurl: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/links/unfurl",
			operationId: "unfurlPortfolioLink",
			summary: "Read a pasted link",
			description:
				"YouTube and Vimeo links become a video (title and picture from the site's oEmbed); other pages a link card from their meta tags. Results are kept for a day.",
		})
		.use(portfolioUnfurlRateLimit)
		.input(z.object({ url: remoteUrlSchema }))
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED", "PORTFOLIO_LINK_UNREADABLE"))
		.output(unfurlSchema)
		.handler(({ context, input, signal }) => portfolioService.unfurl(context.user.id, input, signal)),

	fetchRemoteImage: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/links/image",
			operationId: "fetchPortfolioRemoteImage",
			summary: "Fetch a link's preview picture",
			description: `The picture at a public address (JPEG, PNG, WebP or GIF, at most ${PORTFOLIO_UPLOAD.remoteImageBytes / MB} MB), for the browser to shrink and store with uploadImage. Nothing is stored.`,
		})
		.use(portfolioRemoteImageRateLimit)
		.input(z.object({ url: remoteUrlSchema }))
		.errors(
			portfolioErrorMap(
				"PORTFOLIO_DISABLED",
				"NOT_FOUND",
				"PORTFOLIO_LINK_UNREADABLE",
				"PORTFOLIO_FILE_TOO_LARGE",
				"PORTFOLIO_IMAGE_INVALID",
			),
		)
		.output(z.file().describe("The picture as the site sent it."))
		.handler(({ context, input, signal }) => portfolioService.fetchRemoteImage(context.user.id, input, signal)),

	deleteFile: protectedProcedure
		.route({
			...route,
			method: "DELETE",
			path: "/portfolio/files",
			operationId: "deletePortfolioFile",
			summary: "Delete a portfolio file the portfolio no longer uses",
		})
		.use(portfolioFileDeleteRateLimit)
		.input(z.object({ key: z.string().min(1).max(PORTFOLIO_LIMITS.text.url) }))
		.errors(portfolioErrorMap("PORTFOLIO_DISABLED", "PORTFOLIO_FILE_NOT_FOUND", "PORTFOLIO_FILE_IN_USE"))
		.output(z.void())
		.handler(({ context, input }) => portfolioService.deleteFile(context.user.id, input)),
};
