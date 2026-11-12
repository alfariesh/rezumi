import type { UnfurlProblem } from "./unfurl";
import { ORPCError } from "@orpc/server";
import z from "zod";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";

const size = z.number().int().nonnegative();
const MB = 1024 * 1024;
const megabytes = (bytes: number) => `${(bytes / MB).toFixed(1)} MB`;

/**
 * Every refusal of the portfolio procedures, each defined once: `router.ts` declares the ones each procedure can
 * throw (so clients get them typed), and the service throws them through `portfolioErrors` below. Codes and statuses
 * are part of the API, since the web words each refusal by its code (`apps/web/src/features/portfolio/errors.ts`).
 * Messages are plain English for API callers; a thrown error may say more than the general message here.
 */
export const PORTFOLIO_ERRORS = {
	PORTFOLIO_DISABLED: { status: 403, message: "Portfolios aren't available for this account yet." },
	PORTFOLIO_EXISTS: { status: 409, message: "This account already has a portfolio." },
	NOT_FOUND: { status: 404, message: "This account has no portfolio yet." },
	PORTFOLIO_SOURCE_INVALID: {
		status: 400,
		message: "Choose one of your resumes that isn't in Trash.",
		// `unreadable`: the resume's stored data can't be read.
		data: z.object({ reason: z.enum(["unavailable", "unreadable"]) }),
	},
	PORTFOLIO_VERSION_CONFLICT: {
		status: 409,
		message: "The portfolio changed somewhere else after you opened it. Reload it, then make your change again.",
		data: z.object({ updatedAt: z.string() }),
	},
	PORTFOLIO_TOO_LARGE: {
		status: 413,
		message: "The portfolio is too large to save. Shorten some text or remove a few blocks.",
		data: z.object({ bytes: size, max: size }),
	},
	PORTFOLIO_FILE_NOT_FOUND: {
		status: 400,
		message: "A file in this portfolio isn't one of its uploads. Upload it again.",
		data: z.object({ key: z.string() }),
	},
	PORTFOLIO_EMAIL_NOT_VERIFIED: {
		status: 403,
		message: "Verify your email address before publishing your portfolio.",
	},
	PORTFOLIO_MODERATION_CONFLICT: {
		status: 409,
		message: "This portfolio is already in that state. Reload the page to see what changed.",
	},
	PORTFOLIO_CANNOT_BAN_ADMIN: { status: 403, message: "An administrator's account can't be banned here." },
	PORTFOLIO_SUSPENDED: {
		status: 403,
		message: "This portfolio was taken down and can't be published. Contact support to appeal.",
	},
	PORTFOLIO_FILE_TOO_LARGE: {
		status: 413,
		message: "This file is too large to upload.",
		data: z.object({ bytes: size, max: size }),
	},
	PORTFOLIO_PDF_INVALID: {
		status: 400,
		message: "This file isn't a PDF. Upload a PDF file.",
		data: z.object({ reason: z.literal("type") }),
	},
	PORTFOLIO_LINK_UNREADABLE: {
		status: 400,
		message: "This site can't be read automatically. Fill in the details yourself.",
		// The reasons belong to the link reader (`UnfurlProblem`); clients treat an unknown one like the rest.
		data: z.object({ reason: z.string() }),
	},
	PORTFOLIO_IMAGE_INVALID: {
		status: 400,
		message: "This picture can't be used.",
		data: z.object({ reason: z.enum(["type", "animated", "dimensions", "unreadable"]) }),
	},
	PORTFOLIO_FILE_IN_USE: {
		status: 409,
		message: "The portfolio still uses this file. Remove it from the portfolio first.",
		data: z.object({ key: z.string() }),
	},
	PORTFOLIO_WORKS_LIMIT: {
		status: 400,
		message: `A portfolio holds at most ${PORTFOLIO_LIMITS.works} works. Remove some before adding more.`,
		data: z.object({ max: size }),
	},
	PORTFOLIO_AI_UNUSABLE: {
		status: 502,
		message: "The AI's answer couldn't be used, so nothing changed. Try again; no credits were used.",
	},
	PORTFOLIO_STORAGE_FULL: {
		status: 413,
		message:
			"The portfolio's files take all the storage it may use. Remove pictures or PDFs it no longer uses; they're deleted a day after.",
		// What the account stores already (files waiting for the cleanup job too) and its ceiling.
		data: z.object({ bytes: size, maxBytes: size, files: size, maxFiles: size }),
	},
	PORTFOLIO_WORK_NOT_FOUND: { status: 404, message: "This work isn't in the portfolio." },
} as const;

type PortfolioErrorCode = keyof typeof PORTFOLIO_ERRORS;

/** The definitions of the given refusals, for a procedure's `.errors()`. */
export function portfolioErrorMap<const C extends PortfolioErrorCode>(...codes: C[]): Pick<typeof PORTFOLIO_ERRORS, C> {
	return Object.fromEntries(codes.map((code) => [code, PORTFOLIO_ERRORS[code]])) as Pick<typeof PORTFOLIO_ERRORS, C>;
}

function refusal(code: PortfolioErrorCode, options: { message?: string; data?: unknown; cause?: unknown } = {}) {
	const definition = PORTFOLIO_ERRORS[code];
	return new ORPCError(code, {
		status: definition.status,
		message: options.message ?? definition.message,
		data: options.data,
		cause: options.cause,
	});
}

type ImageProblem = "type" | "animated" | "dimensions" | "unreadable";

/** The refusals the service throws, built from `PORTFOLIO_ERRORS`. */
export const portfolioErrors = {
	disabled: () => refusal("PORTFOLIO_DISABLED"),
	exists: () => refusal("PORTFOLIO_EXISTS"),
	notFound: () => refusal("NOT_FOUND"),
	workNotFound: () => refusal("PORTFOLIO_WORK_NOT_FOUND"),
	sourceInvalid: (reason: "unavailable" | "unreadable" = "unavailable", cause?: unknown) =>
		refusal("PORTFOLIO_SOURCE_INVALID", {
			data: { reason },
			cause,
			...(reason === "unreadable"
				? { message: "This resume's data can't be read. Choose another resume, or start without one." }
				: {}),
		}),
	conflict: (updatedAt: Date) =>
		refusal("PORTFOLIO_VERSION_CONFLICT", { data: { updatedAt: updatedAt.toISOString() } }),
	tooLarge: (bytes: number) =>
		refusal("PORTFOLIO_TOO_LARGE", {
			message: `The portfolio is too large to save (${Math.ceil(bytes / 1024)} KB of ${PORTFOLIO_LIMITS.dataBytes / 1024} KB). Shorten some text or remove a few blocks.`,
			data: { bytes, max: PORTFOLIO_LIMITS.dataBytes },
		}),
	/** Data that doesn't match the write schema, found after the router's own check (data the server built). */
	invalid: (cause: unknown) =>
		new ORPCError("BAD_REQUEST", { status: 400, message: "The portfolio data isn't valid.", cause }),
	fileNotFound: (key: string) => refusal("PORTFOLIO_FILE_NOT_FOUND", { data: { key } }),
	emailNotVerified: () => refusal("PORTFOLIO_EMAIL_NOT_VERIFIED"),
	suspended: () => refusal("PORTFOLIO_SUSPENDED"),
	moderationConflict: () => refusal("PORTFOLIO_MODERATION_CONFLICT"),
	cannotBanAdmin: () => refusal("PORTFOLIO_CANNOT_BAN_ADMIN"),
	fileTooLarge: (bytes: number, kind: "picture" | "pdf" | "remote-picture" = "picture") => {
		const max = {
			picture: PORTFOLIO_UPLOAD.imageBytes,
			pdf: PORTFOLIO_UPLOAD.pdfBytes,
			"remote-picture": PORTFOLIO_UPLOAD.remoteImageBytes,
		}[kind];
		const sizes = `${megabytes(bytes)} of ${max / MB} MB`;
		return refusal("PORTFOLIO_FILE_TOO_LARGE", {
			message: {
				picture: `This picture is too large to upload (${sizes}).`,
				pdf: `This PDF is too large to upload (${sizes}). Save a smaller copy and try again.`,
				"remote-picture": "This picture is too large to copy. Upload it yourself instead.",
			}[kind],
			data: { bytes, max },
		});
	},
	pdfInvalid: (reason: "type") => refusal("PORTFOLIO_PDF_INVALID", { data: { reason } }),
	linkUnreadable: (reason: UnfurlProblem) => refusal("PORTFOLIO_LINK_UNREADABLE", { data: { reason } }),
	imageInvalid: (reason: ImageProblem) =>
		refusal("PORTFOLIO_IMAGE_INVALID", {
			message: {
				type: "Upload a JPEG, PNG or WebP picture.",
				animated: "Animated pictures can't be used. Upload a still picture.",
				dimensions: "This picture is larger than the portfolio allows. Upload it again so it's made smaller first.",
				unreadable: "This picture can't be read. Save it again as JPEG, PNG or WebP and upload that.",
			}[reason],
			data: { reason },
		}),
	/** The model answered, but with nothing that can go on the page: the run fails, so its credits come back. */
	aiUnusable: () => refusal("PORTFOLIO_AI_UNUSABLE"),
	fileInUse: (key: string) => refusal("PORTFOLIO_FILE_IN_USE", { data: { key } }),
	worksLimit: () => refusal("PORTFOLIO_WORKS_LIMIT", { data: { max: PORTFOLIO_LIMITS.works } }),
	storageFull: (stored: { bytes: number; files: number }) => {
		const maxBytes = PORTFOLIO_UPLOAD.accountBytes;
		const maxFiles = PORTFOLIO_UPLOAD.accountFiles;
		return refusal("PORTFOLIO_STORAGE_FULL", {
			message: `The portfolio's files take all the storage it may use (${megabytes(stored.bytes)} of ${maxBytes / MB} MB, ${stored.files} of ${maxFiles} files). Remove pictures or PDFs it no longer uses; they're deleted a day after.`,
			data: { bytes: stored.bytes, maxBytes, files: stored.files, maxFiles },
		});
	},
};
