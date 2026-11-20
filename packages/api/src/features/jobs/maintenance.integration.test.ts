import type { ProviderListing } from "./providers";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import jobspipeSearch from "./__fixtures__/jobspipe-search.json";
import { fakeListing } from "./test-helpers";

/**
 * The daily listing upkeep against a real database (`02-teknis.md` sections 10 and 19). treg is the boundary: its
 * answers come from a fake `fetch`, shaped like the catalog's examples, and nothing calls it.
 */

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	budgetUsd: 1,
}));
vi.mock("@rezumi/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
vi.mock("@rezumi/env/server", async () => {
	const actual = await vi.importActual<typeof import("@rezumi/env/server")>("@rezumi/env/server");
	return {
		...actual,
		env: {
			...actual.env,
			TREG_API_KEY: "test-only-treg-token",
			get JOB_SEARCH_DAILY_BUDGET_USD() {
				return fixture.budgetUsd;
			},
		},
	};
});
vi.mock("./counters", async () => {
	const actual = await vi.importActual<typeof import("./counters")>("./counters");
	return { ...actual, jobCounters: actual.memoryCounters() };
});

const databaseUrl = process.env.INTEGRATIONS_TEST_DATABASE_URL ?? process.env.COVER_LETTER_TEST_DATABASE_URL;

/** A value the test set up, or a failure saying it's missing. */
function must<T>(value: T | null | undefined): T {
	if (value === null || value === undefined) throw new Error("Expected the test's setup to have stored this.");
	return value;
}

const DAY = 24 * 60 * 60 * 1000;
/** 20:00 UTC, after the upkeep's hour. */
const NIGHT = new Date("2026-11-20T20:00:00.000Z");
const ago = (days: number, from = NIGHT) => new Date(from.getTime() - days * DAY);

type Route = (url: URL, body: unknown) => { status?: number; body: unknown; costMicro?: number };

/** A `fetch` that answers treg calls by tool, and records them. */
function fakeTreg(routes: Record<string, Route>) {
	const calls: { tool: string; url: URL; body: unknown }[] = [];
	const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
		const tool = decodeURIComponent(url.pathname.replace("/call/", ""));
		const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
		calls.push({ tool, url, body });
		const route = routes[tool];
		if (!route) return new Response(JSON.stringify({ error: "unknown_tool" }), { status: 404 });
		const answer = route(url, body);
		return new Response(JSON.stringify(answer.body), {
			status: answer.status ?? 200,
			headers: { "content-type": "application/json", "x-treg-cost-micro": String(answer.costMicro ?? 0) },
		});
	}) as typeof globalThis.fetch;
	return { fetch, calls };
}

/** Hirebase's closed-jobs feed: these ids, `pageSize` a page. */
const closedFeed =
	(ids: string[], pageSize = 1000): Route =>
	(url) => {
		const page = Number(url.searchParams.get("page") ?? 1);
		const jobs = ids
			.slice((page - 1) * pageSize, page * pageSize)
			.map((id) => ({ _id: id, company_slug: "acme", job_slug: "job", date_expired: "2026-11-20" }));
		return {
			body: {
				jobs,
				total_count: ids.length,
				page,
				limit: pageSize,
				total_pages: Math.max(1, Math.ceil(ids.length / pageSize)),
			},
		};
	};

/** A JobsPipe job as `jobspipe.jobs.detail` answers it, from the catalog's example. */
const jobspipeJob = (id: string, status: "active" | "closed") => ({
	...jobspipeSearch.data[0],
	id,
	url: `https://www.indeed.com/viewjob?jk=${id}`,
	status,
	closed_at: status === "closed" ? "2026-11-19T08:00:00+00:00" : null,
});

describe.skipIf(!databaseUrl)("daily job listing upkeep", () => {
	let run: typeof import("./maintenance").runJobListingJobs;
	let upsert: typeof import("./store").upsertListings;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `job_upkeep_test_${randomUUID().replaceAll("-", "")}`;
	const db = () => {
		if (!fixture.db) throw new Error("Test database is not initialized.");
		return fixture.db;
	};

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({
			connectionString: databaseUrl,
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
		({ runJobListingJobs: run } = await import("./maintenance"));
		({ upsertListings: upsert } = await import("./store"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.budgetUsd = 1;
		await pool.query('TRUNCATE "user", job_listing, job_search_cache, job_maintenance CASCADE');
		await db().insert(tables.user).values({
			id: "alice",
			name: "Alice Example",
			email: "alice@example.test",
			username: "alice",
			displayUsername: "alice",
			emailVerified: true,
		});
	});

	/** Stores listings as a search would have, seen `seenDaysAgo` days before tonight. */
	async function store(items: ProviderListing[], seenDaysAgo = 1) {
		return upsert(items, ago(seenDaysAgo));
	}

	async function track(listingId: string, id: string, status: "saved" | "applied" = "saved") {
		await db()
			.insert(tables.application)
			.values({ id, userId: "alice", company: "ACME", role: `Role ${id}`, status, jobListingId: listingId });
	}

	const listingRow = async (id: string) =>
		(await db().select().from(tables.jobListing).where(eq(tables.jobListing.id, id)))[0];
	const notices = () => db().select().from(tables.careerNotification);

	it("waits for its hour, then marks closed jobs, tells people once, and removes the listings", async () => {
		const [open, gone, applied] = await store([
			fakeListing("hirebase", 1),
			fakeListing("hirebase", 2),
			fakeListing("hirebase", 3),
		]);
		await track(must(gone).id, "app-saved");
		await track(must(applied).id, "app-applied", "applied");
		const treg = fakeTreg({ "hirebase.jobs.expired": closedFeed(["hirebase-2", "hirebase-3", "not-ours"]) });

		const early = await run({ now: new Date("2026-11-20T18:59:00.000Z"), treg });
		expect(early.ran).toBe(false);
		expect(treg.calls).toHaveLength(0);

		const result = await run({ now: NIGHT, treg });
		expect(result).toMatchObject({ ran: true, completed: true, closed: 2, marked: 2 });
		expect(result.removed.closedListings).toBe(2);
		// Read from yesterday, the first run having nothing earlier to start from; free and never from treg's archive.
		expect(treg.calls[0]?.url.searchParams.get("since")).toBe("2026-11-19");
		expect(await listingRow(must(open).id)).toBeDefined();
		expect(await listingRow(must(gone).id)).toBeUndefined();

		const apps = await db()
			.select({ id: tables.application.id, closedAt: tables.application.postingClosedAt })
			.from(tables.application);
		expect(apps.every((app) => app.closedAt?.getTime() === NIGHT.getTime())).toBe(true);
		// Only the one not applied to yet hears about it.
		expect((await notices()).map((row) => [row.applicationId, row.notice])).toEqual([
			["app-saved", { type: "posting-closed", company: "ACME", role: "Role app-saved" }],
		]);

		// Done for the day: another tick does nothing, and tomorrow's run starts the feed from today.
		expect((await run({ now: new Date(NIGHT.getTime() + 60_000), treg })).ran).toBe(false);
		const tomorrow = new Date(NIGHT.getTime() + DAY);
		await run({ now: tomorrow, treg });
		expect(treg.calls.at(-1)?.url.searchParams.get("since")).toBe("2026-11-20");
		expect(await notices()).toHaveLength(1);
	});

	it("reads a long feed over several ticks, one lease at a time", async () => {
		const ids = Array.from({ length: 2500 }, (_, index) => `hirebase-${index + 1}`);
		await store([fakeListing("hirebase", 1), fakeListing("hirebase", 2400)]);
		const treg = fakeTreg({ "hirebase.jobs.expired": closedFeed(ids) });
		let now = 0;
		// Each look at the clock is a second later: a 1.5 s budget reads one page a tick.
		const options = { now: NIGHT, treg, clock: () => (now += 1000), tickBudgetMs: 1500 };

		const first = await run(options);
		expect(first).toMatchObject({ ran: true, completed: false, closed: 1 });
		const [state] = await db().select().from(tables.jobMaintenance);
		expect(state).toMatchObject({ nextPage: 2, closed: 1, leaseUntil: null });

		expect(await run(options)).toMatchObject({ completed: false, closed: 0 });
		expect(await run(options)).toMatchObject({ completed: true, closed: 1 });
		expect(treg.calls.map((call) => call.url.searchParams.get("page"))).toEqual(["1", "2", "3"]);
	});

	it("leaves a run another tick holds, and goes on from the same page after the feed fails", async () => {
		await store([fakeListing("hirebase", 1)]);
		let failing = true;
		const treg = fakeTreg({
			"hirebase.jobs.expired": (url, body) =>
				failing ? { status: 500, body: { error: "upstream_error" } } : closedFeed(["hirebase-1"])(url, body),
		});
		expect(await run({ now: NIGHT, treg })).toMatchObject({ ran: true, completed: false });
		await db()
			.update(tables.jobMaintenance)
			.set({ leaseUntil: new Date(NIGHT.getTime() + 60_000) });
		expect((await run({ now: NIGHT, treg })).ran).toBe(false);

		failing = false;
		const later = new Date(NIGHT.getTime() + 120_000);
		expect(await run({ now: later, treg })).toMatchObject({ completed: true, closed: 1 });
	});

	it("looks up JobsPipe listings people use, within the budget, and marks the closed ones", async () => {
		const [used, idle, fresh] = await store(
			[
				fakeListing("jobspipe", 1, { externalId: "jp-used", closedAt: null }),
				fakeListing("jobspipe", 2, { externalId: "jp-idle", closedAt: null }),
				fakeListing("jobspipe", 3, { externalId: "jp-fresh", closedAt: null }),
			],
			5,
		);
		await track(must(used).id, "app-used");
		await db()
			.insert(tables.careerOpportunity)
			.values({ userId: "alice", url: "https://example.test/fresh", snippet: "", listingId: must(fresh).id });
		await db()
			.update(tables.jobListing)
			.set({ lastVerifiedAt: NIGHT })
			.where(eq(tables.jobListing.id, must(fresh).id));
		const treg = fakeTreg({
			"hirebase.jobs.expired": closedFeed([]),
			"jobspipe.jobs.detail": (_url, body) => ({
				body: {
					data: (body as { job_id_or: string[] }).job_id_or.map((id) => jobspipeJob(id, "closed")),
					metadata: {},
				},
				costMicro: 0,
			}),
		});

		const result = await run({ now: NIGHT, treg });
		expect(result).toMatchObject({ completed: true, checked: 1, marked: 1 });
		// Only the tracked one, checked three or more days ago; one nobody uses isn't paid for.
		const detail = treg.calls.filter((call) => call.tool === "jobspipe.jobs.detail");
		expect(detail.map((call) => call.body)).toEqual([{ job_id_or: ["jp-used"], status: "any", limit: 1 }]);
		expect(await listingRow(must(used).id)).toBeUndefined();
		expect(await listingRow(must(idle).id)).toBeDefined();
		expect((await notices())[0]?.notice).toEqual({ type: "posting-closed", company: "ACME", role: "Role app-used" });
	});

	it("moves JobsPipe ids it doesn't answer to the back of the queue", async () => {
		const [gone] = await store([fakeListing("jobspipe", 1, { externalId: "jp-gone", closedAt: null })], 5);
		await track(must(gone).id, "app-gone");
		const treg = fakeTreg({
			"hirebase.jobs.expired": closedFeed([]),
			"jobspipe.jobs.detail": () => ({ body: { data: [], metadata: {} }, costMicro: 0 }),
		});
		expect(await run({ now: NIGHT, treg })).toMatchObject({ completed: true, checked: 0 });
		const row = await listingRow(must(gone).id);
		expect(row?.lastVerifiedAt).toEqual(NIGHT);
		expect(row?.closedAt).toBeNull();
	});

	it("dismisses roles no alert found again for 30 days, so their listings can go", async () => {
		const [listing] = await store([fakeListing("hirebase", 8)], 31);
		await db()
			.insert(tables.careerOpportunity)
			.values({
				userId: "alice",
				url: "https://example.test/8",
				snippet: "",
				listingId: must(listing).id,
				lastSeenAt: ago(31),
			});
		const result = await run({ now: NIGHT, treg: fakeTreg({ "hirebase.jobs.expired": closedFeed([]) }) });
		expect(result.removed.unusedListings).toBe(1);
		const [role] = await db().select().from(tables.careerOpportunity);
		expect(role?.dismissedAt).not.toBeNull();
	});

	it("skips JobsPipe lookups once the day's budget is spent", async () => {
		fixture.budgetUsd = 0;
		const [used] = await store([fakeListing("jobspipe", 1, { externalId: "jp-used", closedAt: null })], 5);
		await track(must(used).id, "app-used");
		const treg = fakeTreg({ "hirebase.jobs.expired": closedFeed([]) });
		expect(await run({ now: NIGHT, treg })).toMatchObject({ completed: true, checked: 0 });
		expect(treg.calls.map((call) => call.tool)).toEqual(["hirebase.jobs.expired"]);
	});

	it("removes old search answers and listings nothing uses, and keeps the ones in use", async () => {
		const [stale, opportunity, application, recent] = await store(
			[fakeListing("hirebase", 1), fakeListing("hirebase", 2), fakeListing("hirebase", 3), fakeListing("hirebase", 4)],
			31,
		);
		await db()
			.update(tables.jobListing)
			.set({ lastSeenAt: ago(2) })
			.where(eq(tables.jobListing.id, must(recent).id));
		await db()
			.insert(tables.careerOpportunity)
			.values({ userId: "alice", url: "https://example.test/2", snippet: "", listingId: must(opportunity).id });
		await track(must(application).id, "app-open");
		const cache = (key: string, expiresAt: Date) => ({
			key,
			providers: ["hirebase" as const],
			query: {},
			listingIds: [must(stale).id],
			fetchedAt: ago(1, expiresAt),
			expiresAt,
		});
		await db()
			.insert(tables.jobSearchCache)
			.values([cache("a".repeat(64), ago(2)), cache("b".repeat(64), ago(0.5))]);

		const result = await run({ now: NIGHT, treg: fakeTreg({ "hirebase.jobs.expired": closedFeed([]) }) });
		expect(result.removed).toEqual({ closedListings: 0, searches: 1, unusedListings: 1 });
		const left = await db()
			.select({ id: tables.jobListing.id })
			.from(tables.jobListing)
			.where(
				inArray(tables.jobListing.id, [must(stale).id, must(opportunity).id, must(application).id, must(recent).id]),
			);
		expect(left.map((row) => row.id).sort()).toEqual(
			[must(opportunity).id, must(application).id, must(recent).id].sort(),
		);
		expect((await db().select().from(tables.jobSearchCache)).map((row) => row.key)).toEqual(["b".repeat(64)]);
	});

	it("dismisses a role whose listing closed, so it doesn't come back once the listing goes", async () => {
		const [listing] = await store([fakeListing("hirebase", 7)]);
		await db()
			.insert(tables.careerOpportunity)
			.values({ userId: "alice", url: "https://example.test/7", snippet: "", listingId: must(listing).id });
		await run({ now: NIGHT, treg: fakeTreg({ "hirebase.jobs.expired": closedFeed(["hirebase-7"]) }) });
		const [role] = await db().select().from(tables.careerOpportunity);
		expect(role?.dismissedAt).not.toBeNull();
		expect(role?.listingId).toBeNull();
	});

	it("still cleans up without a treg token", async () => {
		const [old] = await store([fakeListing("hirebase", 1)], 40);
		const treg = fakeTreg({});
		const result = await run({ now: NIGHT, treg, configured: () => false });
		expect(result).toMatchObject({ completed: true, closed: 0, checked: 0 });
		expect(treg.calls).toHaveLength(0);
		expect(await listingRow(must(old).id)).toBeUndefined();
	});
});
