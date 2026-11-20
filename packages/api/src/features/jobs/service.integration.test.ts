import type { JobSearchDependencies } from "./service";
import type { FakePage } from "./test-helpers";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { jobSearchRequestSchema } from "@rezumi/schema/jobs/search";
import { fakeSource, listings } from "./test-helpers";
import { TregError } from "./treg";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	env: {
		BILLING_MODE: "off",
		JOB_SEARCH_DAILY_BUDGET_USD: 1,
		FLAG_DISABLE_API_RATE_LIMIT: true,
		FLAG_DISABLE_JOB_SEARCH: false,
		DEPLOYMENT_NAMESPACE: "test",
	} as Record<string, unknown>,
}));
vi.mock("@rezumi/env/server", () => ({ env: fixture.env }));
vi.mock("@rezumi/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));

const databaseUrl = process.env.INTEGRATIONS_TEST_DATABASE_URL;

// Opt in with a disposable PostgreSQL database. Each run owns and removes a separate schema.
describe.skipIf(!databaseUrl)("job search service", () => {
	let service: typeof import("./service");
	let counters: typeof import("./counters");
	let pool: Pool;
	let admin: Pool;
	const schemaName = `jobs_search_test_${randomUUID().replaceAll("-", "")}`;
	let clock: Date;

	const request = (value: Record<string, unknown>) => jobSearchRequestSchema.parse(value);

	/** A service with fake providers, its own counters and a clock the test moves. */
	function setup(
		hirebasePages: FakePage[],
		jobspipePages: FakePage[] = [],
		options: { delayMs?: number; overrides?: Partial<JobSearchDependencies> } = {},
	) {
		const hirebase = fakeSource("hirebase", hirebasePages, options);
		const jobspipe = fakeSource("jobspipe", jobspipePages, options);
		const jobs = service.createJobSearchService({
			sources: { hirebase: hirebase.adapter, jobspipe: jobspipe.adapter },
			counters: counters.memoryCounters(() => clock.getTime()),
			now: () => clock,
			wait: (ms) => new Promise((resolve) => setTimeout(resolve, Math.min(ms, 20))),
			configured: () => true,
			switchedOff: () => fixture.env.FLAG_DISABLE_JOB_SEARCH === true,
			...options.overrides,
		});
		return { jobs, hirebase, jobspipe };
	}

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({
			connectionString: databaseUrl,
			max: 10,
			options: `-c search_path=${schemaName} -c statement_timeout=10000`,
		});
		fixture.db = drizzle({ client: pool });
		const migrations = new URL("../../../../../migrations/", import.meta.url);
		const directories = (await readdir(migrations, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
			.map((entry) => entry.name)
			.sort();
		for (const directory of directories) {
			const file = new URL(`${directory}/migration.sql`, migrations);
			if (existsSync(file)) await pool.query((await readFile(file, "utf8")).replaceAll('"public".', ""));
		}
		for (const id of ["alice", "bob", "carol"])
			await pool.query(
				`INSERT INTO "user" (id, name, email, username, display_username, timezone) VALUES ($1, $1, $2, $1, $1, $3)`,
				[id, `${id}@example.com`, id === "carol" ? "Asia/Jakarta" : "UTC"],
			);
		service = await import("./service");
		counters = await import("./counters");
	}, 60_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		clock = new Date("2026-11-20T10:00:00Z");
		Object.assign(fixture.env, { BILLING_MODE: "off", JOB_SEARCH_DAILY_BUDGET_USD: 1, FLAG_DISABLE_JOB_SEARCH: false });
		await pool.query("DELETE FROM job_search_cache; DELETE FROM job_listing_hidden; DELETE FROM job_listing;");
	});

	it("asks the providers once, then answers the same search from the cache for free", async () => {
		const { jobs, hirebase } = setup([listings("hirebase", 20), listings("hirebase", 20, 21)]);
		const first = await jobs.search("alice", request({ query: "Data Analyst", country: "DE" }));
		expect(first).toMatchObject({ fromCache: false, stale: false, budgetLimited: false });
		expect(first.listings).toHaveLength(20);
		expect(first.listings[0]).not.toHaveProperty("description");
		expect(first.listings[0]?.postingUrl).toBe("https://jobs.example.com/hirebase/1");
		expect(first.cursor).toMatch(/^[a-f0-9]{64}$/);
		expect(first.quota).toEqual({ used: 1, max: 40, resetsAt: "2026-11-21T00:00:00.000Z" });

		const second = await jobs.search("bob", request({ query: "  data   ANALYST ", country: "DE" }));
		expect(second.fromCache).toBe(true);
		expect(second.listings.map((listing) => listing.id)).toEqual(first.listings.map((listing) => listing.id));
		expect(second.fetchedAt).toBe(first.fetchedAt);
		expect(hirebase.calls).toHaveLength(1);
	});

	it("doesn't count opening the same page again the same day", async () => {
		const { jobs } = setup([listings("hirebase", 20)]);
		await jobs.search("alice", request({ query: "nurse" }));
		const again = await jobs.search("alice", request({ query: "Nurse" }));
		expect(again.quota.used).toBe(1);
		expect((await jobs.status("alice")).quota.used).toBe(1);
	});

	it("lets one of two simultaneous searches ask the providers, and the other wait for its answer", async () => {
		const { jobs, hirebase } = setup([listings("hirebase", 20)], [], { delayMs: 150 });
		const [first, second] = await Promise.all([
			jobs.search("alice", request({ query: "devops", country: "US" })),
			jobs.search("bob", request({ query: "devops", country: "US" })),
		]);
		expect(hirebase.calls).toHaveLength(1);
		expect([first.fromCache, second.fromCache].toSorted()).toEqual([false, true]);
		expect(second.listings.map((listing) => listing.id)).toEqual(first.listings.map((listing) => listing.id));
	});

	it("refuses the search after the plan's last one today, and allows it again tomorrow", async () => {
		fixture.env.BILLING_MODE = "on";
		const { jobs } = setup([listings("hirebase", 20)]);
		for (const query of ["one", "two", "three"]) await jobs.search("alice", request({ query }));
		await expect(jobs.search("alice", request({ query: "four" }))).rejects.toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			data: { limit: "jobSearchesPerDay", max: 3, used: 3, planId: "free" },
		});
		// A page already opened today still opens.
		expect((await jobs.search("alice", request({ query: "two" }))).quota).toMatchObject({ used: 3, max: 3 });
		clock = new Date("2026-11-21T00:00:01Z");
		expect((await jobs.search("alice", request({ query: "four" }))).quota.used).toBe(1);
	});

	it("starts the day at midnight in the account's time zone", async () => {
		const { jobs } = setup([listings("hirebase", 20)]);
		// 18:00 UTC is already the 21st in Jakarta (UTC+7).
		clock = new Date("2026-11-20T18:00:00Z");
		expect((await jobs.status("carol")).quota.resetsAt).toBe("2026-11-21T17:00:00.000Z");
	});

	it("never shows hidden or closed listings", async () => {
		const { jobs } = setup([listings("hirebase", 20)]);
		const first = await jobs.search("alice", request({ query: "teacher" }));
		const [hidden, closed] = first.listings;
		expect(await jobs.hide("alice", hidden?.id ?? "", true)).toBe(true);
		await pool.query("UPDATE job_listing SET closed_at = now() WHERE id = $1", [closed?.id]);

		const again = await jobs.search("alice", request({ query: "teacher" }));
		const ids = again.listings.map((listing) => listing.id);
		expect(ids).toHaveLength(18);
		expect(ids).not.toContain(hidden?.id);
		expect(ids).not.toContain(closed?.id);
		// Someone else still sees the hidden one.
		expect((await jobs.search("bob", request({ query: "teacher" }))).listings.map((l) => l.id)).toContain(hidden?.id);

		expect(await jobs.hide("alice", hidden?.id ?? "", false)).toBe(true);
		expect((await jobs.search("alice", request({ query: "teacher" }))).listings).toHaveLength(19);
		expect(await jobs.hide("alice", "missing", true)).toBe(false);
	});

	it("continues with the next page from each provider's cursor, leaving out what the first page showed", async () => {
		const { jobs, hirebase } = setup([listings("hirebase", 20), listings("hirebase", 20, 21)]);
		const first = await jobs.search("alice", request({ query: "accountant" }));
		const second = await jobs.search("alice", request({ query: "accountant", cursor: first.cursor }));
		expect(hirebase.calls.map((call) => call.input.cursor)).toEqual([undefined, "2"]);
		expect(second.listings[0]?.externalId).toBe("hirebase-21");
		expect(second.quota.used).toBe(2);
		// Hirebase has no third page and JobsPipe hasn't been asked: it can still add more.
		expect(second.cursor).toBeDefined();

		await expect(
			jobs.search("alice", request({ query: "something else", cursor: first.cursor })),
		).rejects.toMatchObject({ code: "cursor" });
		await expect(jobs.search("alice", request({ query: "accountant", cursor: "0".repeat(64) }))).rejects.toMatchObject({
			code: "cursor",
		});
	});

	it("gives the older answer with a flag once today's budget is spent, and refuses a new search", async () => {
		const { jobs, hirebase } = setup([listings("hirebase", 20)]);
		await jobs.search("alice", request({ query: "sales" }));
		// The first search cost 20,000 millionths of a dollar; the budget is lowered below that.
		fixture.env.JOB_SEARCH_DAILY_BUDGET_USD = 0.01;
		clock = new Date(clock.getTime() + 7 * 60 * 60 * 1000);

		const stale = await jobs.search("bob", request({ query: "sales" }));
		expect(stale).toMatchObject({ fromCache: true, stale: true, budgetLimited: true });
		expect(stale.listings).toHaveLength(20);
		await expect(jobs.search("bob", request({ query: "marketing" }))).rejects.toMatchObject({ code: "budget" });
		expect(hirebase.calls).toHaveLength(1);
		expect((await jobs.status("bob")).cacheOnly).toBe(true);
	});

	it("emails the owner once when spending passes 80% of the day's budget", async () => {
		await pool.query("DELETE FROM billing_notification");
		// One search costs 20,000 millionths of a dollar: the first crosses 80% of $0.024, the second adds to it.
		fixture.env.JOB_SEARCH_DAILY_BUDGET_USD = 0.024;
		const { jobs } = setup([listings("hirebase", 20), listings("hirebase", 20)]);
		await jobs.search("alice", request({ query: "nurse" }));
		const { rows } = await pool.query<{ kind: string; count: number }>(
			"SELECT kind, count FROM billing_notification WHERE kind = 'job_search_budget'",
		);
		expect(rows).toEqual([{ kind: "job_search_budget", count: 1 }]);
		fixture.env.JOB_SEARCH_DAILY_BUDGET_USD = 1;
		await jobs.search("alice", request({ query: "teacher" }));
		const again = await pool.query("SELECT count FROM billing_notification WHERE kind = 'job_search_budget'");
		expect(again.rows).toEqual([{ count: 1 }]);
	});

	it("reports stored listings, cached pages and the treg figures on the cost dashboard", async () => {
		const { jobs } = setup([listings("hirebase", 20)]);
		await jobs.search("alice", request({ query: "pilot" }));
		const { jobCostReport } = await import("./admin");
		const report = await jobCostReport(
			{ days: 7, now: clock },
			{ sql: undefined, treg: async () => "unavailable" as const },
		);
		expect(report).toMatchObject({
			days: 7,
			today: { day: "2026-11-20", budgetMicro: 1_000_000, available: false, switchedOff: false },
			treg: { status: "unavailable" },
			events: { status: "not-configured" },
			store: { openListings: 20, closedListings: 0, cachePages: 1, freshCachePages: 1 },
		});
	});

	it("gives the older answer when the providers fail, and an error when there is none", async () => {
		const failing: FakePage[] = [new TregError("busy")];
		const { jobs } = setup([listings("hirebase", 20)]);
		await jobs.search("alice", request({ query: "python" }));
		clock = new Date(clock.getTime() + 7 * 60 * 60 * 1000);
		const broken = setup(failing, failing);
		const stale = await broken.jobs.search("bob", request({ query: "python" }));
		expect(stale).toMatchObject({ fromCache: true, stale: true, budgetLimited: false });
		await expect(broken.jobs.search("bob", request({ query: "react" }))).rejects.toMatchObject({
			code: "unavailable",
		});
	});

	it("only answers from the cache while searching is switched off, and not at all without a token", async () => {
		const { jobs, hirebase } = setup([listings("hirebase", 20)]);
		fixture.env.FLAG_DISABLE_JOB_SEARCH = true;
		await expect(jobs.search("alice", request({ query: "ux designer" }))).rejects.toMatchObject({
			code: "unavailable",
		});
		expect(hirebase.calls).toHaveLength(0);
		expect((await jobs.status("alice")).cacheOnly).toBe(true);

		const unconfigured = setup([listings("hirebase", 20)], [], { overrides: { configured: () => false } });
		await expect(unconfigured.jobs.search("alice", request({ query: "ux designer" }))).rejects.toMatchObject({
			code: "unavailable",
		});
		expect((await unconfigured.jobs.status("alice")).available).toBe(false);
	});

	it("doesn't count a search that failed", async () => {
		const { jobs } = setup([new TregError("busy")], [new TregError("busy")]);
		await expect(jobs.search("alice", request({ query: "graphic designer" }))).rejects.toMatchObject({
			code: "unavailable",
		});
		expect((await jobs.status("alice")).quota.used).toBe(0);
	});
});
