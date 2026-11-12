import type { BillingMode } from "./entitlements";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { createRouterClient } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { DAY_MS } from "./timeline";

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
describe.skipIf(!databaseUrl)("billing foundation", () => {
	let router: typeof import("./router").billingRouter;
	let getEntitlements: typeof import("./entitlements").getEntitlements;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `billing_test_${randomUUID().replaceAll("-", "")}`;

	const as = (id: string, method: "apiKey" | "bearer" | "session" = "session") =>
		createRouterClient(router, {
			context: { user: { id }, authentication: { user: { id }, method }, reqHeaders: new Headers() } as never,
		});

	async function periodsOf(userId: string) {
		return getDb()
			.select()
			.from(tables.membershipPeriod)
			.where(eq(tables.membershipPeriod.userId, userId))
			.orderBy(asc(tables.membershipPeriod.startsAt));
	}

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
		({ billingRouter: router } = await import("./router"));
		({ getEntitlements } = await import("./entitlements"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "off";
		await pool.query('TRUNCATE "user", billing_audit_log CASCADE');
		await getDb()
			.insert(tables.user)
			.values([
				{
					id: "owner",
					name: "Owner",
					email: "owner@example.test",
					username: "owner",
					displayUsername: "owner",
					role: "admin",
				},
				{
					id: "member",
					name: "Member",
					email: "Member@Example.test",
					username: "member",
					displayUsername: "member",
				},
			]);
	});

	it("queues parallel grants for one account back to back, without overlap or lost days", async () => {
		const plans = ["plus", "pro-ai", "plus", "pro-ai", "plus"] as const;
		await Promise.all(
			plans.map((planId) => as("owner").admin.grantPeriod({ userId: "member", planId, days: 30, reason: "Load test" })),
		);
		const rows = await periodsOf("member");
		const active = rows.filter((row) => !row.revokedAt);
		for (const [index, row] of active.entries()) {
			const next = active[index + 1];
			if (next) expect(+next.startsAt).toBeGreaterThanOrEqual(+row.endsAt);
		}
		const paid = active.reduce((total, row) => total + (+row.endsAt - +row.startsAt), 0);
		expect(paid).toBe(plans.length * 30 * DAY_MS);
		// Higher plans come first: both Pro AI passes run before the Plus days still waiting.
		const upcoming = active.filter((row) => row.endsAt > new Date());
		const firstPlus = upcoming.findIndex((row) => row.planId === "plus");
		expect(upcoming.slice(firstPlus).every((row) => row.planId === "plus")).toBe(true);
		const [account] = await getDb()
			.select()
			.from(tables.billingAccount)
			.where(eq(tables.billingAccount.userId, "member"));
		expect(account).toBeDefined();
		const audit = await getDb().select().from(tables.billingAuditLog);
		expect(audit).toHaveLength(plans.length);
		expect(
			audit.every((entry) => entry.action === "period.granted" && entry.actorUserId === "owner" && entry.reason),
		).toBe(true);
	});

	it("finds the account by email in any case and records who granted it", async () => {
		const period = await as("owner").admin.grantPeriod({
			email: "member@example.TEST",
			planId: "plus",
			days: 7,
			reason: "Support",
		});
		expect(period).toMatchObject({ userId: "member", planId: "plus" });
		expect(+period.endsAt - +period.startsAt).toBe(7 * DAY_MS);
		const [row] = await periodsOf("member");
		expect(row).toMatchObject({ source: "admin", grantedBy: "owner" });
	});

	it("lets only admins on a web session use the billing tools", async () => {
		const input = { userId: "member", planId: "plus", days: 30, reason: "Not allowed" } as const;
		await expect(as("member").admin.grantPeriod(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(as("owner", "apiKey").admin.grantPeriod(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(as("owner", "bearer").admin.grantPeriod(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(as("member").admin.revokePeriod({ periodId: "any", reason: "Not allowed" })).rejects.toBeInstanceOf(
			ORPCError,
		);
		await expect(
			as("owner").admin.grantPeriod({ userId: "nobody", planId: "plus", days: 30, reason: "Missing" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(await periodsOf("member")).toEqual([]);
		expect(await getDb().select().from(tables.billingAuditLog)).toEqual([]);
	});

	it("revokes a running pass, moves the queued one up, and refuses to revoke it twice", async () => {
		const pro = await as("owner").admin.grantPeriod({ userId: "member", planId: "pro-ai", days: 30, reason: "Test" });
		const plus = await as("owner").admin.grantPeriod({ userId: "member", planId: "plus", days: 20, reason: "Test" });
		const revoked = await as("owner").admin.revokePeriod({ periodId: pro.id, reason: "Refund" });
		expect(+revoked.endsAt).toBeLessThanOrEqual(Date.now());
		const rows = await periodsOf("member");
		const moved = rows.find((row) => row.id === plus.id);
		expect(moved?.startsAt).toEqual(revoked.endsAt);
		expect(+(moved?.endsAt ?? 0) - +(moved?.startsAt ?? 0)).toBe(20 * DAY_MS);
		expect(rows.find((row) => row.id === pro.id)).toMatchObject({ revokeReason: "Refund" });
		await expect(as("owner").admin.revokePeriod({ periodId: pro.id, reason: "Again" })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		const actions = (await getDb().select().from(tables.billingAuditLog)).map((entry) => entry.action).toSorted();
		expect(actions).toEqual(["period.granted", "period.granted", "period.revoked"]);
	});

	it("leaves every account unlimited while billing is off, even with a pass", async () => {
		await as("owner").admin.grantPeriod({ userId: "member", planId: "plus", days: 30, reason: "Test" });
		await getDb().insert(tables.resume).values({ id: "r1", userId: "member", name: "CV", slug: "cv" });
		const summary = await as("member").summary();
		expect(summary).toEqual({
			enabled: false,
			planId: "free",
			currentPeriodEndsAt: null,
			source: null,
			renews: false,
			subscription: null,
			currency: "usd",
			paymentMethods: [],
			paymentMethod: null,
			upcoming: [],
			limits: { activeResumes: { used: 1, max: null }, activeCoverLetters: { used: 0, max: null } },
			features: {
				premiumTemplates: true,
				brandLogos: true,
				wordOdtExport: true,
				customStyles: true,
				customFonts: true,
				automationApi: true,
				premiumPortfolioThemes: true,
				premiumHeroEffects: true,
				hidePortfolioCredit: true,
				customDomain: true,
				detailedPortfolioStats: true,
			},
			credits: null,
			canPurchase: false,
			purchaseBlockedBy: "unavailable",
			pendingPayment: null,
			trialAvailable: false,
		});
	});

	it("applies plans only to admins in admins mode, and to everyone when on", async () => {
		await as("owner").admin.grantPeriod({ userId: "owner", planId: "pro-ai", days: 30, reason: "Pilot" });
		fixture.mode = "admins";
		const ownerPlan = await getEntitlements("owner");
		expect(ownerPlan).toMatchObject({ enabled: true, planId: "pro-ai", limits: { activeResumes: 50 } });
		expect(await getEntitlements("member")).toMatchObject({ enabled: false, limits: { activeResumes: null } });

		fixture.mode = "on";
		expect(await getEntitlements("member")).toMatchObject({
			enabled: true,
			planId: "free",
			limits: { activeResumes: 3, activeCoverLetters: 3, portfolioWorks: 6 },
			features: { premiumTemplates: false },
		});
		const summary = await as("owner").summary();
		expect(summary).toMatchObject({
			enabled: true,
			planId: "pro-ai",
			limits: { activeResumes: { used: 0, max: 50 } },
		});
		expect(summary.currentPeriodEndsAt).toEqual(ownerPlan.currentPeriodEndsAt);
	});

	it("deletes passes with the account but keeps the audit trail", async () => {
		await as("owner").admin.grantPeriod({ userId: "member", planId: "plus", days: 30, reason: "Test" });
		await getDb().delete(tables.user).where(eq(tables.user.id, "member"));
		expect(await periodsOf("member")).toEqual([]);
		const [entry] = await getDb().select().from(tables.billingAuditLog);
		expect(entry).toMatchObject({ action: "period.granted", targetUserId: null, actorUserId: "owner" });
	});
});
