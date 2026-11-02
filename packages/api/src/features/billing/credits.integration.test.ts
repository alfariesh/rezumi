import type { BillingMode } from "./entitlements";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { DAY_MS } from "./timeline";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "admins" as BillingMode,
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
// Authentication is resolved by the server adapter; these tests hand the procedures its result.
vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return {
		protectedProcedure: os.$context<{
			user: { id: string };
			authentication: { user: { id: string }; method: "apiKey" | "bearer" | "session" };
		}>(),
	};
});

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("Rezumi AI credit ledger", () => {
	let credits: typeof import("./credits");
	let runBillingJobs: typeof import("./jobs").runBillingJobs;
	let router: typeof import("./router").billingRouter;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `credits_test_${randomUUID().replaceAll("-", "")}`;
	// Procedures read the real clock, so the ledger's clock starts there too.
	const now = new Date();
	const days = (count: number) => new Date(+now + count * DAY_MS);

	const as = (id: string, method: "apiKey" | "bearer" | "session" = "session") =>
		createRouterClient(router, {
			context: { user: { id }, authentication: { user: { id }, method }, reqHeaders: new Headers() } as never,
		});

	const grant = (userId: string, amount: number, expiresAt: Date, source: "trial" | "plan" | "admin" = "plan") =>
		// The test client has no relational schema; the ledger only needs the transaction's query builder.
		getDb().transaction((tx) => credits.grantCredits(tx as never, { userId, source, amount, expiresAt, now }));

	const reserve = (
		userId: string,
		idempotencyKey: string,
		actionKey: "short-text" | "review" = "short-text",
		at = now,
	) => credits.reserveCredits({ userId, actionKey, idempotencyKey, now: at });

	const grantsOf = (userId: string) =>
		getDb()
			.select()
			.from(tables.aiCreditGrant)
			.where(eq(tables.aiCreditGrant.userId, userId))
			.orderBy(asc(tables.aiCreditGrant.expiresAt));

	const balanceOf = async (userId: string, at = now) => (await credits.getCreditBalance(userId, at)).balance;

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
		credits = await import("./credits");
		({ runBillingJobs } = await import("./jobs"));
		({ billingRouter: router } = await import("./router"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "admins";
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
			.values([
				person("owner", { role: "admin" }),
				person("member"),
				person("guest", { role: "admin", isAnonymous: true }),
				person("unverified", { role: "admin", emailVerified: false }),
			]);
	});

	it("reserves, then commits with what the provider reported", async () => {
		await grant("owner", 10, days(30));
		const reservation = await reserve("owner", "job-1", "review");
		expect(reservation).toMatchObject({ credits: 4, balanceAfter: 6, status: "reserved" });
		expect(await balanceOf("owner")).toBe(6);
		const result = {
			provider: "openai",
			model: "test-model",
			inputTokens: 1200,
			outputTokens: 300,
			costUsdMicros: 4500,
		};
		expect(await credits.commitCredits(reservation.usageId, result, now)).toMatchObject({ status: "committed" });
		const [usage] = await getDb().select().from(tables.aiCreditUsage);
		expect(usage).toMatchObject({ status: "committed", action: "review", credits: 4, ...result });
		expect(usage?.settledAt).toEqual(now);
		expect(await balanceOf("owner")).toBe(6);
		// Settling again changes nothing: the credits stay spent.
		expect(await credits.releaseCredits(reservation.usageId, "late_failure", now)).toMatchObject({
			status: "committed",
		});
		expect(await balanceOf("owner")).toBe(6);
	});

	it("gives released credits back to the grants they came from, soonest expiry first", async () => {
		await grant("owner", 2, days(5));
		await grant("owner", 10, days(30));
		const reservation = await reserve("owner", "job-1", "review");
		expect((await grantsOf("owner")).map((row) => row.remaining)).toEqual([0, 8]);
		const [usage] = await getDb().select().from(tables.aiCreditUsage);
		expect(usage?.allocations.map((allocation) => allocation.credits)).toEqual([2, 2]);
		expect(await credits.releaseCredits(reservation.usageId, "provider_error", now)).toMatchObject({
			status: "released",
		});
		expect((await grantsOf("owner")).map((row) => row.remaining)).toEqual([2, 10]);
		// Releasing twice gives nothing back twice.
		await credits.releaseCredits(reservation.usageId, "provider_error", now);
		expect((await grantsOf("owner")).map((row) => row.remaining)).toEqual([2, 10]);
		const [released] = await getDb().select().from(tables.aiCreditUsage);
		expect(released).toMatchObject({ status: "released", errorCode: "provider_error" });
		// A released reservation can't be committed afterwards.
		const result = { provider: "p", model: "m", inputTokens: 1, outputTokens: 1, costUsdMicros: 1 };
		expect(await credits.commitCredits(reservation.usageId, result, now)).toMatchObject({ status: "released" });
		expect(await balanceOf("owner")).toBe(12);
	});

	it("takes credits once per idempotency key", async () => {
		await grant("owner", 10, days(30));
		const first = await reserve("owner", "click-1", "review");
		const again = await reserve("owner", "click-1", "review");
		expect(first.created).toBe(true);
		expect(again).toEqual({ ...first, balanceAfter: 6, created: false });
		const other = await reserve("owner", "click-2", "review");
		expect(other.usageId).not.toBe(first.usageId);
		expect(await balanceOf("owner")).toBe(2);
		// The same key for another action is another piece of work.
		expect((await reserve("owner", "click-1", "short-text")).usageId).not.toBe(first.usageId);
		await expect(reserve("owner", "  ")).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("refuses with the cost and balance when credits are too few, taking nothing", async () => {
		await grant("owner", 3, days(30));
		await expect(reserve("owner", "big", "review")).rejects.toMatchObject({
			code: "INSUFFICIENT_CREDITS",
			status: 403,
			data: { required: 4, balance: 3 },
		});
		expect(await balanceOf("owner")).toBe(3);
		expect(await getDb().select().from(tables.aiCreditUsage)).toEqual([]);
	});

	it("never spends expired or revoked credits, and a release into an expired grant stays unspendable", async () => {
		await grant("owner", 5, days(1));
		const reservation = await reserve("owner", "job-1", "review");
		const later = days(2);
		expect(await balanceOf("owner", later)).toBe(0);
		await credits.releaseCredits(reservation.usageId, "provider_error", later);
		expect((await grantsOf("owner"))[0]?.remaining).toBe(5);
		expect(await balanceOf("owner", later)).toBe(0);
		await expect(reserve("owner", "job-2", "short-text", later)).rejects.toMatchObject({
			code: "INSUFFICIENT_CREDITS",
		});

		const revoked = await grant("owner", 5, days(30));
		expect(await balanceOf("owner", later)).toBe(5);
		await getDb().update(tables.aiCreditGrant).set({ revokedAt: now }).where(eq(tables.aiCreditGrant.id, revoked.id));
		expect(await balanceOf("owner", later)).toBe(0);
	});

	it("shows the soonest expiry and how many credits expire then", async () => {
		await grant("owner", 3, days(5));
		await grant("owner", 2, days(5), "admin");
		await grant("owner", 10, days(30));
		expect(await credits.getCreditBalance("owner", now)).toMatchObject({
			balance: 15,
			nextExpiry: { credits: 5, at: days(5) },
		});
		expect((await credits.getCreditBalance("owner", days(6))).nextExpiry).toEqual({ credits: 10, at: days(30) });
		expect((await credits.getCreditBalance("member", now)).nextExpiry).toBeNull();
	});

	it("lets ten parallel reservations spend only what the balance holds", async () => {
		await grant("owner", 3, days(30));
		const results = await Promise.allSettled(
			Array.from({ length: 10 }, (_, index) => reserve("owner", `device-${index}`)),
		);
		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
		const refused = results.filter((result) => result.status === "rejected");
		expect(refused).toHaveLength(7);
		for (const result of refused) expect(result.reason).toMatchObject({ code: "INSUFFICIENT_CREDITS" });
		expect(await balanceOf("owner")).toBe(0);
		expect((await grantsOf("owner"))[0]?.remaining).toBe(0);
	});

	it("gives the trial once, to verified registered accounts, only while billing applies", async () => {
		const trial = (userId: string, at = now) =>
			getDb().transaction((tx) => credits.ensureTrialCredits(tx as never, userId, at));

		fixture.mode = "off";
		expect(await trial("owner")).toBe(false);
		fixture.mode = "admins";
		expect(await trial("member")).toBe(false);
		expect(await trial("guest")).toBe(false);
		expect(await trial("unverified")).toBe(false);
		expect(await getDb().select().from(tables.aiCreditGrant)).toEqual([]);

		expect((await credits.getCreditBalance("owner", now)).trial).toEqual({
			available: true,
			grantedAt: null,
			expiresAt: null,
		});
		expect(await trial("owner")).toBe(true);
		expect(await trial("owner", days(1))).toBe(false);
		const balance = await credits.getCreditBalance("owner", now);
		expect(balance).toMatchObject({
			balance: 5,
			nextExpiry: { credits: 5, at: days(14) },
			trial: { available: false, grantedAt: now, expiresAt: days(14) },
		});
		// Even with the trial spent and expired, it never comes back.
		await getDb().delete(tables.aiCreditGrant);
		expect(await trial("owner", days(20))).toBe(false);

		fixture.mode = "on";
		expect(await trial("member")).toBe(true);
		expect(await trial("guest")).toBe(false);
		expect(await trial("unverified")).toBe(false);
	});

	it("releases reservations left waiting past 15 minutes, once, even when two runs overlap", async () => {
		await grant("owner", 10, days(30));
		await grant("member", 10, days(30));
		await reserve("owner", "old", "review", new Date(+now - 20 * 60_000));
		await reserve("member", "old", "review", new Date(+now - 16 * 60_000));
		const fresh = await reserve("owner", "fresh", "review", new Date(+now - 5 * 60_000));
		const runs = await Promise.all([runBillingJobs(now), runBillingJobs(now)]);
		expect(runs.reduce((sum, run) => sum + run.releasedReservations, 0)).toBe(2);
		expect(await balanceOf("owner")).toBe(6);
		expect(await balanceOf("member")).toBe(10);
		const usages = await getDb().select().from(tables.aiCreditUsage);
		expect(usages.filter((usage) => usage.status === "released")).toHaveLength(2);
		expect(usages.find((usage) => usage.id === fresh.usageId)?.status).toBe("reserved");
		expect(usages.find((usage) => usage.status === "released")?.errorCode).toBe("stale_reservation");
		expect(await runBillingJobs(now)).toMatchObject({ releasedReservations: 0 });
	});

	it("lets an admin correct credits with a reason, never below zero", async () => {
		const added = await as("owner").admin.adjustCredits({
			email: "MEMBER@example.test",
			amount: 7,
			expiresInDays: 10,
			reason: "Support credit",
		});
		expect(added).toMatchObject({ userId: "member", amount: 7, balance: 7 });
		expect(+(added.expiresAt ?? 0) - Date.now()).toBeGreaterThan(9 * DAY_MS);
		await grant("member", 5, days(400));

		const taken = await as("owner").admin.adjustCredits({ userId: "member", amount: -9, reason: "Correction" });
		expect(taken).toMatchObject({ amount: -9, balance: 3, expiresAt: null });
		// The soonest-expiring grant (the admin one) went first.
		expect((await grantsOf("member")).map((row) => [row.source, row.remaining])).toEqual([
			["admin", 0],
			["plan", 3],
		]);
		await expect(
			as("owner").admin.adjustCredits({ userId: "member", amount: -4, reason: "Too much" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST", data: { balance: 3 } });
		await expect(
			as("owner").admin.adjustCredits({ userId: "member", amount: 5, reason: "No expiry" }),
		).rejects.toBeDefined();
		await expect(
			as("member").admin.adjustCredits({ userId: "member", amount: 5, expiresInDays: 5, reason: "Self" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			as("owner", "bearer").admin.adjustCredits({ userId: "member", amount: 5, expiresInDays: 5, reason: "App" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		const audit = await getDb().select().from(tables.billingAuditLog).orderBy(asc(tables.billingAuditLog.createdAt));
		expect(audit.map((entry) => [entry.action, entry.reason, entry.actorUserId, entry.targetUserId])).toEqual([
			["credits.adjusted", "Support credit", "owner", "member"],
			["credits.adjusted", "Correction", "owner", "member"],
		]);
		expect(audit[1]?.details).toMatchObject({ amount: -9, balanceBefore: 12, balanceAfter: 3 });
		const [correction] = await getDb()
			.select()
			.from(tables.aiCreditUsage)
			.where(eq(tables.aiCreditUsage.userId, "member"));
		expect(correction).toMatchObject({ action: "admin-adjustment", status: "committed", credits: 9 });
	});

	it("shows credits and their history only while billing applies to the account", async () => {
		await grant("owner", 10, days(30));
		await grant("member", 10, days(30));
		await reserve("owner", "job-1", "review", new Date(+now + 1000));

		const summary = await as("owner").summary();
		expect(summary.credits).toMatchObject({ balance: 6, nextExpiry: { credits: 6 } });
		const history = await as("owner").creditHistory({ limit: 1 });
		expect(history).toMatchObject({ hasMore: true, items: [{ type: "usage", action: "review", status: "reserved" }] });
		expect((await as("owner").creditHistory({ limit: 1, offset: 1 })).items).toMatchObject([
			{ type: "grant", source: "plan", amount: 10, remaining: 6 },
		]);
		expect(await as("owner").creditHistory({ offset: 2 })).toEqual({ items: [], hasMore: false });

		expect((await as("member").summary()).credits).toBeNull();
		expect(await as("member").creditHistory()).toEqual({ items: [], hasMore: false });
		fixture.mode = "off";
		expect((await as("owner").summary()).credits).toBeNull();
		expect(await as("owner").creditHistory()).toEqual({ items: [], hasMore: false });
	});

	it("keeps remaining within the grant's amount", async () => {
		await grant("owner", 5, days(30));
		await expect(getDb().update(tables.aiCreditGrant).set({ remaining: 6 })).rejects.toThrow();
		await expect(getDb().update(tables.aiCreditGrant).set({ remaining: -1 })).rejects.toThrow();
		await expect(grant("owner", 0, days(30))).rejects.toThrow();
		await expect(grant("owner", 5, now)).rejects.toThrow();
	});

	it("deletes credits with the account", async () => {
		await grant("member", 5, days(30));
		await reserve("member", "job-1");
		await getDb().delete(tables.user).where(eq(tables.user.id, "member"));
		expect(await getDb().select().from(tables.aiCreditGrant)).toEqual([]);
		expect(await getDb().select().from(tables.aiCreditUsage)).toEqual([]);
	});
});
