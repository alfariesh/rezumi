import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	alertEmail: "owner@example.test" as string | undefined,
	minimumVersion: undefined as string | undefined,
	ai: null as null | { model: object; succeed: () => Promise<void>; fail: () => Promise<void> },
	fields: { company: "", role: "", location: "", salary: "", requirements: [] as string[] },
	emails: [] as { to: string; subject: string; notice: { rows?: { label: string; value: string }[] } }[],
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
			get BILLING_ALERT_EMAIL() {
				return fixture.alertEmail;
			},
			get EXTENSION_MIN_VERSION() {
				return fixture.minimumVersion;
			},
		},
	};
});
// No AI provider unless a test sets one; a set one answers with `fixture.fields`.
vi.mock("../billing/metered-ai", () => ({
	startAiRun: vi.fn(async () => fixture.ai),
	runWithAiSource: vi.fn(),
	errorCode: () => "failed",
}));
vi.mock("../ai/generate-json", () => ({
	aiDeadline: () => undefined,
	generateJson: vi.fn(async () => fixture.fields),
}));
vi.mock("@rezumi/email/billing", () => ({
	deliverBillingNotice: vi.fn(async (input: (typeof fixture.emails)[number]) => {
		fixture.emails.push(input);
		return "sent";
	}),
}));

const databaseUrl = process.env.APPLICATIONS_TEST_DATABASE_URL;

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const capture = (overrides: Record<string, unknown> = {}) => ({
	url: "https://www.linkedin.com/jobs/search/?currentJobId=4012345678&trk=public",
	canonicalUrl: "https://www.linkedin.com/jobs/view/4012345678/",
	site: "linkedin" as const,
	pageTitle: "Product Designer | Lumen Labs | LinkedIn",
	jsonLd: [] as string[],
	text: "Product Designer at Lumen Labs. You will design the onboarding flow.",
	...overrides,
});

const jobPosting = JSON.stringify({
	"@context": "https://schema.org",
	"@type": "JobPosting",
	title: "Data Analyst",
	hiringOrganization: { "@type": "Organization", name: "Nusantara Data" },
	jobLocation: { "@type": "Place", address: { addressLocality: "Jakarta", addressCountry: "ID" } },
	description: "<p>Analyse <b>sales</b> data.</p>",
	validThrough: "2026-12-31",
});

// Opt-in real PostgreSQL tests: every table lives in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("browser extension procedures", () => {
	let admin: Pool;
	let pool: Pool;
	let router: typeof import("./router").applicationsRouter;
	let jobs: typeof import("./extension-jobs");
	const schemaName = `extension_test_${randomUUID().replaceAll("-", "")}`;

	const client = (id = "member", headers: Record<string, string> = {}) =>
		createRouterClient(router, {
			context: {
				locale: "en-US",
				user: { id },
				authentication: { user: { id }, method: "session", permissions: ["read", "write", "delete"] },
				reqHeaders: new Headers(headers),
			} as never,
		});

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({
			connectionString: databaseUrl,
			max: 5,
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
		({ applicationsRouter: router } = await import("./router"));
		jobs = await import("./extension-jobs");
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.alertEmail = "owner@example.test";
		fixture.minimumVersion = undefined;
		fixture.ai = null;
		fixture.emails = [];
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
	});

	const keyOf = async (id: string) =>
		(
			await getDb()
				.select({ key: tables.application.sourceKey })
				.from(tables.application)
				.where(eq(tables.application.id, id))
		)[0]?.key;

	describe("source_key", () => {
		it("is set from the address on create, update and import, and cleared with it", async () => {
			const api = client();
			const id = await api.create({
				company: "Lumen Labs",
				role: "Designer",
				sourceUrl: "https://www.linkedin.com/jobs/view/4012345678/?trk=abc",
			});
			expect(await keyOf(id)).toBe("linkedin:4012345678");

			await api.update({ id, notes: "No address in this change" });
			expect(await keyOf(id)).toBe("linkedin:4012345678");
			await api.update({ id, sourceUrl: "https://careers.acme.example/jobs?gh_jid=42&utm_source=x" });
			expect(await keyOf(id)).toBe("url:careers.acme.example/jobs?gh_jid=42");
			await api.update({ id, sourceUrl: null });
			expect(await keyOf(id)).toBeNull();

			await api.import({
				items: [
					{ company: "A", role: "One", sourceUrl: "https://id.indeed.com/viewjob?jk=0a1b2c3d4e5f6a7b" },
					{ company: "B", role: "Two" },
				],
			});
			const keys = await getDb().select({ key: tables.application.sourceKey }).from(tables.application);
			expect(keys.map(({ key }) => key)).toEqual(expect.arrayContaining(["indeed:0a1b2c3d4e5f6a7b", null]));
		});

		it("never shows in the application itself", async () => {
			const api = client();
			const id = await api.create({
				company: "A",
				role: "B",
				sourceUrl: "https://glints.com/id/opportunities/jobs/designer/6f1c2a8e-1d2b-4c3d-9e8f-0a1b2c3d4e5f",
			});
			expect(await api.getById({ id })).not.toHaveProperty("sourceKey");
		});
	});

	describe("savedKeys", () => {
		it("lists only the account's own postings that have a key, newest first", async () => {
			const mine = client();
			const first = await mine.create({
				company: "A",
				role: "One",
				sourceUrl: "https://id.indeed.com/viewjob?jk=1111aaaa2222bbbb",
			});
			await mine.create({ company: "B", role: "No address" });
			const second = await mine.create({
				company: "C",
				role: "Two",
				status: "applied",
				sourceUrl: "https://www.linkedin.com/jobs/view/4200000042/",
			});
			await client("other").create({
				company: "D",
				role: "Theirs",
				sourceUrl: "https://id.indeed.com/viewjob?jk=3333cccc4444dddd",
			});

			const { keys } = await mine.savedKeys();
			expect(keys.map(({ key, id, status }) => ({ key, id, status }))).toEqual([
				{ key: "linkedin:4200000042", id: second, status: "applied" },
				{ key: "indeed:1111aaaa2222bbbb", id: first, status: "saved" },
			]);
		});

		it("returns at most 5,000 keys", async () => {
			const rows = Array.from({ length: 5_003 }, (_, index) => ({
				userId: "member",
				company: "A",
				role: `Role ${index}`,
				sourceKey: `url:example.test/${index}`,
				updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
			}));
			for (let start = 0; start < rows.length; start += 1_000)
				await getDb()
					.insert(tables.application)
					.values(rows.slice(start, start + 1_000));
			const { keys } = await client().savedKeys();
			expect(keys).toHaveLength(5_000);
			expect(keys[0]?.key).toBe("url:example.test/5002");
		});
	});

	describe("readCapture", () => {
		it("fills the fields from the page's JSON-LD without AI and never fetches the address", async () => {
			const fetchSpy = vi.spyOn(globalThis, "fetch");
			const result = await client().readCapture(
				capture({
					url: "https://careers.nusantara.example/jobs/7?utm_source=linkedin",
					canonicalUrl: "https://careers.nusantara.example/jobs/7",
					site: null,
					jsonLd: ["not json", jobPosting],
					text: "Menu Careers Data Analyst Apply",
				}),
			);
			expect(fetchSpy).not.toHaveBeenCalled();
			fetchSpy.mockRestore();
			expect(result).toMatchObject({
				role: "Data Analyst",
				company: "Nusantara Data",
				location: "Jakarta, ID",
				salary: "",
				filledBy: "page",
				enrichmentWarning: null,
				sourceUrl: "https://careers.nusantara.example/jobs/7",
				validThrough: "2026-12-31",
				existing: null,
				postingSource: {
					method: "extension",
					format: "text",
					requestedUrl: "https://careers.nusantara.example/jobs/7?utm_source=linkedin",
					truncated: false,
				},
			});
			expect(result.jobDescription).toContain("Analyse sales data.");
		});

		it("uses the board reader's fields and the selection, and saves the board's permanent address", async () => {
			const result = await client().readCapture(
				capture({
					selection: "  Only this part  ",
					fields: {
						role: "Product Designer",
						company: "Lumen Labs",
						salary: "Rp 15–20 jt",
						validThrough: "2026-11-30",
					},
				}),
			);
			expect(result).toMatchObject({
				role: "Product Designer",
				company: "Lumen Labs",
				salary: "Rp 15–20 jt",
				jobDescription: "Only this part",
				sourceUrl: "https://www.linkedin.com/jobs/view/4012345678/",
				validThrough: "2026-11-30",
				filledBy: "page",
			});
		});

		it("says nothing filled the fields when the page has no data", async () => {
			const result = await client().readCapture(
				capture({ site: null, url: "https://blog.example/post", canonicalUrl: "https://blog.example/post" }),
			);
			expect(result).toMatchObject({ role: "", company: "", filledBy: "none", validThrough: null });
		});

		it("lets AI fill what the page left out", async () => {
			fixture.ai = { model: {}, succeed: vi.fn(async () => {}), fail: vi.fn(async () => {}) };
			fixture.fields = {
				company: "",
				role: "Senior Product Designer",
				location: "Remote",
				salary: "",
				requirements: ["Figma"],
			};
			const result = await client().readCapture(capture({ fields: { company: "Lumen Labs", salary: "Rp 20 jt" } }));
			expect(result).toMatchObject({
				role: "Senior Product Designer",
				company: "Lumen Labs",
				location: "Remote",
				salary: "Rp 20 jt",
				requirements: ["Figma"],
				filledBy: "ai",
			});
			expect(fixture.ai.succeed).toHaveBeenCalled();
		});

		it("names the application already saved for the same posting, the account's own only", async () => {
			const id = await client().create({
				company: "Lumen Labs",
				role: "Designer",
				status: "applied",
				sourceUrl: "https://www.linkedin.com/jobs/view/4012345678/",
			});
			expect((await client().readCapture(capture())).existing).toMatchObject({
				id,
				status: "applied",
				role: "Designer",
			});
			expect((await client("other").readCapture(capture())).existing).toBeNull();
		});
	});

	describe("reportCapture", () => {
		const report = {
			url: "https://www.jobstreet.com/id/job/123",
			site: "jobstreet" as const,
			extensionVersion: "0.2.0",
			missing: ["company", "salary", "company"],
		};

		it("keeps the address, board, version and missing fields, and refuses the eleventh in an hour", async () => {
			const api = client();
			for (let index = 0; index < 10; index++) await api.reportCapture(report);
			await expect(api.reportCapture(report)).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED" });
			await client("other").reportCapture(report);
			const rows = await getDb().select().from(tables.extensionCaptureReport);
			expect(rows).toHaveLength(11);
			expect(rows[0]).toMatchObject({
				url: report.url,
				site: "jobstreet",
				extensionVersion: "0.2.0",
				missing: ["company", "salary"],
			});
		});

		it("mails pending reports merged, at most once an hour, without page text", async () => {
			const api = client();
			await api.reportCapture(report);
			await api.reportCapture({ ...report, site: null, url: "https://careers.acme.example/7", missing: [] });
			const now = new Date();
			expect(await jobs.sendCaptureReportDigest(now)).toBe(true);
			expect(fixture.emails).toHaveLength(1);
			expect(fixture.emails[0]?.to).toBe("owner@example.test");
			expect(fixture.emails[0]?.notice.rows?.map((row) => row.value)).toEqual([
				"https://www.jobstreet.com/id/job/123 (tidak terbaca: company, salary)",
				"https://careers.acme.example/7",
			]);

			await api.reportCapture(report);
			expect(await jobs.sendCaptureReportDigest(new Date(now.getTime() + 30 * 60_000))).toBe(false);
			expect(await jobs.sendCaptureReportDigest(new Date(now.getTime() + 61 * 60_000))).toBe(true);
			expect(fixture.emails).toHaveLength(2);
			expect(fixture.emails[1]?.notice.rows).toHaveLength(1);
		});

		it("waits without an operator address, and deletes reports after 30 days", async () => {
			fixture.alertEmail = undefined;
			await client().reportCapture(report);
			expect(await jobs.sendCaptureReportDigest(new Date())).toBe(false);
			expect(await jobs.deleteOldCaptureReports(new Date())).toBe(0);
			expect(await jobs.deleteOldCaptureReports(new Date(Date.now() + 31 * 86_400_000))).toBe(1);
		});
	});

	describe("EXTENSION_MIN_VERSION", () => {
		it("refuses an older extension and serves everyone else", async () => {
			fixture.minimumVersion = "0.2.0";
			await expect(client("member", { "x-rezumi-extension": "0.1.0" }).savedKeys()).rejects.toMatchObject({
				code: "EXTENSION_OUTDATED",
				status: 426,
			});
			await expect(client("member", { "x-rezumi-extension": "0.2.0" }).savedKeys()).resolves.toEqual({ keys: [] });
			await expect(client().savedKeys()).resolves.toEqual({ keys: [] });
		});
	});
});
