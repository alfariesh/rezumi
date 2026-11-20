import type { WebContext } from "../web/contracts";
import { jobPostingsIn, readJobPosting as readSharedJobPosting } from "@rezumi/job-sites/json-ld";
import { htmlToText } from "../web/builtin";
import { MAX_CONTENT_CHARS, WebError } from "../web/contracts";
import { readPage } from "../web/service";

export { htmlToText } from "../web/builtin";
export { WebError as PostingFetchError } from "../web/contracts";

/** Matches the applications feature's cap on a saved posting. */
export const MAX_POSTING_CHARS = MAX_CONTENT_CHARS;

/** A lone http(s) link, as opposed to pasted posting text. */
export const isPostingLink = (input: string) => /^https?:\/\/\S+$/i.test(input.trim());

export async function fetchJobPosting(input: string, context: WebContext) {
	const { content, html, ...source } = await readPage(input, context);
	if (isListingUrl(source.resolvedUrl ?? input) || jobPostingsIn(html ?? "").length > 1)
		throw new WebError("not-a-page");
	const page = readJobPosting(html ?? "");
	const text = page?.description || content;
	const truncated = source.truncated || text.length > MAX_POSTING_CHARS;
	return {
		page,
		text: text.slice(0, MAX_POSTING_CHARS),
		source: {
			...source,
			...(page?.description ? { format: "text" as const } : {}),
			truncated,
			completeness: truncated ? ("incomplete" as const) : source.completeness,
		},
	};
}

/** Exclude known board/search pages; unknown sites still get a chance to describe one posting. */
function isListingUrl(url: string) {
	try {
		const { hostname, pathname } = new URL(url);
		if (/(^|\.)linkedin\.com$/.test(hostname))
			return pathname.startsWith("/jobs") && !pathname.startsWith("/jobs/view/");
		if (/(^|\.)indeed\.com$/.test(hostname)) return pathname === "/jobs";
		if (/(^|\.)glassdoor\.[a-z.]+$/.test(hostname)) return pathname.startsWith("/Job/");
		if (
			/^(?:jobs\.(?:eu\.)?lever\.co|jobs\.ashbyhq\.com|(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io)$/.test(hostname)
		)
			return pathname.split("/").filter(Boolean).length < 2;
		return false;
	} catch {
		return true;
	}
}

/**
 * The JobPosting a page describes in its JSON-LD, read without any AI: title, hiring organisation, location and the
 * description as text.
 */
export const readJobPosting = (html: string) => readSharedJobPosting(html, htmlToText);
