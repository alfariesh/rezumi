import { getRedis, redisKey } from "@rezumi/db/redis";

const controllers = new Map<string, AbortController>();
const CANCELLATION_TTL_MS = 15 * 60_000;
const HEARTBEAT_TTL_MS = 10_000;
/**
 * How long an aborted run keeps its heartbeat while it saves the transcript. A run still holding its claim past this
 * is stuck (a hung write, or a Worker cut off by the runtime), and the next request may take the conversation over.
 */
export const ABORTED_RUN_HEARTBEAT_GRACE_MS = 30_000;

export async function requestRunCancellation(runId: string, reason: string): Promise<void> {
	const shared = getCoordination();
	try {
		if (shared) await shared.set(redisKey("agent-cancellation", runId), reason, CANCELLATION_TTL_MS);
		await getRedis()?.set(redisKey("agent-cancellation", runId), reason, "PX", CANCELLATION_TTL_MS);
	} finally {
		// On Workers the run belongs to another request's I/O context: aborting it from here would touch that request's
		// streams and sockets, which the runtime forbids. The owner sees the shared flag on its next poll instead.
		if (!shared) controllers.get(runId)?.abort(new DOMException(reason, "AbortError"));
	}
}

/** True once someone asked the run to stop (the user, a deletion or an archive). */
export async function isRunCancellationRequested(runId: string): Promise<boolean> {
	const shared = getCoordination();
	if (shared) return (await shared.get(redisKey("agent-cancellation", runId))) !== null;
	const redis = getRedis();
	if (redis) return (await redis.get(redisKey("agent-cancellation", runId))) !== null;
	return controllers.get(runId)?.signal.aborted ?? false;
}

/** Polls for remote stops and keeps a liveness heartbeat until the owner calls the returned cleanup. */
export async function monitorRunCancellation(runId: string, controller: AbortController): Promise<() => void> {
	controllers.set(runId, controller);
	const redis = getRedis();
	const shared = getCoordination();
	let stopped = false;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let abortedAt: number | undefined;
	const cleanup = () => {
		stopped = true;
		clearTimeout(timeout);
		if (controllers.get(runId) === controller) controllers.delete(runId);
	};

	const check = async () => {
		if (stopped || (!redis && !shared)) return;
		if (controller.signal.aborted) abortedAt ??= Date.now();
		// Keep beating after an abort, since the owner still holds the claim while it saves the transcript, but not
		// forever: an owner that never finishes must not keep the conversation busy.
		if (abortedAt !== undefined && Date.now() - abortedAt > ABORTED_RUN_HEARTBEAT_GRACE_MS) return;
		try {
			if (shared) await shared.set(redisKey("agent-run-alive", runId), "1", HEARTBEAT_TTL_MS);
			else await redis?.set(redisKey("agent-run-alive", runId), "1", "PX", HEARTBEAT_TTL_MS);
			const reason = controller.signal.aborted
				? null
				: shared
					? await shared.get(redisKey("agent-cancellation", runId))
					: await redis?.get(redisKey("agent-cancellation", runId));
			if (!stopped && reason) controller.abort(new DOMException(reason, "AbortError"));
		} catch {
			if (!stopped) controller.abort(new DOMException("CANCELLATION_UNAVAILABLE", "AbortError"));
		}
		// ponytail: two shared operations per second per run; pub/sub can reduce traffic at higher concurrency.
		if (!stopped) timeout = setTimeout(() => void check(), 1_000);
	};
	await check();
	return cleanup;
}

/** False once a run's owner has stopped heartbeating, meaning it died without releasing its claim. */
export async function isRunAlive(runId: string, startedAt: Date | null): Promise<boolean> {
	const redis = getRedis();
	const shared = getCoordination();
	if (!redis && !shared) return true;
	// A just-claimed run may not have written its first heartbeat yet.
	if (startedAt && Date.now() - startedAt.getTime() < HEARTBEAT_TTL_MS) return true;
	return shared
		? (await shared.get(redisKey("agent-run-alive", runId))) !== null
		: (await redis?.exists(redisKey("agent-run-alive", runId))) === 1;
}

import { getCoordination } from "@rezumi/db/coordination";
