import { describe, expect, it } from "vite-plus/test";
import { cacheShare, dailyCostSeries, formatUsd, pageCost, typedUsd } from "./costs";

describe("job cost dashboard helpers", () => {
	it("gives every day of the period a bar, with each provider's dollars", () => {
		const { providers, rows } = dailyCostSeries(
			[
				{ date: "2026-11-18", provider: "jobspipe", costMicro: 39_200, calls: 1 },
				{ date: "2026-11-20", provider: "hirebase", costMicro: 60_000, calls: 2 },
				{ date: "2026-11-20", provider: "browser-run", costMicro: 0, calls: 3 },
				{ date: "2026-11-01", provider: "hirebase", costMicro: 999, calls: 1 },
			],
			3,
			new Date("2026-11-20T18:00:00Z"),
		);
		// Providers that cost nothing get no bar; Hirebase stacks first.
		expect(providers).toEqual(["hirebase", "jobspipe"]);
		expect(rows).toEqual([
			{ day: "2026-11-18", hirebase: 0, jobspipe: 0.0392 },
			{ day: "2026-11-19", hirebase: 0, jobspipe: 0 },
			{ day: "2026-11-20", hirebase: 0.06, jobspipe: 0 },
		]);
	});

	it("shares cache answers against provider calls", () => {
		expect(cacheShare({ cacheHits: 9, stale: 1, providerCalls: 10 })).toBe(0.5);
		expect(cacheShare({ cacheHits: 0, stale: 0, providerCalls: 0 })).toBeNull();
	});

	it("writes small amounts to a hundredth of a cent", () => {
		expect(formatUsd(1_500)).toBe("$0.0015");
		expect(formatUsd(0)).toBe("$0.00");
		expect(formatUsd(1_250_000)).toBe("$1.25");
	});
});

describe("pageCost", () => {
	it("averages a page and says how much of what was paid for was shown", () => {
		expect(pageCost({ pages: 4, pageCostMicro: 100_000, paidListings: 50, shownListings: 40 })).toEqual({
			averageMicro: 25_000,
			shownShare: 0.8,
		});
		expect(pageCost({ pages: 2, pageCostMicro: 0, paidListings: 0, shownListings: 0 })).toEqual({
			averageMicro: 0,
			shownShare: null,
		});
		expect(pageCost({ pages: 0, pageCostMicro: 0, paidListings: 0, shownListings: 0 })).toBeNull();
	});
});

describe("typedUsd", () => {
	it("reads whole dollars and cents, with a dot or a comma", () => {
		expect(typedUsd("5")).toBe(5);
		expect(typedUsd(" 2.50 ")).toBe(2.5);
		expect(typedUsd("2,5")).toBe(2.5);
		expect(typedUsd("0")).toBe(0);
	});

	it("refuses anything else", () => {
		expect(typedUsd("")).toBeNull();
		expect(typedUsd("$5")).toBeNull();
		expect(typedUsd("1.234")).toBeNull();
		expect(typedUsd("-1")).toBeNull();
	});
});
