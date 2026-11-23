import type { BillingMode } from "./entitlements";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "off" as BillingMode,
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
			get BILLING_MODE() {
				return fixture.mode;
			},
		},
	};
});

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;
const DAY_MS = 24 * 60 * 60 * 1000;

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("admin account list and numbers", () => {
	let accounts: typeof import("./accounts");
	let admin: Pool;
	let pool: Pool;
	const schemaName = `accounts_test_${randomUUID().replaceAll("-", "")}`;
	const now = new Date();
	const range = { from: new Date(+now - 7 * DAY_MS), to: new Date(+now + DAY_MS) };

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
		accounts = await import("./accounts");
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		await pool.query('TRUNCATE "user" CASCADE');
		const account = (id: string, daysAgo: number, extra: Partial<typeof tables.user.$inferInsert> = {}) => ({
			id,
			name: `Name ${id}`,
			email: `${id}@example.test`,
			username: id,
			displayUsername: id,
			createdAt: new Date(+now - daysAgo * DAY_MS),
			...extra,
		});
		await getDb()
			.insert(tables.user)
			.values([
				account("old-free", 20, { emailVerified: true }),
				account("new-plus", 2, { emailVerified: true }),
				account("new-pro", 1),
				account("guest", 1, { isAnonymous: true }),
			]);
		await getDb()
			.insert(tables.membershipPeriod)
			.values([
				{
					userId: "new-plus",
					planId: "plus",
					startsAt: new Date(+now - DAY_MS),
					endsAt: new Date(+now + 29 * DAY_MS),
					source: "admin",
				},
				// Revoked: doesn't count.
				{
					userId: "old-free",
					planId: "pro-ai",
					startsAt: new Date(+now - DAY_MS),
					endsAt: new Date(+now + 29 * DAY_MS),
					source: "admin",
					revokedAt: now,
				},
			]);
		await getDb()
			.insert(tables.billingSubscription)
			.values({
				userId: "new-pro",
				externalCustomerId: "new-pro",
				providerSubscriptionId: "sub_test_pro",
				providerProductId: "pdt_test",
				planId: "pro-ai",
				interval: "month",
				status: "active",
				amount: 999,
				currency: "usd",
				currentPeriodStart: new Date(+now - DAY_MS),
				currentPeriodEnd: new Date(+now + 29 * DAY_MS),
				paidThrough: new Date(+now + 29 * DAY_MS),
				providerModifiedAt: now,
			});
		await getDb()
			.insert(tables.session)
			.values([
				{ userId: "new-plus", token: "t1", expiresAt: new Date(+now + DAY_MS), updatedAt: new Date(+now - DAY_MS) },
				{
					userId: "old-free",
					token: "t2",
					expiresAt: new Date(+now + DAY_MS),
					updatedAt: new Date(+now - 10 * DAY_MS),
				},
				{ userId: "guest", token: "t3", expiresAt: new Date(+now + DAY_MS), updatedAt: now },
			]);
	});

	it("counts accounts, sign-ups, activity and paid plans, leaving guests out", async () => {
		const metrics = await accounts.accountMetrics(range, now);
		expect(metrics).toMatchObject({
			accounts: 3,
			verified: 2,
			guests: 1,
			signups: { total: 2, verified: 1, previous: 0 },
			active: { week: 1, month: 2 },
			paying: { total: 2, plus: 1, proAi: 1 },
		});
		expect(metrics.signups.daily.reduce((sum, day) => sum + day.signups, 0)).toBe(2);
	});

	it("lists accounts newest first with their plan and last sign-in use, filtered by plan and text", async () => {
		const all = await accounts.listAccounts({ limit: 20, offset: 0 });
		expect(all.total).toBe(3);
		expect(all.accounts.map((row) => [row.id, row.planId])).toEqual([
			["new-pro", "pro-ai"],
			["new-plus", "plus"],
			["old-free", "free"],
		]);
		expect(all.accounts[1]?.lastSeenAt).toBeInstanceOf(Date);
		expect(all.accounts[0]?.lastSeenAt).toBeNull();

		expect((await accounts.listAccounts({ plan: "free", limit: 20, offset: 0 })).accounts.map((row) => row.id)).toEqual(
			["old-free"],
		);
		expect((await accounts.listAccounts({ plan: "plus", limit: 20, offset: 0 })).accounts.map((row) => row.id)).toEqual(
			["new-plus"],
		);
		expect((await accounts.listAccounts({ query: "NAME OLD", limit: 20, offset: 0 })).total).toBe(1);
		expect((await accounts.listAccounts({ query: "100%_", limit: 20, offset: 0 })).total).toBe(0);
		const second = await accounts.listAccounts({ limit: 1, offset: 1 });
		expect(second).toMatchObject({ total: 3, accounts: [{ id: "new-plus" }] });
	});
});
