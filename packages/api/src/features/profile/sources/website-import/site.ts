import type { WorkPage } from "./ai";
import type { SiteDocument, SiteLink } from "./document";
import type { SourceResult } from "@rezumi/schema/profile/sources";
import type { WebsiteImportEvent, WebsiteImportNote, WorkDraft } from "@rezumi/schema/profile/website-import";
import type { LanguageModel } from "ai";
import { isProfileEmpty } from "@rezumi/schema/profile/data";
import { WEBSITE_IMPORT_MAX_WORKS } from "@rezumi/schema/profile/website-import";
import { aiService } from "../../../ai/service";
import { WebError } from "../../../web/contracts";
import { readPage, readSitemapXml } from "../../../web/service";
import { sourceErrors } from "../errors";
import { sourceResult } from "../result";
import { pageError } from "../website";
import { extractWorks, pickWorkPages } from "./ai";
import { readSiteDocument, readSitemap } from "./document";

/**
 * The reading part of a website import, without its credits or its row (`run.ts`), so the dev probe runs exactly what
 * the app runs: the home page into a Profile draft, AI picks the pages about works from the site's links and sitemap,
 * those are read four at a time, and AI turns them into work drafts. Yields progress; returns what it found.
 */

/** Pages read at the same time. */
const READ_CONCURRENCY = 4;

export type SiteRead = {
	homeUrl: string;
	profile: SourceResult;
	works: WorkDraft[];
	notes: WebsiteImportNote[];
};

/** The site's own pages to choose from: its links first (they carry words), then what only the sitemap lists. */
export function candidateLinks(home: SiteDocument, sitemap: readonly string[]): SiteLink[] {
	const seen = new Set(home.pages.map((link) => link.url));
	return [...home.pages, ...sitemap.filter((url) => !seen.has(url)).map((url) => ({ url, text: "" }))];
}

async function readSiteMap(origin: string, signal: AbortSignal | undefined) {
	const xml = await readSitemapXml(origin, signal);
	return xml ? readSitemap(xml, new URL(origin)) : [];
}

async function readWorkPage(userId: string, link: SiteLink, signal: AbortSignal | undefined): Promise<WorkPage> {
	const page = await readPage(link.url, { userId, signal, allowance: "import" });
	const url = page.resolvedUrl ?? page.requestedUrl;
	return { url, text: page.content, document: readSiteDocument(page.html ?? "", url) };
}

/** Reads the site; `stats` counts the pages read as it goes, also when it fails. Throws a source error or an AI error. */
export async function* readSiteForImport(input: {
	userId: string;
	address: string;
	model: LanguageModel;
	signal?: AbortSignal | undefined;
	stats: { pagesRead: number };
}): AsyncGenerator<Exclude<WebsiteImportEvent, { type: "done" }>, SiteRead, unknown> {
	const { userId, address, model, signal, stats } = input;
	yield { type: "reading" };
	let homePage;
	try {
		homePage = await readPage(address, { userId, signal, allowance: "import" });
	} catch (error) {
		signal?.throwIfAborted();
		throw pageError(error instanceof WebError ? error.reason : "unreachable");
	}
	stats.pagesRead = 1;
	const homeUrl = homePage.resolvedUrl ?? homePage.requestedUrl;
	const home = readSiteDocument(homePage.html ?? "", homeUrl);
	const notes = new Set<WebsiteImportNote>();
	if (homePage.truncated || homePage.completeness === "incomplete") notes.add("truncated");

	const sitemap = await readSiteMap(new URL(homeUrl).origin, signal);
	const links = candidateLinks(home, sitemap);
	const [profileData, picked] = await Promise.all([
		aiService.parseWebsite({ languageModel: model, text: homePage.content, url: homeUrl, signal }),
		pickWorkPages(model, { url: homeUrl, homeText: homePage.content, links }, signal),
	]);
	yield { type: "found", pages: picked.pages.length };

	const pages: WorkPage[] = [];
	let failed = 0;
	for (let start = 0; start < picked.pages.length; start += READ_CONCURRENCY) {
		const batch = picked.pages.slice(start, start + READ_CONCURRENCY).map((link) => readWorkPage(userId, link, signal));
		for (const read of batch) {
			try {
				pages.push(await read);
				stats.pagesRead++;
			} catch {
				signal?.throwIfAborted();
				failed++;
			}
			yield { type: "page", done: pages.length + failed, total: picked.pages.length };
		}
	}
	if (failed) notes.add("pages-failed");
	if (picked.pages.length >= WEBSITE_IMPORT_MAX_WORKS && links.length > picked.pages.length) notes.add("more-works");

	yield { type: "extracting" };
	const onHome = pages.length === 0 && picked.worksOnHome;
	const sources: WorkPage[] = onHome ? [{ url: homeUrl, text: homePage.content, document: home }] : pages;
	const works = sources.length ? await extractWorks(model, { pages: sources, onHome }, signal) : [];
	signal?.throwIfAborted();
	if (!works.length) notes.add("no-works");

	const profile = sourceResult(profileData, notes.has("truncated") ? ["truncated"] : []);
	if (isProfileEmpty(profile.data) && !works.length)
		throw sourceErrors.notFound("That site doesn't say who you are or show any of your work.");
	return { homeUrl, profile, works, notes: [...notes] };
}
