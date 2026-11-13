import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { defaultResumeData } from "@rezumi/schema/resume/default";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	portfolio: "on" as "off" | "admins" | "on",
	reply: "" as string | Error,
	calls: [] as { model: string }[],
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
			ENCRYPTION_SECRET: "portfolio-ai-test-encryption-secret-0123456789",
			BILLING_MODE: "on",
			AI_PROVIDER: "openai",
			AI_MODEL: "server-model",
			AI_API_KEY: "server-key-never-sent",
			AI_BASE_URL: undefined,
			AI_COST_INPUT_USD_PER_MTOK: 0.1,
			AI_COST_OUTPUT_USD_PER_MTOK: 0.5,
			get PORTFOLIO_MODE() {
				return fixture.portfolio;
			},
		},
	};
});
vi.mock("../../ai/service", async () => {
	const actual = await vi.importActual<typeof import("../../ai/service")>("../../ai/service");
	return {
		...actual,
		getModel: (input: { model: string }) =>
			new MockLanguageModelV4({
				modelId: input.model,
				doGenerate: async ({ abortSignal }) => {
					fixture.calls.push({ model: input.model });
					abortSignal?.throwIfAborted();
					if (fixture.reply instanceof Error) throw fixture.reply;
					return {
						content: [{ type: "text", text: fixture.reply }],
						finishReason: { unified: "stop", raw: "end_turn" },
						usage: {
							inputTokens: { total: 1_000, noCache: 1_000, cacheRead: 0, cacheWrite: 0 },
							outputTokens: { total: 200, text: 200, reasoning: 0 },
						},
						warnings: [],
					};
				},
			}),
	};
});
vi.mock("../../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return {
		protectedProcedure: os.$context<{ user: { id: string } }>(),
		publicProcedure: os.$context<Record<string, never>>(),
	};
});
vi.mock("../../../middleware/rate-limit", async () => {
	const actual = await vi.importActual<typeof import("../../../middleware/rate-limit")>(
		"../../../middleware/rate-limit",
	);
	return { ...actual, aiRequestRateLimit: ({ next }: { next: () => unknown }) => next() };
});

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const DRAFT = JSON.stringify({
	greeting: "Saya mendesain produk.",
	about: ["Saya menaikkan konversi 35%."],
	works: [{ id: "1", summary: "Checkout baru.", story: ["Saya mendesain ulang checkout."] }],
});
const REWRITE = JSON.stringify({ text: "Saya desainer." });
const METRICS = JSON.stringify({
	metrics: [
		{
			label: "Konversi",
			value: 35,
			format: "percent",
			currency: null,
			unit: null,
			prefix: "+",
			suffix: "",
			quote: "Menaikkan konversi 35%.",
		},
	],
});

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("portfolio AI credits", () => {
	let service: typeof import("../service").portfolioService;
	let router: typeof import("./router").portfolioAiRouter;
	let credits: typeof import("../../billing/credits");
	let providers: typeof import("../../ai-providers/service").aiProvidersService;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `portfolio_ai_test_${randomUUID().replaceAll("-", "")}`;

	const client = (userId = "owner") =>
		createRouterClient(router, {
			context: { user: { id: userId }, reqHeaders: new Headers(), locale: "en-US" } as never,
		});
	const balance = async (userId = "owner") => (await credits.getCreditBalance(userId)).balance;
	const usages = (userId = "owner") =>
		getDb().select().from(tables.aiCreditUsage).where(eq(tables.aiCreditUsage.userId, userId));

	const addResume = async (userId: string, description = "<p>Menaikkan konversi 35%.</p>") => {
		const data = structuredClone(defaultResumeData);
		data.summary.content = "<p>Desainer produk.</p>";
		data.sections.experience.items = [
			{
				id: "job",
				hidden: false,
				company: "Kopi Senja",
				position: "Desainer",
				location: "",
				period: "2020",
				website: { url: "", label: "", inlineLink: false },
				description,
				roles: [],
			},
		] as never;
		data.sections.projects.items = [
			{
				id: "project",
				hidden: false,
				name: "Checkout",
				period: "2024",
				website: { url: "", label: "", inlineLink: false },
				description: "<p>Mendesain ulang checkout.</p>",
			},
		] as never;
		const [row] = await getDb()
			.insert(tables.resume)
			.values({ name: "CV", slug: `cv-${randomUUID().slice(0, 8)}`, userId, data })
			.returning({ id: tables.resume.id });
		return row?.id as string;
	};

	const addOwnConnection = async (userId = "owner") => {
		const created = await providers.create({
			userId,
			label: "Mine",
			provider: "openai",
			model: "own-model",
			apiKey: "own",
		});
		await getDb()
			.update(tables.aiProvider)
			.set({ enabled: true, testStatus: "success" })
			.where(eq(tables.aiProvider.id, created.id));
	};

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({
			connectionString: databaseUrl,
			max: 8,
			options: `-c search_path=${schemaName} -c statement_timeout=10000`,
		});
		fixture.db = drizzle({ client: pool });
		const migrations = new URL("../../../../../../migrations/", import.meta.url);
		const directories = (await readdir(migrations, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
			.map((entry) => entry.name)
			.sort();
		for (const directory of directories) {
			const file = new URL(`${directory}/migration.sql`, migrations);
			if (existsSync(file)) await pool.query((await readFile(file, "utf8")).replaceAll('"public".', ""));
		}
		({ portfolioService: service } = await import("../service"));
		({ portfolioAiRouter: router } = await import("./router"));
		credits = await import("../../billing/credits");
		({ aiProvidersService: providers } = await import("../../ai-providers/service"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.portfolio = "on";
		fixture.reply = DRAFT;
		fixture.calls = [];
		await pool.query('TRUNCATE "user", billing_audit_log, released_username CASCADE');
		await getDb()
			.insert(tables.user)
			.values(
				["owner", "bare"].map((id) => ({
					id,
					name: id,
					email: `${id}@example.test`,
					username: id,
					displayUsername: id,
					emailVerified: true,
				})),
			);
		await service.create("owner", { sourceResumeId: await addResume("owner") });
		await service.create("bare", { sourceResumeId: null, basics: { name: "Bare" } });
	});

	const rezumi = (key: string) => ({ aiSource: "rezumi" as const, idempotencyKey: key });

	it("takes 3 credits for a draft, keeps the tokens and writes nothing", async () => {
		const before = await service.get("owner");
		const result = await client().draft(rezumi("draft-1"));
		expect(result.greeting).toBe("Saya mendesain produk.");
		expect(await balance()).toBe(2);
		expect((await usages())[0]).toMatchObject({
			action: "portfolio-draft",
			credits: 3,
			status: "committed",
			inputTokens: 1_000,
			outputTokens: 200,
		});
		const after = await service.get("owner");
		expect(after.portfolio?.updatedAt).toEqual(before.portfolio?.updatedAt);
		expect(after.portfolio?.isPublic).toBe(false);
	});

	it("takes 1 credit for a rewrite and for finding numbers", async () => {
		fixture.reply = REWRITE;
		await client().rewrite({
			field: "greeting",
			text: "Saya desainer produk.",
			instruction: "shorter",
			...rezumi("a"),
		});
		expect(await balance()).toBe(4);
		fixture.reply = METRICS;
		const { candidates } = await client().findMetrics(rezumi("b"));
		expect(candidates).toHaveLength(1);
		expect(await balance()).toBe(3);
		expect((await usages()).map((usage) => [usage.action, usage.credits]).toSorted()).toEqual([
			["portfolio-metrics", 1],
			["portfolio-rewrite", 1],
		]);
	});

	it("charges once for a repeated key and runs the AI once", async () => {
		await client().draft(rezumi("same"));
		await expect(client().draft(rezumi("same"))).rejects.toMatchObject({ code: "CONFLICT" });
		expect(fixture.calls).toHaveLength(1);
		expect(await balance()).toBe(2);
	});

	it("runs parallel requests with one key once", async () => {
		const results = await Promise.allSettled(Array.from({ length: 4 }, () => client().draft(rezumi("burst"))));
		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		expect(await balance()).toBe(2);
	});

	it("gives the credits back when the provider fails", async () => {
		fixture.reply = new Error("provider down");
		await expect(client().draft(rezumi("fails"))).rejects.toThrow();
		expect(await balance()).toBe(5);
		expect((await usages())[0]).toMatchObject({ status: "released" });
	});

	it("gives the credits back for an answer it can't use, and when it isn't JSON", async () => {
		fixture.reply = JSON.stringify({ greeting: "", about: [], works: [] });
		await expect(client().draft(rezumi("empty"))).rejects.toMatchObject({ code: "PORTFOLIO_AI_UNUSABLE" });
		fixture.reply = "{ not json }";
		await expect(client().draft(rezumi("broken"))).rejects.toMatchObject({ code: "PORTFOLIO_AI_UNUSABLE" });
		expect(await balance()).toBe(5);
	});

	it("gives the credits back when it's cancelled", async () => {
		const abort = new AbortController();
		abort.abort();
		await expect(client().draft(rezumi("stopped"), { signal: abort.signal })).rejects.toThrow();
		expect(await balance()).toBe(5);
		expect((await usages())[0]).toMatchObject({ status: "released" });
	});

	it("never takes Rezumi AI credits on the person's own connection", async () => {
		await addOwnConnection();
		await client().draft({ aiSource: "own" });
		expect(fixture.calls).toEqual([{ model: "own-model" }]);
		expect(await usages()).toEqual([]);
	});

	it("gives the credit back when no number survives the checks", async () => {
		fixture.reply = METRICS.replace("Menaikkan konversi 35%.", "Sebuah kalimat karangan 35%.");
		await expect(client().findMetrics(rezumi("empty"))).resolves.toEqual({ candidates: [] });
		expect(await balance()).toBe(5);
		expect((await usages())[0]).toMatchObject({ status: "released" });
	});

	it("costs nothing when the resume has no numbers to find", async () => {
		await service.delete("owner");
		await service.create("owner", { sourceResumeId: await addResume("owner", "<p>Mendesain aplikasi.</p>") });
		await getDb()
			.update(tables.resume)
			.set({ data: { ...defaultResumeData } })
			.where(eq(tables.resume.userId, "owner"));
		await expect(client().findMetrics(rezumi("none"))).resolves.toEqual({ candidates: [] });
		expect(fixture.calls).toHaveLength(0);
		expect(await usages()).toEqual([]);
	});

	it("needs a source it can read for a draft, before any credits are at stake", async () => {
		await service.updateSettings("bare", { sourceResumeId: await addResume("bare") });
		await getDb().update(tables.resume).set({ trashedAt: new Date() }).where(eq(tables.resume.userId, "bare"));
		await expect(client("bare").draft(rezumi("no-resume"))).rejects.toMatchObject({ code: "PORTFOLIO_SOURCE_INVALID" });
		expect(fixture.calls).toHaveLength(0);
		expect(await usages("bare")).toEqual([]);
	});

	it("reads the Profile for a portfolio without a source resume", async () => {
		const { profileService } = await import("../../profile/service");
		const { emptyProfileData } = await import("@rezumi/schema/profile/data");
		const profile = emptyProfileData();
		profile.sections.experience = [
			{
				id: "profile-job",
				hidden: false,
				company: "Kopi Senja",
				position: "Desainer",
				location: "",
				period: "2020",
				website: { url: "", label: "", inlineLink: false },
				description: "<p>Menaikkan konversi 35%.</p>",
				roles: [],
			},
		] as never;
		await profileService.update("bare", { data: profile });
		await addOwnConnection("bare");
		fixture.reply = METRICS;
		const { candidates } = await client("bare").findMetrics({ aiSource: "own" });
		expect(candidates).toMatchObject([{ quote: "Menaikkan konversi 35%.", source: "Desainer · Kopi Senja" }]);
	});

	it("is refused while portfolios are closed to the account", async () => {
		fixture.portfolio = "off";
		await expect(client().draft(rezumi("off"))).rejects.toMatchObject({ code: "PORTFOLIO_DISABLED" });
		expect(await usages()).toEqual([]);
		expect(fixture.calls).toHaveLength(0);
	});
});
