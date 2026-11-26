import z from "zod";
import { PORTFOLIO_LIMITS } from "../portfolio/limits";
import { sourceResultSchema } from "./sources";

/**
 * Importing a person's own website (`.agents/docs/plans/impor-website/02-teknis.md`): the site's home page fills the
 * Profile as the website source does, and its pages about the person's work become drafts of portfolio works. Nothing
 * is saved until the person reviews the drafts; a run's result is kept for a day so the review survives a reload.
 */

const { text: max } = PORTFOLIO_LIMITS;

/** Works one import finds at most (owner decision W4). */
export const WEBSITE_IMPORT_MAX_WORKS = 10;
/** Pictures a work keeps from its page: a cover and a gallery (decision D5). */
export const WEBSITE_IMPORT_MAX_GALLERY = 6;
/** Imports an account may start in a day (decision D2). */
export const WEBSITE_IMPORT_DAILY_LIMIT = 3;

const pageUrl = z.url({ protocol: /^https$/ }).max(2048);

export const websiteImportImageSchema = z.object({
	url: pageUrl.describe("The picture's public https address on the site; copied only when the work is saved."),
	alt: z.string().max(max.alt).describe("The picture's description on the page, if it had one."),
	width: z.number().int().positive().nullable().describe("Its width in pixels, when the page says."),
	height: z.number().int().positive().nullable().describe("Its height in pixels, when the page says."),
});

export type WebsiteImportImage = z.infer<typeof websiteImportImageSchema>;

export const websiteImportLinkSchema = z.object({
	url: pageUrl,
	label: z.string().max(max.buttonLabel).describe("The link's text on the page, shortened."),
});

export const websiteImportMetricSchema = z.object({
	label: z.string().max(max.metricLabel).describe("What was measured, in the page's words."),
	value: z.string().max(40).describe("The result as the page writes it, such as '40%' or '1.2M users'."),
});

export const workDraftSchema = z.object({
	id: z.string().min(1).max(64).describe("Stable within the run: pass it back to save this work."),
	sourceUrl: pageUrl.describe("The page the work came from."),
	title: z.string().min(1).max(max.workTitle),
	summary: z.string().max(max.workSummary).describe("One or two sentences for the work's card."),
	role: z.string().max(max.workRole),
	date: z.string().max(max.workDate).describe("Free text as the page writes it, such as '2024'."),
	tags: z.array(z.string().max(max.tag)).max(PORTFOLIO_LIMITS.tagsPerWork),
	description: z.string().max(max.blockText).describe("The work's story as the page tells it, for a Text block."),
	metrics: z.array(websiteImportMetricSchema).max(PORTFOLIO_LIMITS.metricsPerBlock),
	cover: websiteImportImageSchema.nullable(),
	gallery: z.array(websiteImportImageSchema).max(WEBSITE_IMPORT_MAX_GALLERY),
	primaryLink: websiteImportLinkSchema.nullable().describe("The work's main link: a live site, a store, a repository."),
	links: z.array(websiteImportLinkSchema).max(8).describe("Other links the page gives for the work."),
	embeds: z
		.array(pageUrl)
		.max(4)
		.describe("Videos and embeds the page shows (YouTube, Vimeo, Figma, Loom, ...), as the portfolio can show them."),
});

export type WorkDraft = z.infer<typeof workDraftSchema>;

/**
 * Short codes about an import, for the app to explain it:
 * - `truncated`: the home page was longer than what was read.
 * - `pages-failed`: some pages about works couldn't be read; the others were.
 * - `more-works`: the site has more works than one import takes.
 * - `no-works`: no work was found; the Profile part stands on its own.
 */
export const WEBSITE_IMPORT_NOTES = ["truncated", "pages-failed", "more-works", "no-works"] as const;

export type WebsiteImportNote = (typeof WEBSITE_IMPORT_NOTES)[number];

export const websiteImportResultSchema = z.object({
	runId: z.string().describe("The import, for `websiteImportResult` and for saving its works."),
	url: z.string().describe("The address that was read, after redirects."),
	profile: sourceResultSchema.describe("The Profile draft from the home page, like the website source's."),
	works: z.array(workDraftSchema).max(WEBSITE_IMPORT_MAX_WORKS),
	notes: z.array(z.enum(WEBSITE_IMPORT_NOTES)),
	free: z.boolean().describe("Whether this import was the account's free one: no credits were taken."),
	expiresAt: z.coerce.date().describe("When the result is no longer kept for review."),
});

export type WebsiteImportResult = z.infer<typeof websiteImportResultSchema>;

/**
 * What an import reports while it runs, then its result. `found` counts pages about works; `page` counts them as they
 * are read (failed ones too).
 */
export const websiteImportEventSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("reading") }),
	z.object({ type: z.literal("found"), pages: z.number().int().min(0) }),
	z.object({ type: z.literal("page"), done: z.number().int().min(0), total: z.number().int().min(0) }),
	z.object({ type: z.literal("extracting") }),
	z.object({ type: z.literal("done"), result: websiteImportResultSchema }),
]);

export type WebsiteImportEvent = z.infer<typeof websiteImportEventSchema>;

/**
 * Saving an import's chosen works (`portfolio.importSiteWorks`): its pictures are copied one by one, then the works
 * are saved. `done` says what happened:
 * - `added`: works saved; `alreadyThere`: chosen works the portfolio already had (a site imported twice).
 * - `picturesSkipped`: pictures that couldn't be read or stored; `storageFull`: the portfolio's storage ran out, so
 *   the rest were left out (the works are saved without them).
 * - `created`: the import made the portfolio (unpublished, with the Profile as its source).
 */
export const siteWorksEventSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("saving") }),
	z.object({ type: z.literal("picture"), done: z.number().int().min(0), total: z.number().int().min(0) }),
	z.object({
		type: z.literal("done"),
		added: z.number().int().min(0),
		alreadyThere: z.number().int().min(0),
		picturesSkipped: z.number().int().min(0),
		storageFull: z.boolean(),
		created: z.boolean(),
	}),
]);

export type SiteWorksEvent = z.infer<typeof siteWorksEventSchema>;
