import type { SearchResult } from "./contracts";
import { assertPublicPageUrl } from "./builtin";
import { MAX_CONTENT_CHARS, MAX_SEARCH_RESULTS, WebError } from "./contracts";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Search rows as the search providers send them: `url` or `link` for the address, `title` or `name`, and a snippet as
 * `snippet`, `description`, `content` or `text`. Rows without a public https address or a title are left out.
 */
export function normalizeSearch(rows: unknown): SearchResult[] {
	if (!Array.isArray(rows)) return [];
	const seen = new Set<string>();
	const results: SearchResult[] = [];
	for (const row of rows) {
		if (!row || typeof row !== "object") continue;
		const item = row as Record<string, unknown>;
		const title = text(item.title) || text(item.name);
		const snippet = text(item.snippet) || text(item.description) || text(item.content) || text(item.text);
		let url: string;
		try {
			url = assertPublicPageUrl(text(item.url) || text(item.link)).toString();
		} catch {
			continue;
		}
		if (!title || seen.has(url)) continue;
		seen.add(url);
		results.push({ url, title: title.slice(0, 1_000), ...(snippet ? { snippet: snippet.slice(0, 5_000) } : {}) });
		if (results.length === MAX_SEARCH_RESULTS) break;
	}
	return results;
}

export function pageContent(content: string) {
	const trimmed = content.trim();
	if (!trimmed) throw new WebError("empty");
	const opening = trimmed.split("\n", 1)[0]?.replace(/^#{1,6}\s*/, "") ?? "";
	if (
		trimmed.length < 3_000 &&
		/^(?:just a moment(?:[.!…]|$)|checking your browser\b|verify (?:that )?you(?:'re| are) human\b|access denied(?:[.!:]|$)|enable javascript and cookies\b|captcha challenge(?:[.!:]|$))/i.test(
			opening,
		)
	) {
		throw new WebError("challenge");
	}
	const truncated = trimmed.length > MAX_CONTENT_CHARS;
	return {
		content: trimmed.slice(0, MAX_CONTENT_CHARS),
		truncated,
		completeness:
			truncated || /\[(?:content )?(?:truncated|\.\.\.)\]\s*$/i.test(trimmed)
				? ("incomplete" as const)
				: ("unknown" as const),
	};
}

export function safeFailure(error: unknown, signal: AbortSignal) {
	if (signal.aborted) {
		if ((signal.reason as { name?: string } | undefined)?.name === "TimeoutError") return new WebError("timeout");
		throw signal.reason;
	}
	return error instanceof WebError ? error : new WebError("unreachable");
}
