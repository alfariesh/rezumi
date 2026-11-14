import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import sharp from "sharp";
import * as tables from "@rezumi/db/schema";
import { PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	billing: "off" as "off" | "admins" | "on",
	portfolio: "on" as "off" | "admins" | "on",
	files: new Map<string, Uint8Array>(),
	/** Stands in for reading a picture from another site. */
	remote: vi.fn<(url: string) => Promise<{ bytes: Uint8Array; contentType: string; extension: string }>>(),
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
			APP_URL: "https://rezumi.test",
			get PORTFOLIO_MODE() {
				return fixture.portfolio;
			},
			get BILLING_MODE() {
				return fixture.billing;
			},
		},
	};
});
vi.mock("../storage", () => ({
	getStorageService: () => ({
		list: (prefix: string) => Promise.resolve([...fixture.files.keys()].filter((key) => key.startsWith(prefix))),
		write: ({ key, data }: { key: string; data: Uint8Array }) => {
			fixture.files.set(key, data);
			return Promise.resolve();
		},
		delete: (key: string) => Promise.resolve(fixture.files.delete(key)),
	}),
}));
vi.mock("./unfurl", async () => ({
	...(await vi.importActual<typeof import("./unfurl")>("./unfurl")),
	fetchRemoteImage: (url: string) => fixture.remote(url),
}));

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const pictureBytes = async (width: number, height: number, format: "webp" | "png" = "webp") =>
	new Uint8Array(
		await sharp({ create: { width, height, channels: 3, background: "#225588" } })
			[format]()
			.toBuffer(),
	);
const picture = async (width = 600, height = 400, format: "webp" | "png" = "webp") =>
	new File([await pictureBytes(width, height, format)], `a.${format}`, { type: `image/${format}` });

const addWork = (title: string, extra: Record<string, unknown> = {}): PortfolioEdit => ({
	op: "add",
	list: "works",
	item: { title, ...extra },
});

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("AI edits to a portfolio", () => {
	let service: typeof import("./service").portfolioService;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `portfolio_ai_edits_test_${randomUUID().replaceAll("-", "")}`;
	const usernameSuffix = randomUUID().slice(0, 8);

	const current = async (userId = "member") => {
		const { portfolio } = await service.get(userId);
		if (!portfolio) throw new Error("No portfolio.");
		return portfolio;
	};

	const fileRow = async (key: string) => {
		const [row] = await getDb()
			.select({ unusedSince: tables.portfolioFile.unusedSince, bytes: tables.portfolioFile.bytes })
			.from(tables.portfolioFile)
			.where(eq(tables.portfolioFile.key, key));
		return row ?? null;
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
		fixture.billing = "off";
		fixture.portfolio = "on";
		fixture.files = new Map();
		fixture.remote.mockReset();
		await pool.query('TRUNCATE "user", released_username CASCADE');
		await getDb()
			.insert(tables.user)
			.values(
				["member", "other"].map((id) => ({
					id,
					role: "user",
					name: `${id} name`,
					email: `${id}@example.test`,
					emailVerified: true,
					username: `ai-${id}-${usernameSuffix}`,
					displayUsername: `ai-${id}-${usernameSuffix}`,
				})),
			);
		await service.create("member", { sourceResumeId: null, theme: "lugas" });
	});

	describe("applyEdits", () => {
		it("saves the edits that apply in one version and reports the ones that fail", async () => {
			const before = await current();
			const result = await service.applyEdits("member", {
				title: "Add Lumen",
				edits: [
					addWork("Lumen redesign", { summary: "A calmer checkout." }),
					{ op: "remove", list: "works", id: "nope" },
				],
			});
			expect(result.applied).toEqual([{ index: 0, summary: expect.any(String), id: expect.any(String) }]);
			expect(result.failed).toEqual([{ index: 1, error: expect.any(String) }]);
			expect(result.title).toBe("Add Lumen");
			const after = await current();
			expect(after.updatedAt.getTime()).toBe(result.updatedAt.getTime());
			expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
			expect(after.data.works.items.map((work) => work.title)).toContain("Lumen redesign");
			expect(after.data.works.items.find((work) => work.id === result.applied[0]?.id)?.slug).toBeTruthy();
		});

		it("writes nothing and keeps the version when no edit applies", async () => {
			const before = await current();
			const result = await service.applyEdits("member", {
				edits: [{ op: "remove", list: "works", id: "nope" }],
			});
			expect(result.applied).toEqual([]);
			expect(result.failed).toHaveLength(1);
			expect(result.updatedAt.getTime()).toBe(before.updatedAt.getTime());
			expect((await current()).updatedAt.getTime()).toBe(before.updatedAt.getTime());
		});

		it("refuses a stale version when one is given, and applies to the latest data without one", async () => {
			const { updatedAt } = await current();
			await service.applyEdits("member", { edits: [{ op: "set", path: "hero.greeting", value: "Hi there" }] });
			await expect(
				service.applyEdits("member", {
					edits: [{ op: "set", path: "hero.greeting", value: "Hello" }],
					expectedUpdatedAt: updatedAt,
				}),
			).rejects.toMatchObject({ code: "PORTFOLIO_VERSION_CONFLICT", status: 409 });
			expect((await current()).data.hero.greeting).toBe("Hi there");
			const fresh = await current();
			await service.applyEdits("member", {
				edits: [{ op: "set", path: "hero.greeting", value: "Hello" }],
				expectedUpdatedAt: fresh.updatedAt,
			});
			expect((await current()).data.hero.greeting).toBe("Hello");
		});

		it("refuses what the plan locks without saving it, with the plan's name", async () => {
			fixture.billing = "on";
			const before = await current();
			const result = await service.applyEdits("member", {
				edits: [
					{ op: "set", path: "theme", value: "kanvas" },
					{ op: "set", path: "hero.greeting", value: "Still saved" },
				],
			});
			expect(result.failed).toEqual([{ index: 0, error: expect.stringContaining("Free") }]);
			const after = await current();
			expect(after.data.theme).toBe(before.data.theme);
			expect(after.data.hero.greeting).toBe("Still saved");

			const full = await service.applyEdits("member", {
				edits: Array.from({ length: 7 }, (_, index) => addWork(`Work ${index + 1}`)),
			});
			expect(full.applied.length).toBeLessThan(7);
			expect(full.failed.length).toBeGreaterThan(0);
			expect((await current()).data.works.items.length).toBeLessThanOrEqual(6);
		});

		it("places an upload not placed yet, and marks the file as used", async () => {
			const image = await service.addImage("member", { source: { file: await picture() }, alt: "Checkout" });
			expect((await fileRow(image.key))?.unusedSince).not.toBeNull();
			expect((await service.aiView("member")).uploads.map((upload) => upload.key)).toContain(image.key);

			const result = await service.applyEdits("member", {
				edits: [addWork("Lumen", { cover: { key: image.key, alt: "Checkout" } })],
			});
			expect(result.failed).toEqual([]);
			const work = (await current()).data.works.items.find((item) => item.id === result.applied[0]?.id);
			expect(work?.cover).toMatchObject({ key: image.key, width: 600, height: 400, alt: "Checkout" });
			expect((await fileRow(image.key))?.unusedSince).toBeNull();
			expect((await service.aiView("member")).uploads.map((upload) => upload.key)).not.toContain(image.key);
		});

		it("refuses pictures that aren't this account's uploads", async () => {
			const result = await service.applyEdits("member", {
				edits: [addWork("Elsewhere", { cover: { key: "uploads/other/pictures/portfolio/theirs.webp" } })],
			});
			expect(result.applied).toEqual([]);
			expect(result.failed).toHaveLength(1);
		});

		it("needs portfolios to be open to the account, and a portfolio", async () => {
			await expect(service.applyEdits("other", { edits: [addWork("A")] })).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
			fixture.portfolio = "off";
			await expect(service.applyEdits("member", { edits: [addWork("A")] })).rejects.toMatchObject({
				code: "PORTFOLIO_DISABLED",
			});
		});
	});

	describe("aiView", () => {
		it("reads the portfolio for a model with its status, uploads and plan", async () => {
			const view = await service.aiView("member");
			expect(view).toMatchObject({
				published: false,
				url: `https://rezumi.test/ai-member-${usernameSuffix}`,
				uploads: [],
				plan: null,
			});
			expect(view.view).toEqual(expect.any(Object));
			fixture.billing = "on";
			expect((await service.aiView("member")).plan).toMatchObject({
				name: "Free",
				maxWorks: 6,
				features: { premiumPortfolioThemes: false, premiumHeroEffects: false, hidePortfolioCredit: false },
			});
			await expect(service.aiView("other")).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});

	describe("addImage", () => {
		it("stores a picture from a file like an upload, unused until placed", async () => {
			const image = await service.addImage("member", {
				source: { file: await picture(800, 500, "png") },
				alt: " Logo ",
			});
			expect(image).toEqual({
				key: expect.stringMatching(/^uploads\/member\/pictures\/portfolio\/.+\.png$/),
				width: 800,
				height: 500,
				alt: "Logo",
			});
			expect(fixture.files.has(image.key)).toBe(true);
			expect(await fileRow(image.key)).toMatchObject({ unusedSince: expect.any(Date) });
		});

		it("drops where and with what a photo was taken before storing it, and keeps it upright", async () => {
			const photo = new Uint8Array(
				await sharp({ create: { width: 900, height: 600, channels: 3, background: "#336699" } })
					.jpeg()
					.withMetadata({ orientation: 6 })
					.withExifMerge({ IFD0: { Make: "PhoneMaker" }, IFD3: { GPSMapDatum: "HOME 51.5N 0.1W" } })
					.toBuffer(),
			);
			expect(Buffer.from(photo).includes("HOME 51.5N 0.1W")).toBe(true);
			const image = await service.addImage("member", {
				source: { file: new File([photo], "me.jpg", { type: "image/jpeg" }) },
			});
			const stored = fixture.files.get(image.key);
			if (!stored) throw new Error("Not stored");
			expect(Buffer.from(stored).includes("HOME 51.5N 0.1W")).toBe(false);
			expect(Buffer.from(stored).includes("PhoneMaker")).toBe(false);
			const meta = await sharp(stored).metadata();
			expect(meta.orientation).toBe(6);
			// Drawn turned a quarter, as browsers do: its sides are recorded the way the page shows them.
			expect([image.width, image.height]).toEqual([600, 900]);
			expect(await fileRow(image.key)).toMatchObject({ bytes: stored.byteLength });
		});

		it("fetches a picture from a link and checks it the same way", async () => {
			fixture.remote.mockResolvedValueOnce({
				bytes: await pictureBytes(400, 300),
				contentType: "image/webp",
				extension: "webp",
			});
			const image = await service.addImage("member", { source: { url: "https://example.com/cover.webp" } });
			expect(fixture.remote).toHaveBeenCalledWith("https://example.com/cover.webp");
			expect(image).toMatchObject({ width: 400, height: 300, alt: "" });

			const { RemoteImageError } = await import("./unfurl");
			fixture.remote.mockRejectedValueOnce(new RemoteImageError("too-large"));
			await expect(
				service.addImage("member", { source: { url: "https://example.com/huge.png" } }),
			).rejects.toMatchObject({
				code: "PORTFOLIO_FILE_TOO_LARGE",
				message: expect.stringContaining("can't make pictures smaller"),
			});
			fixture.remote.mockRejectedValueOnce(new RemoteImageError("unreachable"));
			await expect(
				service.addImage("member", { source: { url: "https://example.com/gone.png" } }),
			).rejects.toMatchObject({
				code: "PORTFOLIO_IMAGE_UNREACHABLE",
				message: expect.stringContaining("Couldn't download that picture"),
			});
		});

		it("refuses pictures larger than the portfolio keeps, saying the server can't resize them", async () => {
			await expect(
				service.addImage("member", { source: { file: await picture(PORTFOLIO_UPLOAD.imageSide + 100, 400) } }),
			).rejects.toMatchObject({
				code: "PORTFOLIO_IMAGE_INVALID",
				data: { reason: "dimensions" },
				message: expect.stringContaining("can't make pictures smaller"),
			});
			const heavy = new File([new Uint8Array(PORTFOLIO_UPLOAD.imageBytes + 1)], "big.png", { type: "image/png" });
			await expect(service.addImage("member", { source: { file: heavy } })).rejects.toMatchObject({
				code: "PORTFOLIO_FILE_TOO_LARGE",
				message: expect.stringContaining("can't make pictures smaller"),
			});
			const text = new File([new TextEncoder().encode("not a picture")], "a.png", { type: "image/png" });
			await expect(service.addImage("member", { source: { file: text } })).rejects.toMatchObject({
				code: "PORTFOLIO_IMAGE_INVALID",
				data: { reason: "type" },
			});
			expect(fixture.files.size).toBe(0);
		});

		it("counts toward the plan's storage", async () => {
			fixture.billing = "on";
			await getDb()
				.insert(tables.portfolioFile)
				.values({
					userId: "member",
					kind: "pdf",
					key: "uploads/member/documents/portfolio/old.pdf",
					bytes: 100 * 1024 * 1024,
					pages: 1,
				});
			await expect(service.addImage("member", { source: { file: await picture() } })).rejects.toMatchObject({
				code: "PLAN_LIMIT_REACHED",
			});
		});
	});
});
