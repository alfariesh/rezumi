import type { SiteDocument, SiteLink } from "./document";
import type { WorkDraft } from "@rezumi/schema/profile/website-import";
import type { LanguageModel } from "ai";
import z from "zod";
import { websiteWorkPagesSystemPrompt, websiteWorksSystemPrompt } from "@rezumi/ai/prompts";
import { truncateText } from "@rezumi/portfolio/text";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { WEBSITE_IMPORT_MAX_GALLERY, WEBSITE_IMPORT_MAX_WORKS } from "@rezumi/schema/profile/website-import";
import { dataBlock } from "../../../ai/data-block";
import { generateJson } from "../../../ai/generate-json";
import { SHARE_IMAGE_CONTEXT } from "./document";

/**
 * The two AI steps of a website import (`02-teknis.md` section 4), besides the Profile read the website source already
 * does: choosing the pages about works from the site's links, then turning those pages into work drafts. Pages are
 * untrusted: they go to the model as data, and every picture, link and page it names is taken from the numbered lists
 * the server gave it, never from addresses it writes.
 */

const { text: max } = PORTFOLIO_LIMITS;

/** Text of the home page the page picker sees: enough to tell a one-page portfolio from a landing page. */
const PICKER_HOME_CHARS = 6_000;
/** Site links the page picker sees. */
const PICKER_LINKS = 150;
/** Text of each work page the work reader sees at most. */
export const WORK_PAGE_CHARS = 8_000;
/**
 * Text of all work pages together: with their picture and link lists and the instructions, ten pages stay inside the
 * work's 120,000-character input limit (`AI_WORK_LIMITS`).
 */
const WORK_PAGES_TEXT_BUDGET = 70_000;
/** Text of a one-page portfolio's home page, when its works are read from it. */
const HOME_WORKS_CHARS = 30_000;
const PICTURES_PER_PAGE = 20;
const LINKS_PER_PAGE = 12;

const oneLine = (text: string, length = 160) => text.replace(/\s+/g, " ").trim().slice(0, length);

const pickerAnswer = z.object({
	pages: z.array(z.number().int()).catch([]),
	worksOnHome: z.boolean().catch(false),
});

/** The site's pages about works (at most ten, best first), and whether its works are on the home page itself. */
export async function pickWorkPages(
	model: LanguageModel,
	input: { url: string; homeText: string; links: readonly SiteLink[] },
	signal?: AbortSignal,
): Promise<{ pages: SiteLink[]; worksOnHome: boolean }> {
	const links = input.links.slice(0, PICKER_LINKS);
	if (!links.length) return { pages: [], worksOnHome: true };
	const list = links
		.map((link, index) => `${index + 1}. ${oneLine(link.text) || "(no text)"} — ${link.url}`)
		.join("\n");
	const answer = await generateJson(
		model,
		{
			system: websiteWorkPagesSystemPrompt,
			prompt: [
				`Site: ${input.url}`,
				dataBlock("HOME", input.homeText.slice(0, PICKER_HOME_CHARS)),
				dataBlock("LINKS", list),
			].join("\n\n"),
		},
		pickerAnswer,
		signal,
	);
	const picked = new Set<number>();
	const pages: SiteLink[] = [];
	for (const number of answer.pages) {
		const link = links[number - 1];
		if (!link || picked.has(number)) continue;
		picked.add(number);
		pages.push(link);
		if (pages.length === WEBSITE_IMPORT_MAX_WORKS) break;
	}
	return { pages, worksOnHome: answer.worksOnHome };
}

/** One page the work reader gets: its address, its text and what the page reader found on it. */
export type WorkPage = { url: string; text: string; document: SiteDocument };

const text = (length: number) =>
	z
		.string()
		.catch("")
		.transform((value) => value.trim().slice(0, length * 2));
const index = z.number().int().nullable().catch(null);

const workAnswer = z.object({
	page: z.number().int(),
	title: text(max.workTitle),
	summary: text(max.workSummary),
	role: text(max.workRole),
	date: text(max.workDate),
	tags: z.array(text(max.tag)).catch([]),
	description: text(max.blockText),
	metrics: z.array(z.object({ label: text(max.metricLabel), value: text(40) })).catch([]),
	cover: index,
	gallery: z.array(z.number().int()).catch([]),
	primaryLink: index,
	links: z.array(z.number().int()).catch([]),
});

const worksAnswer = z.object({ works: z.array(workAnswer.nullable().catch(null)).catch([]) });

function pageBlock(page: WorkPage, number: number, chars: number) {
	const { document } = page;
	const pictures = document.images
		.slice(0, PICTURES_PER_PAGE)
		.map(
			(image, at) =>
				`${at + 1}. ${oneLine(image.alt) || "(no description)"}${image.context ? ` — near: ${oneLine(image.context, 100)}` : ""}`,
		)
		.join("\n");
	const links = document.external
		.slice(0, LINKS_PER_PAGE)
		.map((link, at) => `${at + 1}. ${oneLine(link.text) || "(no text)"} — ${link.url}`)
		.join("\n");
	return dataBlock(
		`PAGE_${number}`,
		[
			`Address: ${page.url}`,
			`Title: ${document.title}`,
			`Text:\n${page.text.slice(0, chars)}`,
			`Pictures:\n${pictures || "(none)"}`,
			`Links to other sites:\n${links || "(none)"}`,
		].join("\n\n"),
	);
}

const fit = (value: string, length: number) => (value.length > length ? truncateText(value, length) : value);

const pick = <T>(list: readonly T[], number: number | null | undefined, limit: number): T | null =>
	number && number >= 1 && number <= limit ? (list[number - 1] ?? null) : null;

/**
 * Work drafts from pages about works, in the pages' order. `onHome` reads several works from the one page it gets (a
 * one-page portfolio). Drafts without a title are dropped; at most ten come back. IDs are `w1`, `w2`, ... in order.
 */
export async function extractWorks(
	model: LanguageModel,
	input: { pages: readonly WorkPage[]; onHome: boolean },
	signal?: AbortSignal,
): Promise<WorkDraft[]> {
	if (!input.pages.length) return [];
	const chars = input.onHome
		? HOME_WORKS_CHARS
		: Math.min(WORK_PAGE_CHARS, Math.floor(WORK_PAGES_TEXT_BUDGET / input.pages.length));
	const answer = await generateJson(
		model,
		{
			system: websiteWorksSystemPrompt,
			prompt: [
				input.onHome
					? "The works are on the home page: make one draft for each work it describes."
					: "Make one draft for each page that is about a work.",
				...input.pages.map((page, at) => pageBlock(page, at + 1, chars)),
			].join("\n\n"),
		},
		worksAnswer,
		signal,
	);

	const drafts: WorkDraft[] = [];
	const perPage = new Map<number, number>();
	for (const work of answer.works) {
		if (!work || drafts.length === WEBSITE_IMPORT_MAX_WORKS) continue;
		const page = input.pages[work.page - 1];
		const title = fit(work.title, max.workTitle);
		if (!page || !title) continue;
		// One draft per page, unless the page is a one-page portfolio.
		if (!input.onHome && perPage.has(work.page)) continue;
		perPage.set(work.page, (perPage.get(work.page) ?? 0) + 1);

		const { images, external, embeds } = page.document;
		const pictureLimit = Math.min(images.length, PICTURES_PER_PAGE);
		const linkLimit = Math.min(external.length, LINKS_PER_PAGE);
		// Without a picture of its own, a work's page still has its preview picture: a fair cover, unless the page is a
		// one-page portfolio whose preview belongs to the whole site.
		const preview = input.onHome ? undefined : images.find((picture) => picture.context === SHARE_IMAGE_CONTEXT);
		const cover = pick(images, work.cover, pictureLimit) ?? preview ?? null;
		const gallery = [...new Set(work.gallery)]
			.map((number) => pick(images, number, pictureLimit))
			.filter((image) => image !== null && image.url !== cover?.url)
			.slice(0, WEBSITE_IMPORT_MAX_GALLERY)
			.map((image) => image as NonNullable<typeof image>);
		const primary = pick(external, work.primaryLink, linkLimit);
		const links = [...new Set(work.links)]
			.map((number) => pick(external, number, linkLimit))
			.filter((link) => link !== null && link.url !== primary?.url)
			.slice(0, 8)
			.map((link) => link as SiteLink);
		const image = (picture: (typeof images)[number]) => ({
			url: picture.url,
			alt: fit(picture.alt, max.alt),
			width: picture.width,
			height: picture.height,
		});
		const link = (entry: SiteLink) => ({
			url: entry.url,
			label: fit(entry.text || new URL(entry.url).hostname, max.buttonLabel),
		});

		drafts.push({
			id: `w${drafts.length + 1}`,
			sourceUrl: page.url,
			title,
			summary: fit(work.summary, max.workSummary),
			role: fit(work.role, max.workRole),
			date: fit(work.date, max.workDate),
			tags: [...new Set(work.tags.map((tag) => fit(tag, max.tag)).filter(Boolean))].slice(
				0,
				PORTFOLIO_LIMITS.tagsPerWork,
			),
			description: fit(work.description, max.blockText),
			metrics: work.metrics
				.map((metric) => ({ label: fit(metric.label, max.metricLabel), value: fit(metric.value, 40) }))
				.filter((metric) => metric.label && metric.value)
				.slice(0, PORTFOLIO_LIMITS.metricsPerBlock),
			cover: cover ? image(cover) : null,
			gallery: gallery.map(image),
			primaryLink: primary ? link(primary) : null,
			links: links.map(link),
			// Embeds belong to a page; a one-page portfolio's are shared by all its works, so none is guessed there.
			embeds: input.onHome ? [] : embeds.slice(0, 4),
		});
	}
	return drafts;
}
