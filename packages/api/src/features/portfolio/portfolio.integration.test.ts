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
import { defaultResumeData } from "@rezumi/schema/resume/default";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as "off" | "admins" | "on",
	deleted: [] as string[],
	/** Storage, in memory: key → bytes. */
	files: new Map<string, Uint8Array>(),
	failWrites: false,
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
vi.mock("../storage", () => {
	const under = (key: string, prefix: string) => key === prefix || key.startsWith(`${prefix.replace(/\/$/, "")}/`);
	return {
		getStorageService: () => ({
			list: (prefix: string) => Promise.resolve([...fixture.files.keys()].filter((key) => under(key, prefix))),
			write: ({ key, data }: { key: string; data: Uint8Array }) => {
				if (fixture.failWrites) return Promise.reject(new Error("Storage is down"));
				fixture.files.set(key, data);
				return Promise.resolve();
			},
			delete: (key: string) => {
				fixture.deleted.push(key);
				const keys = [...fixture.files.keys()].filter((candidate) => under(candidate, key));
				for (const candidate of keys) fixture.files.delete(candidate);
				return Promise.resolve(keys.length > 0);
			},
		}),
	};
});

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

	describe("pictures", () => {
		const picture = async (width: number, height: number, format: "webp" | "png" | "jpeg" = "webp", name = "a") => {
			const image = sharp({ create: { width, height, channels: 3, background: "#225588" } });
			const buffer = await image[format]().toBuffer();
			return new File([new Uint8Array(buffer)], `${name}.${format}`, { type: `image/${format}` });
		};
		const fileRows = (userId = "member") =>
			getDb()
				.select({ key: tables.portfolioFile.key, unusedSince: tables.portfolioFile.unusedSince })
				.from(tables.portfolioFile)
				.where(eq(tables.portfolioFile.userId, userId));

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

	describe("PDFs", () => {
		const pdf = (bytes = 2000, name = "case.pdf") => {
			const data = new Uint8Array(bytes);
			data.set(new TextEncoder().encode("%PDF-1.7\n"));
			return new File([data], name, { type: "application/pdf" });
		};
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

			const again = await service.importWorks("member", {
				resumeItemIds: ["p2"],
				expectedUpdatedAt: added.updatedAt,
			});
			expect(again.data.works.items).toHaveLength(3);
			expect(again.updatedAt.getTime()).toBe(added.updatedAt.getTime());
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
			).rejects.toMatchObject({ code: "PORTFOLIO_SOURCE_INVALID" });
		});
	});

	describe("the file cleanup job", () => {
		const hour = 60 * 60 * 1000;
		const markUnused = (key: string, since: Date | null) =>
			getDb().update(tables.portfolioFile).set({ unusedSince: since }).where(eq(tables.portfolioFile.key, key));
		const stored = (userId: string, name: string) => {
			const { key } = image(userId, name);
			fixture.files.set(key, new Uint8Array([1, 2, 3]));
			return key;
		};

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

			expect(await jobs.runPortfolioJobs(now)).toEqual({ deletedFiles: 1, checkedPortfolios: 1 });
			const rows = await getDb()
				.select({ key: tables.portfolioFile.key, unusedSince: tables.portfolioFile.unusedSince })
				.from(tables.portfolioFile)
				.orderBy(tables.portfolioFile.key);
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

			expect(await jobs.runPortfolioJobs(now)).toEqual({ deletedFiles: 0, checkedPortfolios: 0 });
			expect(fixture.files.size).toBe(4);
			// A day later, the file that was never tracked goes too.
			expect(await jobs.runPortfolioJobs(new Date(now.getTime() + 25 * hour))).toMatchObject({ deletedFiles: 2 });
		});

		it("leaves files alone while portfolios are off", async () => {
			await service.create("member", { sourceResumeId: null });
			stored("member", "old");
			await addFile("member", "old");
			await markUnused(image("member", "old").key, new Date(Date.now() - 48 * hour));
			fixture.mode = "off";
			expect(await jobs.runPortfolioJobs()).toEqual({ deletedFiles: 0, checkedPortfolios: 0 });
			expect(fixture.files.size).toBe(1);
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
