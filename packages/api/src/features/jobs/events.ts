/**
 * Job search events in Workers Analytics Engine, dataset `job_search_events` (binding `JOB_EVENTS`;
 * `.agents/docs/plans/lowongan/02-teknis.md` section 12): cost, latency and result counts per provider, for the admin
 * cost dashboard. Written only on Workers; in Node the adapter is missing and this does nothing. A data point never
 * holds a user id or the search text.
 */

export type JobEventOutcome = "hit" | "miss" | "stale" | "error" | "budget";
export type JobEventKind = "search" | "discovery" | "maintenance" | "web-search" | "browser";

export type JobEvent = {
	provider: string;
	tool: string;
	outcome: JobEventOutcome;
	/** ISO alpha-2 of the searched country; empty for anywhere. */
	countryCode?: string | undefined;
	kind: JobEventKind;
	costMicro: number;
	ms: number;
	resultCount: number;
	/**
	 * Listings paid for, on a `page` event (one page of a search, both providers together): against `resultCount`, the
	 * listings shown, it says how much was bought only to be left out.
	 */
	paidCount?: number;
};

/** Blob and double positions, also used by the dashboard queries: `blob1` is `provider`, `double1` is `costMicro`. */
export type JobDataPoint = {
	indexes: [string];
	blobs: [provider: string, tool: string, outcome: string, countryCode: string, kind: string];
	doubles: [costMicro: number, ms: number, resultCount: number, paidCount: number];
};

export function jobDataPoint(event: JobEvent): JobDataPoint {
	const country = event.countryCode && /^[A-Z]{2}$/.test(event.countryCode) ? event.countryCode : "";
	return {
		indexes: [event.provider],
		blobs: [event.provider, event.tool, event.outcome, country, event.kind],
		doubles: [
			Math.max(0, event.costMicro),
			Math.max(0, Math.round(event.ms)),
			Math.max(0, event.resultCount),
			Math.max(0, event.paidCount ?? 0),
		],
	};
}

type JobEventDataset = { writeDataPoint: (point: JobDataPoint) => void };
type SqlRequest = { query: string; params: Record<string, string> };
/** The Analytics SQL binding (`ANALYTICS_SQL`), as the cost dashboard reads it. */
export type JobEventSql = { query: (request: SqlRequest) => Promise<{ data: Record<string, unknown>[] }> };
type JobEventAdapter = { dataset: () => JobEventDataset | undefined; sql?: () => JobEventSql | undefined };

let adapter: JobEventAdapter | undefined;

/** Set once by the Workers entry point, reading the bindings of the running request. */
export function configureJobEvents(value: JobEventAdapter | undefined): void {
	adapter = value;
}

/** The binding that reads the events back; missing outside Workers. */
export const jobEventSql = (): JobEventSql | undefined => adapter?.sql?.();

/** Writes an event without waiting. Never throws: counting must not break a search. */
export function recordJobEvent(event: JobEvent): void {
	const dataset = adapter?.dataset();
	if (!dataset) return;
	try {
		dataset.writeDataPoint(jobDataPoint(event));
	} catch {
		console.error("[jobs] Writing an analytics event failed.");
	}
}
