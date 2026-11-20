import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vite-plus/test";

const fixture = vi.hoisted(() => ({ redisUrl: undefined as string | undefined }));
vi.mock("@rezumi/env/server", () => ({
	env: {
		get REDIS_URL() {
			return fixture.redisUrl;
		},
		DEPLOYMENT_NAMESPACE: "test",
	},
}));

const { fallbackCounters, memoryCounters, jobCounters } = await import("./counters");

describe("memoryCounters", () => {
	it("adds, reads with 0, refuses past max and starts again after the window", async () => {
		let now = 1_000;
		const counters = memoryCounters(() => now);
		expect(await counters.add("k", 0, { window: 100 })).toEqual({ allowed: true, total: 0, reset: 1_100 });
		expect(await counters.add("k", 2, { window: 100, max: 3 })).toMatchObject({ allowed: true, total: 2 });
		expect(await counters.add("k", 2, { window: 100, max: 3 })).toMatchObject({ allowed: false, total: 2 });
		expect(await counters.add("k", 1, { window: 100, max: 3 })).toMatchObject({ allowed: true, total: 3 });
		now = 1_101;
		expect(await counters.add("k", 0, { window: 100 })).toMatchObject({ total: 0 });
	});
});

describe("fallbackCounters", () => {
	it("counts in this process when the shared store fails, answers nothing or hangs", async () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const rule = { window: 60_000 };
		const failing = fallbackCounters(() => Promise.reject(new Error("down")), 50, memoryCounters());
		expect(await failing.add("k", 2, rule)).toMatchObject({ allowed: true, total: 2 });
		const missing = fallbackCounters(() => Promise.resolve(undefined), 50, memoryCounters());
		expect(await missing.add("k", 1, rule)).toMatchObject({ total: 1 });
		const hanging = fallbackCounters(() => new Promise(() => undefined), 20, memoryCounters());
		const started = Date.now();
		expect(await hanging.add("k", 3, rule)).toMatchObject({ total: 3 });
		expect(Date.now() - started).toBeLessThan(1_000);
		expect(errors).toHaveBeenCalledTimes(2);
		errors.mockRestore();
	});

	it("uses the shared answer when there is one", async () => {
		const shared = { allowed: false, total: 9, reset: 1 };
		const counters = fallbackCounters(() => Promise.resolve(shared), 50, memoryCounters());
		expect(await counters.add("k", 1, { window: 1, max: 9 })).toBe(shared);
	});
});

// Opt in with a disposable Redis (the dev Compose one works): REDIS_TEST_URL=redis://localhost:6379
describe.skipIf(!process.env.REDIS_TEST_URL)("jobCounters on Redis", () => {
	const key = `counter-test:${randomUUID()}`;
	afterAll(async () => {
		const { getRedis, redisKey } = await import("@rezumi/db/redis");
		await getRedis()?.del(redisKey("jobs", key));
		getRedis()?.disconnect();
	});

	it("keeps the same rules as the Durable Object", async () => {
		fixture.redisUrl = process.env.REDIS_TEST_URL;
		expect(await jobCounters.add(key, 0, { window: 60_000 })).toMatchObject({ allowed: true, total: 0 });
		expect(await jobCounters.add(key, 1_500, { window: 60_000 })).toMatchObject({ allowed: true, total: 1_500 });
		expect(await jobCounters.add(key, 1, { window: 60_000, max: 1_500 })).toMatchObject({
			allowed: false,
			total: 1_500,
		});
		const read = await jobCounters.add(key, 0, { window: 60_000 });
		expect(read.total).toBe(1_500);
		expect(read.reset).toBeGreaterThan(Date.now());
	});
});
