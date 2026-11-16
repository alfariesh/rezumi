import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { defaultResumeData } from "@rezumi/schema/resume/default";

const fixture = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle> | undefined }));
vi.mock("@rezumi/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));

const databaseUrl = process.env.APPLICATIONS_TEST_DATABASE_URL;

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

// Opt-in real PostgreSQL tests: every table lives in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("applications.create with a linked resume", () => {
	let admin: Pool;
	let pool: Pool;
	let router: typeof import("./router").applicationsRouter;
	const schemaName = `applications_create_test_${randomUUID().replaceAll("-", "")}`;

	const client = (id = "member") =>
		createRouterClient(router, {
			context: {
				locale: "en-US",
				user: { id },
				authentication: { user: { id }, method: "session", permissions: ["read", "write", "delete"] },
				reqHeaders: new Headers(),
			} as never,
		});

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		// One connection per request, as on Cloudflare Workers; a short lock_timeout stands in for production's statement_timeout.
		pool = new Pool({
			connectionString: databaseUrl,
			max: 1,
			connectionTimeoutMillis: 5_000,
			options: `-c search_path=${schemaName} -c statement_timeout=10000 -c lock_timeout=1000`,
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
		({ applicationsRouter: router } = await import("./router"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		await pool.query('TRUNCATE "user" CASCADE');
		await getDb()
			.insert(tables.user)
			.values(
				["member", "other"].map((id) => ({
					id,
					name: id,
					email: `${id}@example.test`,
					username: id,
					displayUsername: id,
				})),
			);
		await getDb()
			.insert(tables.resume)
			.values([
				{ id: "cv", userId: "member", name: "QA CV", slug: "qa-cv", data: defaultResumeData },
				{ id: "theirs", userId: "other", name: "Their CV", slug: "their-cv", data: defaultResumeData },
			]);
	});

	// The posting the dialog sends after reading pasted text with AI (ISSUE-004, QA 2026-11-16).
	const posting = {
		company: "QA Test Company",
		role: "QA TEST - Manual QA Engineer",
		status: "saved" as const,
		location: "Remote Indonesia",
		salary: "IDR 12,000,000–18,000,000 monthly",
		requirements: ["3 years manual web QA", "API testing basics", "Collaboration with developers"],
		jobDescription: "QA TEST FIXTURE — fictional job. QA Manual Engineer at QA Test Company.",
		postingSource: {
			method: "paste" as const,
			format: "text" as const,
			truncated: false,
			completeness: "unknown" as const,
		},
	};

	it("saves the job linked to the chosen resume", async () => {
		const id = await client().create({ ...posting, resumeId: "cv" });
		const [row] = await getDb().select().from(tables.application).where(eq(tables.application.id, id));
		expect(row?.resumeId).toBe("cv");
	});

	it("saves a job already applied for with the chosen resume, recording the sent version", async () => {
		const id = await client().create({ ...posting, status: "applied", stageEnteredAt: "2026-11-16", resumeId: "cv" });
		const [row] = await getDb().select().from(tables.application).where(eq(tables.application.id, id));
		expect(row?.resumeId).toBe("cv");
		expect(row?.sentResumeVersionId).toBeTruthy();
	});

	it("refuses someone else's resume as not found", async () => {
		await expect(client().create({ ...posting, resumeId: "theirs" })).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("answers a save blocked on the linked resume's row lock with a retryable error, not a bare 500", async () => {
		const holder = await admin.connect();
		try {
			await holder.query("BEGIN");
			await holder.query(`SELECT id FROM ${schemaName}.resume WHERE id = 'cv' FOR UPDATE`);

			// The foreign-key check on resume_id waits for the lock; saving without a resume does not.
			await expect(client().create({ ...posting, resumeId: "cv" })).rejects.toMatchObject({
				code: "SERVICE_UNAVAILABLE",
				status: 503,
				message: "Couldn't save the application just now. Try again.",
			});
			await expect(client().create(posting)).resolves.toEqual(expect.any(String));
		} finally {
			await holder.query("ROLLBACK");
			holder.release();
		}

		await expect(client().create({ ...posting, resumeId: "cv" })).resolves.toEqual(expect.any(String));
	});
});
