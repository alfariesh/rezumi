import type { LookupFunction } from "node:net";
import { lookup as socketLookup } from "node:dns";
import { lookup } from "node:dns/promises";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { memoryCounters } from "../jobs/counters";
import {
	BROWSER_READS_PER_DAY,
	looksUnrendered,
	readPage,
	searchWeb,
	WEB_SEARCH_SPEND_PER_DAY_MICRO,
	WEB_SEARCHES_PER_DAY,
} from "./service";

const fixtures = vi.hoisted(() => ({
	limit: vi.fn(async () => ({ success: true })),
	direct: vi.fn(),
	directHtml: "",
	directLocation: "",
	directStatus: 200,
	directContentType: "text/html",
	counters: undefined as unknown as { add: (...args: never[]) => Promise<unknown> },
	events: vi.fn(),
	env: {} as Record<string, unknown>,
}));
vi.mock("../../redis", () => ({ createRateLimiter: () => ({ limit: fixtures.limit }) }));
vi.mock("@rezumi/env/server", () => ({ env: fixtures.env }));
vi.mock("../jobs/counters", async (original) => ({
	...(await original<typeof import("../jobs/counters")>()),
	jobCounters: { add: (...args: never[]) => fixtures.counters.add(...args) },
}));
vi.mock("../jobs/events", () => ({ recordJobEvent: fixtures.events }));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:dns", () => ({ lookup: vi.fn() }));
vi.mock("node:https", async (original) => ({
	...(await original<typeof import("node:https")>()),
	request: (
		url: URL,
		options: { signal: AbortSignal; agent: { options: { lookup: LookupFunction } } },
		callback: (response: EventEmitter) => void,
	) => {
		fixtures.direct(url.toString());
		const request = new EventEmitter();
		const req = Object.assign(request, {
			destroy: (error: Error) => request.emit("error", error),
			end: () => {
				options.agent.options.lookup(url.hostname, { all: true }, (error) => {
					if (error) return req.destroy(error);
					const response = Object.assign(new EventEmitter(), {
						statusCode: fixtures.directLocation ? 302 : fixtures.directStatus,
						headers: { "content-type": fixtures.directContentType, location: fixtures.directLocation || undefined },
						resume: () => {},
					});
					callback(response);
					response.emit("data", Buffer.from(fixtures.directHtml));
					response.emit("end");
				});
			},
		});
		return req;
	},
}));

const PAGE = "https://jobs.example.com/role";
const ACCOUNT = "0123456789abcdef0123456789abcdef";
const POSTING_HTML = `<script type="application/ld+json">{"@type":"JobPosting","title":"Designer"}</script><h1>Designer</h1><p>Work on accessible products.</p>`;
const SPA_SHELL = `<div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript>`;
const RENDERED = `<h1>Product designer</h1><p>${"Design accessible products for millions of people. ".repeat(10)}</p>`;

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
const calls: Call[] = [];
let answer: (call: Call) => Response;

const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json", ...init.headers } });

beforeEach(() => {
	vi.stubEnv("NODE_ENV", "test");
	for (const key of Object.keys(fixtures.env)) delete fixtures.env[key];
	Object.assign(fixtures.env, {
		FLAG_DISABLE_API_RATE_LIMIT: false,
		TREG_API_KEY: "test-treg-token",
		CLOUDFLARE_BROWSER_TOKEN: "test-browser-token",
		CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
		JOB_SEARCH_DAILY_BUDGET_USD: 1,
	});
	fixtures.counters = memoryCounters() as never;
	fixtures.events.mockClear();
	fixtures.direct.mockClear();
	fixtures.limit.mockClear();
	fixtures.directHtml = POSTING_HTML;
	fixtures.directLocation = "";
	fixtures.directStatus = 200;
	fixtures.directContentType = "text/html";
	calls.length = 0;
	answer = () => json({ success: true, result: RENDERED }, { headers: { "x-browser-ms-used": "2300" } });
	vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
		const call = {
			url: input.toString(),
			headers: Object.fromEntries(new Headers(init?.headers).entries()),
			body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
		};
		calls.push(call);
		return answer(call);
	});
	vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
	vi.mocked(socketLookup).mockImplementation(((
		_hostname: string,
		_options: unknown,
		callback: (error: Error | null, addresses: unknown) => void,
	) => callback(null, [{ address: "93.184.216.34", family: 4 }])) as never);
	vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("reading a page", () => {
	it("reads a page with JobPosting data directly, without the browser", async () => {
		const page = await readPage(PAGE, { userId: "user" });
		expect(page).toMatchObject({ method: "builtin", requestedUrl: PAGE, completeness: "unknown" });
		expect(page.content).toContain("Work on accessible products.");
		expect(page.html).toContain("JobPosting");
		expect(calls).toHaveLength(0);
	});

	it("reads a page drawn by JavaScript through Browser Run", async () => {
		fixtures.directHtml = SPA_SHELL;
		const page = await readPage(PAGE, { userId: "user" });
		expect(page).toMatchObject({ method: "browser", fallbackReason: "empty", requestedUrl: PAGE });
		expect(page.content).toContain("Product designer");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/browser-run/content`);
		expect(calls[0]?.headers.authorization).toBe("Bearer test-browser-token");
		expect(calls[0]?.body).toMatchObject({ url: PAGE, gotoOptions: { waitUntil: "networkidle2" } });
		expect(fixtures.events).toHaveBeenCalledWith(
			expect.objectContaining({ kind: "browser", outcome: "miss", ms: 2300, costMicro: 0 }),
		);
	});

	it("opens a page that never goes quiet again, reading it once its HTML is in", async () => {
		fixtures.directHtml = SPA_SHELL;
		answer = (call) =>
			(call.body.gotoOptions as { waitUntil?: string }).waitUntil === "networkidle2"
				? new Response("{}", { status: 422, headers: { "x-browser-ms-used": "9000" } })
				: json({ success: true, result: RENDERED }, { headers: { "x-browser-ms-used": "3500" } });
		const page = await readPage(PAGE, { userId: "user" });
		expect(page).toMatchObject({ method: "browser" });
		expect(calls.map((call) => call.body.gotoOptions)).toEqual([
			expect.objectContaining({ waitUntil: "networkidle2" }),
			expect.objectContaining({ waitUntil: "domcontentloaded" }),
		]);
		expect(calls[1]?.body).toMatchObject({ waitForTimeout: 5000 });
		expect(fixtures.events).toHaveBeenCalledWith(expect.objectContaining({ kind: "browser", ms: 12_500 }));
	});

	it("reads a website import's pages once their HTML is in, without waiting for a quiet network", async () => {
		fixtures.directHtml = SPA_SHELL;
		await readPage(PAGE, { userId: "user", allowance: "import" });
		expect(calls).toHaveLength(1);
		expect(calls[0]?.body).toMatchObject({ gotoOptions: { waitUntil: "domcontentloaded" }, waitForTimeout: 5000 });
	});

	it.each<[string, { html?: string; status?: number }, string]>([
		["a bot check", { html: "<p>Just a moment. Verify you are human.</p>" }, "challenge"],
		["a refusal of plain requests", { status: 403 }, "unreachable"],
		["a short page without JobPosting data", { html: "<p>Loading jobs…</p>" }, "empty"],
	])("asks the browser after %s", async (_name, direct, reason) => {
		if (direct.html) fixtures.directHtml = direct.html;
		if (direct.status) fixtures.directStatus = direct.status;
		expect(await readPage(PAGE, { userId: "user" })).toMatchObject({ method: "browser", fallbackReason: reason });
	});

	it("keeps the direct text of a short page when the browser isn't set up", async () => {
		delete fixtures.env.CLOUDFLARE_BROWSER_TOKEN;
		fixtures.directHtml = "<p>Loading jobs…</p>";
		expect(await readPage(PAGE, { userId: "user" })).toMatchObject({ method: "builtin", content: "Loading jobs…" });
		expect(calls).toHaveLength(0);
	});

	it("answers the direct reader's failure when the browser fails too", async () => {
		fixtures.directHtml = "<p>Just a moment. Verify you are human.</p>";
		answer = () => new Response("{}", { status: 422 });
		await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason: "challenge" });
		expect(fixtures.events).toHaveBeenCalledWith(expect.objectContaining({ kind: "browser", outcome: "error" }));
	});

	it("rejects a malformed Browser Run answer", async () => {
		fixtures.directHtml = SPA_SHELL;
		answer = () => json({ success: false, errors: [{ message: "echo of the request" }] });
		await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason: "empty" });
	});

	it("doesn't ask the browser for a page that is gone", async () => {
		fixtures.directStatus = 404;
		await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason: "not-found" });
		expect(calls).toHaveLength(0);
	});

	it("doesn't count a browser read that failed", async () => {
		fixtures.directHtml = SPA_SHELL;
		answer = () => new Response("{}", { status: 503 });
		for (let index = 0; index < BROWSER_READS_PER_DAY; index++)
			await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason: "empty" });
		answer = () => json({ success: true, result: RENDERED });
		expect(await readPage(PAGE, { userId: "user" })).toMatchObject({ method: "browser" });
	});

	it(`reads at most ${BROWSER_READS_PER_DAY} pages through the browser per person per day`, async () => {
		fixtures.directHtml = SPA_SHELL;
		for (let index = 0; index < BROWSER_READS_PER_DAY; index++)
			expect(await readPage(PAGE, { userId: "user" })).toMatchObject({ method: "browser" });
		await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason: "empty" });
		expect(calls).toHaveLength(BROWSER_READS_PER_DAY);
		expect(await readPage(PAGE, { userId: "someone-else" })).toMatchObject({ method: "browser" });
	});

	it("reads a website import's pages on the import's own allowance, without using the day's browser reads", async () => {
		fixtures.directHtml = SPA_SHELL;
		for (let index = 0; index < BROWSER_READS_PER_DAY + 3; index++)
			expect(await readPage(PAGE, { userId: "user", allowance: "import" })).toMatchObject({ method: "browser" });
		// The day's own allowance is untouched.
		for (let index = 0; index < BROWSER_READS_PER_DAY; index++)
			expect(await readPage(PAGE, { userId: "user" })).toMatchObject({ method: "browser" });
		await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason: "empty" });
	});

	it("doesn't throttle a website import's reads per request", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const allow = fixtures.limit.getMockImplementation();
		fixtures.limit.mockImplementation(async () => ({ success: false }));
		try {
			await expect(readPage(PAGE, { userId: "user", allowance: "import" })).resolves.toMatchObject({
				method: "builtin",
			});
			expect(fixtures.limit).not.toHaveBeenCalled();
		} finally {
			if (allow) fixtures.limit.mockImplementation(allow);
		}
	});

	it.each([
		"http://jobs.example.com/role",
		"https://user:pass@jobs.example.com/role",
		"https://localhost/role",
		"https://127.0.0.1/role",
		"https://10.0.0.8/role",
		"https://[::1]/role",
		"ftp://jobs.example.com/role",
	])("refuses %s before anything is fetched or sent to the browser", async (url) => {
		await expect(readPage(url, { userId: "user" })).rejects.toMatchObject({ reason: "unsafe-url" });
		expect(fixtures.direct).not.toHaveBeenCalled();
		expect(calls).toHaveLength(0);
	});

	it("refuses a name that resolves to a private address before the browser sees it", async () => {
		vi.mocked(lookup).mockResolvedValue([
			{ address: "93.184.216.34", family: 4 },
			{ address: "192.168.1.4", family: 4 },
		] as never);
		await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason: "unsafe-url" });
		expect(calls).toHaveLength(0);
	});

	it("protects the direct socket against DNS rebinding after the check", async () => {
		vi.mocked(socketLookup).mockImplementation(((
			_hostname: string,
			_options: unknown,
			callback: (error: Error | null, addresses: unknown) => void,
		) => callback(null, [{ address: "10.0.0.1", family: 4 }])) as never);
		await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason: "unsafe-url" });
		expect(calls).toHaveLength(0);
	});

	it.each(["https://127.0.0.1/private", "http://jobs.example.com/role"])(
		"refuses a direct redirect to %s",
		async (location) => {
			fixtures.directLocation = location;
			await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason: "unsafe-url" });
			expect(calls).toHaveLength(0);
		},
	);

	it.each([
		["media-type", "not-a-page"],
		["response-size", "too-large"],
	])("bounds the direct reader's %s failure without the browser", async (failure, reason) => {
		if (failure === "media-type") fixtures.directContentType = "application/pdf";
		if (failure === "response-size") fixtures.directHtml = "x".repeat(2_000_001);
		await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason });
		expect(calls).toHaveLength(0);
	});

	it("limits reading once per request in production", async () => {
		vi.stubEnv("NODE_ENV", "production");
		fixtures.limit.mockResolvedValueOnce({ success: false });
		await expect(readPage(PAGE, { userId: "user" })).rejects.toMatchObject({ reason: "rate-limit" });
		expect(fixtures.limit).toHaveBeenCalledWith("user");
		expect(fixtures.direct).not.toHaveBeenCalled();
	});
});

describe("looksUnrendered", () => {
	it("trusts a page with JSON-LD, however short", () => {
		expect(looksUnrendered('<script type="application/ld+json">{}</script>', "Hi")).toBe(false);
	});
	it("treats a page asking for JavaScript as unrendered", () => {
		expect(looksUnrendered("<p></p>", `${"Words. ".repeat(60)} Please enable JavaScript to continue.`)).toBe(true);
	});
	it("trusts a page with plenty of text", () => {
		expect(looksUnrendered("<p></p>", "Words. ".repeat(100))).toBe(false);
	});
});

const organic = [
	{ title: "Lumen Health", link: "https://lumen.example/about", snippet: "Careers at Lumen" },
	{ title: "Private", link: "https://localhost/private" },
	{ title: "Insecure", link: "http://lumen.example/insecure" },
	{ link: "https://lumen.example/no-title" },
];

describe("searching the web", () => {
	beforeEach(() => {
		answer = (call) =>
			json(
				{
					organic: call.body.gl === "de" ? [{ title: "Berlin", link: "https://de.example/role" }, ...organic] : organic,
				},
				{ headers: { "x-treg-cost-micro": "1000" } },
			);
	});

	it("searches through Serper with a cost ceiling and keeps only public results", async () => {
		expect(await searchWeb("Lumen Health company", { userId: "user" })).toEqual([
			{ url: "https://lumen.example/about", title: "Lumen Health", snippet: "Careers at Lumen" },
		]);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://treg.to/call/serper.web.search");
		expect(calls[0]?.headers).toMatchObject({ "x-treg-token": "test-treg-token", "x-treg-route-max-cost": "0.0020" });
		expect(calls[0]?.body).toEqual({ q: "Lumen Health company" });
		expect(fixtures.events).toHaveBeenCalledWith(
			expect.objectContaining({ kind: "web-search", provider: "serper", costMicro: 1000, resultCount: 1 }),
		);
	});

	it("searches each country and interleaves the results in country order", async () => {
		const results = await searchWeb("designer", { userId: "user", regions: ["DE", "FR"] });
		expect(calls.map((call) => call.body.gl)).toEqual(["de", "fr"]);
		expect(results.map((result) => result.url)).toEqual(["https://de.example/role", "https://lumen.example/about"]);
	});

	it("counts what the searches cost in the job search budget", async () => {
		const { spentToday } = await import("../jobs/allowance");
		await searchWeb("designer", { userId: "user", regions: ["DE", "FR"] });
		expect(await spentToday(fixtures.counters as never, new Date())).toBe(2000);
	});

	it("falls back to treg's routed search when Serper fails, under a larger ceiling", async () => {
		answer = (call) =>
			call.url.endsWith("serper.web.search")
				? json({ error: "upstream_error" }, { status: 500 })
				: json(
						{
							output: {
								results: [{ url: "https://lumen.example/team", title: "Team", description: "The people" }],
							},
						},
						{ headers: { "x-treg-cost-micro": "4000" } },
					);
		expect(await searchWeb("Lumen Health", { userId: "user" })).toEqual([
			{ url: "https://lumen.example/team", title: "Team", snippet: "The people" },
		]);
		expect(calls.map((call) => call.url)).toEqual([
			"https://treg.to/call/serper.web.search",
			"https://treg.to/call/treg.web.search",
		]);
		expect(calls[1]?.headers["x-treg-route-max-cost"]).toBe("0.0100");
		expect(calls[1]?.body).toEqual({ q: "Lumen Health", limit: 5 });
	});

	it("falls back once, not once per country, when Serper fails everywhere", async () => {
		answer = (call) =>
			call.url.endsWith("serper.web.search")
				? json({ error: "upstream_error" }, { status: 500 })
				: json(
						{ output: { results: [{ url: "https://lumen.example/team", title: "Team" }] } },
						{ headers: { "x-treg-cost-micro": "4000" } },
					);
		await searchWeb("designer", { userId: "user", regions: ["DE", "FR", "GB"] });
		expect(calls.filter((call) => call.url.endsWith("treg.web.search"))).toHaveLength(1);
	});

	it("doesn't count a search that failed", async () => {
		answer = () => json({ error: "upstream_error" }, { status: 500 });
		for (let index = 0; index < WEB_SEARCHES_PER_DAY; index++)
			await expect(searchWeb("designer", { userId: "user" })).rejects.toMatchObject({ reason: "unavailable" });
		answer = () => json({ organic }, { headers: { "x-treg-cost-micro": "1000" } });
		expect(await searchWeb("designer", { userId: "user" })).toHaveLength(1);
	});

	it("stops a person whose searches cost too much today, without calling treg", async () => {
		answer = () => json({ organic }, { headers: { "x-treg-cost-micro": String(WEB_SEARCH_SPEND_PER_DAY_MICRO) } });
		await searchWeb("designer", { userId: "user" });
		calls.length = 0;
		await expect(searchWeb("designer", { userId: "user" })).rejects.toMatchObject({ reason: "rate-limit" });
		expect(calls).toHaveLength(0);
		expect(await searchWeb("designer", { userId: "someone-else" })).toHaveLength(1);
	});

	it("stops with a budget error once today's budget is spent, without calling treg", async () => {
		const { recordSpend } = await import("../jobs/allowance");
		await recordSpend(fixtures.counters as never, 1_000_000, new Date());
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const failure = await searchWeb("designer", { userId: "user" }).catch((error: unknown) => error);
		expect(failure).toMatchObject({ reason: "budget", message: expect.stringContaining("Try again tomorrow") });
		expect(calls).toHaveLength(0);
	});

	it("answers a budget error when treg's spend cap is reached, without the routed search", async () => {
		answer = () => json({ error: "member_spend_cap_reached" }, { status: 429 });
		await expect(searchWeb("designer", { userId: "user" })).rejects.toMatchObject({ reason: "budget" });
		expect(calls).toHaveLength(1);
		expect(fixtures.events).toHaveBeenCalledWith(expect.objectContaining({ kind: "web-search", outcome: "budget" }));
	});

	it("is unavailable without a treg token", async () => {
		delete fixtures.env.TREG_API_KEY;
		await expect(searchWeb("designer", { userId: "user" })).rejects.toMatchObject({ reason: "unavailable" });
		expect(calls).toHaveLength(0);
	});

	it(`allows ${WEB_SEARCHES_PER_DAY} searches per person per day`, async () => {
		for (let index = 0; index < WEB_SEARCHES_PER_DAY; index++) await searchWeb("designer", { userId: "user" });
		await expect(searchWeb("designer", { userId: "user" })).rejects.toMatchObject({ reason: "rate-limit" });
		expect(calls).toHaveLength(WEB_SEARCHES_PER_DAY);
	});

	it.each(["", " ", "x".repeat(513)])("refuses the query %j", async (query) => {
		await expect(searchWeb(query, { userId: "user" })).rejects.toMatchObject({ reason: "malformed" });
		expect(calls).toHaveLength(0);
	});
});
