import { describe, expect, it, vi } from "vite-plus/test";
import { jobCostQueries, reportStart, summarizeJobEvents } from "./admin";
import { readTregAccount } from "./treg-account";

describe("job cost queries", () => {
	it("starts the period at midnight UTC so the last day is today", () => {
		expect(reportStart(new Date("2026-11-20T15:30:00Z"), 7)).toBe("2026-11-14T00:00:00.000Z");
		expect(reportStart(new Date("2026-11-20T00:00:00Z"), 1)).toBe("2026-11-20T00:00:00.000Z");
	});

	it("reads the job search dataset with the start as a parameter, never in the text", () => {
		const queries = jobCostQueries("2026-11-14T00:00:00.000Z");
		for (const request of Object.values(queries)) {
			expect(request.query).toContain('events.analyticsEngine."job_search_events"');
			expect(request.query).toContain("timestamp >= $start");
			expect(request.query).not.toContain("2026-11-14");
			expect(request.query).not.toMatch(/accountTag/);
			expect(request.params).toEqual({ start: "2026-11-14T00:00:00.000Z" });
		}
	});
});

describe("summarizeJobEvents", () => {
	const rows = [
		// Two days of Hirebase searches, one failed call, a budget refusal and cache answers.
		{
			day: "2026-11-19 00:00:00",
			provider: "hirebase",
			tool: "hirebase.jobs.search",
			outcome: "miss",
			kind: "search",
			calls: "4",
			cost: "120000",
			ms: "6400",
			results: "80",
		},
		{
			day: "2026-11-20T00:00:00Z",
			provider: "hirebase",
			tool: "hirebase.jobs.search",
			outcome: "miss",
			kind: "search",
			calls: 2,
			cost: 60000,
			ms: 3000,
			results: 40,
		},
		{
			day: "2026-11-20",
			provider: "hirebase",
			tool: "hirebase.jobs.search",
			outcome: "error",
			kind: "search",
			calls: 1,
			cost: 0,
			ms: 0,
			results: 0,
		},
		{
			day: "2026-11-20",
			provider: "hirebase",
			tool: "budget",
			outcome: "budget",
			kind: "search",
			calls: 3,
			cost: 0,
			ms: 0,
			results: 0,
		},
		{
			day: "2026-11-20",
			provider: "hirebase",
			tool: "cache",
			outcome: "hit",
			kind: "search",
			calls: 9,
			cost: 0,
			ms: 0,
			results: 0,
		},
		{
			day: "2026-11-20",
			provider: "hirebase",
			tool: "cache",
			outcome: "stale",
			kind: "search",
			calls: 1,
			cost: 0,
			ms: 0,
			results: 0,
		},
		{
			day: "2026-11-20",
			provider: "jobspipe",
			tool: "jobspipe.jobs.search",
			outcome: "miss",
			kind: "search",
			calls: 1,
			cost: 39200,
			ms: 2100,
			results: 10,
		},
		{
			day: "2026-11-20",
			provider: "serper",
			tool: "serper.web.search",
			outcome: "miss",
			kind: "web-search",
			calls: 5,
			cost: 5000,
			ms: 7000,
			results: 25,
		},
	];

	it("adds cost per day and provider, keeping cache answers out of the calls", () => {
		const summary = summarizeJobEvents(rows, null);
		expect(summary.daily).toEqual([
			{ date: "2026-11-19", provider: "hirebase", costMicro: 120000, calls: 4 },
			{ date: "2026-11-20", provider: "hirebase", costMicro: 60000, calls: 6 },
			{ date: "2026-11-20", provider: "jobspipe", costMicro: 39200, calls: 1 },
			{ date: "2026-11-20", provider: "serper", costMicro: 5000, calls: 5 },
		]);
		expect(summary.search).toEqual({ cacheHits: 9, stale: 1, providerCalls: 7, budget: 3 });
	});

	it("averages speed over calls that reached the provider and counts failures", () => {
		const hirebase = summarizeJobEvents(rows, null).tools.find((row) => row.tool === "hirebase.jobs.search");
		expect(hirebase).toEqual({
			provider: "hirebase",
			tool: "hirebase.jobs.search",
			kind: "search",
			calls: 7,
			costMicro: 180000,
			results: 120,
			errors: 1,
			budget: 0,
			avgMs: 1567,
			p95Ms: null,
		});
	});

	it("adds the percentiles when they came, and sorts by cost", () => {
		const summary = summarizeJobEvents(rows, [
			{ provider: "hirebase", tool: "hirebase.jobs.search", kind: "search", p95: "2300.4" },
			{ provider: "nobody", tool: "x", kind: "search", p95: 1 },
		]);
		expect(summary.tools.map((row) => row.tool)).toEqual([
			"hirebase.jobs.search",
			"jobspipe.jobs.search",
			"serper.web.search",
			"budget",
		]);
		expect(summary.tools[0]?.p95Ms).toBe(2300);
		expect(summary.tools.find((row) => row.tool === "budget")).toMatchObject({ budget: 3, avgMs: null });
	});
});

describe("readTregAccount", () => {
	const answers: Record<string, unknown> = {
		"/orgs": [
			{ org_id: 7, active: false },
			{ org_id: 8, active: true, demo: true },
			{ org_id: 9, active: true, demo: false },
		],
		"/orgs/9/balance": { balance_micro: 888220, balance_usd: 0.88822 },
		"/orgs/9/usage/by-tag": {
			rows: [
				{ value: "web-search", charged_micro: 3000, calls: 3 },
				{ value: "jobs-search", charged_micro: 59180, calls: 7 },
			],
			unattributed_micro: 49600,
			total_micro: 111780,
		},
	};

	it("finds the team, then reads its balance and ledger per feature", async () => {
		const requests: { url: URL; token: string | null }[] = [];
		const fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
			const url = new URL(String(input));
			requests.push({ url, token: new Headers(init?.headers).get("x-treg-token") });
			return Response.json(answers[url.pathname]);
		});
		const account = await readTregAccount(30, { fetch: fetch as typeof globalThis.fetch, token: "team-token" });
		expect(account).toEqual({
			balanceMicro: 888220,
			usage: [
				{ feature: "jobs-search", chargedMicro: 59180, calls: 7 },
				{ feature: "web-search", chargedMicro: 3000, calls: 3 },
			],
			totalMicro: 111780,
			unattributedMicro: 49600,
		});
		expect(requests.find((request) => request.url.pathname.endsWith("by-tag"))?.url.search).toBe(
			"?key=feature&days=30",
		);
		expect(requests.every((request) => request.token === "team-token")).toBe(true);
	});

	it("says so without a token, and when treg fails", async () => {
		expect(await readTregAccount(7, { token: undefined })).toBe("not-configured");
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const failing = vi.fn(async () => new Response("no", { status: 500 }));
		expect(await readTregAccount(7, { fetch: failing as typeof globalThis.fetch, token: "other-token" })).toBe(
			"unavailable",
		);
		expect(error.mock.calls.flat().join(" ")).not.toContain("other-token");
		error.mockRestore();
	});
});
