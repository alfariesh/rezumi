import type { BillingMode } from "./entitlements";
import type { AnyRouter } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as BillingMode,
	serverAi: true,
	prices: true,
	// What the fake provider answers next: text, or an error to throw.
	reply: { text: '{"text":"Led a team of 5","why":"Adds scale","addsFacts":false}' } as {
		text?: string;
		error?: Error;
	},
	calls: [] as { maxOutputTokens: number | undefined; model: string }[],
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
			ENCRYPTION_SECRET: "metered-ai-test-encryption-secret-0123456789",
			get BILLING_MODE() {
				return fixture.mode;
			},
			get AI_PROVIDER() {
				return fixture.serverAi ? "openai" : undefined;
			},
			get AI_MODEL() {
				return fixture.serverAi ? "server-model" : undefined;
			},
			get AI_API_KEY() {
				return fixture.serverAi ? "server-key-never-sent" : undefined;
			},
			AI_BASE_URL: undefined,
			get AI_COST_INPUT_USD_PER_MTOK() {
				return fixture.prices ? 0.5 : undefined;
			},
			get AI_COST_OUTPUT_USD_PER_MTOK() {
				return fixture.prices ? 4 : undefined;
			},
		},
	};
});
// Every connection answers from the fake provider; the model name says which connection ran.
vi.mock("../ai/service", async () => {
	const actual = await vi.importActual<typeof import("../ai/service")>("../ai/service");
	return {
		...actual,
		getModel: (input: { model: string }) =>
			new MockLanguageModelV4({
				modelId: input.model,
				doGenerate: async (options) => {
					fixture.calls.push({ maxOutputTokens: options.maxOutputTokens, model: input.model });
					if (fixture.reply.error) throw fixture.reply.error;
					return {
						content: [{ type: "text", text: fixture.reply.text ?? "" }],
						finishReason: { unified: "stop", raw: "stop" },
						usage: {
							inputTokens: { total: 1_000, noCache: 1_000, cacheRead: 0, cacheWrite: 0 },
							outputTokens: { total: 200, text: 150, reasoning: 50 },
						},
						warnings: [],
					};
				},
			}),
	};
});
vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return { protectedProcedure: os.$context<{ user: { id: string } }>() };
});
vi.mock("../../middleware/rate-limit", async () => {
	const actual = await vi.importActual<typeof import("../../middleware/rate-limit")>("../../middleware/rate-limit");
	return { ...actual, aiRequestRateLimit: ({ next }: { next: () => unknown }) => next() };
});

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("Rezumi AI metering", () => {
	let metered: typeof import("./metered-ai");
	let credits: typeof import("./credits");
	let providers: typeof import("../ai-providers/service").aiProvidersService;
	let aiRouter: typeof import("../ai/router").aiRouter;
	let applicationsAi: typeof import("../applications/ai").aiRouter;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `metered_test_${randomUUID().replaceAll("-", "")}`;

	const usagesOf = (userId: string) =>
		getDb().select().from(tables.aiCreditUsage).where(eq(tables.aiCreditUsage.userId, userId));
	const balanceOf = async (userId: string) => (await credits.getCreditBalance(userId)).balance;
	const improve = { line: "Managed a team", action: "verb" as const };
	const clientOf = <T extends AnyRouter>(router: T, userId = "owner") =>
		createRouterClient(router, {
			context: { user: { id: userId }, reqHeaders: new Headers(), locale: "en-US" } as never,
		});
	const addOwnConnection = async (userId = "owner") => {
		const created = await providers.create({
			userId,
			label: "My key",
			provider: "openai",
			model: "own-model",
			apiKey: "own-key",
		});
		await getDb()
			.update(tables.aiProvider)
			.set({ enabled: true, testStatus: "success" })
			.where(eq(tables.aiProvider.id, created.id));
		return created;
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
		const migrations = new URL("../../../../../migrations/", import.meta.url);
		const directories = (await readdir(migrations, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
			.map((entry) => entry.name)
			.sort();
		for (const directory of directories) {
			const file = new URL(`${directory}/migration.sql`, migrations);
			if (existsSync(file)) await pool.query((await readFile(file, "utf8")).replaceAll('"public".', ""));
		}
		metered = await import("./metered-ai");
		credits = await import("./credits");
		({ aiProvidersService: providers } = await import("../ai-providers/service"));
		({ aiRouter } = await import("../ai/router"));
		({ aiRouter: applicationsAi } = await import("../applications/ai"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		fixture.serverAi = true;
		fixture.prices = true;
		fixture.reply = { text: '{"text":"Led a team of 5","why":"Adds scale","addsFacts":false}' };
		fixture.calls = [];
		await pool.query('TRUNCATE "user", billing_audit_log CASCADE');
		const person = (id: string, extra: Partial<typeof tables.user.$inferInsert> = {}) => ({
			id,
			name: id,
			email: `${id}@example.test`,
			username: id,
			displayUsername: id,
			emailVerified: true,
			...extra,
		});
		await getDb()
			.insert(tables.user)
			.values([person("owner"), person("member"), person("unverified", { emailVerified: false })]);
	});

	describe("Rezumi AI", () => {
		it("grants the trial on first use, then keeps the credits with the tokens and cost", async () => {
			const result = await clientOf(aiRouter).improve({ ...improve, aiSource: "rezumi", idempotencyKey: "k1" });
			expect(result.text).toBe("Led a team of 5");
			expect(fixture.calls).toEqual([{ maxOutputTokens: 1_024, model: "server-model" }]);
			expect(await balanceOf("owner")).toBe(4);
			const [usage] = await usagesOf("owner");
			expect(usage).toMatchObject({
				action: "short-text",
				credits: 1,
				status: "committed",
				provider: "openai",
				model: "server-model",
				inputTokens: 1_000,
				outputTokens: 200,
				// 1,000 × $0.50 + 200 × $4 per million tokens.
				costUsdMicros: 1_300,
			});
		});

		it("keeps the tokens without guessing a cost when no prices are set", async () => {
			fixture.prices = false;
			await clientOf(aiRouter).improve({ ...improve, aiSource: "rezumi" });
			expect((await usagesOf("owner"))[0]).toMatchObject({ status: "committed", costUsdMicros: null });
		});

		it("gives the credits back when the provider fails", async () => {
			fixture.reply = { error: new Error("provider down") };
			await expect(clientOf(aiRouter).improve({ ...improve, aiSource: "rezumi" })).rejects.toThrow();
			expect(await balanceOf("owner")).toBe(5);
			expect((await usagesOf("owner"))[0]).toMatchObject({ status: "released" });
		});

		it("gives the credits back when the work is cancelled", async () => {
			const controller = new AbortController();
			const run = metered.runWithAiSource(
				{ userId: "owner", action: "review", aiSource: "rezumi", missing: () => new Error("none") },
				async (ai) => {
					const result = await generateText({ model: ai.model, prompt: "Review" });
					// The user stopped it after the provider answered, before the result was saved.
					controller.abort();
					controller.signal.throwIfAborted();
					return result;
				},
			);
			await expect(run).rejects.toThrow();
			expect(await balanceOf("owner")).toBe(5);
			// The provider was still paid for the answer nobody kept: its tokens stay on record.
			expect((await usagesOf("owner"))[0]).toMatchObject({ status: "released", inputTokens: 1_000, outputTokens: 200 });
		});

		it("takes credits once per action key: a double click doesn't run twice", async () => {
			const client = clientOf(aiRouter);
			await client.improve({ ...improve, aiSource: "rezumi", idempotencyKey: "same" });
			await expect(client.improve({ ...improve, aiSource: "rezumi", idempotencyKey: "same" })).rejects.toMatchObject({
				code: "CONFLICT",
			});
			expect(fixture.calls).toHaveLength(1);
			expect(await balanceOf("owner")).toBe(4);
		});

		it("lets a key whose work failed run again, charging once", async () => {
			const client = clientOf(aiRouter);
			fixture.reply = { error: new Error("provider down") };
			await expect(client.improve({ ...improve, aiSource: "rezumi", idempotencyKey: "retry" })).rejects.toThrow();
			fixture.reply = { text: '{"text":"Led a team","why":"","addsFacts":false}' };
			await client.improve({ ...improve, aiSource: "rezumi", idempotencyKey: "retry" });
			expect(await balanceOf("owner")).toBe(4);
			const statuses = (await usagesOf("owner")).map((usage) => usage.status).toSorted();
			expect(statuses).toEqual(["committed", "released"]);
		});

		it("runs parallel requests with one key once", async () => {
			const client = clientOf(aiRouter);
			const results = await Promise.allSettled(
				Array.from({ length: 4 }, () => client.improve({ ...improve, aiSource: "rezumi", idempotencyKey: "burst" })),
			);
			expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
			expect(await balanceOf("owner")).toBe(4);
		});

		it("refuses work without enough credits, naming what's needed and what's left", async () => {
			await expect(clientOf(aiRouter, "unverified").improve({ ...improve, aiSource: "rezumi" })).rejects.toMatchObject({
				code: "INSUFFICIENT_CREDITS",
				data: { required: 1, balance: 0 },
			});
			expect(fixture.calls).toHaveLength(0);
		});

		it("stops input past the work's limit before the provider sees it, and gives the credits back", async () => {
			const run = metered.runWithAiSource(
				{ userId: "owner", action: "short-text", aiSource: "rezumi", missing: () => new Error("none") },
				(ai) => generateText({ model: ai.model, prompt: "x".repeat(70_000) }),
			);
			await expect(run).rejects.toMatchObject({ code: "AI_INPUT_TOO_LARGE" });
			expect(fixture.calls).toHaveLength(0);
			expect(await balanceOf("owner")).toBe(5);
		});

		it("never runs voice or scheduled work", async () => {
			await expect(metered.startAiRun({ userId: "owner", action: null, aiSource: "rezumi" })).rejects.toMatchObject({
				code: "REZUMI_AI_UNAVAILABLE",
			});
			expect(await usagesOf("owner")).toEqual([]);
		});
	});

	describe("the user's own connection", () => {
		it("runs without credits, and never falls back to Rezumi AI", async () => {
			await addOwnConnection();
			await clientOf(aiRouter).improve({ ...improve, aiSource: "own" });
			expect(fixture.calls).toEqual([{ maxOutputTokens: undefined, model: "own-model" }]);
			expect(await usagesOf("owner")).toEqual([]);

			// Failing on the own connection doesn't move the work to Rezumi AI.
			fixture.reply = { error: new Error("own key revoked") };
			await expect(clientOf(aiRouter).improve({ ...improve, aiSource: "own" })).rejects.toThrow();
			expect(fixture.calls.map((call) => call.model)).toEqual(["own-model", "own-model"]);
		});

		it("asks to set one up when the user has none", async () => {
			await expect(clientOf(aiRouter).improve({ ...improve, aiSource: "own" })).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
		});
	});

	describe("apps from before Rezumi AI", () => {
		it("are refused rather than charged when Rezumi AI is the only AI", async () => {
			await expect(clientOf(aiRouter).improve(improve)).rejects.toMatchObject({ code: "AI_SOURCE_REQUIRED" });
			const managed = (await providers.list({ userId: "owner" }))[0];
			expect(managed?.managed).toBe(true);
			await expect(clientOf(aiRouter).improve({ ...improve, aiProviderId: managed?.id ?? "" })).rejects.toMatchObject({
				code: "AI_SOURCE_REQUIRED",
			});
			expect(fixture.calls).toHaveLength(0);
			expect(await usagesOf("owner")).toEqual([]);
		});

		it("use the user's own connection when there is one", async () => {
			await addOwnConnection();
			await clientOf(aiRouter).improve(improve);
			expect(fixture.calls.map((call) => call.model)).toEqual(["own-model"]);
			expect(await usagesOf("owner")).toEqual([]);
		});

		it("still read a pasted posting, without AI, when Rezumi AI is the only AI", async () => {
			const result = await clientOf(applicationsAi).parsePosting({ input: "Engineer at Example, Berlin" });
			expect(result.filledBy).toBe("none");
			expect(fixture.calls).toHaveLength(0);
		});
	});

	describe("while billing doesn't apply", () => {
		it("runs on the server's AI for free, whatever the request says, as before plans existed", async () => {
			fixture.mode = "off";
			await clientOf(aiRouter).improve({ ...improve, aiSource: "rezumi" });
			await clientOf(aiRouter).improve(improve);
			expect(fixture.calls.map((call) => call.model)).toEqual(["server-model", "server-model"]);
			expect(fixture.calls[0]?.maxOutputTokens).toBeUndefined();
			expect(await usagesOf("owner")).toEqual([]);
			expect(await credits.getCreditBalance("owner")).toMatchObject({ balance: 0, trial: { grantedAt: null } });
			await expect(addOwnConnection()).rejects.toMatchObject({ code: "FORBIDDEN" });
		});

		it("keeps working when plans stop applying to an account whose own connection is its default, and keeps that default for later", async () => {
			const own = await addOwnConnection();
			await providers.setDefault({ id: own.id, userId: "owner" });
			fixture.mode = "off";
			const list = await providers.list({ userId: "owner" });
			expect(list.map((item) => [item.managed, item.isDefault])).toEqual([[true, true]]);
			await expect(providers.getDefaultRunnable({ userId: "owner" })).resolves.toMatchObject({ managed: true });
			await clientOf(aiRouter).improve(improve);
			expect(fixture.calls.map((call) => call.model)).toEqual(["server-model"]);
			// Plans apply again: the account's own choice is still the default, never switched to Rezumi AI.
			fixture.mode = "on";
			expect((await providers.list({ userId: "owner" }))[0]).toMatchObject({ id: own.id, isDefault: true });
		});

		it("applies to admins only in admins mode", async () => {
			fixture.mode = "admins";
			await clientOf(aiRouter).improve({ ...improve, aiSource: "rezumi" });
			expect(await usagesOf("owner")).toEqual([]);
		});
	});

	describe("connections", () => {
		it("lists Rezumi AI with the user's own, without keys, and keeps the user's default", async () => {
			const own = await addOwnConnection();
			await providers.setDefault({ id: own.id, userId: "owner" });
			const list = await providers.list({ userId: "owner" });
			expect(list.map((item) => [item.label, item.managed, item.isDefault])).toEqual([
				["My key", false, true],
				["Rezumi AI", true, false],
			]);
			expect(JSON.stringify(list)).not.toContain("server-key-never-sent");
			expect(JSON.stringify(list)).not.toContain("own-key");
			// Listing again doesn't take the default back.
			expect((await providers.list({ userId: "owner" }))[0]?.id).toBe(own.id);

			// Rezumi AI can be made the default, and can't be deleted.
			const managed = list.find((item) => item.managed);
			if (!managed) throw new Error("Rezumi AI is missing.");
			await providers.setDefault({ id: managed.id, userId: "owner" });
			await providers.delete({ id: managed.id, userId: "owner" });
			expect((await providers.list({ userId: "owner" }))[0]).toMatchObject({ id: managed.id, isDefault: true });
		});
	});

	describe("entry points", () => {
		it("autofill takes one credit on Rezumi AI", async () => {
			fixture.reply = { text: '{"company":"Example","role":"Engineer","location":"Berlin","salary":""}' };
			await expect(
				clientOf(applicationsAi).autofill({ jobDescription: "Engineer at Example", aiSource: "rezumi" }),
			).resolves.toMatchObject({ company: "Example" });
			expect((await usagesOf("owner"))[0]).toMatchObject({ action: "short-text", status: "committed" });
		});

		it("reading a posting gives the credit back when the AI fails, keeping the pasted text", async () => {
			fixture.reply = { error: new Error("provider down") };
			const result = await clientOf(applicationsAi).parsePosting({ input: "Engineer at Example", aiSource: "rezumi" });
			expect(result).toMatchObject({ filledBy: "none", enrichmentWarning: "ai-unavailable" });
			expect((await usagesOf("owner"))[0]).toMatchObject({ action: "short-text", status: "released" });
			expect(await balanceOf("owner")).toBe(5);
		});

		it("the writing review takes four credits", async () => {
			fixture.reply = {
				text: '{"summary":"Clear","rewrites":[],"strengths":[],"jobAlignment":null}',
			};
			await clientOf(aiRouter)
				.atsReview({ extractedText: "Resume text", findings: [], aiSource: "rezumi" })
				.catch(() => null);
			const [usage] = await usagesOf("owner");
			expect(usage?.action).toBe("review");
			expect(usage?.credits).toBe(4);
			expect(usage?.status).not.toBe("reserved");
		});
	});
});
