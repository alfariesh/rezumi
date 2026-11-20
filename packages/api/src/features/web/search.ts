import type { SearchResult } from "./contracts";
import { callTreg, TregError } from "../jobs/treg";
import { WebError } from "./contracts";
import { normalizeSearch } from "./transport";

/**
 * Web search through treg on Rezumi's account (`02-teknis.md` section 11). Serper (Google results, $0.001 a call,
 * a country parameter) answers first; when it fails, treg's routed `treg.web.search` tries its other search providers,
 * cheapest first, within a small cost ceiling. Provider names and prices come from treg's catalog
 * (`GET https://treg.to/catalog/endpoints/<tool>`); check it before changing them.
 */

const PRIMARY = { tool: "serper.web.search", provider: "serper", maxCostUsd: 0.002 } as const;
const ROUTED = { tool: "treg.web.search", provider: "treg", maxCostUsd: 0.01 } as const;

export type SearchCall = {
	results: SearchResult[];
	provider: string;
	tool: string;
	costMicro: number;
	ms: number;
};

type SerperAnswer = { organic?: unknown };
type RoutedAnswer = { output?: { results?: unknown } };

function failure(error: unknown): WebError {
	if (!(error instanceof TregError)) return new WebError("unavailable");
	if (error.code === "budget") return new WebError("budget");
	if (error.code === "timeout") return new WebError("timeout");
	return new WebError("unavailable");
}

/** One search in one country (`region`, ISO alpha-2), or anywhere. Throws `WebError`. */
export async function searchThroughTreg(
	query: string,
	options: { region?: string | undefined; signal: AbortSignal },
): Promise<SearchCall> {
	try {
		const { data, costMicro, ms } = await callTreg<SerperAnswer>({
			tool: PRIMARY.tool,
			body: { q: query, ...(options.region ? { gl: options.region.toLowerCase() } : {}) },
			maxCostUsd: PRIMARY.maxCostUsd,
			feature: "web-search",
			signal: options.signal,
		});
		return { results: normalizeSearch(data.organic), provider: PRIMARY.provider, tool: PRIMARY.tool, costMicro, ms };
	} catch (error) {
		options.signal.throwIfAborted();
		// A spent balance or a missing token fails the routed search the same way; don't ask twice.
		if (!(error instanceof TregError) || error.code === "budget" || error.code === "not-configured")
			throw failure(error);
	}
	try {
		const { data, costMicro, ms } = await callTreg<RoutedAnswer>({
			tool: ROUTED.tool,
			body: { q: query, limit: 5 },
			maxCostUsd: ROUTED.maxCostUsd,
			feature: "web-search",
			signal: options.signal,
		});
		return {
			results: normalizeSearch(data.output?.results),
			provider: ROUTED.provider,
			tool: ROUTED.tool,
			costMicro,
			ms,
		};
	} catch (error) {
		options.signal.throwIfAborted();
		throw failure(error);
	}
}
