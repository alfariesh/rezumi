import type { RunnableAiProvider } from "../ai-providers/service";
import type { AiSourceRequest } from "./ai-source";
import type { CreditUsageResult } from "./credits";
import type { CreditAction } from "@rezumi/schema/billing";
import type { LanguageModelMiddleware } from "ai";
import { ORPCError } from "@orpc/server";
import { wrapLanguageModel } from "ai";
import { db } from "@rezumi/db/client";
import { env } from "@rezumi/env/server";
import { generateId } from "@rezumi/utils/string";
import { aiProvidersService } from "../ai-providers/service";
import { getModel } from "../ai/service";
import { commitCredits, ensureTrialCredits, releaseCredits, reserveCredits } from "./credits";

/**
 * Runs AI work on the source the user chose. Rezumi AI (the server's AI) takes the work's credits before it runs,
 * keeps them when it gives a usable result and gives them back when it doesn't; the user's own connection runs
 * without credits. Nothing here ever moves work from one source to the other.
 */

type ProviderModel = ReturnType<typeof getModel>;

/** What one piece of Rezumi AI work may use; past it, the work fails and the credits come back. */
export type AiWorkLimits = {
	/** Output tokens per model call. */
	maxOutputTokens: number;
	/** Characters (bytes, for files) sent to the model per call. */
	maxInputChars: number;
	/** Model calls in one agent run. */
	maxSteps: number;
};

/**
 * Limits per kind of work, far above what a normal request needs and well below what keeps a request's cost
 * open-ended. Output tokens include the model's reasoning, which can take most of them: the 2026-11-03 benchmark
 * (.agents/docs/research/benchmark-rezumi-ai-2026-11-03.md) found launch limits a quarter to half this size cutting off
 * letters, reviews and Coach replies, some before any text. Each limit is about twice the largest answer measured.
 */
export const AI_WORK_LIMITS: Record<CreditAction, AiWorkLimits> = {
	"short-text": { maxOutputTokens: 4_096, maxInputChars: 60_000, maxSteps: 1 },
	"draft-answer": { maxOutputTokens: 4_096, maxInputChars: 120_000, maxSteps: 1 },
	"cover-letter": { maxOutputTokens: 8_192, maxInputChars: 120_000, maxSteps: 1 },
	"interview-practice": { maxOutputTokens: 8_192, maxInputChars: 120_000, maxSteps: 1 },
	"coach-turn": { maxOutputTokens: 8_192, maxInputChars: 240_000, maxSteps: 8 },
	review: { maxOutputTokens: 16_384, maxInputChars: 150_000, maxSteps: 1 },
	"tailor-resume": { maxOutputTokens: 4_096, maxInputChars: 150_000, maxSteps: 1 },
	"import-document": { maxOutputTokens: 32_768, maxInputChars: 6_000_000, maxSteps: 1 },
	"portfolio-draft": { maxOutputTokens: 16_384, maxInputChars: 120_000, maxSteps: 1 },
	// A translated Text block, at its 10,000 characters, is the longest answer.
	"portfolio-rewrite": { maxOutputTokens: 16_384, maxInputChars: 120_000, maxSteps: 1 },
	"portfolio-metrics": { maxOutputTokens: 8_192, maxInputChars: 120_000, maxSteps: 1 },
};

export type AiRunRequest = AiSourceRequest & {
	userId: string;
	/**
	 * The kind of work, for its credit cost and limits. Null for work Rezumi AI doesn't run at launch (voice, scheduled
	 * work): only the user's own connection does.
	 */
	action: CreditAction | null;
	/** One of the user's own connections, by ID; otherwise their default. */
	providerId?: string | null | undefined;
	/**
	 * For work that does fine without AI (reading a posting): a request that names no source and has only Rezumi AI to
	 * run on gets no AI instead of an error.
	 */
	optional?: boolean;
};

export type AiRun = {
	provider: RunnableAiProvider;
	/** Whether this run spends Rezumi AI credits. */
	metered: boolean;
	/** Credits it takes when it succeeds; 0 on the user's own connection. */
	credits: number;
	/** Null on the user's own connection, which has only its own limits. */
	limits: AiWorkLimits | null;
	/** The provider's model, counted and limited when metered. */
	model: ProviderModel;
	/** Counts and limits another model of the same provider (the agent's), when metered. */
	wrap: (model: ProviderModel) => ProviderModel;
	/** Keeps the credits: call once the work gave a usable result (saved, or sent in full). */
	succeed: () => Promise<void>;
	/** Gives the credits back: call when the work failed or was cancelled before a usable result. */
	fail: (code: string) => Promise<void>;
};

/** Apps from before Rezumi AI never spend credits: they get this instead of running on it. */
export function aiSourceRequired() {
	return new ORPCError("AI_SOURCE_REQUIRED", {
		status: 409,
		message: "Update Rezumi to use Rezumi AI, or add your own AI connection in Settings.",
	});
}

export function rezumiAiUnavailable() {
	return new ORPCError("REZUMI_AI_UNAVAILABLE", {
		status: 409,
		message: "Rezumi AI can't do this. Use your own AI connection.",
	});
}

function inputTooLarge() {
	return new ORPCError("AI_INPUT_TOO_LARGE", {
		status: 413,
		message: "This is too long for Rezumi AI. Shorten it, or use your own AI connection.",
	});
}

/** The answer ran into the work's output limit: cut off, so it isn't kept and costs no credits. */
function outputLimitReached() {
	return new ORPCError("AI_OUTPUT_LIMIT", {
		status: 502,
		message: "Rezumi AI stopped before finishing its answer. Try again; no credits were used.",
	});
}

/** Rough size of what a model call sends: text in characters, files in bytes. */
export function promptSize(value: unknown): number {
	if (typeof value === "string") return value.length;
	if (value instanceof Uint8Array) return value.byteLength;
	if (value instanceof URL) return value.href.length;
	if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + promptSize(item), 0);
	if (value && typeof value === "object")
		return Object.values(value).reduce<number>((sum, item) => sum + promptSize(item), 0);
	return 0;
}

/** Token counts from usage in any provider spec version: a number, or an object with a total. */
function tokenCount(value: unknown, parts: string[] = []): number {
	if (typeof value === "number") return value;
	if (!value || typeof value !== "object") return 0;
	const record = value as Record<string, unknown>;
	if (typeof record.total === "number") return record.total;
	return parts.reduce((sum, part) => sum + (typeof record[part] === "number" ? (record[part] as number) : 0), 0);
}

type TokenTally = { inputTokens: number; outputTokens: number };

/**
 * Counts every call's tokens into `tally` and holds each call to `limits`. A call that stops at its output limit fails
 * the work (an error part, in a stream): what it left is a letter cut off mid-sentence, JSON that doesn't parse, or only
 * reasoning, and the user shouldn't pay for it.
 */
function meterMiddleware(tally: TokenTally, limits: AiWorkLimits): LanguageModelMiddleware {
	const count = (usage: { inputTokens?: unknown; outputTokens?: unknown } | undefined) => {
		tally.inputTokens += tokenCount(usage?.inputTokens, ["noCache", "cacheRead", "cacheWrite"]);
		// Output includes reasoning; providers that report no total get text plus reasoning.
		tally.outputTokens += tokenCount(usage?.outputTokens, ["text", "reasoning"]);
	};
	return {
		specificationVersion: "v4",
		transformParams: ({ params }) =>
			promptSize(params.prompt) > limits.maxInputChars
				? Promise.reject(inputTooLarge())
				: Promise.resolve({
						...params,
						maxOutputTokens: Math.min(params.maxOutputTokens ?? limits.maxOutputTokens, limits.maxOutputTokens),
					}),
		wrapGenerate: async ({ doGenerate }) => {
			const result = await doGenerate();
			count(result.usage);
			if (result.finishReason.unified === "length") throw outputLimitReached();
			return result;
		},
		wrapStream: async ({ doStream }) => {
			const { stream, ...rest } = await doStream();
			return {
				...rest,
				stream: stream.pipeThrough(
					new TransformStream({
						transform(part, controller) {
							if (part.type === "finish") {
								count(part.usage);
								if (part.finishReason.unified === "length")
									controller.enqueue({ type: "error", error: outputLimitReached() });
							}
							controller.enqueue(part);
						},
					}),
				),
			};
		},
	};
}

/** Micro-dollars from the configured per-million-token prices; null without both prices. */
export function costUsdMicros(tally: TokenTally): number | null {
	const input = env.AI_COST_INPUT_USD_PER_MTOK;
	const output = env.AI_COST_OUTPUT_USD_PER_MTOK;
	if (input === undefined || output === undefined) return null;
	// A price per million tokens is micro-dollars per token.
	return Math.round(tally.inputTokens * input + tally.outputTokens * output);
}

const MAX_RETRIED_KEYS = 3;

/**
 * Takes the credits for one action. A repeated key whose work is still running or already done takes nothing and
 * runs nothing; one whose work failed (credits back) is a retry and reserves again under a key derived from it.
 */
async function reserve(userId: string, action: CreditAction, idempotencyKey: string) {
	let key = idempotencyKey;
	for (let attempt = 0; attempt < MAX_RETRIED_KEYS; attempt++) {
		const reservation = await reserveCredits({ userId, actionKey: action, idempotencyKey: key });
		if (reservation.created) return reservation;
		if (reservation.status === "reserved")
			throw new ORPCError("CONFLICT", { message: "This is already running. Wait for it to finish." });
		if (reservation.status === "committed")
			throw new ORPCError("CONFLICT", { message: "This already finished. Start it again to run it again." });
		key = `${key}~${reservation.usageId}`;
	}
	throw new ORPCError("CONFLICT", { message: "This was retried too many times. Start it again." });
}

function ownRun(provider: RunnableAiProvider): AiRun {
	// Made on first use: the agent runs its own model and never reads this one.
	let model: ProviderModel | undefined;
	return {
		provider,
		metered: false,
		credits: 0,
		limits: null,
		get model() {
			model ??= getModel({
				provider: provider.provider,
				model: provider.model,
				apiKey: provider.apiKey,
				...(provider.baseURL ? { baseURL: provider.baseURL } : {}),
				serverAi: provider.managed,
			});
			return model;
		},
		wrap: (wrapped) => wrapped,
		succeed: async () => {},
		fail: async () => {},
	};
}

async function rezumiRun(
	provider: RunnableAiProvider,
	userId: string,
	action: CreditAction,
	idempotencyKey: string | undefined,
): Promise<AiRun> {
	// Built first: a provider setup that can't work fails here, before any credits are taken.
	const base = ownRun(provider).model;
	await db.transaction((tx) => ensureTrialCredits(tx, userId));
	const reservation = await reserve(userId, action, idempotencyKey ?? generateId());
	const limits = AI_WORK_LIMITS[action];
	const tally: TokenTally = { inputTokens: 0, outputTokens: 0 };
	const wrap = (model: ProviderModel) => wrapLanguageModel({ model, middleware: meterMiddleware(tally, limits) });
	let settled = false;
	const spent = (): CreditUsageResult => ({
		provider: provider.provider,
		model: provider.model,
		...tally,
		costUsdMicros: costUsdMicros(tally),
	});
	return {
		provider,
		metered: true,
		credits: reservation.credits,
		limits,
		model: wrap(base),
		wrap,
		succeed: async () => {
			if (settled) return;
			settled = true;
			// A failed commit leaves the reservation to the billing job, which gives the credits back: the user keeps the
			// result either way.
			await commitCredits(reservation.usageId, spent()).catch(() =>
				console.error("[billing] Committing Rezumi AI credits failed; the reservation is released later."),
			);
		},
		fail: async (code) => {
			if (settled) return;
			settled = true;
			// The provider is paid for failed work too: its tokens are kept, for the cost reports.
			await releaseCredits(reservation.usageId, code.slice(0, 100), new Date(), spent()).catch(() =>
				console.error("[billing] Releasing Rezumi AI credits failed; the reservation is released later."),
			);
		},
	};
}

/**
 * Which AI runs a request, without taking credits yet. Null when the request has no AI to run on: the caller says how
 * to set one up.
 *
 * - While the account doesn't choose (billing doesn't apply, or the server has no AI), the connection is picked as
 *   before plans existed and nothing is metered, whatever the request says.
 * - `rezumi` runs on Rezumi AI, metered. `own` runs on the user's own connection only.
 * - No source (an older app or API client) runs on the user's own connection; when Rezumi AI is all there is, it's
 *   refused rather than spending credits nobody saw.
 */
export async function resolveAiSource(
	request: Omit<AiRunRequest, "idempotencyKey">,
): Promise<{ provider: RunnableAiProvider; rezumi: boolean } | null> {
	const { userId } = request;
	if (!(await aiProvidersService.offersChoice(userId))) {
		const provider = request.providerId
			? await aiProvidersService.getRunnableById({ id: request.providerId, userId })
			: await aiProvidersService.getDefaultRunnable({ userId });
		return provider ? { provider, rezumi: false } : null;
	}
	if (request.aiSource === "rezumi") {
		if (!request.action) throw rezumiAiUnavailable();
		const provider = await aiProvidersService.getManagedRunnable({ userId });
		if (!provider) throw rezumiAiUnavailable();
		return { provider, rezumi: true };
	}
	if (request.providerId && aiProvidersService.isManagedId({ userId, id: request.providerId })) {
		if (request.aiSource === "own")
			throw new ORPCError("BAD_REQUEST", { message: "Choose one of your own AI connections." });
		if (request.optional) return null;
		throw aiSourceRequired();
	}
	const own = await aiProvidersService.getOwnRunnable({ userId, id: request.providerId });
	if (own) return { provider: own, rezumi: false };
	if (request.aiSource === undefined && !request.optional) throw aiSourceRequired();
	return null;
}

/** Starts a run on a resolved source: for Rezumi AI, takes the work's credits first. */
export async function startResolvedAiRun(
	resolved: { provider: RunnableAiProvider; rezumi: boolean },
	request: Pick<AiRunRequest, "userId" | "action" | "idempotencyKey">,
): Promise<AiRun> {
	if (!resolved.rezumi) return ownRun(resolved.provider);
	if (!request.action) throw rezumiAiUnavailable();
	return await rezumiRun(resolved.provider, request.userId, request.action, request.idempotencyKey);
}

/** Resolves which AI runs a request (see `resolveAiSource`) and, for Rezumi AI, takes its credits. */
export async function startAiRun(request: AiRunRequest): Promise<AiRun | null> {
	const resolved = await resolveAiSource(request);
	return resolved ? startResolvedAiRun(resolved, request) : null;
}

/**
 * Runs `work` on the request's AI source: credits kept when it returns, given back when it throws. `missing` is the
 * error for a request with no AI to run on.
 */
export async function runWithAiSource<T>(
	request: AiRunRequest & { missing: () => Error },
	work: (ai: AiRun) => Promise<T>,
): Promise<T> {
	const ai = await startAiRun(request);
	if (!ai) throw request.missing();
	try {
		const result = await work(ai);
		await ai.succeed();
		return result;
	} catch (error) {
		await ai.fail(errorCode(error));
		throw error;
	}
}

/** A short code for why a run failed, kept on the released reservation. */
export function errorCode(error: unknown): string {
	if (error instanceof ORPCError) return error.code;
	if (error instanceof Error) return error.name === "AbortError" ? "aborted" : error.name || "error";
	return "error";
}
