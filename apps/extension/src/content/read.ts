import type { CapturedFields } from "@rezumi/job-sites/capture";
import type { JobSite } from "@rezumi/job-sites/sites";
import { MAX_CAPTURE_TEXT_CHARS, MAX_JSON_LD_BLOCKS, MAX_JSON_LD_CHARS } from "@rezumi/job-sites/limits";
import { canonicalJobUrl, detectSite, jobKey } from "@rezumi/job-sites/sites";
import { SITE_ADAPTERS } from "./sites";
import { clip, textOf, tidy } from "./text";

/**
 * One reading of the open page, made only when the person asks (opening the panel, saving, the context menu or the
 * shortcut). Order (02-teknis.md §7.2): the board's own reader, then the page's JSON-LD (parsed by the panel and the
 * server, not here), then the page's main text; text the person selected wins over all of them on the server.
 */
export type PageReading = {
	url: string;
	canonicalUrl: string;
	site: JobSite | null;
	/** The posting's job key; null on a board page with no posting open (a search page with nothing picked). */
	key: string | null;
	pageTitle: string;
	/** Raw JSON-LD blocks that mention a JobPosting (unparsed; at most 5 of at most 50,000 characters each). */
	jsonLd: string[];
	/** The posting's text: the board's description block, else the page's main text. */
	text: string;
	/** Where `text` came from. */
	textSource: "site" | "page";
	selection?: string;
	/** What the board's reader found (empty on other sites). */
	fields: CapturedFields;
};

/** The JSON-LD blocks that may hold a job posting. */
function jsonLdBlocks(document: Document): string[] {
	const blocks: string[] = [];
	for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
		const text = script.textContent?.trim() ?? "";
		if (!text || text.length > MAX_JSON_LD_CHARS || !text.includes("JobPosting")) continue;
		blocks.push(text);
		if (blocks.length === MAX_JSON_LD_BLOCKS) break;
	}
	return blocks;
}

/** A page's main text: `main`, else the longest `article`, else the body; without navigation, header and footer. */
function mainText(document: Document): string {
	const main = document.querySelector('main, [role="main"]');
	const articles = [...document.querySelectorAll("article")];
	const longest = articles.toSorted((a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0))[0];
	return textOf(main ?? longest ?? document.body, { skipChrome: true });
}

export function readPage(document: Document, href: string, selected = ""): PageReading {
	const url = new URL(href);
	const site = detectSite(url);
	const reading = site ? SITE_ADAPTERS[site].read(document, url) : null;
	const description = reading?.description ?? "";
	const selection = clip(tidy(selected), MAX_CAPTURE_TEXT_CHARS);
	return {
		url: url.href,
		canonicalUrl: canonicalJobUrl(url) ?? url.href,
		site,
		key: jobKey(url),
		pageTitle: tidy(document.title).slice(0, 500),
		jsonLd: jsonLdBlocks(document),
		text: clip(description || mainText(document), MAX_CAPTURE_TEXT_CHARS),
		textSource: description ? "site" : "page",
		...(selection ? { selection } : {}),
		fields: reading?.fields ?? {},
	};
}
