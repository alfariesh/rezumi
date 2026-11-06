import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { defaultResumeData } from "@rezumi/schema/resume/default";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as "off" | "admins" | "on",
	deleted: [] as string[],
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
			get PORTFOLIO_MODE() {
				return fixture.mode;
			},
		},
	};
});
vi.mock("../storage", () => ({
	getStorageService: () => ({
		delete: (key: string) => {
			fixture.deleted.push(key);
			return Promise.resolve(true);
		},
	}),
}));

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;

function resumeData(name: string): ResumeData {
	const data = structuredClone(defaultResumeData);
	data.basics.name = name;
	data.summary.content = "<p>Designer of calm apps.</p>";
	data.sections.projects.items = [
		{
			id: "p1",
			hidden: false,
			name: "Aplikasi Kopi",
			period: "2024",
			website: { url: "https://example.test/kopi", label: "", inlineLink: false },
			description: "<p>Coffee ordering.</p>",
		},
	];
	return data;
}

const image = (userId: string, name: string) => ({
	key: `uploads/${userId}/pictures/portfolio/${name}.webp`,
	width: 800,
	height: 600,
	alt: "",
});

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("portfolio service", () => {
	let service: typeof import("./service").portfolioService;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `portfolio_test_${randomUUID().replaceAll("-", "")}`;

	const addResume = async (userId: string, values: Partial<typeof tables.resume.$inferInsert> = {}) => {
		const [row] = await getDb()
			.insert(tables.resume)
			.values({ name: "CV", slug: `cv-${randomUUID().slice(0, 8)}`, userId, data: resumeData(userId), ...values })
			.returning({ id: tables.resume.id });
		return row?.id as string;
	};

	const addFile = (userId: string, name: string) =>
		getDb()
			.insert(tables.portfolioFile)
			.values({ userId, kind: "image", key: image(userId, name).key, bytes: 1000, width: 800, height: 600 });

	const save = async (userId: string, data: PortfolioDataInput, expectedUpdatedAt?: Date) => {
		const current = await service.get(userId);
		return service.update(userId, {
			data,
			expectedUpdatedAt: expectedUpdatedAt ?? (current.portfolio?.updatedAt as Date),
		});
	};

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
		({ portfolioService: service } = await import("./service"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		fixture.deleted = [];
		await pool.query('TRUNCATE "user", released_username CASCADE');
		await getDb()
			.insert(tables.user)
			.values(
				[
					{ id: "member", emailVerified: true },
					{ id: "other", emailVerified: true },
					{ id: "unverified", emailVerified: false },
					{ id: "owner", emailVerified: true, role: "admin" },
					{ id: "guest", emailVerified: false, isAnonymous: true },
				].map((account) => ({
					name: `${account.id} name`,
					email: `${account.id}@example.test`,
					username: account.id,
					displayUsername: account.id,
					...account,
				})),
			);
	});

	describe("the switch", () => {
		it("hides portfolios from everyone when off, without changing anything", async () => {
			fixture.mode = "off";
			expect((await service.get("owner")).enabled).toBe(false);
			await expect(service.create("owner", {})).rejects.toMatchObject({ code: "PORTFOLIO_DISABLED" });
			expect(await getDb().select().from(tables.portfolio)).toEqual([]);
		});

		it("opens portfolios to admins only while testing", async () => {
			fixture.mode = "admins";
			expect((await service.get("member")).enabled).toBe(false);
			await expect(service.create("member", {})).rejects.toMatchObject({ code: "PORTFOLIO_DISABLED" });
			expect((await service.get("owner")).enabled).toBe(true);
			await expect(service.create("owner", {})).resolves.toMatchObject({ isPublic: false });
		});

		it("never opens them to guest accounts", async () => {
			expect((await service.get("guest")).enabled).toBe(false);
			await expect(service.create("guest", {})).rejects.toMatchObject({ code: "PORTFOLIO_DISABLED" });
		});

		it("keeps a portfolio made while on, but refuses changes once off again", async () => {
			const created = await service.create("member", {});
			fixture.mode = "off";
			await expect(service.update("member", { data: {}, expectedUpdatedAt: created.updatedAt })).rejects.toMatchObject({
				code: "PORTFOLIO_DISABLED",
			});
			await expect(service.setPublic("member", { isPublic: true })).rejects.toMatchObject({
				code: "PORTFOLIO_DISABLED",
			});
			await expect(service.delete("member")).rejects.toMatchObject({ code: "PORTFOLIO_DISABLED" });
			expect(await getDb().select({ id: tables.portfolio.id }).from(tables.portfolio)).toHaveLength(1);
		});
	});

	describe("create", () => {
		it("starts from the primary resume: About from its summary and works from its projects", async () => {
			await addResume("member", { name: "Newer", isPrimary: false });
			const primary = await addResume("member", { name: "Main", isPrimary: true });
			const portfolio = await service.create("member", {});
			expect(portfolio.sourceResumeId).toBe(primary);
			expect(portfolio.sourceResume).toMatchObject({ id: primary, name: "Main", inTrash: false });
			expect(portfolio.data.about.content).toBe("<p>Designer of calm apps.</p>");
			expect(portfolio.data.works.items.map((work) => work.title)).toEqual(["Aplikasi Kopi"]);
			expect(portfolio.data.design).toMatchObject({ accent: { source: "resume" }, fonts: { source: "resume" } });
			expect(portfolio).toMatchObject({ isPublic: false, showInSearchEngines: true, publishedAt: null });
		});

		it("can start without a resume, from the basics given", async () => {
			await addResume("member");
			const portfolio = await service.create("member", {
				sourceResumeId: null,
				theme: "mozaik",
				basics: { name: "Citra M.", headline: "Illustrator" },
			});
			expect(portfolio).toMatchObject({ sourceResumeId: null, sourceResume: null });
			expect(portfolio.data).toMatchObject({ theme: "mozaik", basics: { name: "Citra M.", headline: "Illustrator" } });
			expect(portfolio.data.works.items).toEqual([]);
		});

		it("keeps one portfolio per account, even when two creates race", async () => {
			const results = await Promise.allSettled([service.create("member", {}), service.create("member", {})]);
			expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
			const [rejected] = results.filter((result) => result.status === "rejected");
			expect(rejected?.reason).toMatchObject({ code: "PORTFOLIO_EXISTS", status: 409 });
			expect(await getDb().select().from(tables.portfolio).where(eq(tables.portfolio.userId, "member"))).toHaveLength(
				1,
			);
			await expect(service.create("member", {})).rejects.toMatchObject({ code: "PORTFOLIO_EXISTS" });
		});

		it("refuses a resume of another account or one in Trash", async () => {
			const foreign = await addResume("other");
			const trashed = await addResume("member", { trashedAt: new Date() });
			for (const sourceResumeId of [foreign, trashed, "missing"])
				await expect(service.create("member", { sourceResumeId })).rejects.toMatchObject({
					code: "PORTFOLIO_SOURCE_INVALID",
				});
		});
	});

	describe("update", () => {
		it("saves valid data, cleaning rich text", async () => {
			await service.create("member", { sourceResumeId: null });
			const saved = await save("member", {
				hero: { greeting: "Hello!" },
				about: { content: '<p onclick="x()">Hi<script>steal()</script> <a href="javascript:alert(1)">me</a></p>' },
			});
			expect(saved.data.hero.greeting).toBe("Hello!");
			expect(saved.data.about.content).toBe("<p>Hi <a>me</a></p>");
			const [row] = await getDb().select({ data: tables.portfolio.data }).from(tables.portfolio);
			expect(JSON.stringify(row?.data)).not.toMatch(/script|onclick|javascript/);
		});

		it("can't change who sees the portfolio through its data", async () => {
			await service.create("member", { sourceResumeId: null });
			await save("member", { isPublic: true, showInSearchEngines: false, suspendedAt: null } as PortfolioDataInput);
			const [row] = await getDb().select().from(tables.portfolio);
			expect(row).toMatchObject({ isPublic: false, showInSearchEngines: true });
			expect(row?.data).not.toHaveProperty("isPublic");
		});

		it("only ever changes the signed-in account's own portfolio", async () => {
			const created = await service.create("member", { sourceResumeId: null });
			await expect(
				service.update("other", { data: { hero: { greeting: "Hacked" } }, expectedUpdatedAt: created.updatedAt }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			expect((await service.get("member")).portfolio?.data.hero.greeting).toBe("");
		});

		it("detects a change made elsewhere since the editor loaded", async () => {
			const created = await service.create("member", { sourceResumeId: null });
			const first = await service.update("member", {
				data: { hero: { greeting: "First tab" } },
				expectedUpdatedAt: created.updatedAt,
			});
			const stale = service.update("member", {
				data: { hero: { greeting: "Second tab" } },
				expectedUpdatedAt: created.updatedAt,
			});
			await expect(stale).rejects.toMatchObject({
				code: "PORTFOLIO_VERSION_CONFLICT",
				status: 409,
				data: { updatedAt: first.updatedAt.toISOString() },
			});
			expect((await service.get("member")).portfolio?.data.hero.greeting).toBe("First tab");
			await expect(
				service.update("member", { data: { hero: { greeting: "Reloaded" } }, expectedUpdatedAt: first.updatedAt }),
			).resolves.toMatchObject({ data: { hero: { greeting: "Reloaded" } } });
		});

		it("refuses data over the size limit", async () => {
			await service.create("member", { sourceResumeId: null });
			const text = `<p>${"word ".repeat(1900)}</p>`;
			const items = Array.from({ length: 30 }, (_, index) => ({
				id: `w${index}`,
				slug: `w${index}`,
				blocks: [{ id: "t", type: "text" as const, html: text }],
			}));
			await expect(save("member", { works: { items } })).rejects.toMatchObject({
				code: "PORTFOLIO_TOO_LARGE",
				status: 413,
			});
		});

		it("refuses invalid data", async () => {
			await service.create("member", { sourceResumeId: null });
			await expect(
				save("member", { testimonials: { items: [{ id: "t", quote: "Fake", name: "Nobody" }] } } as PortfolioDataInput),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});

		it("only uses files uploaded to the account's own portfolio", async () => {
			await service.create("member", { sourceResumeId: null });
			await addFile("member", "mine");
			await addFile("other", "theirs");
			await expect(save("member", { basics: { picture: image("member", "mine") } })).resolves.toMatchObject({
				data: { basics: { picture: { key: image("member", "mine").key } } },
			});
			for (const picture of [image("member", "never-uploaded"), image("other", "theirs")])
				await expect(save("member", { basics: { picture } })).rejects.toMatchObject({
					code: "PORTFOLIO_FILE_NOT_FOUND",
					data: { key: picture.key },
				});
		});
	});

	describe("publishing and settings", () => {
		it("needs a verified email, records the first publication, and keeps the data version", async () => {
			await service.create("unverified", { sourceResumeId: null });
			await expect(service.setPublic("unverified", { isPublic: true })).rejects.toMatchObject({
				code: "PORTFOLIO_EMAIL_NOT_VERIFIED",
			});

			const created = await service.create("member", { sourceResumeId: null });
			const published = await service.setPublic("member", { isPublic: true });
			expect(published.isPublic).toBe(true);
			expect(published.publishedAt).toBeInstanceOf(Date);
			expect(published.updatedAt.getTime()).toBe(created.updatedAt.getTime());
			await service.setPublic("member", { isPublic: false });
			const again = await service.setPublic("member", { isPublic: true });
			expect(again.publishedAt?.getTime()).toBe(published.publishedAt?.getTime());
			// An editor open before publishing can still save.
			await expect(
				service.update("member", { data: { hero: { greeting: "Still mine" } }, expectedUpdatedAt: created.updatedAt }),
			).resolves.toBeDefined();
		});

		it("can't publish a portfolio an admin took down, but can unpublish it", async () => {
			await service.create("member", { sourceResumeId: null });
			await service.setPublic("member", { isPublic: true });
			await getDb()
				.update(tables.portfolio)
				.set({ suspendedAt: new Date(), suspendedReason: "Scam", isPublic: false })
				.where(eq(tables.portfolio.userId, "member"));
			await expect(service.setPublic("member", { isPublic: true })).rejects.toMatchObject({
				code: "PORTFOLIO_SUSPENDED",
			});
			await expect(service.setPublic("member", { isPublic: false })).resolves.toMatchObject({ isPublic: false });
			await expect(service.setPublic("other", { isPublic: false })).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("switches the source resume only to one of the account's active resumes, or none", async () => {
			await service.create("member", { sourceResumeId: null });
			const mine = await addResume("member");
			const foreign = await addResume("other");
			const trashed = await addResume("member", { trashedAt: new Date() });
			await expect(service.updateSettings("member", { sourceResumeId: mine })).resolves.toMatchObject({
				sourceResumeId: mine,
			});
			for (const sourceResumeId of [foreign, trashed])
				await expect(service.updateSettings("member", { sourceResumeId })).rejects.toMatchObject({
					code: "PORTFOLIO_SOURCE_INVALID",
				});
			await expect(
				service.updateSettings("member", { sourceResumeId: null, showInSearchEngines: false }),
			).resolves.toMatchObject({ sourceResumeId: null, showInSearchEngines: false });
		});

		it("shows a source resume moved to Trash, and lets go of a deleted one", async () => {
			const resumeId = await addResume("member");
			await service.create("member", { sourceResumeId: resumeId });
			await getDb().update(tables.resume).set({ trashedAt: new Date() }).where(eq(tables.resume.id, resumeId));
			expect((await service.get("member")).portfolio?.sourceResume).toMatchObject({ id: resumeId, inTrash: true });
			await getDb().delete(tables.resume).where(eq(tables.resume.id, resumeId));
			expect((await service.get("member")).portfolio).toMatchObject({ sourceResumeId: null, sourceResume: null });
		});
	});

	describe("deleting", () => {
		it("deletes the portfolio and its files", async () => {
			await service.create("member", { sourceResumeId: null });
			await addFile("member", "a");
			await addFile("other", "b");
			await service.delete("member");
			expect(fixture.deleted).toEqual(["uploads/member/pictures/portfolio", "uploads/member/documents/portfolio"]);
			expect(await getDb().select().from(tables.portfolio)).toEqual([]);
			expect((await getDb().select().from(tables.portfolioFile)).map((file) => file.userId)).toEqual(["other"]);
			await expect(service.delete("member")).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("goes with the account", async () => {
			await service.create("member", { sourceResumeId: null });
			await addFile("member", "a");
			await getDb().delete(tables.user).where(eq(tables.user.id, "member"));
			expect(await getDb().select().from(tables.portfolio)).toEqual([]);
			expect(await getDb().select().from(tables.portfolioFile)).toEqual([]);
		});
	});

	it("reports usage", async () => {
		await service.create("member", {});
		await addFile("member", "a");
		await addFile("member", "b");
		expect(await service.get("member")).toMatchObject({
			enabled: true,
			usage: { works: 0, storageBytes: 2000 },
			limits: { works: 50 },
		});
	});
});
