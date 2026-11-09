import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { getOrpcErrorMessage } from "@/libs/error-message";

type PortfolioErrorOptions = {
	/** What to say when the error isn't one of the portfolio API's refusals (a dropped connection, a server error). */
	fallback: string;
	/** Wording for this action that beats the general one, by error code (e.g. a PDF's "too large"). */
	byCode?: Record<string, string>;
};

type ErrorData = Record<string, unknown>;

const dataOf = (error: ORPCError<string, unknown>): ErrorData =>
	typeof error.data === "object" && error.data !== null ? (error.data as ErrorData) : {};

const numberOf = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** The picture checks `portfolio.uploadImage` and `portfolio.fetchRemoteImage` refuse a picture for. */
function imageInvalidMessage(reason: unknown): string {
	switch (reason) {
		case "animated":
			return t`Animated GIFs can't be used. Upload a still picture (JPG, PNG or WebP).`;
		case "dimensions":
			return t`This picture is larger than the portfolio allows. Upload it again so it's made smaller first.`;
		case "type":
			return t`This file isn't a picture your browser can read. Use a JPG, PNG or WebP file.`;
		default:
			return t`The server couldn't read this picture. Try another JPG, PNG or WebP file.`;
	}
}

/** The portfolio's data is over the size limit (`PORTFOLIO_LIMITS.dataBytes`), with the sizes when they're known. */
export function portfolioTooLargeMessage(bytes?: number, max?: number): string {
	return bytes !== undefined && max !== undefined
		? t`Your portfolio is too large to save (${Math.ceil(bytes / 1024)} KB of ${Math.floor(max / 1024)} KB). Shorten some text or remove a few blocks.`
		: t`Your portfolio is too large to save. Shorten some text or remove a few blocks.`;
}

/**
 * Every refusal of the portfolio API (`packages/api/src/features/portfolio`), in the user's language. The server's
 * English messages are never shown: each code has its own wording here, and `byCode` lets one action say it its way.
 */
function portfolioMessagesByCode(data: ErrorData): Record<string, string> {
	const maxWorks = numberOf(data.max);
	return {
		PORTFOLIO_DISABLED: t`Portfolios aren't available for your account right now.`,
		PORTFOLIO_EXISTS: t`You already have a portfolio. Open it from Portfolio in the menu.`,
		NOT_FOUND: t`This portfolio doesn't exist anymore. It may have been deleted in another tab.`,
		// "unreadable": the resume's stored data can't be read; otherwise it's missing or in Trash.
		PORTFOLIO_SOURCE_INVALID:
			data.reason === "unreadable"
				? t`This resume can't be read. Choose another resume.`
				: t`Choose one of your resumes that isn't in Trash.`,
		PORTFOLIO_VERSION_CONFLICT: t`Your portfolio changed in another tab or device. Reload it to see the latest version.`,
		PORTFOLIO_TOO_LARGE: portfolioTooLargeMessage(numberOf(data.bytes), numberOf(data.max)),
		PORTFOLIO_FILE_NOT_FOUND: t`A picture or file in your portfolio isn't available anymore. Remove it, then upload it again.`,
		PORTFOLIO_EMAIL_NOT_VERIFIED: t`Verify your email address before publishing your portfolio.`,
		PORTFOLIO_SUSPENDED: t`Your portfolio was taken down and can't be published. Contact support to appeal.`,
		PORTFOLIO_FILE_TOO_LARGE: t`This file is too large to upload.`,
		PORTFOLIO_PDF_INVALID: t`This file isn't a PDF. Upload a PDF file.`,
		PORTFOLIO_LINK_UNREADABLE: t`This site can't be read automatically. Fill in the details yourself.`,
		PORTFOLIO_IMAGE_INVALID: imageInvalidMessage(data.reason),
		PORTFOLIO_FILE_IN_USE: t`Your portfolio still uses this file. Remove it from the portfolio first.`,
		PORTFOLIO_WORKS_LIMIT:
			maxWorks !== undefined
				? t`A portfolio holds at most ${maxWorks} works. Remove some before adding more.`
				: t`Your portfolio holds as many works as it can. Remove some before adding more.`,
		PORTFOLIO_STORAGE_FULL: t`Your portfolio's storage is full. Remove pictures or PDFs you don't need, then try again.`,
		TOO_MANY_REQUESTS: t`Too many requests in a short time. Wait a minute, then try again.`,
	};
}

/**
 * A portfolio API error in words for the person who caused it. Plan refusals are worded by the billing
 * helpers inside `getOrpcErrorMessage`; anything else, including errors that aren't the API's answer at all (a dropped
 * connection's "Failed to fetch", a script error), gets `fallback`, never its own English text.
 */
export function portfolioErrorMessage(error: unknown, options: PortfolioErrorOptions): string {
	if (!(error instanceof ORPCError)) return options.fallback;
	const byCode = { ...portfolioMessagesByCode(dataOf(error)), ...options.byCode };
	return getOrpcErrorMessage(error, { fallback: options.fallback, byCode });
}

/** The words for one of the portfolio API's refusal codes, or undefined for a code it doesn't use. */
export function portfolioRefusalMessage(code: string, data: ErrorData = {}): string | undefined {
	return portfolioMessagesByCode(data)[code];
}

/** The error's code when it's a refusal from the API, else undefined (a dropped connection, a script error). */
export function portfolioErrorCode(error: unknown): string | undefined {
	return error instanceof ORPCError ? error.code : undefined;
}
