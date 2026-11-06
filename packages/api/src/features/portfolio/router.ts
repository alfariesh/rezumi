import z from "zod";
import { portfolioDataSchema, writablePortfolioDataSchema } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
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
import { portfolioService } from "./service";

// Kept out of the public API and its OpenAPI spec until portfolios launch (portfolio plan Phase 12).
const route = { tags: ["Internal"] };

const disabled = { PORTFOLIO_DISABLED: { status: 403, message: "Portfolios aren't available for this account yet." } };
const notFound = { NOT_FOUND: { status: 404, message: "This account has no portfolio yet." } };
const sourceInvalid = {
	PORTFOLIO_SOURCE_INVALID: { status: 400, message: "Choose one of your resumes that isn't in Trash." },
};

const resumeIdSchema = z.string().min(1).max(64);
const conflict = {
	PORTFOLIO_VERSION_CONFLICT: { status: 409, message: "The portfolio changed somewhere else after you opened it." },
};
const fileNotFound = {
	PORTFOLIO_FILE_NOT_FOUND: { status: 400, message: "A file in this portfolio isn't one of its uploads." },
};

const linkUnreadable = {
	PORTFOLIO_LINK_UNREADABLE: {
		status: 400,
		message: "This site can't be read automatically. Fill in the details yourself.",
	},
};
const remoteUrlSchema = z
	.string()
	.trim()
	.min(1)
	.max(PORTFOLIO_LIMITS.text.url)
	.describe("A public http(s) address; one without a scheme is read as https.");

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

export const portfolioRouter = {
	get: protectedProcedure
		.route({ ...route, method: "GET", path: "/portfolio", operationId: "getPortfolio", summary: "Get the portfolio" })
		.input(z.object({}).optional())
		.output(
			z.object({
				enabled: z.boolean().describe("Whether portfolios are open to this account; false hides the feature."),
				portfolio: portfolioSchema.nullable(),
				limits: z.object({
					works: z.number().int(),
					storageBytes: z.number().int().nullable().describe("Null when unlimited."),
					dataBytes: z.number().int(),
				}),
				usage: z.object({ works: z.number().int(), storageBytes: z.number().int() }),
			}),
		)
		.handler(({ context }) => portfolioService.get(context.user.id)),

	create: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio",
			operationId: "createPortfolio",
			summary: "Create the portfolio",
		})
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
		.use(portfolioMutationRateLimit)
		.errors({
			...disabled,
			...sourceInvalid,
			PORTFOLIO_EXISTS: { status: 409, message: "This account already has a portfolio." },
		})
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
		.input(
			z.object({
				data: writablePortfolioDataSchema,
				expectedUpdatedAt: z.coerce
					.date()
					.describe("The updatedAt this save was made from; a different one means it changed elsewhere."),
			}),
		)
		.use(portfolioUpdateRateLimit)
		.errors({
			...disabled,
			...notFound,
			...conflict,
			...fileNotFound,
			PORTFOLIO_TOO_LARGE: { status: 413, message: "The portfolio is too large to save." },
		})
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
		.input(z.object({ isPublic: z.boolean() }))
		.use(portfolioMutationRateLimit)
		.errors({
			...disabled,
			...notFound,
			PORTFOLIO_EMAIL_NOT_VERIFIED: { status: 403, message: "Verify your email address before publishing." },
			PORTFOLIO_SUSPENDED: { status: 403, message: "This portfolio was taken down and can't be published." },
		})
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
		.input(
			z.object({
				showInSearchEngines: z.boolean().optional(),
				sourceResumeId: resumeIdSchema
					.nullable()
					.optional()
					.describe("Another resume of the account, or null for none."),
			}),
		)
		.use(portfolioMutationRateLimit)
		.errors({ ...disabled, ...notFound, ...sourceInvalid })
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.updateSettings(context.user.id, input)),

	delete: protectedProcedure
		.route({
			...route,
			method: "DELETE",
			path: "/portfolio",
			operationId: "deletePortfolio",
			summary: "Delete the portfolio",
		})
		.input(z.object({}).optional())
		.use(portfolioMutationRateLimit)
		.errors({ ...disabled, ...notFound })
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
		.use(portfolioMutationRateLimit)
		.errors({
			...disabled,
			...notFound,
			...sourceInvalid,
			...conflict,
			...fileNotFound,
			PORTFOLIO_TOO_LARGE: { status: 413, message: "The portfolio is too large to save." },
			PORTFOLIO_WORKS_LIMIT: { status: 400, message: `A portfolio holds at most ${PORTFOLIO_LIMITS.works} works.` },
		})
		.output(portfolioSchema)
		.handler(({ context, input }) => portfolioService.importWorks(context.user.id, input)),

	uploadImage: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/files/images",
			operationId: "uploadPortfolioImage",
			summary: "Upload a picture for the portfolio",
			description: `A JPEG, PNG or WebP picture the browser already made smaller: at most ${PORTFOLIO_UPLOAD.imageBytes / 1024 / 1024} MB and ${PORTFOLIO_UPLOAD.imageSide} px on its longest side, with an optional small copy of at most ${PORTFOLIO_UPLOAD.thumbSide} px. Unused until saved data refers to its key.`,
		})
		.input(
			z.object({
				file: z.file().describe("The picture."),
				thumbnail: z.file().optional().describe("A small copy for cards and lists."),
			}),
		)
		.use(portfolioUploadRateLimit)
		.errors({
			...disabled,
			...notFound,
			PORTFOLIO_FILE_TOO_LARGE: { status: 413, message: "This picture is too large to upload." },
			PORTFOLIO_IMAGE_INVALID: { status: 400, message: "This picture can't be used." },
		})
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
			description: `A PDF of at most ${PORTFOLIO_UPLOAD.pdfBytes / 1024 / 1024} MB that opens without a password, with the page count the browser read. Its first page's picture is uploaded with uploadImage. Unused until saved data refers to its key.`,
		})
		.input(
			z.object({
				file: z.file().describe("The PDF."),
				pages: z.coerce.number().int().min(1).max(PORTFOLIO_LIMITS.pdfPages).describe("How many pages it has."),
			}),
		)
		.use(portfolioUploadRateLimit)
		.errors({
			...disabled,
			...notFound,
			PORTFOLIO_FILE_TOO_LARGE: { status: 413, message: "This PDF is too large to upload." },
			PORTFOLIO_PDF_INVALID: { status: 400, message: "This file isn't a PDF." },
		})
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
		.input(z.object({ url: remoteUrlSchema }))
		.use(portfolioUnfurlRateLimit)
		.errors({ ...disabled, ...linkUnreadable })
		.output(unfurlSchema)
		.handler(({ context, input, signal }) => portfolioService.unfurl(context.user.id, input, signal)),

	fetchRemoteImage: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/links/image",
			operationId: "fetchPortfolioRemoteImage",
			summary: "Fetch a link's preview picture",
			description: `The picture at a public address (JPEG, PNG, WebP or GIF, at most ${PORTFOLIO_UPLOAD.remoteImageBytes / 1024 / 1024} MB), for the browser to shrink and store with uploadImage. Nothing is stored.`,
		})
		.input(z.object({ url: remoteUrlSchema }))
		.use(portfolioRemoteImageRateLimit)
		.errors({
			...disabled,
			...notFound,
			...linkUnreadable,
			PORTFOLIO_FILE_TOO_LARGE: { status: 413, message: "This picture is too large to copy." },
			PORTFOLIO_IMAGE_INVALID: { status: 400, message: "This isn't a picture that can be used." },
		})
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
		.input(z.object({ key: z.string().min(1).max(PORTFOLIO_LIMITS.text.url) }))
		.use(portfolioFileDeleteRateLimit)
		.errors({
			...disabled,
			...fileNotFound,
			PORTFOLIO_FILE_IN_USE: { status: 409, message: "The portfolio still uses this file." },
		})
		.output(z.void())
		.handler(({ context, input }) => portfolioService.deleteFile(context.user.id, input)),
};
