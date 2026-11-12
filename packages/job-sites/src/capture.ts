import { z } from "zod";
import { JOB_SITES } from "./sites";

/**
 * The most posting text the extension sends and the server keeps: the server's web reader cap (MAX_CONTENT_CHARS in
 * packages/api/src/features/web-access/contracts.ts; a test there keeps the two equal).
 */
export const MAX_CAPTURE_TEXT_CHARS = 20_000;

/** At most this many JSON-LD blocks of at most this many characters each are read from a page. */
export const MAX_JSON_LD_BLOCKS = 5;
export const MAX_JSON_LD_CHARS = 50_000;

const shortText = (max: number) => z.string().trim().max(max);

/** What a site reader found in the page's own markup; every field is plain text, never HTML. */
export const capturedFieldsSchema = z.object({
	role: shortText(300).optional(),
	company: shortText(300).optional(),
	location: shortText(300).optional(),
	salary: shortText(300).optional(),
	employmentType: shortText(100).optional(),
	/** When the employer stops taking applications, as the page states it (ISO when known). */
	validThrough: shortText(100).optional(),
	applyUrl: z
		.url({ protocol: /^https?$/ })
		.max(2_000)
		.optional(),
});

export type CapturedFields = z.infer<typeof capturedFieldsSchema>;

/**
 * One posting as the browser extension captured it from the open page and sends to the server
 * (.agents/docs/plans/plugin-browser/02-teknis.md §7.5). The page is untrusted: text only, every field bounded.
 */
export const capturedPostingSchema = z.object({
	url: z.url({ protocol: /^https?$/ }).max(2_000),
	canonicalUrl: z.url({ protocol: /^https?$/ }).max(2_000),
	/** The board with its own reader, or null for any other site (read from JSON-LD and page text). */
	site: z.enum(JOB_SITES).nullable(),
	pageTitle: shortText(500),
	/** The page's raw `application/ld+json` blocks, unparsed. */
	jsonLd: z.array(z.string().max(MAX_JSON_LD_CHARS)).max(MAX_JSON_LD_BLOCKS),
	/** The posting's visible text, whitespace tidied. */
	text: z.string().max(MAX_CAPTURE_TEXT_CHARS),
	/** Text the person selected on the page, when they saved a selection. */
	selection: z.string().max(MAX_CAPTURE_TEXT_CHARS).optional(),
	fields: capturedFieldsSchema.optional(),
});

export type CapturedPosting = z.infer<typeof capturedPostingSchema>;
