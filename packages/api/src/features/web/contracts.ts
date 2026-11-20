/**
 * Reading public pages and searching the web for the server, with no setup by the person (`.agents/docs/plans/lowongan/
 * 02-teknis.md` section 11). Pages are read directly, then through Cloudflare Browser Run when a page needs JavaScript;
 * searches go through treg on Rezumi's account.
 */

export type WebContext = {
	userId: string;
	signal?: AbortSignal | undefined;
	/** ISO 3166-1 alpha-2 countries to search, first primary. Absent or empty searches anywhere. */
	regions?: string[] | undefined;
};

export type ReadPageResult = {
	requestedUrl: string;
	resolvedUrl?: string;
	content: string;
	format: "text";
	/** Time received by this application. */
	retrievedAt: string;
	/** `browser`: the page needed JavaScript and was read through Browser Run. */
	method: "builtin" | "browser";
	truncated: boolean;
	completeness: "unknown" | "incomplete";
	/** Why the direct read wasn't enough, when the page was read through the browser. */
	fallbackReason?: BrowserReason;
	/** Bounded server-only input for JobPosting parsing. */
	html?: string;
};

/** Direct-read failures a real browser can get past: nothing rendered, a bot check, a refusal of plain requests. */
export type BrowserReason = "empty" | "challenge" | "unreachable";

export type SearchResult = { url: string; title: string; snippet?: string };

export type WebFailure =
	| "unsafe-url"
	| "unreachable"
	| "not-a-page"
	| "too-large"
	| "malformed"
	| "empty"
	| "challenge"
	| "timeout"
	| "unavailable"
	| "rate-limit"
	| "budget";

/** Plain words for the assistant, which sees a failed tool's message and explains it to the person. */
const MESSAGES: Record<WebFailure, string> = {
	"unsafe-url": "Only public https:// addresses can be read.",
	unreachable: "The page couldn't be reached.",
	"not-a-page": "The address isn't a readable web page.",
	"too-large": "The page is too large to read.",
	malformed: "The request wasn't valid.",
	empty: "The page has no readable text.",
	challenge: "The site blocks automated reading.",
	timeout: "The page took too long to answer.",
	unavailable: "Web search isn't available on this server.",
	"rate-limit": "Too many web requests. Try again later.",
	budget: "Web search reached today's limit on this server. Try again tomorrow.",
};

export class WebError extends Error {
	constructor(readonly reason: WebFailure) {
		super(MESSAGES[reason]);
		this.name = "WebError";
	}
}

export const MAX_PAGE_BYTES = 2_000_000;
export const MAX_CONTENT_CHARS = 20_000;
export const MAX_SEARCH_RESULTS = 5;
export const MAX_SEARCH_QUERY_CHARS = 512;
/** One read: the direct reader, then the browser when the page needs it. */
export const READ_DEADLINE_MS = 30_000;
export const SEARCH_DEADLINE_MS = 20_000;
