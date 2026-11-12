import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import sharp from "sharp";
import * as tables from "@rezumi/db/schema";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { defaultResumeData } from "@rezumi/schema/resume/default";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as "off" | "admins" | "on",
	deleted: [] as string[],
	/** Storage, in memory: key → bytes. */
	files: new Map<string, Uint8Array>(),
	failWrites: false,
	/** Keys storage refuses to delete, reporting `false` as the S3 and local adapters do. */
	keepOnDelete: new Set<string>(),
	/** Listings of a prefix containing one of these fail. */
	failLists: [] as string[],
	/** Runs before each delete, so a test can hold storage mid-delete. */
	beforeDelete: undefined as ((key: string) => Promise<void>) | undefined,
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
		// By raw prefix, as S3, R2 and Blob list: a folder named without its slash lists siblings that start alike.
		list: (prefix: string) =>
			fixture.failLists.some((part) => prefix.includes(part))
				? Promise.reject(new Error("Storage is down"))
				: Promise.resolve([...fixture.files.keys()].filter((key) => key.startsWith(prefix))),
		write: ({ key, data }: { key: string; data: Uint8Array }) => {
			if (fixture.failWrites) return Promise.reject(new Error("Storage is down"));
			fixture.files.set(key, data);
			return Promise.resolve();
		},
		// A file, or a folder and everything in it, as every adapter deletes.
		delete: async (key: string) => {
			fixture.deleted.push(key);
			await fixture.beforeDelete?.(key);
			if (fixture.keepOnDelete.has(key)) return false;
			const folder = `${key.replace(/\/$/, "")}/`;
			const keys = [...fixture.files.keys()].filter((candidate) => candidate === key || candidate.startsWith(folder));
			for (const candidate of keys) fixture.files.delete(candidate);
			return keys.length > 0;
		},
	}),
}));

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;
const hour = 60 * 60 * 1000;

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

const picture = async (width: number, height: number, format: "webp" | "png" | "jpeg" = "webp", name = "a") => {
	const image = sharp({ create: { width, height, channels: 3, background: "#225588" } });
	const buffer = await image[format]().toBuffer();
	return new File([new Uint8Array(buffer)], `${name}.${format}`, { type: `image/${format}` });
};

const pdf = (bytes = 2000, name = "case.pdf") => {
	const data = new Uint8Array(bytes);
	data.set(new TextEncoder().encode("%PDF-1.7\n"));
	return new File([data], name, { type: "application/pdf" });
};

/** Holds whatever waits on it: `arrived` once something does, until `open()`. */
function gate() {
	let open = () => {};
	let arrive = () => {};
	const opened = new Promise<void>((resolve) => {
		open = resolve;
	});
	const arrived = new Promise<void>((resolve) => {
		arrive = resolve;
	});
	return {
		arrived,
		open: () => open(),
		wait: () => {
			arrive();
			return opened;
		},
	};
}

const timeout = (ms: number) =>
	new Promise<never>((_, reject) => {
		setTimeout(() => reject(new Error(`Still waiting after ${ms} ms`)), ms);
	});

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("portfolio service", () => {
	let service: typeof import("./service").portfolioService;
	let jobs: typeof import("./jobs");
	let admin: Pool;
	let pool: Pool;
	const schemaName = `portfolio_test_${randomUUID().replaceAll("-", "")}`;
	// Usernames are claimed under a database-wide advisory lock (`lock_username_claim`). Suites running at the same time
	// with the same usernames in a different order can deadlock each other, so each run uses its own.
	const usernameSuffix = randomUUID().slice(0, 8);

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

	/** Saves data through the service as the router hands it over: checked by the write schema first. */
	const update = (userId: string, data: PortfolioDataInput, expectedUpdatedAt: Date) =>
		service.update(userId, { data: parseWritablePortfolioData(data), expectedUpdatedAt });

	const save = async (userId: string, data: PortfolioDataInput, expectedUpdatedAt?: Date) => {
		const current = await service.get(userId);
		return update(userId, data, expectedUpdatedAt ?? (current.portfolio?.updatedAt as Date));
	};

	const fileRows = (userId = "member") =>
		getDb()
			.select({ key: tables.portfolioFile.key, unusedSince: tables.portfolioFile.unusedSince })
			.from(tables.portfolioFile)
			.where(eq(tables.portfolioFile.userId, userId))
			.orderBy(tables.portfolioFile.key);

	const markUnused = (key: string, since: Date | null) =>
		getDb().update(tables.portfolioFile).set({ unusedSince: since }).where(eq(tables.portfolioFile.key, key));

	/** A file in storage, under the account's portfolio pictures. */
	const stored = (userId: string, name: string) => {
		const { key } = image(userId, name);
		fixture.files.set(key, new Uint8Array([1, 2, 3]));
		return key;
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
		jobs = await import("./jobs");
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		fixture.deleted = [];
		fixture.files = new Map();
		fixture.failWrites = false;
		fixture.keepOnDelete = new Set();
		fixture.failLists = [];
		fixture.beforeDelete = undefined;
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
					username: `portfolio-${account.id}-${usernameSuffix}`,
					displayUsername: `portfolio-${account.id}-${usernameSuffix}`,
					...account,
				})),
			);
	});

	describe("the switch", () => {
		it("hides portfolios from everyone when off, without changing anything", async () => {
			fixture.mode = "off";
			expect((await service.get("owner")).enabled).toBe(false);
			expect(await service.status("owner")).toEqual({ enabled: false, portfolio: null });
			await expect(service.create("owner", {})).rejects.toMatchObject({ code: "PORTFOLIO_DISABLED" });
			expect(await getDb().select().from(tables.portfolio)).toEqual([]);
		});

		it("opens portfolios to admins only while testing", async () => {
			fixture.mode = "admins";
			expect((await service.get("member")).enabled).toBe(false);
			expect(await service.status("member")).toEqual({ enabled: false, portfolio: null });
			await expect(service.create("member", {})).rejects.toMatchObject({ code: "PORTFOLIO_DISABLED" });
			expect((await service.get("owner")).enabled).toBe(true);
			await expect(service.create("owner", {})).resolves.toMatchObject({ isPublic: false });
		});

		it("never opens them to guest accounts", async () => {
			expect((await service.get("guest")).enabled).toBe(false);
			expect(await service.status("guest")).toEqual({ enabled: false, portfolio: null });
			await expect(service.create("guest", {})).rejects.toMatchObject({ code: "PORTFOLIO_DISABLED" });
		});

		it("keeps a portfolio made while on, but refuses changes once off again", async () => {
			const created = await service.create("member", {});
			fixture.mode = "off";
			await expect(update("member", {}, created.updatedAt)).rejects.toMatchObject({ code: "PORTFOLIO_DISABLED" });
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
					data: { reason: "unavailable" },
				});
		});

		it("refuses a resume whose stored data can't be read, rather than failing", async () => {
			const broken = await addResume("member", { data: { basics: "not a resume" } as never, isPrimary: true });
			const unreadable = { code: "PORTFOLIO_SOURCE_INVALID", status: 400, data: { reason: "unreadable" } };
			await expect(service.create("member", { sourceResumeId: broken })).rejects.toMatchObject(unreadable);
			// The primary resume, used when none is chosen.
			await expect(service.create("member", {})).rejects.toMatchObject(unreadable);
			expect(await getDb().select().from(tables.portfolio)).toEqual([]);
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
			await expect(update("other", { hero: { greeting: "Hacked" } }, created.updatedAt)).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
			expect((await service.get("member")).portfolio?.data.hero.greeting).toBe("");
		});

		it("detects a change made elsewhere since the editor loaded", async () => {
			const created = await service.create("member", { sourceResumeId: null });
			const first = await update("member", { hero: { greeting: "First tab" } }, created.updatedAt);
			expect(first.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
			await expect(update("member", { hero: { greeting: "Second tab" } }, created.updatedAt)).rejects.toMatchObject({
				code: "PORTFOLIO_VERSION_CONFLICT",
				status: 409,
				data: { updatedAt: first.updatedAt.toISOString() },
			});
			expect((await service.get("member")).portfolio?.data.hero.greeting).toBe("First tab");
			await expect(update("member", { hero: { greeting: "Reloaded" } }, first.updatedAt)).resolves.toMatchObject({
				data: { hero: { greeting: "Reloaded" } },
			});
		});

		it("answers a stale editor with a conflict before looking at its files", async () => {
			const created = await service.create("member", { sourceResumeId: null });
			const first = await update("member", { hero: { greeting: "First tab" } }, created.updatedAt);
			await expect(
				update("member", { basics: { picture: image("member", "never-uploaded") } }, created.updatedAt),
			).rejects.toMatchObject({
				code: "PORTFOLIO_VERSION_CONFLICT",
				data: { updatedAt: first.updatedAt.toISOString() },
			});
		});

		it("keeps the data's version when anything but a save changes the portfolio", async () => {
			const created = await service.create("member", { sourceResumeId: null });
			// An admin's takedown and the file checks write the row directly.
			await getDb()
				.update(tables.portfolio)
				.set({ suspendedAt: new Date(), suspendedReason: "Scam", filesCheckedAt: new Date() })
				.where(eq(tables.portfolio.userId, "member"));
			const [row] = await getDb().select({ updatedAt: tables.portfolio.updatedAt }).from(tables.portfolio);
			expect(row?.updatedAt.getTime()).toBe(created.updatedAt.getTime());
			await expect(update("member", { hero: { greeting: "Still mine" } }, created.updatedAt)).resolves.toMatchObject({
				data: { hero: { greeting: "Still mine" } },
			});
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
			// A refused save changes nothing.
			expect((await service.get("member")).portfolio?.data.basics.picture?.key).toBe(image("member", "mine").key);
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
			expect((await service.updateSettings("member", { showInSearchEngines: false })).updatedAt.getTime()).toBe(
				created.updatedAt.getTime(),
			);
			// An editor open before publishing can still save.
			await expect(update("member", { hero: { greeting: "Still mine" } }, created.updatedAt)).resolves.toBeDefined();
		});

		it("asks visitors for a password and stops again, without moving the data's version or showing the hash", async () => {
			const created = await service.create("member", { sourceResumeId: null });
			expect(created.hasPassword).toBe(false);
			const locked = await service.setPassword("member", { password: "rahasia-123" });
			expect(locked.hasPassword).toBe(true);
			expect(locked.updatedAt.getTime()).toBe(created.updatedAt.getTime());
			expect(JSON.stringify(locked)).not.toContain("$2");
			const [row] = await getDb().select().from(tables.portfolio).where(eq(tables.portfolio.userId, "member"));
			expect(row?.password).toMatch(/^\$2[aby]\$10\$/);
			expect((await service.get("member")).portfolio?.hasPassword).toBe(true);
			const opened = await service.removePassword("member");
			expect(opened.hasPassword).toBe(false);
			expect(opened.updatedAt.getTime()).toBe(created.updatedAt.getTime());
			await expect(service.setPassword("unverified", { password: "rahasia-123" })).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
			fixture.mode = "off";
			await expect(service.setPassword("member", { password: "rahasia-123" })).rejects.toMatchObject({
				code: "PORTFOLIO_DISABLED",
			});
		});

		it("reads only the account's own works' numbers", async () => {
			const created = await service.create("member", { sourceResumeId: null });
			const saved = await update(
				"member",
				{ works: { items: [{ id: "w1", slug: "kopi", title: "Kopi" }] } },
				created.updatedAt,
			);
			expect(saved.data.works.items).toHaveLength(1);
			expect((await service.workStatistics("member", { workId: "w1" })).work).toMatchObject({ id: "w1" });
			// Another account's work is simply not in its portfolio.
			await service.create("other", { sourceResumeId: null });
			await expect(service.workStatistics("other", { workId: "w1" })).rejects.toMatchObject({
				code: "PORTFOLIO_WORK_NOT_FOUND",
			});
			await expect(service.workStatistics("unverified", { workId: "w1" })).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
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
			// Nothing to change: the portfolio as it is.
			await expect(service.updateSettings("member", {})).resolves.toMatchObject({ sourceResumeId: null });
			await expect(service.updateSettings("other", {})).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("shows a source resume moved to Trash, and lets go of a deleted one", async () => {
			const resumeId = await addResume("member");
			await service.create("member", { sourceResumeId: resumeId });
			await getDb().update(tables.resume).set({ trashedAt: new Date() }).where(eq(tables.resume.id, resumeId));
			expect((await service.get("member")).portfolio?.sourceResume).toMatchObject({ id: resumeId, inTrash: true });
			await getDb().delete(tables.resume).where(eq(tables.resume.id, resumeId));
			expect((await service.get("member")).portfolio).toMatchObject({ sourceResumeId: null, sourceResume: null });
		});

		it("tells whether the account has a portfolio and whether it's live, without reading it", async () => {
			expect(await service.status("member")).toEqual({ enabled: true, portfolio: null });
			await service.create("member", { sourceResumeId: null });
			expect(await service.status("member")).toEqual({
				enabled: true,
				portfolio: { isPublic: false, suspendedAt: null },
			});
			await service.setPublic("member", { isPublic: true });
			expect(await service.status("member")).toEqual({
				enabled: true,
				portfolio: { isPublic: true, suspendedAt: null },
			});
			const takenDown = new Date("2026-11-07T10:00:00Z");
			await getDb()
				.update(tables.portfolio)
				.set({ suspendedAt: takenDown, suspendedReason: "Scam" })
				.where(eq(tables.portfolio.userId, "member"));
			expect(await service.status("member")).toEqual({
				enabled: true,
				portfolio: { isPublic: true, suspendedAt: takenDown },
			});
		});
	});

	describe("deleting", () => {
		it("deletes the portfolio at once, and its files on the cleanup job's next run", async () => {
			await service.create("member", { sourceResumeId: null });
			const used = await service.uploadImage("member", {
				file: await picture(300, 200),
				thumbnail: await picture(200, 133),
			});
			await save("member", {
				basics: { picture: { key: used.key, thumbKey: used.thumbKey, width: 300, height: 200, alt: "" } },
			});
			await service.uploadPdf("member", { file: pdf(), pages: 2 });
			await addFile("other", "b");
			const theirs = stored("other", "b");

			await service.delete("member");
			expect(await getDb().select().from(tables.portfolio)).toEqual([]);
			expect(await service.status("member")).toEqual({ enabled: true, portfolio: null });
			// Storage isn't touched while deleting: every file is due for the cleanup job at once.
			expect(fixture.deleted).toEqual([]);
			expect((await fileRows()).map((row) => row.unusedSince?.getTime())).toEqual([0, 0, 0]);
			await expect(service.delete("member")).rejects.toMatchObject({ code: "NOT_FOUND" });

			expect(await jobs.runPortfolioJobs()).toMatchObject({ deletedFiles: 3, checkedPortfolios: 0 });
			expect(await fileRows()).toEqual([]);
			expect([...fixture.files.keys()]).toEqual([theirs]);
			expect(await fileRows("other")).toEqual([{ key: theirs, unusedSince: null }]);
		});

		it("still deletes a deleted portfolio's files while portfolios are off", async () => {
			await service.create("member", { sourceResumeId: null });
			await service.uploadImage("member", { file: await picture(300, 200) });
			await service.delete("member");
			fixture.mode = "off";
			expect(await jobs.runPortfolioJobs()).toMatchObject({ deletedFiles: 1, checkedPortfolios: 0, messageEmails: 0 });
			expect(await fileRows()).toEqual([]);
			expect(fixture.files.size).toBe(0);
		});

		it("tries again later for files storage can't delete once the portfolio is gone", async () => {
			await service.create("member", { sourceResumeId: null });
			const kept = await service.uploadImage("member", { file: await picture(300, 200) });
			const lost = await service.uploadImage("member", { file: await picture(300, 200) });
			await service.delete("member");
			fixture.keepOnDelete.add(kept.key);
			// Already gone from storage: it counts as deleted.
			fixture.files.delete(lost.key);
			const logged = vi.spyOn(console, "error").mockImplementation(() => {});
			try {
				await jobs.runPortfolioJobs();
				expect((await fileRows()).map((row) => row.key)).toContain(kept.key);
				expect(fixture.files.has(kept.key)).toBe(true);
				fixture.keepOnDelete.clear();
				await jobs.runPortfolioJobs();
				await jobs.runPortfolioJobs();
				expect(await fileRows()).toEqual([]);
				expect(fixture.files.size).toBe(0);
			} finally {
				logged.mockRestore();
			}
		});

		it("never deadlocks with a save running at the same time", async () => {
			for (let round = 0; round < 5; round += 1) {
				const created = await service.create("member", { sourceResumeId: null });
				const uploaded = await service.uploadImage("member", { file: await picture(300, 200) });
				const [saved, deleted] = await Promise.allSettled([
					update(
						"member",
						{ basics: { picture: { key: uploaded.key, width: 300, height: 200, alt: "" } } },
						created.updatedAt,
					),
					service.delete("member"),
				]);
				expect(deleted).toMatchObject({ status: "fulfilled" });
				if (saved.status === "rejected") expect(saved.reason).toMatchObject({ code: "NOT_FOUND" });
				expect(await getDb().select().from(tables.portfolio)).toEqual([]);
				expect((await fileRows()).every((row) => row.unusedSince?.getTime() === 0)).toBe(true);
			}
		});

		it("goes with the account", async () => {
			await service.create("member", { sourceResumeId: null });
			await addFile("member", "a");
			await getDb().delete(tables.user).where(eq(tables.user.id, "member"));
			expect(await getDb().select().from(tables.portfolio)).toEqual([]);
			expect(await getDb().select().from(tables.portfolioFile)).toEqual([]);
		});
	});

	describe("pictures", () => {
		it("stores a picture and its small copy, unused until saved data uses them", async () => {
			await service.create("member", { sourceResumeId: null });
			const uploaded = await service.uploadImage("member", {
				file: await picture(1200, 800),
				thumbnail: await picture(800, 533),
			});
			expect(uploaded).toMatchObject({ width: 1200, height: 800 });
			expect(uploaded.key).toMatch(/^uploads\/member\/pictures\/portfolio\/[\da-f-]{36}\.webp$/);
			expect(uploaded.thumbKey).toBe(uploaded.key.replace(".webp", "-sm.webp"));
			expect([...fixture.files.keys()].sort()).toEqual([uploaded.key, uploaded.thumbKey].sort());
			const stored = [...fixture.files.values()].reduce((sum, data) => sum + data.byteLength, 0);
			expect(uploaded.bytes).toBe(stored);
			expect((await service.get("member")).usage.storageBytes).toBe(stored);
			expect((await fileRows()).every((row) => row.unusedSince instanceof Date)).toBe(true);

			const { key, thumbKey } = uploaded;
			await save("member", { basics: { picture: { key, thumbKey, width: 1200, height: 800, alt: "Me" } } });
			expect((await fileRows()).map((row) => row.unusedSince)).toEqual([null, null]);
			await save("member", { basics: {} });
			expect((await fileRows()).every((row) => row.unusedSince instanceof Date)).toBe(true);
		});

		it("refuses files that aren't still JPEG, PNG or WebP pictures, are too big, or too large", async () => {
			await expect(service.uploadImage("member", { file: await picture(100, 100) })).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
			await service.create("member", { sourceResumeId: null });
			const invalid = (reason: string) => ({ code: "PORTFOLIO_IMAGE_INVALID", status: 400, data: { reason } });
			const upload = (file: File, thumbnail?: File) => service.uploadImage("member", { file, thumbnail });

			await expect(upload(new File(["not a picture"], "photo.jpg", { type: "image/jpeg" }))).rejects.toMatchObject(
				invalid("type"),
			);
			const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } })
				.gif()
				.toBuffer();
			await expect(upload(new File([new Uint8Array(gif)], "a.gif", { type: "image/gif" }))).rejects.toMatchObject(
				invalid("type"),
			);
			const animated = new Uint8Array([
				...new TextEncoder().encode("RIFF"),
				22,
				0,
				0,
				0,
				...new TextEncoder().encode("WEBPVP8X"),
				10,
				0,
				0,
				0,
				0x02,
				0,
				0,
				0,
				99,
				0,
				0,
				99,
				0,
				0,
			]);
			await expect(upload(new File([animated], "a.webp", { type: "image/webp" }))).rejects.toMatchObject(
				invalid("animated"),
			);
			const huge = new Uint8Array(2.6 * 1024 * 1024);
			huge.set([0xff, 0xd8, 0xff]);
			await expect(upload(new File([huge], "big.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({
				code: "PORTFOLIO_FILE_TOO_LARGE",
				status: 413,
				data: { bytes: huge.byteLength, max: 2.5 * 1024 * 1024 },
			});
			await expect(upload(await picture(2400, 100, "png"))).rejects.toMatchObject(invalid("dimensions"));
			await expect(upload(await picture(1000, 800), await picture(1000, 800))).rejects.toMatchObject(
				invalid("dimensions"),
			);
			expect(fixture.files.size).toBe(0);
			expect(await fileRows()).toEqual([]);
		});

		it("records nothing when storing fails", async () => {
			await service.create("member", { sourceResumeId: null });
			fixture.failWrites = true;
			await expect(service.uploadImage("member", { file: await picture(300, 200, "jpeg") })).rejects.toThrow(
				"Storage is down",
			);
			expect(await fileRows()).toEqual([]);
		});

		it("never lets one account's data use another account's upload", async () => {
			await service.create("member", { sourceResumeId: null });
			await service.create("other", { sourceResumeId: null });
			const theirs = await service.uploadImage("other", { file: await picture(300, 200) });
			await expect(
				save("member", { basics: { picture: { key: theirs.key, width: 300, height: 200, alt: "" } } }),
			).rejects.toMatchObject({ code: "PORTFOLIO_FILE_NOT_FOUND", data: { key: theirs.key } });
			await expect(service.deleteFile("member", { key: theirs.key })).rejects.toMatchObject({
				code: "PORTFOLIO_FILE_NOT_FOUND",
			});
			expect(fixture.files.has(theirs.key)).toBe(true);
		});

		it("deletes a file only once the saved data no longer uses it", async () => {
			await service.create("member", { sourceResumeId: null });
			const used = await service.uploadImage("member", { file: await picture(300, 200) });
			const spare = await service.uploadImage("member", { file: await picture(300, 200) });
			await save("member", { basics: { picture: { key: used.key, width: 300, height: 200, alt: "" } } });

			await expect(service.deleteFile("member", { key: used.key })).rejects.toMatchObject({
				code: "PORTFOLIO_FILE_IN_USE",
				status: 409,
				data: { key: used.key },
			});
			await service.deleteFile("member", { key: spare.key });
			expect(fixture.files.has(spare.key)).toBe(false);
			expect((await fileRows()).map((row) => row.key)).toEqual([used.key]);
			await expect(service.deleteFile("member", { key: spare.key })).rejects.toMatchObject({
				code: "PORTFOLIO_FILE_NOT_FOUND",
			});
		});
	});

	describe("the storage ceiling", () => {
		const largeFile = (userId: string, bytes: number, unusedSince: Date | null = null) =>
			getDb()
				.insert(tables.portfolioFile)
				.values({
					userId,
					kind: "pdf",
					key: `uploads/${userId}/documents/portfolio/${randomUUID()}.pdf`,
					bytes,
					pages: 1,
					unusedSince,
				});

		it("refuses uploads past what an account may store, counting files waiting for cleanup", async () => {
			await service.create("member", { sourceResumeId: null });
			const file = await picture(300, 200);
			const stored = PORTFOLIO_UPLOAD.accountBytes - file.size + 1;
			// Removed from the portfolio but not deleted yet: it still takes room.
			await largeFile("member", stored, new Date());
			const before = await fileRows();
			const full = {
				code: "PORTFOLIO_STORAGE_FULL",
				status: 413,
				data: {
					bytes: stored,
					maxBytes: PORTFOLIO_UPLOAD.accountBytes,
					files: 1,
					maxFiles: PORTFOLIO_UPLOAD.accountFiles,
				},
			};
			await expect(service.uploadImage("member", { file })).rejects.toMatchObject(full);
			await expect(service.uploadPdf("member", { file: pdf(), pages: 1 })).rejects.toMatchObject(full);
			expect(fixture.files.size).toBe(0);
			expect(await fileRows()).toEqual(before);
			expect(await service.get("member")).toMatchObject({
				limits: { storageBytes: PORTFOLIO_UPLOAD.accountBytes },
				usage: { storageBytes: stored },
			});
			// A file that fills it exactly still fits.
			await getDb()
				.update(tables.portfolioFile)
				.set({ bytes: stored - 1 })
				.where(eq(tables.portfolioFile.userId, "member"));
			await expect(service.uploadImage("member", { file })).resolves.toMatchObject({ bytes: file.size });
			expect((await service.get("member")).usage.storageBytes).toBe(PORTFOLIO_UPLOAD.accountBytes);
		});

		it("doesn't count a deleted portfolio's files, which nothing can use again", async () => {
			await service.create("member", { sourceResumeId: null });
			await largeFile("member", PORTFOLIO_UPLOAD.accountBytes);
			await service.delete("member");
			await service.create("member", { sourceResumeId: null });
			// Its files wait for the cleanup job, marked overdue; a new portfolio can upload meanwhile.
			const file = await picture(300, 200);
			await expect(service.uploadImage("member", { file })).resolves.toMatchObject({ bytes: file.size });
			expect((await service.get("member")).usage.storageBytes).toBe(file.size);
		});

		it("refuses uploads past how many files an account may store", async () => {
			await service.create("member", { sourceResumeId: null });
			await getDb()
				.insert(tables.portfolioFile)
				.values(
					Array.from({ length: PORTFOLIO_UPLOAD.accountFiles }, (_, index) => ({
						userId: "member",
						kind: "image" as const,
						key: image("member", `f${index}`).key,
						bytes: 1,
						width: 1,
						height: 1,
					})),
				);
			await expect(service.uploadPdf("member", { file: pdf(), pages: 1 })).rejects.toMatchObject({
				code: "PORTFOLIO_STORAGE_FULL",
				data: { files: PORTFOLIO_UPLOAD.accountFiles },
			});
			await getDb()
				.delete(tables.portfolioFile)
				.where(eq(tables.portfolioFile.key, image("member", "f0").key));
			await expect(service.uploadPdf("member", { file: pdf(), pages: 1 })).resolves.toMatchObject({ bytes: 2000 });
		});

		it("lets only one of two uploads at once take the last room", async () => {
			await service.create("member", { sourceResumeId: null });
			const [first, second] = [await picture(300, 200, "webp", "a"), await picture(300, 200, "webp", "b")];
			await largeFile("member", PORTFOLIO_UPLOAD.accountBytes - first.size - Math.floor(second.size / 2));
			const results = await Promise.allSettled([
				service.uploadImage("member", { file: first }),
				service.uploadImage("member", { file: second }),
			]);
			expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
			expect(results.find((result) => result.status === "rejected")?.reason).toMatchObject({
				code: "PORTFOLIO_STORAGE_FULL",
			});
			expect(fixture.files.size).toBe(1);
		});

		it("counts each account on its own", async () => {
			await service.create("member", { sourceResumeId: null });
			await largeFile("other", PORTFOLIO_UPLOAD.accountBytes);
			await expect(service.uploadPdf("member", { file: pdf(), pages: 1 })).resolves.toMatchObject({ bytes: 2000 });
		});
	});

	describe("PDFs", () => {
		const pdfRows = (userId = "member") =>
			getDb()
				.select({
					key: tables.portfolioFile.key,
					kind: tables.portfolioFile.kind,
					bytes: tables.portfolioFile.bytes,
					pages: tables.portfolioFile.pages,
					unusedSince: tables.portfolioFile.unusedSince,
				})
				.from(tables.portfolioFile)
				.where(eq(tables.portfolioFile.userId, userId));
		const work = (file: string) => ({
			works: {
				items: [
					{
						id: "w1",
						slug: "case",
						title: "Case",
						blocks: [{ id: "b1", type: "pdf" as const, file, title: "Case study", pages: 3 }],
					},
				],
			},
		});

		it("stores a PDF under the account's own folder, recorded and unused until a block uses it", async () => {
			await expect(service.uploadPdf("member", { file: pdf(), pages: 3 })).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
			await service.create("member", { sourceResumeId: null });
			const uploaded = await service.uploadPdf("member", { file: pdf(), pages: 3 });
			expect(uploaded).toEqual({ key: expect.any(String), bytes: 2000, pages: 3 });
			expect(uploaded.key).toMatch(/^uploads\/member\/documents\/portfolio\/[\da-f-]{36}\.pdf$/);
			expect(fixture.files.get(uploaded.key)?.byteLength).toBe(2000);
			expect(await pdfRows()).toEqual([
				{ key: uploaded.key, kind: "pdf", bytes: 2000, pages: 3, unusedSince: expect.any(Date) },
			]);
			expect((await service.get("member")).usage.storageBytes).toBe(2000);

			const saved = await save("member", work(uploaded.key));
			expect(saved.data.works.items[0]?.blocks[0]).toMatchObject({ type: "pdf", file: uploaded.key, pages: 3 });
			expect((await pdfRows()).map((row) => row.unusedSince)).toEqual([null]);
		});

		it("refuses files that aren't PDFs or are larger than 10 MB, storing nothing", async () => {
			await service.create("member", { sourceResumeId: null });
			const html = new File(["<html><script>alert(1)</script></html>"], "case.pdf", { type: "application/pdf" });
			await expect(service.uploadPdf("member", { file: html, pages: 1 })).rejects.toMatchObject({
				code: "PORTFOLIO_PDF_INVALID",
				status: 400,
				data: { reason: "type" },
			});
			const max = 10 * 1024 * 1024;
			await expect(service.uploadPdf("member", { file: pdf(max + 1), pages: 1 })).rejects.toMatchObject({
				code: "PORTFOLIO_FILE_TOO_LARGE",
				status: 413,
				data: { bytes: max + 1, max },
				message: expect.stringContaining("PDF"),
			});
			expect(fixture.files.size).toBe(0);
			expect(await pdfRows()).toEqual([]);
			await expect(service.uploadPdf("member", { file: pdf(max), pages: 1 })).resolves.toMatchObject({ bytes: max });
		});

		it("records nothing when storing fails", async () => {
			await service.create("member", { sourceResumeId: null });
			fixture.failWrites = true;
			await expect(service.uploadPdf("member", { file: pdf(), pages: 1 })).rejects.toThrow("Storage is down");
			expect(await pdfRows()).toEqual([]);
		});

		it("never lets one account's data use another account's PDF", async () => {
			await service.create("member", { sourceResumeId: null });
			await service.create("other", { sourceResumeId: null });
			const theirs = await service.uploadPdf("other", { file: pdf(), pages: 2 });
			await expect(save("member", work(theirs.key))).rejects.toMatchObject({
				code: "PORTFOLIO_FILE_NOT_FOUND",
				data: { key: theirs.key },
			});
			const unknown = "uploads/member/documents/portfolio/00000000-0000-0000-0000-000000000000.pdf";
			await expect(save("member", work(unknown))).rejects.toMatchObject({
				code: "PORTFOLIO_FILE_NOT_FOUND",
				data: { key: unknown },
			});
		});

		it("refuses link reading and remote pictures while portfolios are off, without fetching", async () => {
			fixture.mode = "off";
			await expect(service.unfurl("member", { url: "https://github.com/" })).rejects.toMatchObject({
				code: "PORTFOLIO_DISABLED",
			});
			await expect(service.fetchRemoteImage("member", { url: "https://github.com/a.png" })).rejects.toMatchObject({
				code: "PORTFOLIO_DISABLED",
			});
			fixture.mode = "on";
			await expect(service.fetchRemoteImage("member", { url: "http://127.0.0.1/a.png" })).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
			await service.create("member", { sourceResumeId: null });
			await expect(service.fetchRemoteImage("member", { url: "http://127.0.0.1/a.png" })).rejects.toMatchObject({
				code: "PORTFOLIO_LINK_UNREADABLE",
				data: { reason: "unsafe-url" },
			});
			await expect(service.unfurl("member", { url: "http://10.1.2.3/" })).rejects.toMatchObject({
				code: "PORTFOLIO_LINK_UNREADABLE",
				status: 400,
				data: { reason: "unsafe-url" },
			});
		});
	});

	describe("adding works from the resume", () => {
		const project = (id: string, name: string) => ({
			id,
			hidden: false,
			name,
			period: "2025",
			website: { url: "", label: "", inlineLink: false },
			description: `<p>${name} story.</p>`,
		});
		const resumeWithProjects = (userId: string) => {
			const data = resumeData(userId);
			data.sections.projects.items.push(project("p2", "Aplikasi Kopi"), project("p3", "Toko Batik"));
			return addResume(userId, { data });
		};

		it("adds the chosen projects in the resume's order, once each, with their own addresses", async () => {
			await resumeWithProjects("member");
			const created = await service.create("member", {});
			expect(created.data.works.items.map((work) => work.fromResumeItemId)).toEqual(["p1", "p2", "p3"]);
			// Remove two works, then add them back.
			const trimmed = await save("member", { works: { items: created.data.works.items.slice(0, 1) } });

			const added = await service.importWorks("member", {
				resumeItemIds: ["p3", "p1", "p2", "missing"],
				expectedUpdatedAt: trimmed.updatedAt,
			});
			expect(added.data.works.items.map((work) => [work.fromResumeItemId, work.slug])).toEqual([
				["p1", "aplikasi-kopi"],
				["p2", "aplikasi-kopi-2"],
				["p3", "toko-batik"],
			]);
			expect(added.updatedAt.getTime()).toBeGreaterThan(trimmed.updatedAt.getTime());

			// Nothing new: nothing is written, and the version stays.
			const again = await service.importWorks("member", {
				resumeItemIds: ["p2"],
				expectedUpdatedAt: added.updatedAt,
			});
			expect(again.data.works.items).toHaveLength(3);
			expect(again.updatedAt.getTime()).toBe(added.updatedAt.getTime());
			await expect(
				update("member", { works: { items: again.data.works.items } }, added.updatedAt),
			).resolves.toBeDefined();
		});

		it("refuses a stale editor, a missing resume and going past the work limit", async () => {
			await resumeWithProjects("member");
			const created = await service.create("member", {});
			const saved = await save("member", { works: { items: [] } });
			await expect(
				service.importWorks("member", { resumeItemIds: ["p1"], expectedUpdatedAt: created.updatedAt }),
			).rejects.toMatchObject({ code: "PORTFOLIO_VERSION_CONFLICT" });

			const many = Array.from({ length: 49 }, (_, index) => ({ id: `w${index}`, slug: `w${index}`, title: "W" }));
			const full = await save("member", { works: { items: many } }, saved.updatedAt);
			await expect(
				service.importWorks("member", { resumeItemIds: ["p1", "p2"], expectedUpdatedAt: full.updatedAt }),
			).rejects.toMatchObject({ code: "PORTFOLIO_WORKS_LIMIT", status: 400, data: { max: 50 } });
			await expect(
				service.importWorks("member", { resumeItemIds: ["p1"], expectedUpdatedAt: full.updatedAt }),
			).resolves.toMatchObject({ data: { works: { items: expect.any(Array) } } });

			await service.create("other", { sourceResumeId: null });
			const other = await service.get("other");
			await expect(
				service.importWorks("other", { resumeItemIds: ["p1"], expectedUpdatedAt: other.portfolio?.updatedAt as Date }),
			).rejects.toMatchObject({ code: "PORTFOLIO_SOURCE_INVALID", data: { reason: "unavailable" } });
		});

		it("refuses a source resume whose stored data can't be read, rather than failing", async () => {
			const created = await service.create("member", { sourceResumeId: await resumeWithProjects("member") });
			const broken = await addResume("member", { data: { basics: "not a resume" } as never });
			await service.updateSettings("member", { sourceResumeId: broken });
			await expect(
				service.importWorks("member", { resumeItemIds: ["p1"], expectedUpdatedAt: created.updatedAt }),
			).rejects.toMatchObject({ code: "PORTFOLIO_SOURCE_INVALID", status: 400, data: { reason: "unreadable" } });
		});
	});

	describe("the file cleanup job", () => {
		it("deletes files unused for a day and stray files, keeps the rest, and is safe to run twice", async () => {
			const now = new Date();
			await service.create("member", { sourceResumeId: null });
			for (const name of ["used", "fresh", "old", "stale-mark", "never-tracked"]) {
				stored("member", name);
				await addFile("member", name);
			}
			const stray = stored("member", "stray");
			const created = await save("member", {
				basics: { picture: image("member", "used") },
				hero: { background: { kind: "image", image: image("member", "stale-mark") } },
			});
			await markUnused(image("member", "fresh").key, new Date(now.getTime() - hour));
			await markUnused(image("member", "old").key, new Date(now.getTime() - 25 * hour));
			// Marked unused long ago, but the data uses it again (an undo, say): kept, and marked used.
			await markUnused(image("member", "stale-mark").key, new Date(now.getTime() - 48 * hour));
			// Recorded before usage was tracked: unused, but not deleted until a day has passed.
			await markUnused(image("member", "never-tracked").key, null);

			expect(await jobs.runPortfolioJobs(now)).toMatchObject({ deletedFiles: 1, checkedPortfolios: 1 });
			const rows = await fileRows();
			const state = Object.fromEntries(
				rows.map((row) => [row.key.split("/").pop(), row.unusedSince ? "unused" : "used"]),
			);
			expect(state).toEqual({
				"fresh.webp": "unused",
				"never-tracked.webp": "unused",
				"stale-mark.webp": "used",
				"used.webp": "used",
			});
			expect(fixture.files.has(image("member", "old").key)).toBe(false);
			expect(fixture.files.has(stray)).toBe(false);
			expect(fixture.files.has(image("member", "used").key)).toBe(true);

			const [portfolio] = await getDb().select().from(tables.portfolio).where(eq(tables.portfolio.userId, "member"));
			expect(portfolio?.filesCheckedAt?.getTime()).toBe(now.getTime());
			// The check never changes the data's version: an open editor still saves.
			expect(portfolio?.updatedAt.getTime()).toBe(created.updatedAt.getTime());

			expect(await jobs.runPortfolioJobs(now)).toMatchObject({ deletedFiles: 0, checkedPortfolios: 0 });
			expect(fixture.files.size).toBe(4);
			// A day later, the file that was never tracked goes too.
			expect(await jobs.runPortfolioJobs(new Date(now.getTime() + 25 * hour))).toMatchObject({ deletedFiles: 2 });
		});

		it("keeps files the stored data names anywhere, even in a field this version doesn't read", async () => {
			const now = new Date();
			await service.create("member", { sourceResumeId: null });
			const key = stored("member", "future");
			await addFile("member", "future");
			// Data a later version saved, with a field this one doesn't know.
			const [row] = await getDb().select({ data: tables.portfolio.data }).from(tables.portfolio);
			await getDb()
				.update(tables.portfolio)
				.set({ data: { ...(row?.data as object), intro: { slides: [{ picture: key }] } } })
				.where(eq(tables.portfolio.userId, "member"));
			await markUnused(key, new Date(now.getTime() - 48 * hour));

			await expect(service.deleteFile("member", { key })).rejects.toMatchObject({ code: "PORTFOLIO_FILE_IN_USE" });
			expect(await jobs.runPortfolioJobs(now)).toMatchObject({ deletedFiles: 0, checkedPortfolios: 1 });
			expect(fixture.files.has(key)).toBe(true);
			expect(await fileRows()).toEqual([{ key, unusedSince: null }]);
		});

		it("never touches files beside the portfolio's folders", async () => {
			await service.create("member", { sourceResumeId: null });
			const beside = [
				"uploads/member/pictures/portfolio-persona.jpg",
				"uploads/member/documents/portfolio.pdf",
				"uploads/member/pictures/photo.jpg",
			];
			for (const key of beside) fixture.files.set(key, new Uint8Array([1]));
			const stray = stored("member", "stray");
			expect(await jobs.runPortfolioJobs()).toMatchObject({ deletedFiles: 0, checkedPortfolios: 1 });
			expect(fixture.files.has(stray)).toBe(false);
			expect([...fixture.files.keys()].sort()).toEqual([...beside].sort());
		});

		it("never holds a portfolio's lock while storage deletes, so saving doesn't wait", async () => {
			const now = new Date();
			const created = await service.create("member", { sourceResumeId: null });
			const key = stored("member", "old");
			await addFile("member", "old");
			await markUnused(key, new Date(now.getTime() - 48 * hour));
			const hold = gate();
			fixture.beforeDelete = (deleting) => (deleting === key ? hold.wait() : Promise.resolve());
			const run = jobs.runPortfolioJobs(now);
			try {
				await hold.arrived;
				// The job is mid-delete; a save goes through at once.
				await expect(
					Promise.race([update("member", { hero: { greeting: "Saved" } }, created.updatedAt), timeout(3000)]),
				).resolves.toMatchObject({ data: { hero: { greeting: "Saved" } } });
			} finally {
				hold.open();
			}
			expect(await run).toMatchObject({ deletedFiles: 1, checkedPortfolios: 1 });
			expect(fixture.files.has(key)).toBe(false);
		});

		it("refuses at once a save naming a file of a deleted portfolio, while the job deletes it", async () => {
			await service.create("member", { sourceResumeId: null });
			const uploaded = await service.uploadImage("member", { file: await picture(300, 200) });
			await service.delete("member");
			const hold = gate();
			fixture.beforeDelete = (key) => (key === uploaded.key ? hold.wait() : Promise.resolve());
			const run = jobs.runPortfolioJobs();
			try {
				await hold.arrived;
				// A new portfolio whose save names the file being deleted (an old editor's data, say): an overdue file is
				// gone as far as saves go, so it's refused without waiting for the job.
				const fresh = await service.create("member", { sourceResumeId: null });
				await expect(
					update(
						"member",
						{ basics: { picture: { key: uploaded.key, width: 300, height: 200, alt: "" } } },
						fresh.updatedAt,
					),
				).rejects.toMatchObject({ code: "PORTFOLIO_FILE_NOT_FOUND", data: { key: uploaded.key } });
			} finally {
				hold.open();
			}
			await run;
			expect(fixture.files.has(uploaded.key)).toBe(false);
			expect(await fileRows()).toEqual([]);
			expect((await service.get("member")).portfolio?.data.basics.picture).toBeUndefined();
		});

		it("leaves a file storage won't delete as a stray, which a later check deletes", async () => {
			const now = new Date();
			await service.create("member", { sourceResumeId: null });
			const key = stored("member", "old");
			await addFile("member", "old");
			await markUnused(key, new Date(now.getTime() - 25 * hour));
			fixture.keepOnDelete.add(key);
			const logged = vi.spyOn(console, "error").mockImplementation(() => {});
			try {
				// Its row goes (no save can use the file anymore); storage keeps the file, the check can't delete it either.
				expect(await jobs.runPortfolioJobs(now)).toMatchObject({ deletedFiles: 1, checkedPortfolios: 1 });
				expect(await fileRows()).toEqual([]);
				expect(fixture.files.has(key)).toBe(true);
				expect(logged).toHaveBeenCalled();
			} finally {
				logged.mockRestore();
			}
			fixture.keepOnDelete.clear();
			expect(await jobs.runPortfolioJobs(new Date(now.getTime() + 8 * 24 * hour))).toMatchObject({
				deletedFiles: 0,
				checkedPortfolios: 1,
			});
			expect(fixture.files.has(key)).toBe(false);
		});

		it("goes on with the other accounts when one fails", async () => {
			await service.create("member", { sourceResumeId: null });
			await service.create("other", { sourceResumeId: null });
			const theirs = stored("other", "stray");
			const mine = stored("member", "stray");
			fixture.failLists.push("uploads/member/");
			const logged = vi.spyOn(console, "error").mockImplementation(() => {});
			try {
				expect(await jobs.runPortfolioJobs()).toMatchObject({ deletedFiles: 0, checkedPortfolios: 1 });
			} finally {
				logged.mockRestore();
			}
			expect(fixture.files.has(theirs)).toBe(false);
			expect(fixture.files.has(mine)).toBe(true);

			// The failed check is given back, so the next run tries this portfolio again instead of waiting a week.
			fixture.failLists.length = 0;
			expect(await jobs.runPortfolioJobs()).toMatchObject({ deletedFiles: 0, checkedPortfolios: 1 });
			expect(fixture.files.has(mine)).toBe(false);
		});

		it("deletes other accounts' files when storage fails one account's", async () => {
			for (const userId of ["member", "other"]) {
				await service.create(userId, { sourceResumeId: null });
				await service.uploadImage(userId, { file: await picture(300, 200) });
				await service.delete(userId);
			}
			const [mine] = await fileRows("member");
			fixture.keepOnDelete.add(mine?.key as string);
			const logged = vi.spyOn(console, "error").mockImplementation(() => {});
			try {
				expect(await jobs.runPortfolioJobs()).toMatchObject({ deletedFiles: 1 });
			} finally {
				logged.mockRestore();
			}
			expect(await fileRows("other")).toEqual([]);
			expect(await fileRows("member")).toHaveLength(1);
		});

		it("still deletes unused files while portfolios are off, but skips the weekly check", async () => {
			await service.create("member", { sourceResumeId: null });
			stored("member", "old");
			await addFile("member", "old");
			await markUnused(image("member", "old").key, new Date(Date.now() - 48 * hour));
			// A stray only the weekly check would find stays until portfolios are back.
			const stray = stored("member", "stray");
			fixture.mode = "off";
			expect(await jobs.runPortfolioJobs()).toMatchObject({ deletedFiles: 1, checkedPortfolios: 0 });
			expect([...fixture.files.keys()]).toEqual([stray]);
		});
	});

	it("reports usage", async () => {
		await service.create("member", {});
		await addFile("member", "a");
		await addFile("member", "b");
		expect(await service.get("member")).toMatchObject({
			enabled: true,
			usage: { works: 0, storageBytes: 2000 },
			limits: { works: 50, storageBytes: PORTFOLIO_UPLOAD.accountBytes, dataBytes: 256 * 1024 },
		});
	});
});
