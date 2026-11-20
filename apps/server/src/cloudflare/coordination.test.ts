import type { DurableObjectState } from "@cloudflare/workers-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Coordination } from "./coordination";

/** The parts of a Durable Object's state the class uses, kept in memory. */
function fakeState() {
	const kv = new Map<string, unknown>();
	let alarm: number | null = null;
	const storage = {
		kv: {
			get: (key: string) => kv.get(key),
			put: (key: string, value: unknown) => kv.set(key, value),
		},
		transactionSync: <T>(run: () => T) => run(),
		getAlarm: async () => alarm,
		setAlarm: async (at: number) => {
			alarm = at;
		},
		deleteAll: async () => {
			kv.clear();
			alarm = null;
		},
	};
	return { kv, state: { storage, getWebSockets: () => [] } as unknown as DurableObjectState };
}

const call = async (object: Coordination, input: object) =>
	(await object.fetch(new Request("https://coordination/", { method: "POST", body: JSON.stringify(input) }))).json();

describe("Coordination", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-11-20T00:00:00Z"));
	});
	afterEach(() => vi.useRealTimers());

	it("adds amounts to a running total and reads it with 0", async () => {
		const object = new Coordination(fakeState().state);
		expect(await call(object, { operation: "add", amount: 0, window: 60_000 })).toMatchObject({
			allowed: true,
			total: 0,
		});
		expect(await call(object, { operation: "add", amount: 1_500, window: 60_000 })).toMatchObject({ total: 1_500 });
		expect(await call(object, { operation: "add", amount: 2_500, window: 60_000 })).toMatchObject({ total: 4_000 });
		expect(await call(object, { operation: "add", amount: 0, window: 60_000 })).toEqual({
			allowed: true,
			total: 4_000,
			reset: Date.now() + 60_000,
		});
	});

	it("refuses an amount that would pass max and adds nothing", async () => {
		const object = new Coordination(fakeState().state);
		expect(await call(object, { operation: "add", amount: 1, window: 60_000, max: 2 })).toMatchObject({
			allowed: true,
			total: 1,
		});
		expect(await call(object, { operation: "add", amount: 1, window: 60_000, max: 2 })).toMatchObject({
			allowed: true,
			total: 2,
		});
		expect(await call(object, { operation: "add", amount: 1, window: 60_000, max: 2 })).toMatchObject({
			allowed: false,
			total: 2,
		});
	});

	it("starts again once the window is over", async () => {
		const object = new Coordination(fakeState().state);
		await call(object, { operation: "add", amount: 5, window: 1_000 });
		vi.setSystemTime(Date.now() + 1_001);
		expect(await call(object, { operation: "add", amount: 0, window: 1_000 })).toMatchObject({ total: 0 });
	});

	it("keeps consume working beside it", async () => {
		const object = new Coordination(fakeState().state);
		expect(await call(object, { operation: "consume", window: 60_000, max: 1 })).toMatchObject({ allowed: true });
		expect(await call(object, { operation: "consume", window: 60_000, max: 1 })).toMatchObject({ allowed: false });
	});

	it("rejects a negative or fractional amount", async () => {
		const object = new Coordination(fakeState().state);
		await expect(call(object, { operation: "add", amount: -1, window: 60_000 })).rejects.toThrow();
		await expect(call(object, { operation: "add", amount: 1.5, window: 60_000 })).rejects.toThrow();
	});
});
