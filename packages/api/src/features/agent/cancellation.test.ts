import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
	const values = new Map<string, string>();
	const redis = {
		get: vi.fn(async (key: string) => values.get(key) ?? null),
		set: vi.fn((key: string, value: string) => {
			values.set(key, value);
			return Promise.resolve("OK");
		}),
		exists: vi.fn(async (key: string) => (values.has(key) ? 1 : 0)),
	};
	const sharedValues = new Map<string, string>();
	const shared = {
		get: vi.fn(async (key: string) => sharedValues.get(key) ?? null),
		set: vi.fn(async (key: string, value: string) => {
			sharedValues.set(key, value);
		}),
	};
	return {
		values,
		redis,
		getRedis: vi.fn((): typeof redis | null => redis),
		sharedValues,
		shared,
		getCoordination: vi.fn((): typeof shared | undefined => undefined),
	};
});

vi.mock("@rezumi/db/coordination", () => ({ getCoordination: mocks.getCoordination }));

vi.mock("@rezumi/db/redis", () => ({
	getRedis: mocks.getRedis,
	redisKey: (...parts: string[]) => ["test", ...parts].join(":"),
}));

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.useFakeTimers();
	mocks.values.clear();
	mocks.sharedValues.clear();
	mocks.getRedis.mockReturnValue(mocks.redis);
	mocks.getCoordination.mockReturnValue(undefined);
});

afterEach(() => vi.useRealTimers());

describe("agent cancellation", () => {
	it("aborts the owner when another instance requests cancellation", async () => {
		const remote = await import("./cancellation");
		vi.resetModules();
		const owner = await import("./cancellation");
		const controller = new AbortController();
		const cleanup = await owner.monitorRunCancellation("run-2", controller);
		await remote.requestRunCancellation("run-2", "USER_ARCHIVED");
		expect(controller.signal.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(controller.signal.reason).toMatchObject({ name: "AbortError", message: "USER_ARCHIVED" });
		cleanup();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("aborts safely if Redis monitoring fails", async () => {
		const { monitorRunCancellation } = await import("./cancellation");
		const controller = new AbortController();
		mocks.redis.get.mockRejectedValueOnce(new Error("Disconnected"));
		const cleanup = await monitorRunCancellation("run-4", controller);
		expect(controller.signal.reason).toMatchObject({ name: "AbortError", message: "CANCELLATION_UNAVAILABLE" });
		cleanup();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("does not overlap polls or reschedule an in-flight check after cleanup", async () => {
		const { monitorRunCancellation } = await import("./cancellation");
		const cleanup = await monitorRunCancellation("slow-run", new AbortController());
		const result = Promise.withResolvers<string | null>();
		mocks.redis.get.mockReturnValueOnce(result.promise);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(mocks.redis.get).toHaveBeenCalledTimes(2);
		cleanup();
		result.resolve(null);
		await result.promise;
		expect(vi.getTimerCount()).toBe(0);
	});

	it("retains local cancellation without Redis", async () => {
		mocks.getRedis.mockReturnValue(null);
		const { monitorRunCancellation, requestRunCancellation } = await import("./cancellation");
		const controller = new AbortController();
		const cleanup = await monitorRunCancellation("run-5", controller);
		await requestRunCancellation("run-5", "USER_DELETED");
		expect(controller.signal.reason).toMatchObject({ name: "AbortError", message: "USER_DELETED" });
		expect(mocks.redis.get).not.toHaveBeenCalled();
		expect(mocks.redis.set).not.toHaveBeenCalled();
		cleanup();
	});

	it("reports a run dead only after its heartbeat is gone and the start grace has passed", async () => {
		const { isRunAlive } = await import("./cancellation");
		const old = new Date(Date.now() - 60_000);
		expect(await isRunAlive("run-7", old)).toBe(false);
		expect(await isRunAlive("run-7", new Date())).toBe(true);
		mocks.values.set("test:agent-run-alive:run-7", "1");
		expect(await isRunAlive("run-7", old)).toBe(true);
		mocks.getRedis.mockReturnValue(null);
		mocks.values.clear();
		expect(await isRunAlive("run-7", old)).toBe(true);
	});
	it("reports a stop to whoever asks next, on any instance", async () => {
		const remote = await import("./cancellation");
		vi.resetModules();
		const other = await import("./cancellation");
		expect(await other.isRunCancellationRequested("run-8")).toBe(false);
		await remote.requestRunCancellation("run-8", "USER_STOPPED");
		expect(await other.isRunCancellationRequested("run-8")).toBe(true);

		mocks.getRedis.mockReturnValue(null);
		vi.resetModules();
		const local = await import("./cancellation");
		const controller = new AbortController();
		const cleanup = await local.monitorRunCancellation("run-9", controller);
		expect(await local.isRunCancellationRequested("run-9")).toBe(false);
		await local.requestRunCancellation("run-9", "USER_STOPPED");
		expect(await local.isRunCancellationRequested("run-9")).toBe(true);
		cleanup();
	});

	// On Workers the stop request and the run are different requests: the run must abort itself from its own poll.
	it("leaves the abort to the owner's poll with Workers coordination", async () => {
		mocks.getRedis.mockReturnValue(null);
		mocks.getCoordination.mockReturnValue(mocks.shared);
		const { monitorRunCancellation, requestRunCancellation, isRunCancellationRequested } =
			await import("./cancellation");
		const controller = new AbortController();
		const cleanup = await monitorRunCancellation("run-10", controller);
		await requestRunCancellation("run-10", "USER_STOPPED");
		expect(controller.signal.aborted).toBe(false);
		expect(await isRunCancellationRequested("run-10")).toBe(true);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(controller.signal.reason).toMatchObject({ name: "AbortError", message: "USER_STOPPED" });
		cleanup();
	});

	it("stops the heartbeat of an aborted run that never finishes", async () => {
		const { ABORTED_RUN_HEARTBEAT_GRACE_MS, isRunAlive, monitorRunCancellation } = await import("./cancellation");
		const controller = new AbortController();
		const cleanup = await monitorRunCancellation("run-11", controller);
		controller.abort(new DOMException("USER_STOPPED", "AbortError"));
		const startedAt = new Date(Date.now() - 60_000);
		await vi.advanceTimersByTimeAsync(ABORTED_RUN_HEARTBEAT_GRACE_MS + 2_000);
		expect(await isRunAlive("run-11", startedAt)).toBe(true);
		const beats = mocks.redis.set.mock.calls.length;
		await vi.advanceTimersByTimeAsync(5_000);
		expect(mocks.redis.set.mock.calls.length).toBe(beats);
		expect(vi.getTimerCount()).toBe(0);
		// The fake store keeps keys forever; a real one lets the last beat expire after its TTL.
		mocks.values.delete("test:agent-run-alive:run-11");
		expect(await isRunAlive("run-11", startedAt)).toBe(false);
		cleanup();
	});
});
