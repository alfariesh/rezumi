import type { RouterOutput } from "@/libs/orpc/client";
import { t } from "@lingui/core/macro";

export type JobCostReport = RouterOutput["jobs"]["admin"]["costs"];
export type JobCostEvents = Extract<JobCostReport["events"], { status: "ok" }>;

/** Providers in the order the chart stacks them, with the colours of the billing dashboard's charts. */
export const PROVIDER_COLORS: Record<string, string> = {
	hirebase: "var(--chart-2)",
	jobspipe: "var(--chart-4)",
	serper: "var(--chart-1)",
	treg: "var(--chart-3)",
	"browser-run": "var(--chart-5)",
};

/** A provider's name as people know it. */
export function providerName(provider: string) {
	switch (provider) {
		case "hirebase":
			return "Hirebase";
		case "jobspipe":
			return "JobsPipe";
		case "serper":
			return t`Serper (web search)`;
		case "treg":
			return t`treg web search`;
		case "browser-run":
			return "Browser Run";
		default:
			return provider;
	}
}

/** What a group of calls was for. */
export function kindName(kind: string) {
	switch (kind) {
		case "search":
			return t`Search`;
		case "discovery":
			return t`Job alerts`;
		case "maintenance":
			return t`Nightly upkeep`;
		case "web-search":
			return t`Assistant web search`;
		case "browser":
			return t`Reading links`;
		default:
			return kind;
	}
}

/** treg's ledger tags calls with `feature=jobs-<kind>`, `web-search` and the like. */
export function featureName(feature: string) {
	switch (feature) {
		case "jobs-search":
			return t`Job search`;
		case "jobs-discovery":
			return t`Job alerts`;
		case "jobs-maintenance":
			return t`Nightly upkeep`;
		case "jobs-count":
			return t`Counting (free)`;
		case "web-search":
			return t`Assistant web search`;
		case "profile-linkedin":
			return t`LinkedIn profile reads`;
		default:
			return feature;
	}
}

/** "$0.0300" for small amounts, "$1.25" from a cent up; millionths of a US dollar in. */
export function formatUsd(micro: number) {
	return `$${(micro / 1_000_000).toFixed(micro !== 0 && Math.abs(micro) < 10_000 ? 4 : 2)}`;
}

/** Every day of the period with each provider's cost on it: days without calls still get a bar's place. */
export function dailyCostSeries(daily: JobCostEvents["daily"], days: number, now: Date) {
	const providers = [...new Set(daily.filter((point) => point.costMicro > 0).map((point) => point.provider))].sort(
		(a, b) => order(a) - order(b),
	);
	const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
	const rows = Array.from({ length: days }, (_, index) => {
		const day = new Date(today - (days - 1 - index) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		const row: Record<string, number | string> = { day };
		for (const provider of providers) row[provider] = 0;
		return row;
	});
	const byDay = new Map(rows.map((row) => [row.day as string, row]));
	for (const point of daily) {
		const row = byDay.get(point.date);
		if (row && providers.includes(point.provider))
			row[point.provider] = Number(row[point.provider] ?? 0) + point.costMicro / 1_000_000;
	}
	return { providers, rows };
}

const order = (provider: string) => {
	const index = Object.keys(PROVIDER_COLORS).indexOf(provider);
	return index === -1 ? 99 : index;
};

/** Share of search answers that came from Rezumi's cache, against provider calls; null before any search. */
export function cacheShare(search: Pick<JobCostEvents["search"], "cacheHits" | "stale" | "providerCalls">) {
	const fromCache = search.cacheHits + search.stale;
	const total = fromCache + search.providerCalls;
	return total ? fromCache / total : null;
}

/**
 * What one page of results cost on average, and the share of the listings paid for that people were shown (the rest
 * failed a filter on Rezumi's side or repeated a job); null before any page was asked of the providers.
 */
export function pageCost(
	search: Pick<JobCostEvents["search"], "pages" | "pageCostMicro" | "paidListings" | "shownListings">,
) {
	if (!search.pages) return null;
	return {
		averageMicro: Math.round(search.pageCostMicro / search.pages),
		shownShare: search.paidListings ? Math.min(1, search.shownListings / search.paidListings) : null,
	};
}
