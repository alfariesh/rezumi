import { ORPCError } from "@orpc/client";

// What a failed save of the portfolio's data means for the editor (`./store.ts`); `./save-problem.ts` words it.

/** A place in the portfolio's data, as a schema issue names it: keys and list positions. */
export type PortfolioDataPath = readonly (string | number)[];

/**
 * Why the data isn't saved, and won't be until something changes:
 * - `field`: a value the server would refuse (`path` leads to it);
 * - `too-large`: the data is over `PORTFOLIO_LIMITS.dataBytes`;
 * - `file-missing`: a picture or file the data uses isn't one of the portfolio's uploads (anymore);
 * - `refused`: any other refusal (a plan limit from Phase 07), worded from its error;
 * - `gone`: the portfolio was deleted, or portfolios were switched off for the account. Nothing can be saved.
 */
export type PortfolioSaveProblem =
	| { kind: "field"; path: PortfolioDataPath }
	| { kind: "too-large"; bytes?: number | undefined; max?: number | undefined }
	| { kind: "file-missing"; key: string | null }
	| { kind: "refused"; error: unknown }
	| { kind: "gone"; code: "NOT_FOUND" | "PORTFOLIO_DISABLED" };

/** Why a save failed in a way that may pass by itself, so it's tried again. */
export type PortfolioRetryReason = "offline" | "busy" | "server" | "signed-out";

export type PortfolioSaveFailure =
	/** Saved somewhere else since: `updatedAt` is that version, when the server named it. */
	| { kind: "conflict"; updatedAt: Date | null }
	/**
	 * Try again later. `maybeSaved`: the answer was lost, so the server may hold the data after all. `notBefore`: the
	 * server asked to wait until then (a rate limit), in milliseconds like `Date.now()`.
	 */
	| { kind: "retry"; reason: PortfolioRetryReason; maybeSaved: boolean; notBefore?: number }
	| { kind: "problem"; problem: PortfolioSaveProblem };

type ErrorData = Record<string, unknown>;

const isRecord = (value: unknown): value is ErrorData => typeof value === "object" && value !== null;

const numberOf = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

function dateOf(value: unknown): Date | null {
	if (typeof value !== "string" && !(value instanceof Date)) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Where in the data the input validation of `portfolio.update` failed: oRPC sends the schema's issues with paths into
 * the input (`{ data, expectedUpdatedAt }`). Null when no issue names a place in the data.
 */
export function issueDataPath(data: unknown): PortfolioDataPath | null {
	if (!isRecord(data) || !Array.isArray(data.issues)) return null;
	for (const issue of data.issues) {
		if (!isRecord(issue) || !Array.isArray(issue.path)) continue;
		const path: unknown[] = issue.path.map((segment: unknown) => (isRecord(segment) ? segment.key : segment));
		const [root, ...rest] = path;
		if (root !== "data") continue;
		const keys = rest.filter((segment) => typeof segment === "string" || typeof segment === "number");
		if (keys.length === rest.length) return keys;
	}
	return null;
}

/** What a failed `portfolio.update` means for the editor. */
export function classifySaveError(error: unknown): PortfolioSaveFailure {
	// No answer at all: the connection dropped, possibly after the server saved.
	if (!(error instanceof ORPCError)) return { kind: "retry", reason: "offline", maybeSaved: true };
	const data: ErrorData = isRecord(error.data) ? error.data : {};
	switch (error.code) {
		case "PORTFOLIO_VERSION_CONFLICT":
			return { kind: "conflict", updatedAt: dateOf(data.updatedAt) };
		case "NOT_FOUND":
			return { kind: "problem", problem: { kind: "gone", code: "NOT_FOUND" } };
		case "PORTFOLIO_DISABLED":
			return { kind: "problem", problem: { kind: "gone", code: "PORTFOLIO_DISABLED" } };
		case "PORTFOLIO_TOO_LARGE":
			return { kind: "problem", problem: { kind: "too-large", bytes: numberOf(data.bytes), max: numberOf(data.max) } };
		case "PORTFOLIO_FILE_NOT_FOUND":
			return {
				kind: "problem",
				problem: { kind: "file-missing", key: typeof data.key === "string" ? data.key : null },
			};
		case "TOO_MANY_REQUESTS": {
			const reset = numberOf(data.reset);
			return { kind: "retry", reason: "busy", maybeSaved: false, ...(reset === undefined ? {} : { notBefore: reset }) };
		}
		case "UNAUTHORIZED":
			// Signing in again (in another tab) lets the next try through.
			return { kind: "retry", reason: "signed-out", maybeSaved: false };
		case "BAD_REQUEST": {
			const path = issueDataPath(data);
			return { kind: "problem", problem: path ? { kind: "field", path } : { kind: "refused", error } };
		}
	}
	if (error.status >= 500) return { kind: "retry", reason: "server", maybeSaved: true };
	if (error.status === 408) return { kind: "retry", reason: "server", maybeSaved: false };
	return { kind: "problem", problem: { kind: "refused", error } };
}

const RETRY_FIRST_MS = 2000;
const RETRY_LONGEST_MS = 60_000;

/** How long to wait before try `attempt` (1 for the first retry): doubling from 2 seconds, a minute at most. */
export function saveRetryDelay(attempt: number, notBefore: number | undefined, now: number): number {
	const backoff = Math.min(RETRY_FIRST_MS * 2 ** Math.max(0, attempt - 1), RETRY_LONGEST_MS);
	const asked = notBefore === undefined ? 0 : Math.min(notBefore - now, RETRY_LONGEST_MS);
	return Math.max(backoff, asked);
}
