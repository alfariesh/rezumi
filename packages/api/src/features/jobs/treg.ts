import { env } from "@rezumi/env/server";

/**
 * The one place job search talks to treg (https://treg.to), which serves Hirebase and JobsPipe with Rezumi's single
 * token (`.agents/docs/plans/lowongan/02-teknis.md` section 4). Server only. Every call carries a cost ceiling, retries
 * treg's "busy" refusals briefly, and reports what it was charged from `X-Treg-Cost-Micro`. Logs never hold the token,
 * the request body or the provider's answer.
 */

export const TREG_BASE_URL = "https://treg.to";

/** treg, or the stand-in the browser tests run (`TREG_BASE_URL`). */
const tregBase = () => env.TREG_BASE_URL ?? TREG_BASE_URL;

const CALL_TIMEOUT_MS = 15_000;
/** Retries of a busy refusal stop once the call has taken this long in all. */
const RETRY_BUDGET_MS = 10_000;
const MAX_RETRIES = 2;

/**
 * `not-configured`: no token. `budget`: a treg spend limit or balance ran out; try again tomorrow. `busy`: treg or the
 * provider stayed busy. `rejected`: the request itself was refused (a bad parameter, the cost ceiling). `timeout`: no
 * answer in time. `unavailable`: anything else.
 */
export type TregErrorCode = "not-configured" | "budget" | "busy" | "rejected" | "timeout" | "unavailable";

export class TregError extends Error {
	readonly code: TregErrorCode;
	readonly status: number | undefined;
	/** treg's own error code from the body, such as `share_busy`; never the provider's text. */
	readonly reason: string | undefined;

	constructor(code: TregErrorCode, options: { status?: number | undefined; reason?: string | undefined } = {}) {
		super(`treg call failed: ${code}${options.reason ? ` (${options.reason})` : ""}`);
		this.name = "TregError";
		this.code = code;
		this.status = options.status;
		this.reason = options.reason;
	}
}

export type TregCall = {
	/** A catalog tool id, such as `hirebase.jobs.search`. */
	tool: string;
	method?: "GET" | "POST";
	body?: unknown;
	query?: Record<string, string | number>;
	/** The most this call may cost, in US dollars (`X-Treg-Route-Max-Cost`). */
	maxCostUsd: number;
	/** Skips treg's shared answer archive, for checks that need fresh data. */
	fresh?: boolean;
	/** What the call is for, kept in treg's ledger as `feature=<value>`; never a person's id. */
	feature?: string;
	/** How long one attempt may take; 15 seconds unless the tool is slower, such as reading a LinkedIn profile. */
	timeoutMs?: number;
	signal?: AbortSignal | undefined;
};

export type TregResult<T> = {
	data: T;
	/** What treg charged, in millionths of a US dollar. */
	costMicro: number;
	callId: string | undefined;
	/** Answered from treg's archive at a tenth of the price. */
	archived: boolean;
	ms: number;
};

export type TregDependencies = {
	fetch?: typeof fetch;
	token?: string | undefined;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
};

const SPEND_LIMITS = new Set([
	"member_spend_cap_reached",
	"tag_spend_cap_reached",
	"insufficient_balance",
	"funds_required",
	"trial_allowance_reached",
]);
const RETRYABLE_429 = new Set(["share_busy", "provider_rate_limited"]);
const TEAM_LIMITS = new Set(["org_rate_limit", "org_concurrency_limit"]);

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const isTregConfigured = (token: string | undefined = env.TREG_API_KEY) => Boolean(token);

type Refusal = { error?: unknown; retry_after_s?: unknown };

async function readRefusal(
	response: Response,
): Promise<{ reason: string | undefined; retryAfterMs: number | undefined }> {
	let body: Refusal | undefined;
	try {
		body = (await response.json()) as Refusal;
	} catch {
		body = undefined;
	}
	const reason = typeof body?.error === "string" && /^[a-z_]{1,64}$/.test(body.error) ? body.error : undefined;
	const header = response.headers.get("retry-after");
	const seconds = typeof body?.retry_after_s === "number" ? body.retry_after_s : header ? Number(header) : Number.NaN;
	return { reason, retryAfterMs: Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined };
}

function classify(status: number, reason: string | undefined): { code: TregErrorCode; retry: boolean } {
	if (reason && SPEND_LIMITS.has(reason)) return { code: "budget", retry: false };
	if (status === 503) return { code: "busy", retry: true };
	if (status === 429) {
		if (reason && RETRYABLE_429.has(reason)) return { code: "busy", retry: true };
		if (reason && TEAM_LIMITS.has(reason)) return { code: "busy", retry: false };
		return { code: "busy", retry: false };
	}
	if (status >= 500) return { code: "unavailable", retry: false };
	return { code: "rejected", retry: false };
}

function callUrl(call: TregCall): string {
	const url = new URL(`/call/${encodeURIComponent(call.tool)}`, tregBase());
	for (const [key, value] of Object.entries(call.query ?? {})) url.searchParams.set(key, String(value));
	return url.href;
}

const log = (tool: string, status: number | string, costMicro: number, ms: number) =>
	console.info(`[jobs] ${JSON.stringify({ tool, status, costMicro, ms })}`);

/** Calls a treg catalog tool and returns the provider's answer as it came. Throws `TregError`. */
export async function callTreg<T>(call: TregCall, dependencies: TregDependencies = {}): Promise<TregResult<T>> {
	const token = "token" in dependencies ? dependencies.token : env.TREG_API_KEY;
	if (!token) throw new TregError("not-configured");
	const request = dependencies.fetch ?? fetch;
	const sleep = dependencies.sleep ?? wait;
	const now = dependencies.now ?? Date.now;
	const method = call.method ?? (call.body === undefined ? "GET" : "POST");
	const headers: Record<string, string> = {
		"X-Treg-Token": token,
		"X-Treg-Route-Max-Cost": call.maxCostUsd.toFixed(4),
		Accept: "application/json",
	};
	if (call.body !== undefined) headers["Content-Type"] = "application/json";
	if (call.fresh) headers["Cache-Control"] = "no-cache";
	if (call.feature && /^[\w.:-]{1,64}$/.test(call.feature)) headers["X-Treg-Meta"] = `feature=${call.feature}`;
	const url = callUrl(call);
	const started = now();

	for (let attempt = 0; ; attempt++) {
		const timeout = AbortSignal.timeout(call.timeoutMs ?? CALL_TIMEOUT_MS);
		const signal = call.signal ? AbortSignal.any([call.signal, timeout]) : timeout;
		let response: Response;
		try {
			response = await request(url, {
				method,
				headers,
				signal,
				...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
			});
		} catch (error) {
			if (call.signal?.aborted) throw error;
			const timedOut = timeout.aborted;
			log(call.tool, timedOut ? "timeout" : "network", 0, now() - started);
			throw new TregError(timedOut ? "timeout" : "unavailable");
		}

		if (response.ok) {
			const costMicro = Number.parseInt(response.headers.get("x-treg-cost-micro") ?? "", 10);
			const cost = Number.isFinite(costMicro) && costMicro > 0 ? costMicro : 0;
			let data: T;
			try {
				data = (await response.json()) as T;
			} catch {
				log(call.tool, "invalid-json", cost, now() - started);
				throw new TregError("unavailable", { status: response.status });
			}
			const ms = now() - started;
			log(call.tool, response.status, cost, ms);
			return {
				data,
				costMicro: cost,
				callId: response.headers.get("x-treg-call-id") ?? undefined,
				archived: response.headers.get("x-treg-cache") === "hit",
				ms,
			};
		}

		const { reason, retryAfterMs } = await readRefusal(response);
		const { code, retry } = classify(response.status, reason);
		const delay = Math.min(retryAfterMs ?? 500 * 2 ** attempt, RETRY_BUDGET_MS);
		const elapsed = now() - started;
		if (retry && attempt < MAX_RETRIES && elapsed + delay < RETRY_BUDGET_MS && !call.signal?.aborted) {
			log(call.tool, `${response.status} retry`, 0, elapsed);
			await sleep(delay);
			continue;
		}
		log(call.tool, reason ? `${response.status} ${reason}` : response.status, 0, elapsed);
		throw new TregError(code, { status: response.status, reason });
	}
}
