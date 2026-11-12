import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

/**
 * A guest opening a work's page (Phase 13, B2/B9) on the Node path with Postgres only (no Analytics Engine), from the
 * route to the owner's numbers: `servePortfolioWork` → `recordPortfolioVisit({ workId })` → the daily row →
 * `portfolio.workStatistics` and `portfolio.statistics`.
 */
const fixture = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle> | undefined }));
vi.mock("@rezumi/db/client", () => ({
	get db() {
		return fixture.db;
	},
	withDatabasePool: (_pool: unknown, callback: () => unknown) => callback(),
}));
vi.mock("@rezumi/env/server", async (original) => {
	const { env } = await original<typeof import("@rezumi/env/server")>();
	return {
		env: { ...env, APP_URL: "https://rezumi.example", PORTFOLIO_MODE: "on", BILLING_MODE: "off", REDIS_URL: undefined },
	};
});

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("a guest opening a work's page", () => {
	let admin: Pool;
	let pool: Pool;
	const schemaName = `portfolio_work_page_test_${randomUUID().replaceAll("-", "")}`;
	const suffix = randomUUID().slice(0, 8);
	const username = `pfwork-${suffix}`;

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({ connectionString: databaseUrl, max: 5, options: `-c search_path=${schemaName}` });
		fixture.db = drizzle({ client: pool });
		const migrations = new URL("../../../../migrations/", import.meta.url);
		const directories = (await readdir(migrations, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
			.map((entry) => entry.name)
			.sort();
		for (const directory of directories) {
			const file = new URL(`${directory}/migration.sql`, migrations);
			if (existsSync(file)) await pool.query((await readFile(file, "utf8")).replaceAll('"public".', ""));
		}
		await fixture.db.insert(tables.user).values({
			id: "owner",
			name: "Nadia Rahmawati",
			email: `owner-${suffix}@example.test`,
			username,
			displayUsername: username,
			emailVerified: true,
			timezone: "UTC",
			createdAt: new Date(Date.now() - 30 * 86_400_000),
		});
		await fixture.db.insert(tables.portfolio).values({
			userId: "owner",
			isPublic: true,
			data: { version: 1, works: { items: [{ id: "w1", slug: "kopi", title: "Coffee app" }] } } as never,
		});
	}, 60_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	it("counts the work as opened, which the owner then reads in both statistics", async () => {
		const { configurePortfolioVisitLifetime, servePortfolioWork } = await import("./portfolio-page");
		// On Node the count runs after the response; this test waits for it.
		const counting: Promise<unknown>[] = [];
		configurePortfolioVisitLifetime((work) => counting.push(work));
		const guest = () =>
			new Request(`https://rezumi.example/${username}/work/kopi`, {
				headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15" },
			});
		try {
			const response = await servePortfolioWork(guest(), username, "kopi", "203.0.113.10");
			expect(response.status).toBe(200);
			// Opened again within the hour by the same visitor: counted once.
			await servePortfolioWork(guest(), username, "kopi", "203.0.113.10");
			await Promise.all(counting);
		} finally {
			configurePortfolioVisitLifetime(undefined);
		}

		const { default: router } = await import("@rezumi/api/routers");
		const owner = { id: "owner", name: "Nadia", email: "owner@example.test" };
		const client = createRouterClient(router, {
			context: {
				user: owner,
				authentication: { user: owner, method: "session", permissions: ["read", "write", "delete"] },
				reqHeaders: new Headers(),
			} as never,
		});
		const work = await client.portfolio.workStatistics({ workId: "w1", range: 7 });
		expect(work.totals.opens).toBe(1);
		expect(work.days.at(-1)?.opens).toBe(1);
		expect(work.details).toEqual({ state: "not-configured" });
		const all = await client.portfolio.statistics({ range: 7 });
		expect(all?.works).toEqual([{ id: "w1", title: "Coffee app", opens: 1 }]);
		expect(all?.totals.views).toBe(1);
		expect(all?.days.at(-1)).toMatchObject({ views: 1, workOpens: 1 });
	});
});
