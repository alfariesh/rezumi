import type { BrowserReason, ReadPageResult, SearchResult, WebContext, WebFailure } from "./contracts";
import type { SearchCall } from "./search";
import { env } from "@rezumi/env/server";
import { rateLimitConfig } from "@rezumi/utils/rate-limit";
import { MAX_SEARCH_REGIONS } from "@rezumi/utils/region";
import { abortable } from "@rezumi/utils/url-security.node";
import { createRateLimiter } from "../../redis";
import { budgetLeft, recordSpend } from "../jobs/allowance";
import { jobCounters } from "../jobs/counters";
import { recordJobEvent } from "../jobs/events";
import { isTregConfigured } from "../jobs/treg";
import { isBrowserRunConfigured, readBrowserPage } from "./browser";
import { assertPublicTarget, htmlToText, readBuiltinPage, XML_TYPES } from "./builtin";
import {
	MAX_PAGE_BYTES,
	MAX_SEARCH_QUERY_CHARS,
	MAX_SEARCH_RESULTS,
	READ_DEADLINE_MS,
	SEARCH_DEADLINE_MS,
	WebError,
} from "./contracts";
import { searchRouted, searchSerper } from "./search";
import { pageContent, safeFailure } from "./transport";

/** Pages a person may have read through Browser Run in one UTC day (`02-teknis.md` section 11). */
export const BROWSER_READS_PER_DAY = 20;
/** Web searches a person may send in one UTC day; each one costs Rezumi money (section 11). */
export const WEB_SEARCHES_PER_DAY = 50;
/**
 * What one person's web searches may cost in a UTC day, in millionths of a US dollar: room for every search in three
 * countries through Serper ($0.15), so only the dearer fallback runs into it. One person can't spend the shared budget.
 */
export const WEB_SEARCH_SPEND_PER_DAY_MICRO = 200_000;
/** The direct reader's share of a read's deadline when the browser can take over. */
const DIRECT_BUDGET_MS = 12_000;
/** A sitemap is a nicety: a slow one is skipped rather than waited for. */
const SITEMAP_DEADLINE_MS = 8_000;

const limiter = createRateLimiter("web", rateLimitConfig.orpc.aiRequest);

async function consume(userId: string, signal: AbortSignal) {
	signal.throwIfAborted();
	if (process.env.NODE_ENV !== "production" || env.FLAG_DISABLE_API_RATE_LIMIT) return;
	const { success } = await abortable(limiter.limit(userId), signal);
	if (!success) throw new WebError("rate-limit");
}

const deadline = (ms: number, signal?: AbortSignal) =>
	AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(ms)]);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A person's running total of `what` this UTC day. Checked before an attempt and added to only once it worked, so a
 * failed read or search costs nothing. (The counters fall back to this process when the shared store fails.)
 */
function today(what: string, userId: string) {
	const now = Date.now();
	const day = new Date(now).toISOString().slice(0, 10);
	const rule = { window: Date.parse(`${day}T00:00:00Z`) + DAY_MS - now + 60 * 60 * 1000 };
	const key = `${what}:${userId}:${day}`;
	return {
		used: async () => (await jobCounters.add(key, 0, rule)).total,
		add: async (amount: number) => {
			if (amount > 0) await jobCounters.add(key, Math.round(amount), rule);
		},
	};
}

function log(operation: "search" | "read", method: string, started: number, outcome: string, detail?: string) {
	console.info("[web]", {
		method,
		operation,
		durationMs: Date.now() - started,
		outcome,
		...(detail ? { detail } : {}),
	});
}

// ---- Reading -----------------------------------------------------------------------------------------------------

const BROWSER_HELPS = new Set<WebFailure>(["empty", "challenge", "unreachable"] satisfies BrowserReason[]);
const helpsBrowser = (reason: WebFailure): reason is BrowserReason => BROWSER_HELPS.has(reason);

/**
 * A page whose content is drawn by JavaScript: no JSON-LD to read, and only a few words of text or a note asking for
 * JavaScript. ponytail: a heuristic; a genuinely short page also gets one browser read, within the daily allowance.
 */
export function looksUnrendered(html: string, text: string): boolean {
	if (/<script[^>]+application\/ld\+json/i.test(html)) return false;
	if (text.length < 300) return true;
	return text.length < 2_000 && /\b(?:enable|turn on|requires?|needs?) javascript\b/i.test(text);
}

async function readThroughBrowser(url: URL, context: WebContext, signal: AbortSignal, reason: BrowserReason) {
	if (!isBrowserRunConfigured()) return null;
	const counted = context.allowance !== "import";
	const reads = today("web-browser", context.userId);
	if (counted && (await reads.used()) >= BROWSER_READS_PER_DAY) {
		console.info("[web]", { operation: "read", method: "browser", outcome: "daily-limit" });
		return null;
	}
	const started = Date.now();
	let browserMs = 0;
	try {
		const page = await readBrowserPage(url, signal, context.allowance === "import" ? "loaded" : "settled");
		browserMs = page.browserMs;
		if (page.html.length > MAX_PAGE_BYTES) throw new WebError("too-large");
		const content = pageContent(htmlToText(page.html));
		if (counted) await reads.add(1);
		recordJobEvent({
			provider: "browser-run",
			tool: "content",
			outcome: "miss",
			kind: "browser",
			costMicro: 0,
			ms: browserMs || Date.now() - started,
			resultCount: 1,
		});
		return {
			...content,
			html: page.html,
			requestedUrl: url.toString(),
			retrievedAt: new Date().toISOString(),
			method: "browser",
			format: "text",
			fallbackReason: reason,
		} satisfies ReadPageResult;
	} catch (error) {
		signal.throwIfAborted();
		recordJobEvent({
			provider: "browser-run",
			tool: "content",
			outcome: "error",
			kind: "browser",
			costMicro: 0,
			ms: browserMs || Date.now() - started,
			resultCount: 0,
		});
		console.info("[web]", {
			operation: "read",
			method: "browser",
			outcome: error instanceof WebError ? error.reason : "unreachable",
		});
		return null;
	}
}

/**
 * Reads one public page. The direct reader goes first; when it finds nothing to read, a bot check, or a page drawn by
 * JavaScript, Cloudflare Browser Run reads it again (limited per person per day). The address is checked to be public
 * before anything is fetched. One deadline covers both; cancellation never falls back.
 */
export async function readPage(input: string, context: WebContext): Promise<ReadPageResult> {
	const signal = deadline(READ_DEADLINE_MS, context.signal);
	const started = Date.now();
	let reason: BrowserReason | undefined;
	try {
		if (context.allowance !== "import") await consume(context.userId, signal);
		const url = await assertPublicTarget(input, signal);
		const browser = isBrowserRunConfigured();
		// Leave the browser time to work when it can take over.
		const directSignal = browser ? AbortSignal.any([signal, AbortSignal.timeout(DIRECT_BUDGET_MS)]) : signal;
		let direct: ReadPageResult | undefined;
		try {
			const page = await readBuiltinPage(url.toString(), directSignal);
			const content = pageContent(htmlToText(page.html));
			direct = {
				...page,
				...content,
				requestedUrl: url.toString(),
				retrievedAt: new Date().toISOString(),
				method: "builtin",
				format: "text",
			};
			if (!looksUnrendered(page.html, content.content)) {
				log("read", "builtin", started, "success");
				return direct;
			}
			reason = "empty";
		} catch (error) {
			signal.throwIfAborted();
			const failure = safeFailure(error, directSignal);
			if (!helpsBrowser(failure.reason)) throw failure;
			reason = failure.reason;
		}
		const rendered = browser ? await readThroughBrowser(url, context, signal, reason) : null;
		if (rendered) {
			log("read", "browser", started, "success", reason);
			return rendered;
		}
		if (direct) {
			log("read", "builtin", started, "success", "unrendered");
			return direct;
		}
		throw new WebError(reason);
	} catch (error) {
		log(
			"read",
			"builtin",
			started,
			signal.aborted ? "aborted" : error instanceof WebError ? error.reason : "unreachable",
		);
		throw safeFailure(error, signal);
	}
}

/**
 * A site's sitemap (`/sitemap.xml`), read directly with the page reader's checks; null when there is none or it can't be
 * read. Only website imports ask for it, so it has no throttle of its own.
 */
export async function readSitemapXml(origin: string, signal?: AbortSignal): Promise<string | null> {
	const read = deadline(SITEMAP_DEADLINE_MS, signal);
	try {
		const url = await assertPublicTarget(new URL("/sitemap.xml", origin).toString(), read);
		const page = await readBuiltinPage(url.toString(), read, 0, XML_TYPES);
		return page.html;
	} catch {
		signal?.throwIfAborted();
		return null;
	}
}

// ---- Searching ---------------------------------------------------------------------------------------------------

/** Whether this server can search the web: treg is set up. Nothing is asked of the person. */
export const canSearchWeb = () => isTregConfigured();

function searchInput(query: string) {
	const input = query.trim();
	if (!input || input.length > MAX_SEARCH_QUERY_CHARS) throw new WebError("malformed");
	return input;
}

/** Deduplicates by URL and takes results round-robin in region order, so each region that returned anything shows. */
function interleave(lists: SearchResult[][]) {
	const seen = new Set<string>();
	const merged: SearchResult[] = [];
	const longest = Math.max(...lists.map((list) => list.length));
	for (let index = 0; index < longest; index++) {
		for (const list of lists) {
			const item = list[index];
			if (!item || seen.has(item.url)) continue;
			seen.add(item.url);
			merged.push(item);
		}
	}
	return merged.slice(0, MAX_SEARCH_RESULTS);
}

/** Runs one paid search call, adding what it cost to the server's budget and the person's spending. */
async function recorded(
	call: () => Promise<SearchCall>,
	spend: ReturnType<typeof today>,
	region: string | undefined,
): Promise<SearchCall> {
	try {
		const result = await call();
		await Promise.all([recordSpend(jobCounters, result.costMicro, new Date()), spend.add(result.costMicro)]);
		recordJobEvent({
			provider: result.provider,
			tool: result.tool,
			outcome: "miss",
			countryCode: region,
			kind: "web-search",
			costMicro: result.costMicro,
			ms: result.ms,
			resultCount: result.results.length,
		});
		return result;
	} catch (error) {
		recordJobEvent({
			provider: "treg",
			tool: "web.search",
			outcome: error instanceof WebError && error.reason === "budget" ? "budget" : "error",
			countryCode: region,
			kind: "web-search",
			costMicro: 0,
			ms: 0,
			resultCount: 0,
		});
		throw error;
	}
}

/**
 * One web search, paid by the server through treg and counted in the job search budget (K7). Serper searches each of
 * the person's search countries in parallel under one deadline; a failed country drops out. When every country failed,
 * treg's routed search runs once, anywhere. Throws `WebError`: `budget` once today's budget is spent, `rate-limit` past
 * the person's searches or spending for the day. A search that failed isn't counted.
 */
export async function searchWeb(query: string, context: WebContext): Promise<SearchResult[]> {
	const signal = deadline(SEARCH_DEADLINE_MS, context.signal);
	const started = Date.now();
	try {
		await consume(context.userId, signal);
		const input = searchInput(query);
		if (!canSearchWeb()) throw new WebError("unavailable");
		if (!(await budgetLeft(jobCounters, new Date()))) throw new WebError("budget");
		const searches = today("web-search", context.userId);
		const spend = today("web-spend", context.userId);
		const [used, spent] = await Promise.all([searches.used(), spend.used()]);
		if (used >= WEB_SEARCHES_PER_DAY || spent >= WEB_SEARCH_SPEND_PER_DAY_MICRO) throw new WebError("rate-limit");
		const regions = (context.regions ?? []).slice(0, MAX_SEARCH_REGIONS);
		const settled = await Promise.allSettled(
			(regions.length ? regions : [undefined]).map((region) =>
				recorded(() => searchSerper(input, { region, signal }), spend, region),
			),
		);
		const calls = settled.flatMap((outcome) => (outcome.status === "fulfilled" ? [outcome.value] : []));
		if (calls.length === 0) {
			signal.throwIfAborted();
			const first: unknown = (settled[0] as PromiseRejectedResult).reason;
			// A spent balance fails the routed search the same way; don't ask twice.
			if (first instanceof WebError && first.reason === "budget") throw first;
			calls.push(await recorded(() => searchRouted(input, { signal }), spend, undefined));
		}
		await searches.add(1);
		signal.throwIfAborted();
		const failed = settled.length - settled.filter((outcome) => outcome.status === "fulfilled").length;
		log(
			"search",
			calls[0]?.provider ?? "treg",
			started,
			"success",
			failed ? `${failed}/${settled.length}-regions-failed` : undefined,
		);
		return interleave(calls.map((call) => call.results));
	} catch (error) {
		log(
			"search",
			"treg",
			started,
			signal.aborted ? "aborted" : error instanceof WebError ? error.reason : "unreachable",
		);
		throw safeFailure(error, signal);
	}
}
