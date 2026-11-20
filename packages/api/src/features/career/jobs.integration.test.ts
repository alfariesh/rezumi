import type { ProviderListing, ProviderSearchOptions, ProviderSearchResult } from "../jobs/providers";
import type { JobSearchInput } from "@rezumi/schema/jobs/search";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { careerScheduleInputSchema } from "@rezumi/schema/career";
import { fakeListing } from "../jobs/test-helpers";

type SourceCall = (input: JobSearchInput, options: ProviderSearchOptions) => Promise<ProviderSearchResult>;

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	// The job providers are the boundary: what treg would answer, without calling it.
	hirebase: vi.fn<SourceCall>(),
	jobspipeSearch: vi.fn<SourceCall>(),
	jobspipeNew:
		vi.fn<(input: JobSearchInput, delta: string, options: ProviderSearchOptions) => Promise<ProviderSearchResult>>(),
	email: vi.fn<typeof import("@rezumi/email/transport").sendCareerNotification>(),
	generate: vi.fn<typeof import("./generate").generateCareer>(),
	env: {
		CRON_SECRET: undefined as string | undefined,
		BILLING_MODE: "off" as "off" | "on",
		JOB_SEARCH_DAILY_BUDGET_USD: 1,
	},
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
			APP_URL: "http://localhost:3000",
			CLOUDFLARE: false,
			get CRON_SECRET() {
				return fixture.env.CRON_SECRET;
			},
			get BILLING_MODE() {
				return fixture.env.BILLING_MODE;
			},
			get JOB_SEARCH_DAILY_BUDGET_USD() {
				return fixture.env.JOB_SEARCH_DAILY_BUDGET_USD;
			},
			TREG_API_KEY: "test-only-treg-token",
			FLAG_DISABLE_JOB_SEARCH: false,
			SMTP_HOST: undefined,
			SMTP_USER: undefined,
			SMTP_PASS: undefined,
			SMTP_FROM: undefined,
		},
	};
});
vi.mock("../jobs/providers", () => ({
	JOB_SOURCES: {
		hirebase: {
			provider: "hirebase",
			pricePerListingUsd: 0.0015,
			search: (...args: Parameters<SourceCall>) => fixture.hirebase(...args),
			count: async () => undefined,
		},
		jobspipe: {
			provider: "jobspipe",
			pricePerListingUsd: 0.00392,
			search: (...args: Parameters<SourceCall>) => fixture.jobspipeSearch(...args),
			newListings: (input: JobSearchInput, delta: string, options: ProviderSearchOptions) =>
				fixture.jobspipeNew(input, delta, options),
			count: async () => undefined,
		},
	},
}));
// Budget and quota totals in this process, as on a server without Redis.
vi.mock("../jobs/counters", async () => {
	const actual = await vi.importActual<typeof import("../jobs/counters")>("../jobs/counters");
	return { ...actual, jobCounters: actual.memoryCounters() };
});
vi.mock("@rezumi/email/transport", () => ({ sendCareerNotification: fixture.email }));
// No live AI: the briefing writer is the boundary; the provider check only has to find the connection.
vi.mock("./generate", () => ({ generateCareer: fixture.generate }));
// The user's own connection; plans don't apply, so Rezumi AI never comes into it.
vi.mock("../ai-providers/service", () => ({
	aiProvidersService: { getRunnableById: async () => ({}), isManagedId: () => false, offersChoice: async () => false },
}));

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.INTEGRATIONS_TEST_DATABASE_URL ?? process.env.COVER_LETTER_TEST_DATABASE_URL;
/** A provider answer with these listings, at Hirebase's price. */
const answer = (
	provider: "hirebase" | "jobspipe",
	listings: ProviderListing[],
	extra: Partial<ProviderSearchResult> = {},
) => ({
	provider,
	listings,
	cursor: undefined,
	total: undefined,
	costMicro: listings.length * 1_500,
	ms: 5,
	dropped: 0,
	...extra,
});
const role = (index: number, overrides: Partial<ProviderListing> = {}) =>
	fakeListing("hirebase", index, {
		title: `Reliability engineer ${index}`,
		company: { name: "ACME" },
		postingUrl: `https://example.test/jobs/${index}?utm_source=search`,
		description: "Maintain reliable services.",
		...overrides,
	});
/** Enough fitting jobs from Hirebase that JobsPipe isn't asked. */
const plenty = () => Array.from({ length: 12 }, (_, index) => role(index + 1));

describe.skipIf(!databaseUrl)("durable career scheduling", () => {
	let jobs: typeof import("./jobs").careerJobs;
	let run: typeof import("./jobs").runCareerJobs;
	let runNext: typeof import("./jobs").runNextCareerJob;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `career_jobs_test_${randomUUID().replaceAll("-", "")}`;

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
		({ careerJobs: jobs, runCareerJobs: run, runNextCareerJob: runNext } = await import("./jobs"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		vi.stubEnv("VERCEL", "");
		fixture.env.CRON_SECRET = undefined;
		fixture.env.BILLING_MODE = "off";
		fixture.env.JOB_SEARCH_DAILY_BUDGET_USD = 1;
		fixture.hirebase.mockReset().mockResolvedValue(answer("hirebase", plenty()));
		fixture.jobspipeSearch.mockReset().mockResolvedValue(answer("jobspipe", []));
		fixture.jobspipeNew.mockReset().mockResolvedValue(answer("jobspipe", []));
		fixture.email.mockReset().mockResolvedValue(true);
		fixture.generate.mockReset().mockResolvedValue({ item: null, answer: null });
		await pool.query('TRUNCATE "user", job_listing CASCADE');
		await getDb().insert(tables.user).values({
			id: "alice",
			name: "Alice Example",
			email: "alice@example.test",
			username: "alice",
			displayUsername: "alice",
			emailVerified: true,
		});
	});

	const due = () => new Date(Date.now() - 60_000);
	afterEach(() => vi.unstubAllEnvs());
	const expired = () => new Date(Date.now() - 3_600_000);
	async function schedule(applicationId: string | null = null) {
		return jobs.save(
			"alice",
			careerScheduleInputSchema.parse({
				applicationId,
				kind: "discovery",
				query: "Reliability engineer",
				enabled: true,
				timezone: "Europe/Berlin",
				nextRunAt: due(),
				intervalDays: 1,
			}),
		);
	}

	const interview = (at: Date) => ({
		id: "interview-round",
		type: "interview" as const,
		at,
		kind: "technical" as const,
		durationMinutes: 45,
		location: "Video",
		notes: "",
		audience: "practitioner" as const,
		participants: [],
		timezone: "Europe/Berlin",
	});
	async function interviewApplication(at: Date) {
		await getDb()
			.insert(tables.application)
			.values({
				id: "alice-app",
				userId: "alice",
				company: "ACME",
				role: "Engineer",
				activity: [{ id: "saved-stage", type: "stage", stage: "saved", at: expired() }, interview(at)],
			});
		await getDb().insert(tables.aiProvider).values({
			id: "preparation-provider",
			userId: "alice",
			label: "Synthetic provider",
			provider: "openai",
			model: "fixture-model",
			encryptedApiKey: "synthetic-key",
			apiKeySalt: "synthetic-salt",
			apiKeyHash: "synthetic-hash",
			apiKeyPreview: "synthetic-preview",
		});
	}

	it("requires Vercel's native cron token before enabling work, while allowing pause", async () => {
		const native = await schedule();
		vi.stubEnv("VERCEL", "1");
		await expect(schedule()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
		await expect(
			jobs.save("alice", {
				...careerScheduleInputSchema.parse({ ...native, enabled: false }),
				id: native.id,
			}),
		).resolves.toMatchObject({ enabled: false });
		fixture.env.CRON_SECRET = "synthetic-vercel-cron-secret-32-characters";
		await expect(schedule()).resolves.toMatchObject({ enabled: true });
	});

	it("two overlapping ticks publish only one result and notification for a due search", async () => {
		await schedule();
		const started = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		fixture.hirebase.mockImplementationOnce(async () => {
			started.resolve();
			await release.promise;
			return answer("hirebase", [role(1), role(1, { externalId: "hirebase-1-copy" })]);
		});
		const first = run();
		await Promise.race([
			started.promise,
			first.then(() => {
				throw new Error("Runner completed without starting discovery.");
			}),
		]);
		try {
			await run();
		} finally {
			release.resolve();
			await first;
		}
		await run();
		expect(fixture.hirebase).toHaveBeenCalledTimes(1);
		expect(await jobs.opportunities("alice")).toMatchObject([
			{ url: "https://example.test/jobs/1", role: "Reliability engineer 1", company: "ACME" },
		]);
		expect(await jobs.notifications("alice")).toHaveLength(1);
		expect(await getDb().select().from(tables.application)).toEqual([]);
		expect(await getDb().select().from(tables.careerArtifact)).toEqual([]);
	});

	it("with a dispatcher, a tick only queues the waiting account, and one queued run does the job", async () => {
		await schedule();
		const dispatch = vi.fn(async (_count: number) => {});
		await expect(run({ dispatch })).resolves.toEqual({ processed: 0 });
		expect(dispatch).toHaveBeenCalledWith(1);
		expect(fixture.hirebase).not.toHaveBeenCalled();

		await expect(runNext()).resolves.toBe("alice");
		await expect(runNext()).resolves.toBeNull();
		expect(fixture.hirebase).toHaveBeenCalledOnce();
		expect(await jobs.notifications("alice")).toHaveLength(1);

		dispatch.mockClear();
		await run({ dispatch });
		expect(dispatch).not.toHaveBeenCalled();
	});

	it("offers new listings as roles, and a later run with nothing new adds nothing and moves on", async () => {
		const saved = await schedule();
		const before = Date.now();
		await run();
		const [first] = fixture.hirebase.mock.calls;
		expect(first?.[0]).toMatchObject({ query: "Reliability engineer" });
		expect(first?.[1]).toMatchObject({ kind: "discovery", fresh: true, limit: 20 });
		// The first check reaches one interval (a day) back.
		expect(Date.parse(first?.[1].ingestedAfter ?? "")).toBeLessThanOrEqual(before - 86_400_000 + 1_000);
		expect(fixture.jobspipeSearch).not.toHaveBeenCalled();

		const roles = await jobs.opportunities("alice");
		expect(roles).toHaveLength(12);
		expect(roles[0]).toMatchObject({
			role: expect.stringMatching(/^Reliability engineer \d+$/),
			company: "ACME",
			url: expect.stringMatching(/^https:\/\/example\.test\/jobs\/\d+$/),
			listingId: expect.any(String),
			listing: { company: { name: "ACME" }, postingUrl: expect.stringContaining("utm_source") },
			unknowns: ["salary", "office"],
		});
		expect(await getDb().select().from(tables.jobListing)).toHaveLength(12);
		expect(await jobs.notifications("alice")).toMatchObject([{ title: "12 new roles to review" }]);

		// Nothing new since: the same listings come back (an hour of overlap) and nothing is offered twice.
		await getDb()
			.update(tables.careerSchedule)
			.set({ nextRunAt: new Date(Date.now() - 30_000) })
			.where(eq(tables.careerSchedule.id, saved.id));
		await run();
		expect(fixture.hirebase).toHaveBeenCalledTimes(2);
		const [, second] = fixture.hirebase.mock.calls;
		expect(Date.parse(second?.[1].ingestedAfter ?? "")).toBeGreaterThan(before - 3_600_000 - 1_000);
		expect(await jobs.opportunities("alice")).toHaveLength(12);
		expect(await jobs.notifications("alice")).toHaveLength(1);
		expect(await getDb().select().from(tables.application)).toEqual([]);
	});

	it("never offers a listing the person hid, tracked or dismissed, and leaves closed ones out", async () => {
		const careers = (await import("./service")).careerService;
		const { upsertListings } = await import("../jobs/store");
		const { trackListing } = await import("../jobs/track");
		fixture.hirebase.mockResolvedValue(answer("hirebase", [role(1), role(2), role(3)]));
		const saved = await schedule();
		await run();
		const roles = await jobs.opportunities("alice");
		const byRole = (index: number) => {
			const found = roles.find((row) => row.role === `Reliability engineer ${index}`);
			if (!found) throw new Error(`Expected role ${index}`);
			return found;
		};
		await jobs.dismissOpportunity("alice", byRole(1).id);
		const tracked = await careers.trackOpportunity("alice", byRole(2).id);
		expect(await careers.trackOpportunity("alice", byRole(2).id)).toEqual(tracked);
		// Closed after it was offered: it leaves New roles.
		await getDb()
			.update(tables.jobListing)
			.set({ closedAt: new Date() })
			.where(eq(tables.jobListing.id, byRole(3).listingId ?? ""));
		// Hidden and tracked from the Jobs page.
		const [four, five] = await upsertListings([role(4), role(5)]);
		if (!four || !five) throw new Error("Expected stored listings.");
		await getDb().insert(tables.jobListingHidden).values({ userId: "alice", listingId: four.id });
		await trackListing("alice", five);

		fixture.hirebase.mockResolvedValue(
			answer(
				"hirebase",
				[1, 2, 3, 4, 5, 6].map((index) => role(index)),
			),
		);
		await getDb()
			.update(tables.careerSchedule)
			.set({ nextRunAt: new Date(Date.now() - 30_000) })
			.where(eq(tables.careerSchedule.id, saved.id));
		await run();
		expect(
			(await jobs.opportunities("alice")).map((row) => [row.role, Boolean(row.trackedApplicationId)]).sort(),
		).toEqual([
			["Reliability engineer 2", true],
			["Reliability engineer 6", false],
		]);
		expect((await jobs.notifications("alice")).map((row) => row.title)).toEqual([
			"1 new role to review",
			"3 new roles to review",
		]);
		expect(
			await getDb()
				.select({ role: tables.application.role, source: tables.application.source, url: tables.application.sourceUrl })
				.from(tables.application)
				.orderBy(tables.application.role),
		).toEqual([
			{
				role: "Reliability engineer 2",
				source: "Rezumi job search",
				url: "https://example.test/jobs/2?utm_source=search",
			},
			{
				role: "Reliability engineer 5",
				source: "Rezumi job search",
				url: "https://example.test/jobs/5?utm_source=search",
			},
		]);
	});

	it("tops up with JobsPipe below ten, then follows its delta cursor for new jobs only", async () => {
		fixture.hirebase.mockResolvedValue(answer("hirebase", [role(1)]));
		fixture.jobspipeSearch.mockResolvedValue(
			answer("jobspipe", [fakeListing("jobspipe", 7, { title: "Site reliability engineer" })], {
				deltaCursor: "delta-one",
			}),
		);
		const saved = await schedule();
		await run();
		expect(fixture.jobspipeSearch).toHaveBeenCalledOnce();
		expect(fixture.jobspipeSearch.mock.calls[0]?.[1]).toMatchObject({ limit: 19, fresh: true, kind: "discovery" });
		expect(await jobs.opportunities("alice")).toHaveLength(2);

		fixture.jobspipeNew.mockResolvedValue(
			answer("jobspipe", [fakeListing("jobspipe", 8, { title: "Reliability lead" })], { deltaCursor: "delta-two" }),
		);
		await getDb()
			.update(tables.careerSchedule)
			.set({ nextRunAt: new Date(Date.now() - 30_000) })
			.where(eq(tables.careerSchedule.id, saved.id));
		await run();
		expect(fixture.jobspipeSearch).toHaveBeenCalledOnce();
		expect(fixture.jobspipeNew).toHaveBeenCalledWith(
			expect.objectContaining({ query: "Reliability engineer" }),
			"delta-one",
			expect.objectContaining({ limit: 19 }),
		);
		expect(await jobs.opportunities("alice")).toHaveLength(3);
		const [state] = await getDb()
			.select({ state: tables.careerSchedule.discoveryState })
			.from(tables.careerSchedule)
			.where(eq(tables.careerSchedule.id, saved.id));
		expect(state?.state).toMatchObject({ jobspipeDelta: "delta-two", hirebaseAfter: expect.any(String) });
	});

	it("postpones a check until the budget resets, without using an attempt or reporting a failure", async () => {
		fixture.env.JOB_SEARCH_DAILY_BUDGET_USD = 0;
		await schedule();
		await run();
		expect(fixture.hirebase).not.toHaveBeenCalled();
		const [job] = await getDb().select().from(tables.careerJob);
		expect(job).toMatchObject({ status: "queued", attempts: 0, error: null });
		expect(job?.leaseUntil?.toISOString().slice(11, 16)).toBe("00:05");
		expect(job?.leaseUntil?.getTime()).toBeGreaterThan(Date.now());
		expect(await jobs.notifications("alice")).toEqual([]);

		fixture.env.JOB_SEARCH_DAILY_BUDGET_USD = 1;
		await getDb().update(tables.careerJob).set({ leaseUntil: expired() });
		await run();
		expect(fixture.hirebase).toHaveBeenCalledOnce();
		expect(await jobs.opportunities("alice")).toHaveLength(12);
	});

	it("keeps a saved search, rebuilds one from a role, and caps job alerts by plan", async () => {
		const search = { query: "Data analyst", country: "GB", remote: "only", postedWithinDays: 7 };
		const saved = await jobs.save(
			"alice",
			careerScheduleInputSchema.parse({
				kind: "discovery",
				search,
				timezone: "UTC",
				nextRunAt: due(),
				intervalDays: 1,
			}),
		);
		expect(saved).toMatchObject({ query: "Data analyst", search: { ...search, includeNoSalary: true } });
		// A toggle that leaves the search out keeps it.
		const paused = await jobs.save("alice", {
			...careerScheduleInputSchema.parse({ ...saved, search: undefined, enabled: false }),
			id: saved.id,
		});
		expect(paused.search).toMatchObject(search);
		await expect(
			jobs.save(
				"alice",
				careerScheduleInputSchema.parse({ kind: "discovery", query: "x", timezone: "UTC", nextRunAt: due() }),
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		fixture.env.BILLING_MODE = "on";
		await schedule();
		await expect(schedule()).rejects.toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			data: { limit: "jobAlerts", max: 1, used: 1, planId: "free" },
		});
		// Paused alerts don't count.
		await expect(
			jobs.save(
				"alice",
				careerScheduleInputSchema.parse({
					kind: "discovery",
					query: "Designer",
					enabled: false,
					timezone: "UTC",
					nextRunAt: due(),
				}),
			),
		).resolves.toMatchObject({ enabled: false });
	});

	it.each(["pause", "delete schedule", "delete application"] as const)(
		"discards an in-flight search after %s",
		async (action) => {
			await getDb()
				.insert(tables.application)
				.values({ id: "alice-app", userId: "alice", company: "ACME", role: "Engineer" });
			const saved = await schedule("alice-app");
			const started = Promise.withResolvers<void>();
			const release = Promise.withResolvers<void>();
			fixture.hirebase.mockImplementationOnce(async () => {
				started.resolve();
				await release.promise;
				return answer("hirebase", plenty());
			});
			const running = run();
			await started.promise;
			try {
				if (action === "pause")
					await jobs.save("alice", { ...careerScheduleInputSchema.parse(saved), id: saved.id, enabled: false });
				else if (action === "delete schedule") await jobs.delete("alice", saved.id);
				else await getDb().delete(tables.application).where(eq(tables.application.id, "alice-app"));
			} finally {
				release.resolve();
				await running;
			}
			await run();
			expect(fixture.hirebase).toHaveBeenCalledTimes(1);
			expect(await jobs.opportunities("alice")).toEqual([]);
			expect(await jobs.notifications("alice")).toEqual([]);
			expect(fixture.email).not.toHaveBeenCalled();
		},
	);

	it("runs a briefing at its lead before the interview, through the schedule's own connection", async () => {
		const at = new Date(Date.now() + 3_600_000);
		await interviewApplication(at);
		const saved = await jobs.save(
			"alice",
			careerScheduleInputSchema.parse({
				applicationId: "alice-app",
				interviewId: "interview-round",
				kind: "prepare",
				lead: "2h",
				aiProviderId: "preparation-provider",
				timezone: "Europe/Berlin",
				nextRunAt: new Date("2031-01-01T00:00:00Z"),
			}),
		);
		expect(saved.nextRunAt).toEqual(new Date(at.getTime() - 2 * 3_600_000));
		await run();
		await run();
		const [job] = await getDb().select().from(tables.careerJob);
		expect(fixture.generate).toHaveBeenCalledOnce();
		expect(fixture.generate).toHaveBeenCalledWith(
			expect.objectContaining({
				applicationId: "alice-app",
				task: { task: "briefing", interviewId: "interview-round" },
				providerId: "preparation-provider",
				jobId: job?.id,
			}),
		);
		expect(await jobs.notifications("alice")).toMatchObject([
			{
				notice: { type: "briefing", company: "ACME" },
				applicationId: "alice-app",
				url: "/dashboard/applications/alice-app/prepare",
			},
		]);
	});

	it.each(["update", "delete"] as const)(
		"follows a rescheduled interview and pauses when it is removed, cancelling pending work (%s)",
		async (action) => {
			await interviewApplication(new Date("2030-10-08T10:00:00Z"));
			const unrelated = await schedule("alice-app");
			await getDb().insert(tables.careerSchedule).values({
				id: "interview-preparation",
				userId: "alice",
				applicationId: "alice-app",
				interviewId: "interview-round",
				aiProviderId: "preparation-provider",
				kind: "prepare",
				lead: "2h",
				enabled: true,
				nextRunAt: due(),
				lastQueuedAt: due(),
			});
			await getDb()
				.insert(tables.careerJob)
				.values([
					{
						userId: "alice",
						scheduleId: "interview-preparation",
						dueAt: expired(),
						status: "queued",
					},
					{
						userId: "alice",
						scheduleId: "interview-preparation",
						dueAt: due(),
						status: "running",
						attempts: 1,
						lease: "active-worker",
						leaseUntil: new Date(Date.now() + 60_000),
					},
				]);
			const applications = (await import("../applications/service")).applicationService;
			if (action === "update")
				await applications.updateInterview({
					userId: "alice",
					id: "alice-app",
					entryId: "interview-round",
					at: "2030-10-09T10:00:00Z",
				});
			else await applications.deleteTimelineEntry({ userId: "alice", id: "alice-app", entryId: "interview-round" });
			expect(await jobs.list("alice")).toEqual(
				expect.arrayContaining([
					expect.objectContaining(
						action === "update"
							? {
									id: "interview-preparation",
									enabled: true,
									nextRunAt: new Date("2030-10-09T08:00:00Z"),
									lastQueuedAt: null,
								}
							: { id: "interview-preparation", enabled: false },
					),
					expect.objectContaining({ id: unrelated.id, enabled: true }),
				]),
			);
			expect(
				await getDb()
					.select({
						status: tables.careerJob.status,
						lease: tables.careerJob.lease,
						leaseUntil: tables.careerJob.leaseUntil,
					})
					.from(tables.careerJob),
			).toEqual([
				{ status: "canceled", lease: null, leaseUntil: null },
				{ status: "canceled", lease: null, leaseUntil: null },
			]);
			expect(await jobs.notifications("alice")).toMatchObject(
				action === "update"
					? []
					: [
							{
								notice: { type: "briefing-paused" },
								applicationId: "alice-app",
								title: "Interview briefing paused",
								url: "/dashboard/career?schedule=interview-preparation",
							},
						],
			);
		},
	);

	it("tracks an older role without a listing once, from its own copy of the posting", async () => {
		const careers = (await import("./service")).careerService;
		const url = "https://example.test/jobs/42";
		const [opportunity] = await getDb()
			.insert(tables.careerOpportunity)
			.values({
				userId: "alice",
				url,
				role: "Reliability engineer",
				company: "ACME",
				snippet: "Maintain reliable services.",
			})
			.returning();
		if (!opportunity) throw new Error("Expected a role.");
		await expect(careers.trackOpportunity("bob", opportunity.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
		const tracked = await careers.trackOpportunity("alice", opportunity.id);
		expect(await careers.trackOpportunity("alice", opportunity.id)).toEqual(tracked);
		expect(
			await getDb()
				.select({
					id: tables.application.id,
					company: tables.application.company,
					role: tables.application.role,
					status: tables.application.status,
					sourceUrl: tables.application.sourceUrl,
				})
				.from(tables.application),
		).toEqual([
			{ id: tracked.applicationId, company: "ACME", role: "Reliability engineer", status: "saved", sourceUrl: url },
		]);
	});

	it("recovers a crashed lease but reports an exhausted lease only once without another provider call", async () => {
		const recoveredSchedule = await schedule();
		const exhaustedSchedule = await schedule();
		// Persist the state a terminated worker leaves behind, using already elapsed real timestamps.
		await getDb()
			.update(tables.careerSchedule)
			.set({ lastQueuedAt: recoveredSchedule.nextRunAt })
			.where(eq(tables.careerSchedule.id, recoveredSchedule.id));
		await getDb()
			.update(tables.careerSchedule)
			.set({ lastQueuedAt: exhaustedSchedule.nextRunAt })
			.where(eq(tables.careerSchedule.id, exhaustedSchedule.id));
		await getDb()
			.insert(tables.careerJob)
			.values([
				{
					id: "recoverable-job",
					userId: "alice",
					scheduleId: recoveredSchedule.id,
					dueAt: recoveredSchedule.nextRunAt,
					status: "running",
					attempts: 1,
					lease: "terminated-worker",
					leaseUntil: expired(),
				},
				{
					id: "exhausted-job",
					userId: "alice",
					scheduleId: exhaustedSchedule.id,
					dueAt: exhaustedSchedule.nextRunAt,
					status: "running",
					attempts: 3,
					lease: "terminated-worker-3",
					leaseUntil: expired(),
				},
			]);
		await Promise.all([run(), run()]);
		await run();
		expect(fixture.hirebase).toHaveBeenCalledTimes(1);
		expect(await jobs.opportunities("alice")).toHaveLength(12);
		const notifications = await jobs.notifications("alice");
		expect(notifications.filter((item) => item.title === "Career schedule needs attention")).toHaveLength(1);
		expect(notifications).toHaveLength(2);
		expect(
			await getDb()
				.select({ status: tables.careerJob.status, attempts: tables.careerJob.attempts })
				.from(tables.careerJob)
				.where(eq(tables.careerJob.id, "exhausted-job")),
		).toEqual([{ status: "failed", attempts: 3 }]);
	});

	it("backs off failed requests and stops after three attempts with one actionable, sanitized notification", async () => {
		const failing = await schedule();
		fixture.hirebase.mockRejectedValue(new Error("Synthetic provider error containing private-key-material"));
		fixture.jobspipeSearch.mockRejectedValue(new Error("Synthetic provider error containing private-key-material"));
		await run();
		await run();
		expect(fixture.hirebase).toHaveBeenCalledTimes(1);
		const [job] = await getDb().select().from(tables.careerJob);
		if (!job) throw new Error("Expected durable failed work.");
		expect(job.status).toBe("queued");
		expect(job.leaseUntil?.getTime()).toBeGreaterThan(Date.now());
		expect(await jobs.notifications("alice")).toEqual([]);
		for (let attempt = 2; attempt <= 3; attempt++) {
			// Restore the next retry as elapsed; no fake JS clock can disagree with PostgreSQL.
			await getDb().update(tables.careerJob).set({ leaseUntil: expired() }).where(eq(tables.careerJob.id, job.id));
			await run();
		}
		await run();
		expect(fixture.hirebase).toHaveBeenCalledTimes(3);
		expect(await jobs.opportunities("alice")).toEqual([]);
		const notifications = await jobs.notifications("alice");
		expect(notifications).toMatchObject([
			{ title: "Career schedule needs attention", url: `/dashboard/career?schedule=${failing.id}` },
		]);
		expect(JSON.stringify(notifications)).not.toContain("private-key-material");
		expect(
			await getDb()
				.select({ status: tables.careerJob.status, attempts: tables.careerJob.attempts })
				.from(tables.careerJob)
				.where(eq(tables.careerJob.id, job.id)),
		).toEqual([{ status: "failed", attempts: 3 }]);
	});
	it("reclaims an abandoned email attempt but never resends a delivered notification", async () => {
		const saved = await schedule();
		await getDb().update(tables.careerSchedule).set({ email: true }).where(eq(tables.careerSchedule.id, saved.id));
		await run();
		const [notice] = await jobs.notifications("alice");
		if (!notice) throw new Error("Expected a notification.");
		await getDb()
			.update(tables.careerNotification)
			.set({ emailedAt: null, emailAttemptedAt: new Date(Date.now() - 11 * 60_000) })
			.where(eq(tables.careerNotification.id, notice.id));
		fixture.email.mockClear();
		await run();
		expect(fixture.email).toHaveBeenCalledOnce();
		await run();
		expect(fixture.email).toHaveBeenCalledOnce();
	});

	it("deletes notifications read more than 90 days ago and keeps unread and recently read ones", async () => {
		const day = 24 * 60 * 60 * 1000;
		const old = new Date(Date.now() - 91 * day);
		await getDb()
			.insert(tables.careerNotification)
			.values([
				{ userId: "alice", key: "read-old", notice: { type: "schedule-failed", reason: "failed" }, readAt: old },
				{
					userId: "alice",
					key: "read-recent",
					notice: { type: "schedule-failed", reason: "failed" },
					readAt: new Date(Date.now() - 89 * day),
				},
				{ userId: "alice", key: "unread-old", notice: { type: "schedule-failed", reason: "failed" }, createdAt: old },
			]);
		await run();
		const keys = (await getDb().select({ key: tables.careerNotification.key }).from(tables.careerNotification)).map(
			(row) => row.key,
		);
		expect(keys.sort()).toEqual(["read-recent", "unread-old"]);
	});
});
