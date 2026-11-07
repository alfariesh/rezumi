import type { SchemaKit } from "./kit";
import z from "zod";
import { PORTFOLIO_LIMITS } from "./limits";

/**
 * Where portfolio files live in storage. Pictures sit under `pictures/`, which the public upload route already serves;
 * PDFs under `documents/`. The API checks each key belongs to the portfolio's owner and is recorded in
 * `portfolio_file` before saving data that uses it.
 */
export const PORTFOLIO_IMAGE_KEY_PATTERN = /^uploads\/[\w-]+\/pictures\/portfolio\/[\w-]+\.(?:webp|jpe?g|png)$/;
export const PORTFOLIO_PDF_KEY_PATTERN = /^uploads\/[\w-]+\/documents\/portfolio\/[\w-]+\.pdf$/;

export const portfolioImageKeySchema = z
	.string()
	.regex(PORTFOLIO_IMAGE_KEY_PATTERN, "Use an image uploaded to this portfolio.")
	.describe("The storage key of an image uploaded to the portfolio: uploads/<userId>/pictures/portfolio/<id>.<ext>.");

export const portfolioPdfKeySchema = z
	.string()
	.regex(PORTFOLIO_PDF_KEY_PATTERN, "Use a PDF uploaded to this portfolio.")
	.describe("The storage key of a PDF uploaded to the portfolio: uploads/<userId>/documents/portfolio/<id>.pdf.");

/**
 * The storage folders of an account's portfolio files, each with its trailing slash: storage lists by prefix, and
 * without the slash a listing would also return siblings such as `pictures/portfolio-persona.jpg`.
 */
export function portfolioFilePrefixes(userId: string): string[] {
	return [`uploads/${userId}/pictures/portfolio/`, `uploads/${userId}/documents/portfolio/`];
}

/**
 * Whether deleting this storage key, a file or a whole folder, would delete any of the account's portfolio files: a
 * key inside one of its portfolio folders, the folder itself, or a folder holding one. Those files are recorded in
 * `portfolio_file`, so only the portfolio API may delete them.
 */
export function reachesPortfolioFiles(userId: string, key: string): boolean {
	const path = `${key.replace(/\/+$/, "")}/`;
	return portfolioFilePrefixes(userId).some((prefix) => path.startsWith(prefix) || prefix.startsWith(path));
}

const side = z.number().int().min(1).max(PORTFOLIO_LIMITS.imageSide);

export function createImageSchema(kit: SchemaKit) {
	return z.object({
		key: portfolioImageKeySchema,
		thumbKey: kit.optional(portfolioImageKeySchema).describe("A smaller copy (800 px) for cards and lists."),
		width: side.describe("The image's width in pixels."),
		height: side.describe("The image's height in pixels."),
		alt: kit.field(kit.text(PORTFOLIO_LIMITS.text.alt), "").describe("Alternative text for screen readers."),
	});
}

export type PortfolioImage = z.output<ReturnType<typeof createImageSchema>>;
