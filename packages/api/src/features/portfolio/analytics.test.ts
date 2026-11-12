import type { PortfolioDataPoint } from "./analytics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@rezumi/db/redis", () => ({ getRedis: () => null, redisKey: (...parts: string[]) => parts.join(":") }));
vi.mock("@rezumi/db/coordination", () => ({ getCoordination: () => undefined }));

const {
	configurePortfolioAnalytics,
	portfolioDataPoint,
	portfolioDetailQueries,
	readPortfolioDetails,
	writePortfolioEvent,
} = await import("./analytics");

afterEach(() => configurePortfolioAnalytics(undefined));

describe("portfolioDataPoint", () => {
	it("holds the portfolio as index and only the agreed fields", () => {
		expect(
			portfolioDataPoint({
				portfolioId: "pf1",
				event: "view",
				source: "linkedin",
				referrerDomain: "linkedin.com",
				country: "id",
				device: "mobile",
			}),
		).toEqual({ indexes: ["pf1"], blobs: ["view", "", "linkedin", "linkedin.com", "ID", "mobile"], doubles: [1] });
	});

	it("records the work of a work event", () => {
		expect(portfolioDataPoint({ portfolioId: "pf1", event: "work", workId: "w1", device: "desktop" }).blobs).toEqual([
			"work",
			"w1",
			"",
			"",
			"",
			"desktop",
		]);
	});
});

describe("writePortfolioEvent", () => {
	const event = { portfolioId: "pf1", event: "view", device: "mobile" as const };

	it("does nothing without the binding", () => {
		expect(() => writePortfolioEvent(event)).not.toThrow();
		configurePortfolioAnalytics({ dataset: () => undefined, sql: () => undefined, country: () => "ID" });
		expect(() => writePortfolioEvent(event)).not.toThrow();
	});

	it("writes the country from the running request", () => {
		const points: PortfolioDataPoint[] = [];
		configurePortfolioAnalytics({
			dataset: () => ({ writeDataPoint: (point) => points.push(point) }),
			sql: () => undefined,
			country: () => "SG",
		});
		writePortfolioEvent(event);
		expect(points[0]?.blobs[4]).toBe("SG");
		expect(JSON.stringify(points)).not.toMatch(/Mozilla|\d+\.\d+\.\d+\.\d+/);
	});

	it("never throws when the platform refuses a point", () => {
		configurePortfolioAnalytics({
			dataset: () => ({
				writeDataPoint: () => {
					throw new Error("too many points");
				},
			}),
			sql: () => undefined,
			country: () => undefined,
		});
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		expect(() => writePortfolioEvent(event)).not.toThrow();
		log.mockRestore();
	});
});

describe("portfolioDetailQueries", () => {
	const now = new Date("2026-11-09T00:00:00Z");
	const queries = Object.values(portfolioDetailQueries("pf-mine", now));

	it("always filters to one portfolio and the last 30 days", () => {
		expect(queries).toHaveLength(4);
		for (const { query, params } of queries) {
			expect(query).toContain("index1 = $portfolio");
			expect(query).toContain("timestamp >= $start");
			// The start of the oldest of the 30 days the daily counts show.
			expect(params).toEqual({ portfolio: "pf-mine", start: "2026-10-11T00:00:00.000Z" });
		}
	});

	it("starts at the beginning of the owner's oldest day", () => {
		expect(portfolioDetailQueries("pf-mine", now, "Asia/Jakarta").countries.params.start).toBe(
			"2026-10-10T17:00:00.000Z",
		);
	});

	it("reads the dataset through the binding's names, without account scope or a format", () => {
		for (const { query } of queries) {
			expect(query).toContain('events.analyticsEngine."portfolio_events"');
			expect(query).not.toMatch(/accountTag|FORMAT/i);
			expect(query).not.toContain("pf-mine");
		}
	});
});

describe("work days", () => {
	const now = new Date("2026-11-09T00:00:00Z");

	it("are the owner's days, and a time zone that isn't a plain name can't reach the query", () => {
		expect(portfolioDetailQueries("pf-mine", now, "Asia/Jakarta").workDays.query).toContain(
			"toStartOfInterval(timestamp, INTERVAL '1' DAY, 'Asia/Jakarta')",
		);
		expect(portfolioDetailQueries("pf-mine", now, "x') OR 1=1 --").workDays.query).toContain(
			"INTERVAL '1' DAY, 'UTC')",
		);
	});

	it.each([
		["local midnight", "2026-11-08 00:00:00"],
		["a UTC instant", "2026-11-07 17:00:00"],
		["an ISO instant", "2026-11-07T17:00:00Z"],
	])("reads a bucket written as %s", async (_name, day) => {
		const query = vi.fn(({ query: sql }: { query: string }) =>
			Promise.resolve({ data: sql.includes("toStartOfInterval") ? [{ day, workId: "w1", opens: 3 }] : [] }),
		);
		configurePortfolioAnalytics({ dataset: () => undefined, sql: () => ({ query }), country: () => undefined });
		const rows = await readPortfolioDetails(`pf-${day}`, "Asia/Jakarta");
		expect(rows?.workDays).toEqual([{ date: "2026-11-08", workId: "w1", opens: 3 }]);
	});
});

describe("readPortfolioDetails", () => {
	beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
	afterEach(() => vi.restoreAllMocks());

	it("is null without the binding", async () => {
		expect(await readPortfolioDetails("pf-none")).toBeNull();
	});

	it("is null when the query fails", async () => {
		configurePortfolioAnalytics({
			dataset: () => undefined,
			sql: () => ({ query: () => Promise.reject(new Error("no")) }),
			country: () => undefined,
		});
		expect(await readPortfolioDetails("pf-fail")).toBeNull();
	});

	it("reads rows, rounding weighted sums and dropping what isn't a known value, then caches them", async () => {
		const query = vi.fn(({ query: sql }: { query: string }) =>
			Promise.resolve({
				data: sql.includes("blob5")
					? [
							{ code: "ID", views: "12.4" },
							{ code: "??", views: 1 },
						]
					: sql.includes("blob6")
						? [
								{ device: "mobile", views: 9 },
								{ device: "fridge", views: 1 },
							]
						: sql.includes("blob4")
							? [{ domain: "example.com", views: 2 }]
							: [{ day: "2026-11-08 00:00:00", workId: "w1", opens: 3 }],
			}),
		);
		configurePortfolioAnalytics({ dataset: () => undefined, sql: () => ({ query }), country: () => undefined });
		const first = await readPortfolioDetails("pf-read");
		expect(first).toEqual({
			countries: [{ code: "ID", views: 12 }],
			devices: [{ device: "mobile", views: 9 }],
			referrers: [{ domain: "example.com", views: 2 }],
			workDays: [{ date: "2026-11-08", workId: "w1", opens: 3 }],
		});
		expect(await readPortfolioDetails("pf-read")).toEqual(first);
		expect(query).toHaveBeenCalledTimes(4);
	});
});
