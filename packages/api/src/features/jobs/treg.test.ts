import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@rezumi/env/server", () => ({ env: { TREG_API_KEY: "env-token-should-not-leak" } }));

const { callTreg, TregError } = await import("./treg");

const TOKEN = "secret-test-token-123";

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

function fakeFetch(replies: Reply[]) {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), init: init ?? {} });
		const reply = replies.shift();
		if (!reply) throw new Error("No more replies");
		return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
			status: reply.status,
			headers: { "content-type": "application/json", ...reply.headers },
		});
	});
	return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const call = { tool: "hirebase.jobs.search", body: { job_titles: ["nurse"], limit: 2 }, maxCostUsd: 0.01 };

beforeEach(() => {
	vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("callTreg", () => {
	it("sends the token, the cost ceiling and the body, and reads the cost from the header", async () => {
		const { fetch, calls } = fakeFetch([
			{
				status: 200,
				body: { jobs: [] },
				headers: { "x-treg-cost-micro": "3000", "x-treg-call-id": "call_1", "x-treg-cache": "hit" },
			},
		]);
		const result = await callTreg(
			{ ...call, feature: "jobs-search", fresh: true },
			{ fetch, token: TOKEN, sleep: async () => {} },
		);
		expect(result).toMatchObject({ data: { jobs: [] }, costMicro: 3000, callId: "call_1", archived: true });
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://treg.to/call/hirebase.jobs.search");
		const headers = calls[0]?.init.headers as Record<string, string>;
		expect(headers["X-Treg-Token"]).toBe(TOKEN);
		expect(headers["X-Treg-Route-Max-Cost"]).toBe("0.0100");
		expect(headers["Cache-Control"]).toBe("no-cache");
		expect(headers["X-Treg-Meta"]).toBe("feature=jobs-search");
		expect(calls[0]?.init.method).toBe("POST");
		expect(JSON.parse(String(calls[0]?.init.body))).toEqual(call.body);
	});

	it("never reads the cost from the body", async () => {
		const { fetch } = fakeFetch([{ status: 200, body: { cost: 99, credits_charged: 5 } }]);
		const result = await callTreg(call, { fetch, token: TOKEN });
		expect(result.costMicro).toBe(0);
	});

	it("sends a GET with query parameters for tools that take them", async () => {
		const { fetch, calls } = fakeFetch([{ status: 200, body: { jobs: [] } }]);
		await callTreg(
			{ tool: "hirebase.jobs.expired", query: { since: "2026-11-13", limit: 100 }, maxCostUsd: 0.001 },
			{ fetch, token: TOKEN },
		);
		expect(calls[0]?.url).toBe("https://treg.to/call/hirebase.jobs.expired?since=2026-11-13&limit=100");
		expect(calls[0]?.init.method).toBe("GET");
		expect(calls[0]?.init.body).toBeUndefined();
	});

	it("retries a busy 503 and a 429 share_busy, then succeeds", async () => {
		const sleep = vi.fn(async () => {});
		const { fetch, calls } = fakeFetch([
			{ status: 503, body: { error: "upstream_busy", retry_after_s: 1 } },
			{ status: 429, body: { error: "share_busy" } },
			{ status: 200, body: { ok: true }, headers: { "x-treg-cost-micro": "1500" } },
		]);
		const result = await callTreg(call, { fetch, token: TOKEN, sleep });
		expect(result.costMicro).toBe(1500);
		expect(calls).toHaveLength(3);
		expect(sleep).toHaveBeenNthCalledWith(1, 1000);
		expect(sleep).toHaveBeenNthCalledWith(2, 1000);
	});

	it("gives up after two retries", async () => {
		const { fetch, calls } = fakeFetch([
			{ status: 503, body: { error: "treg_saturated" } },
			{ status: 503, body: { error: "treg_saturated" } },
			{ status: 503, body: { error: "treg_saturated" } },
		]);
		const error = await callTreg(call, { fetch, token: TOKEN, sleep: async () => {} }).catch((caught) => caught);
		expect(error).toBeInstanceOf(TregError);
		expect(error).toMatchObject({ code: "busy", status: 503, reason: "treg_saturated" });
		expect(calls).toHaveLength(3);
	});

	it("doesn't wait past the retry budget", async () => {
		const sleep = vi.fn(async () => {});
		const { fetch, calls } = fakeFetch([{ status: 503, body: { error: "upstream_busy", retry_after_s: 30 } }]);
		await expect(callTreg(call, { fetch, token: TOKEN, sleep })).rejects.toMatchObject({ code: "busy" });
		expect(sleep).not.toHaveBeenCalled();
		expect(calls).toHaveLength(1);
	});

	it.each(["member_spend_cap_reached", "insufficient_balance", "trial_allowance_reached"])(
		"stops at the spend limit %s without retrying",
		async (reason) => {
			const status = reason === "insufficient_balance" ? 402 : 429;
			const { fetch, calls } = fakeFetch([{ status, body: { error: reason } }]);
			await expect(callTreg(call, { fetch, token: TOKEN, sleep: async () => {} })).rejects.toMatchObject({
				code: "budget",
				reason,
			});
			expect(calls).toHaveLength(1);
		},
	);

	it("doesn't retry a team rate limit or a refused request", async () => {
		const { fetch, calls } = fakeFetch([
			{ status: 429, body: { error: "org_rate_limit" } },
			{ status: 402, body: { error: "route_max_cost" } },
			{ status: 422, body: { detail: "unknown field visa" } },
		]);
		const options = { fetch, token: TOKEN, sleep: async () => {} };
		await expect(callTreg(call, options)).rejects.toMatchObject({ code: "busy", reason: "org_rate_limit" });
		await expect(callTreg(call, options)).rejects.toMatchObject({ code: "rejected", reason: "route_max_cost" });
		await expect(callTreg(call, options)).rejects.toMatchObject({ code: "rejected", status: 422 });
		expect(calls).toHaveLength(3);
	});

	it("needs a token", async () => {
		const { fetch, calls } = fakeFetch([]);
		await expect(callTreg(call, { fetch, token: undefined })).rejects.toMatchObject({ code: "not-configured" });
		expect(calls).toHaveLength(0);
	});

	it("turns a network failure into unavailable", async () => {
		const fetch = vi.fn(async () => {
			throw new TypeError("fetch failed");
		}) as unknown as typeof globalThis.fetch;
		await expect(callTreg(call, { fetch, token: TOKEN })).rejects.toMatchObject({ code: "unavailable" });
	});

	it("never logs the token, the body or the provider's answer", async () => {
		const info = vi.mocked(console.info);
		const { fetch } = fakeFetch([
			{ status: 503, body: { error: "upstream_busy", retry_after_s: 0 } },
			{ status: 200, body: { jobs: [{ job_title: "Secret role" }] }, headers: { "x-treg-cost-micro": "1500" } },
			{ status: 422, body: { detail: "bad nurse" } },
		]);
		const options = { fetch, token: TOKEN, sleep: async () => {} };
		await callTreg(call, options);
		await callTreg(call, options).catch(() => {});
		const logged = info.mock.calls.flat().join("\n");
		expect(logged).toContain("hirebase.jobs.search");
		expect(logged).toContain("1500");
		expect(logged).not.toContain(TOKEN);
		expect(logged).not.toContain("env-token-should-not-leak");
		expect(logged).not.toContain("nurse");
		expect(logged).not.toContain("Secret role");
	});
});
