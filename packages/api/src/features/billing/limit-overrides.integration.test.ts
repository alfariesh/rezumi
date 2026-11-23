import type { BillingMode } from "./entitlements";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as BillingMode,
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
describe.skipIf(!databaseUrl)("limits set by an administrator", () => {
	let billingAdmin: typeof import("./admin").billingAdmin;
	let quotaDay: typeof import("../jobs/allowance").quotaDay;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `limit_override_test_${randomUUID().replaceAll("-", "")}`;

	const setSearches = (value: number, expiresInDays?: number) =>
		billingAdmin.setLimitOverride({
			actorUserId: "owner",
			userId: "member",
			limitKey: "jobSearchesPerDay",
			value,
			expiresInDays,
			reason: "Support",
		});

	const auditActions = async () =>
		(
			await getDb()
				.select({ action: tables.billingAuditLog.action, details: tables.billingAuditLog.details })
				.from(tables.billingAuditLog)
				.where(eq(tables.billingAuditLog.targetUserId, "member"))
				.orderBy(tables.billingAuditLog.createdAt)
		).map((row) => ({ action: row.action, details: row.details }));

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
		({ billingAdmin } = await import("./admin"));
		({ quotaDay } = await import("../jobs/allowance"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		await pool.query('TRUNCATE "user", billing_audit_log CASCADE');
		await getDb()
			.insert(tables.user)
			.values(
				["owner", "member"].map((id) => ({
					id,
					name: id,
					email: `${id}@example.test`,
					username: id,
					displayUsername: id,
					...(id === "owner" ? { role: "admin" } : {}),
				})),
			);
	});

	it("replaces the plan's job searches a day, higher or lower, and records why", async () => {
		expect((await quotaDay("member", new Date())).max).toBe(3);

		const raised = await setSearches(25, 7);
		expect(raised).toMatchObject({ userId: "member", limitKey: "jobSearchesPerDay", value: 25 });
		expect(raised.expiresAt && +raised.expiresAt - Date.now()).toBeGreaterThan(6 * DAY_MS);
		expect((await quotaDay("member", new Date())).max).toBe(25);

		// Setting it again replaces the last one, for good this time.
		const lowered = await setSearches(1);
		expect(lowered).toMatchObject({ value: 1, expiresAt: null });
		expect((await quotaDay("member", new Date())).max).toBe(1);
		expect(await getDb().select().from(tables.billingLimitOverride)).toHaveLength(1);

		const actions = await auditActions();
		expect(actions.map((entry) => entry.action)).toEqual(["limit.set", "limit.set"]);
		expect(actions[1]?.details).toMatchObject({
			limitKey: "jobSearchesPerDay",
			value: 1,
			expiresAt: null,
			before: { value: 25 },
		});
	});

	it("stops counting once it expires", async () => {
		await setSearches(50, 1);
		expect((await quotaDay("member", new Date())).max).toBe(50);
		expect((await quotaDay("member", new Date(Date.now() + 2 * DAY_MS))).max).toBe(3);
	});

	it("applies while plans don't apply to the account, where Pro AI's number would", async () => {
		fixture.mode = "off";
		expect((await quotaDay("member", new Date())).max).toBe(40);
		await setSearches(100);
		expect((await quotaDay("member", new Date())).max).toBe(100);
	});

	it("finds the account by email, and clearing it brings the plan's number back", async () => {
		await billingAdmin.setLimitOverride({
			actorUserId: "owner",
			email: "MEMBER@example.test",
			limitKey: "jobSearchesPerDay",
			value: 10,
			reason: "Tester",
		});
		expect((await quotaDay("member", new Date())).max).toBe(10);

		const customer = await billingAdmin.customer({ userId: "member" });
		expect(customer.limitOverrides).toEqual([
			expect.objectContaining({ limitKey: "jobSearchesPerDay", value: 10, expiresAt: null, live: true }),
		]);

		await billingAdmin.clearLimitOverride({
			actorUserId: "owner",
			userId: "member",
			limitKey: "jobSearchesPerDay",
			reason: "Done testing",
		});
		expect((await quotaDay("member", new Date())).max).toBe(3);
		expect((await auditActions()).map((entry) => entry.action)).toEqual(["limit.set", "limit.cleared"]);
		await expect(
			billingAdmin.clearLimitOverride({
				actorUserId: "owner",
				userId: "member",
				limitKey: "jobSearchesPerDay",
				reason: "Again",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
