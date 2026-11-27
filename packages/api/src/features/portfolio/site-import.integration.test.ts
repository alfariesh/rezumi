import type { SiteWorksEvent, WorkDraft } from "@rezumi/schema/profile/website-import";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { readPortfolioImageHeader } from "@rezumi/portfolio/image-header";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { emptyProfileData } from "@rezumi/schema/profile/data";

/**
 * Saving a website import's works against a real PostgreSQL: the Profile's projects, the portfolio made unpublished,
 * pictures copied (and shrunk) within the plan's storage, the plan's works, and importing twice. Storage and the
 * pictures' sites are fakes.
 */

const fixture = vi.hoisted(() => ({
	db: undefined as unknown,
	files: new Map<string, Uint8Array>(),
	pictures: new Map<string, { width: number; height: number; format: "jpeg" | "png" } | "missing">(),
	fetched: [] as string[],
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
		env: { ...actual.env, PORTFOLIO_MODE: "on", BILLING_MODE: "on", FLAG_DISABLE_IMAGE_PROCESSING: false },
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
vi.mock("./unfurl", async () => {
	const actual = await vi.importActual<typeof import("./unfurl")>("./unfurl");
	const { default: sharpImage } = await vi.importActual<typeof import("sharp")>("sharp");
	return {
		...actual,
		fetchRemoteImage: vi.fn(async (url: string) => {
			fixture.fetched.push(url);
			const picture = fixture.pictures.get(url);
			if (!picture || picture === "missing") throw new actual.RemoteImageError("unreachable");
			const image = sharpImage({
				create: { width: picture.width, height: picture.height, channels: 3, background: "#336699" },
			});
			const bytes = new Uint8Array(await (picture.format === "png" ? image.png() : image.jpeg()).toBuffer());
			return { bytes, contentType: `image/${picture.format}`, extension: picture.format === "png" ? "png" : "jpg" };
		}),
	};
});

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;

const draft = (id: string, title: string, extra: Partial<WorkDraft> = {}): WorkDraft => ({
	id,
	sourceUrl: `https://dewi.design/work/${id}`,
	title,
	summary: `${title} in one sentence.`,
	role: "Designer",
	date: "2024",
	tags: ["Product design"],
	description: `The story of ${title}.`,
	metrics: [{ label: "Checkout time", value: "-40%" }],
	cover: { url: `https://dewi.design/img/${id}-cover.jpg`, alt: "Cover", width: 1600, height: 1000 },
	gallery: [{ url: `https://dewi.design/img/${id}-a.jpg`, alt: "Screen", width: null, height: null }],
	primaryLink: null,
	links: [],
	embeds: [],
	...extra,
});

describe.skipIf(!databaseUrl)("saving a website import's works", () => {
	let admin: Pool;
	let pool: Pool;
	let importSiteWorks: typeof import("./site-import").importSiteWorks;
	let service: typeof import("./service").portfolioService;
	let profile: typeof import("../profile/service").profileService;
	const schemaName = `site_import_test_${randomUUID().replaceAll("-", "")}`;
	const suffix = randomUUID().slice(0, 8);
	const db = () => fixture.db as ReturnType<typeof drizzle>;

	const saveRun = async (works: WorkDraft[], userId = "dewi") => {
		const id = randomUUID();
		const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
		const result = {
			runId: id,
			url: "https://dewi.design/",
			profile: { data: emptyProfileData(), photoUrl: null, notes: [] },
			works,
			notes: [],
			free: true,
			expiresAt,
		};
		await db()
			.insert(tables.websiteImport)
			.values({ id, userId, url: "https://dewi.design/", status: "succeeded", result, resultExpiresAt: expiresAt });
		return id;
	};

	const save = async (runId: string, workIds: string[], userId = "dewi") => {
		const events: SiteWorksEvent[] = [];
		for await (const event of importSiteWorks(userId, { runId, workIds })) events.push(event);
		return events;
	};
	const outcome = (events: SiteWorksEvent[]) => {
		const last = events.at(-1);
		if (last?.type !== "done") throw new Error("Saving didn't finish.");
		return last;
	};
	const portfolioOf = async (userId = "dewi") => {
		const { portfolio } = await service.get(userId);
		if (!portfolio) throw new Error("No portfolio.");
		return portfolio;
	};

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({ connectionString: databaseUrl, max: 8, options: `-c search_path=${schemaName}` });
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
		({ importSiteWorks } = await import("./site-import"));
		({ portfolioService: service } = await import("./service"));
		({ profileService: profile } = await import("../profile/service"));
	}, 60_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.files = new Map();
		fixture.fetched = [];
		fixture.pictures = new Map<string, { width: number; height: number; format: "jpeg" | "png" } | "missing">(
			["kopi", "bank", "zine"].flatMap((id): [string, { width: number; height: number; format: "jpeg" | "png" }][] => [
				[`https://dewi.design/img/${id}-cover.jpg`, { width: 1600, height: 1000, format: "jpeg" as const }],
				[`https://dewi.design/img/${id}-a.jpg`, { width: 1200, height: 800, format: "png" as const }],
			]),
		);
		await pool.query('TRUNCATE "user", released_username CASCADE');
		await db()
			.insert(tables.user)
			.values(
				["dewi", "other"].map((id) => ({
					id,
					name: `${id} name`,
					email: `${id}@example.test`,
					emailVerified: true,
					username: `${id}-${suffix}`,
					displayUsername: `${id}-${suffix}`,
				})),
			);
	});

	it("makes an unpublished portfolio of only the imported works, with Profile projects and copied pictures", async () => {
		// A project the Profile already had, which the portfolio doesn't take.
		const before = emptyProfileData();
		before.sections.projects = [
			{
				id: "old-project-1234",
				hidden: false,
				name: "Old side project",
				period: "",
				website: { url: "", label: "", inlineLink: false },
				description: "",
			},
		];
		await profile.update("dewi", { data: before });
		const runId = await saveRun([draft("kopi", "Kopi checkout"), draft("bank", "Bank app"), draft("zine", "Zine")]);

		const events = await save(runId, ["kopi", "bank"]);
		expect(events.map((event) => event.type)).toEqual(["saving", "picture", "picture", "done"]);
		expect(outcome(events)).toEqual({
			type: "done",
			added: 2,
			alreadyThere: 0,
			picturesSkipped: 0,
			storageFull: false,
			created: true,
		});

		const portfolio = await portfolioOf();
		expect(portfolio.isPublic).toBe(false);
		const { data: saved } = await profile.read("dewi");
		expect(saved.sections.projects.map((project) => project.name)).toEqual([
			"Old side project",
			"Kopi checkout",
			"Bank app",
		]);
		const projectId = (name: string) => saved.sections.projects.find((project) => project.name === name)?.id;

		expect(portfolio.data.works.items.map((work) => [work.title, work.fromResumeItemId])).toEqual([
			["Kopi checkout", projectId("Kopi checkout")],
			["Bank app", projectId("Bank app")],
		]);
		const [kopi] = portfolio.data.works.items;
		expect(kopi?.cover?.key).toMatch(/^uploads\/dewi\/pictures\/portfolio\//);
		expect(kopi?.blocks.map((block) => block.type)).toEqual(["text", "metrics", "images"]);
		expect(fixture.files.size).toBe(4);
		// Every stored picture is one the saved works use.
		const used = await db().select().from(tables.portfolioFile).where(eq(tables.portfolioFile.userId, "dewi"));
		expect(used.every((file) => file.unusedSince === null)).toBe(true);
	});

	it("links a work to the Profile project already naming it, and adds nothing twice when imported again", async () => {
		const before = emptyProfileData();
		before.sections.projects = [
			{
				id: "kopi-project-1234",
				hidden: false,
				name: "Kopi",
				period: "",
				website: { url: "https://dewi.design/work/kopi", label: "", inlineLink: false },
				description: "",
			},
		];
		await profile.update("dewi", { data: before });
		const runId = await saveRun([draft("kopi", "Kopi checkout")]);
		await save(runId, ["kopi"]);
		expect((await profile.read("dewi")).data.sections.projects).toHaveLength(1);
		expect((await portfolioOf()).data.works.items[0]?.fromResumeItemId).toBe("kopi-project-1234");

		const files = fixture.files.size;
		const again = outcome(await save(await saveRun([draft("kopi", "Kopi checkout")]), ["kopi"]));
		expect(again).toMatchObject({ added: 0, alreadyThere: 1, created: false });
		expect(fixture.files.size).toBe(files);
		expect((await portfolioOf()).data.works.items).toHaveLength(1);
	});

	it("adds to a portfolio that already exists, keeping its works", async () => {
		await service.create("dewi", { sourceResumeId: null });
		const { data, updatedAt } = await portfolioOf();
		data.works.items = parseWritablePortfolioData({
			...data,
			works: { items: [{ id: "mine", slug: "kopi-checkout", title: "My own work", blocks: [] }] },
		}).works.items;
		await service.update("dewi", { data: parseWritablePortfolioData(data), expectedUpdatedAt: updatedAt });

		const result = outcome(await save(await saveRun([draft("kopi", "Kopi checkout")]), ["kopi"]));
		expect(result).toMatchObject({ added: 1, created: false });
		const works = (await portfolioOf()).data.works.items;
		expect(works.map((work) => [work.title, work.slug])).toEqual([
			["My own work", "kopi-checkout"],
			["Kopi checkout", "kopi-checkout-2"],
		]);
	});

	it("refuses more works than the Free plan holds before copying any picture", async () => {
		await service.create("dewi", { sourceResumeId: null });
		const { data, updatedAt } = await portfolioOf();
		data.works.items = parseWritablePortfolioData({
			...data,
			works: {
				items: Array.from({ length: 5 }, (_, index) => ({
					id: `w${index}`,
					slug: `w-${index}`,
					title: `W ${index}`,
					blocks: [],
				})),
			},
		}).works.items;
		await service.update("dewi", { data: parseWritablePortfolioData(data), expectedUpdatedAt: updatedAt });

		const runId = await saveRun([draft("kopi", "Kopi checkout"), draft("bank", "Bank app")]);
		await expect(save(runId, ["kopi", "bank"])).rejects.toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			data: expect.objectContaining({ limit: "portfolioWorks", max: 6, used: 5 }),
		});
		expect(fixture.fetched).toEqual([]);
		expect(outcome(await save(runId, ["kopi"]))).toMatchObject({ added: 1 });
	});

	it("saves the works without the pictures that can't be read", async () => {
		fixture.pictures.set("https://dewi.design/img/kopi-a.jpg", "missing");
		const result = outcome(await save(await saveRun([draft("kopi", "Kopi checkout")]), ["kopi"]));
		expect(result).toMatchObject({ added: 1, picturesSkipped: 1, storageFull: false });
		const [kopi] = (await portfolioOf()).data.works.items;
		expect(kopi?.cover).toBeDefined();
		expect(kopi?.blocks.map((block) => block.type)).toEqual(["text", "metrics"]);
	});

	it("saves the works without pictures once the plan's storage is full", async () => {
		await service.create("dewi", { sourceResumeId: null });
		// The Free plan's 100 MB, all but a little taken.
		await db()
			.insert(tables.portfolioFile)
			.values({
				userId: "dewi",
				kind: "pdf",
				key: `uploads/dewi/documents/portfolio/${randomUUID()}.pdf`,
				bytes: 100 * 1024 * 1024 - 1_000,
				pages: 1,
			});
		const result = outcome(await save(await saveRun([draft("kopi", "Kopi checkout")]), ["kopi"]));
		expect(result).toMatchObject({ added: 1, storageFull: true, picturesSkipped: 2 });
		const kopi = (await portfolioOf()).data.works.items.find((work) => work.title === "Kopi checkout");
		expect(kopi?.cover).toBeUndefined();
	});

	it("shrinks a picture larger than the portfolio keeps to 2,000 pixels", async () => {
		fixture.pictures.set("https://dewi.design/img/kopi-cover.jpg", { width: 3200, height: 1800, format: "jpeg" });
		await save(await saveRun([draft("kopi", "Kopi checkout")]), ["kopi"]);
		const [kopi] = (await portfolioOf()).data.works.items;
		expect(kopi?.cover).toMatchObject({ width: 2000, height: 1125 });
		const stored = fixture.files.get(kopi?.cover?.key ?? "");
		const header = stored ? readPortfolioImageHeader(stored) : null;
		expect(header?.ok && header.image).toMatchObject({ width: 2000, height: 1125 });
	});

	it("uses only the account's own run and the works it found", async () => {
		const runId = await saveRun([draft("kopi", "Kopi checkout")]);
		await expect(save(runId, ["kopi"], "other")).rejects.toMatchObject({ code: "PORTFOLIO_IMPORT_GONE" });
		await expect(save(runId, ["not-in-the-run"])).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect((await service.get("dewi")).portfolio).toBeNull();
	});
});
