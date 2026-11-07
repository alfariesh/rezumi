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
	viewer: null as { id: string } | null,
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
vi.mock("../resume/access-policy", async () => {
	const actual = await vi.importActual<typeof import("../resume/access-policy")>("../resume/access-policy");
	return { ...actual, resolveViewer: () => Promise.resolve(fixture.viewer) };
});

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;

function resumeData(name: string): ResumeData {
	const data = structuredClone(defaultResumeData);
	data.basics.name = name;
	return data;
}

const visitor = (userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15") =>
	new Headers({ "user-agent": userAgent });

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("who /<username> belongs to", () => {
	let publicPortfolio: typeof import("./public");
	let webPage: typeof import("../resume/web-page");
	let socialMeta: typeof import("../resume/social-meta");
	let admin: Pool;
	let pool: Pool;
	const schemaName = `portfolio_public_test_${randomUUID().replaceAll("-", "")}`;
	// Usernames are claimed under a database-wide advisory lock (`lock_username_claim`). Suites running at the same time
	// with the same usernames in a different order can deadlock each other, so each run uses its own.
	const usernameSuffix = randomUUID().slice(0, 8);
	const username = (id: string) => `pfpub-${id}-${usernameSuffix}`;

	const addResume = async (userId: string, values: Partial<typeof tables.resume.$inferInsert> = {}) => {
		const [row] = await getDb()
			.insert(tables.resume)
			.values({
				name: "CV",
				slug: "cv",
				userId,
				data: resumeData(`${userId} resume`),
				isPublic: true,
				isPrimary: true,
				...values,
			})
			.returning({ id: tables.resume.id });
		return row?.id as string;
	};

	const addPortfolio = async (userId: string, values: Partial<typeof tables.portfolio.$inferInsert> = {}) => {
		const [row] = await getDb()
			.insert(tables.portfolio)
			.values({ userId, isPublic: true, data: { version: 1 } as never, ...values })
			.returning({ id: tables.portfolio.id });
		return row?.id as string;
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
		publicPortfolio = await import("./public");
		webPage = await import("../resume/web-page");
		socialMeta = await import("../resume/social-meta");
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		fixture.viewer = null;
		await pool.query('TRUNCATE "user", released_username CASCADE');
		await getDb()
			.insert(tables.user)
			.values(
				[{ id: "member" }, { id: "chief", role: "admin" }, { id: "banned", banned: true }, { id: "nobody" }].map(
					(account) => ({
						name: `${account.id} name`,
						email: `${account.id}@example.test`,
						username: username(account.id),
						displayUsername: username(account.id),
						emailVerified: true,
						// Settled accounts: new ones stay out of search engines for a week.
						createdAt: new Date(Date.now() - 30 * 86_400_000),
						...account,
					}),
				),
			);
	});

	describe("the published portfolio", () => {
		it("is shown in every mode that lets its owner have one", async () => {
			await addPortfolio("member");
			await addPortfolio("chief");
			const shown = async () => ({
				member: Boolean(await publicPortfolio.findPublicPortfolio(username("member"))),
				chief: Boolean(await publicPortfolio.findPublicPortfolio(username("chief"))),
			});
			fixture.mode = "off";
			expect(await shown()).toEqual({ member: false, chief: false });
			fixture.mode = "admins";
			expect(await shown()).toEqual({ member: false, chief: true });
			fixture.mode = "on";
			expect(await shown()).toEqual({ member: true, chief: true });
		});

		it("isn't shown unpublished, suspended, or for a banned owner", async () => {
			await addPortfolio("member", { isPublic: false });
			await addPortfolio("chief", { suspendedAt: new Date(), suspendedReason: "Scam" });
			await addPortfolio("banned");
			expect(await publicPortfolio.findPublicPortfolio(username("member"))).toBeNull();
			expect(await publicPortfolio.findPublicPortfolio(username("chief"))).toBeNull();
			expect(await publicPortfolio.findPublicPortfolio(username("banned"))).toBeNull();
			expect(await publicPortfolio.findPublicPortfolio(username("nobody"))).toBeNull();
		});

		it("reads its source resume unless it is in Trash, and matches the username in any case", async () => {
			const resumeId = await addResume("member", { slug: "my-cv", showDownloadButtons: true });
			await addPortfolio("member", { sourceResumeId: resumeId, showInSearchEngines: false });
			const found = await publicPortfolio.findPublicPortfolio(username("member").toUpperCase());
			expect(found).toMatchObject({
				username: username("member"),
				ownerName: "member name",
				indexable: false,
				customDomain: null,
				resume: { slug: "my-cv", isPublic: true, hasPassword: false, showDownloadButtons: true },
			});
			expect(found?.resume?.data.basics.name).toBe("member resume");

			await getDb().update(tables.resume).set({ trashedAt: new Date() }).where(eq(tables.resume.id, resumeId));
			expect((await publicPortfolio.findPublicPortfolio(username("member")))?.resume).toBeNull();
		});

		it("still shows when its source resume's stored data can't be read, without the resume", async () => {
			const resumeId = await addResume("member", { data: { basics: "not a resume" } as never });
			await addPortfolio("member", { sourceResumeId: resumeId });
			const logged = vi.spyOn(console, "error").mockImplementation(() => {});
			const found = await publicPortfolio.findPublicPortfolio(username("member"));
			expect(found).toMatchObject({ username: username("member"), resume: null });
			expect(logged).toHaveBeenCalledOnce();
			logged.mockRestore();
		});
	});

	describe("its files", () => {
		const key = (userId: string, name: string) => `uploads/${userId}/pictures/portfolio/${name}.webp`;
		const addFile = async (userId: string, name: string, used = true) => {
			await getDb()
				.insert(tables.portfolioFile)
				.values({
					userId,
					kind: "image",
					key: key(userId, name),
					bytes: 10,
					width: 1,
					height: 1,
					unusedSince: used ? null : new Date(),
				});
			return key(userId, name);
		};

		it("are public only while saved data uses them and the portfolio shows", async () => {
			const portfolioId = await addPortfolio("member");
			const used = await addFile("member", "used");
			const unsaved = await addFile("member", "unsaved", false);
			expect(await publicPortfolio.isPublicPortfolioFile(used)).toBe(true);
			expect(await publicPortfolio.isPublicPortfolioFile(unsaved)).toBe(false);
			expect(await publicPortfolio.isPublicPortfolioFile(key("member", "unknown"))).toBe(false);

			await getDb().update(tables.portfolio).set({ isPublic: false }).where(eq(tables.portfolio.id, portfolioId));
			expect(await publicPortfolio.isPublicPortfolioFile(used)).toBe(false);
			await getDb()
				.update(tables.portfolio)
				.set({ isPublic: true, suspendedAt: new Date(), suspendedReason: "Scam" })
				.where(eq(tables.portfolio.id, portfolioId));
			expect(await publicPortfolio.isPublicPortfolioFile(used)).toBe(false);
			await getDb()
				.update(tables.portfolio)
				.set({ suspendedAt: null, suspendedReason: null })
				.where(eq(tables.portfolio.id, portfolioId));
			expect(await publicPortfolio.isPublicPortfolioFile(used)).toBe(true);

			// The switch decides too: off for everyone, or on only for admins.
			fixture.mode = "admins";
			expect(await publicPortfolio.isPublicPortfolioFile(used)).toBe(false);
			fixture.mode = "off";
			expect(await publicPortfolio.isPublicPortfolioFile(used)).toBe(false);
		});

		it("are never public for a banned owner, or without a portfolio", async () => {
			await addPortfolio("banned");
			expect(await publicPortfolio.isPublicPortfolioFile(await addFile("banned", "photo"))).toBe(false);
			expect(await publicPortfolio.isPublicPortfolioFile(await addFile("nobody", "photo"))).toBe(false);
		});
	});

	describe("the primary resume", () => {
		it("keeps /<username> as its address until a portfolio is published there", async () => {
			await addResume("member", { slug: "my-cv" });
			const page = () =>
				webPage.loadPublicWebPage({
					match: { username: username("member"), slug: "my-cv" },
					requestHeaders: visitor(),
					trustedClient: "1.1.1.1",
				});
			const card = () => socialMeta.getPublicResumeCardData({ username: username("member"), slug: "my-cv" });
			expect(await page()).toMatchObject({ status: "ok", isPrimary: true });
			expect(await card()).toMatchObject({ isPrimary: true });

			const portfolioId = await addPortfolio("member");
			expect(await page()).toMatchObject({ status: "ok", isPrimary: false, customDomain: null });
			expect(await card()).toMatchObject({ isPrimary: false });

			// Switched off again, the short address is the resume's once more, with no change to the data.
			fixture.mode = "off";
			expect(await page()).toMatchObject({ isPrimary: true });
			fixture.mode = "on";
			await getDb().update(tables.portfolio).set({ isPublic: false }).where(eq(tables.portfolio.id, portfolioId));
			expect(await page()).toMatchObject({ isPrimary: true });
		});

		it("is listed in the sitemap at its own address once a portfolio holds the short one", async () => {
			await addResume("member", { slug: "my-cv", showInSearchEngines: true });
			const listed = async () => (await webPage.listIndexableResumes(0)).map((row) => row.isPrimary);
			expect(await listed()).toEqual([true]);
			await addPortfolio("member");
			expect(await listed()).toEqual([false]);
		});
	});

	describe("the portfolio sitemap", () => {
		it("lists published, indexable portfolios shown in this mode", async () => {
			await addPortfolio("member");
			await addPortfolio("chief", { showInSearchEngines: false });
			await addPortfolio("banned");
			expect((await publicPortfolio.listIndexablePortfolios(0)).map((row) => row.username)).toEqual([
				username("member"),
			]);
			expect(await publicPortfolio.countIndexablePortfolios()).toBe(1);
			fixture.mode = "admins";
			expect(await publicPortfolio.countIndexablePortfolios()).toBe(0);
			fixture.mode = "off";
			expect(await publicPortfolio.listIndexablePortfolios(0)).toEqual([]);
		});

		it("agrees with the page on what search engines may list", async () => {
			const portfolioId = await addPortfolio("member");
			const listed = async () => ({
				page: (await publicPortfolio.findPublicPortfolio(username("member")))?.indexable ?? null,
				sitemap: (await publicPortfolio.listIndexablePortfolios(0)).length === 1,
			});
			expect(await listed()).toEqual({ page: true, sitemap: true });
			await getDb()
				.update(tables.portfolio)
				.set({ showInSearchEngines: false })
				.where(eq(tables.portfolio.id, portfolioId));
			expect(await listed()).toEqual({ page: false, sitemap: false });
			await getDb()
				.update(tables.portfolio)
				.set({ showInSearchEngines: true, suspendedAt: new Date(), suspendedReason: "Scam" })
				.where(eq(tables.portfolio.id, portfolioId));
			// Suspended: no page at all, and not listed.
			expect(await listed()).toEqual({ page: null, sitemap: false });
		});

		it("keeps a portfolio out of search engines for its account's first week", async () => {
			await addPortfolio("member");
			const sixDaysOld = new Date(Date.now() - 6 * 86_400_000);
			await getDb().update(tables.user).set({ createdAt: sixDaysOld }).where(eq(tables.user.id, "member"));
			expect(await publicPortfolio.countIndexablePortfolios()).toBe(0);
			expect(await publicPortfolio.findPublicPortfolio(username("member"))).toMatchObject({ indexable: false });

			const eightDaysOld = new Date(Date.now() - 8 * 86_400_000);
			await getDb().update(tables.user).set({ createdAt: eightDaysOld }).where(eq(tables.user.id, "member"));
			expect(await publicPortfolio.countIndexablePortfolios()).toBe(1);
			expect(await publicPortfolio.findPublicPortfolio(username("member"))).toMatchObject({ indexable: true });
		});
	});

	describe("visits", () => {
		const views = async (portfolioId: string) =>
			(
				await getDb()
					.select()
					.from(tables.portfolioStatisticsDaily)
					.where(eq(tables.portfolioStatisticsDaily.portfolioId, portfolioId))
			)
				.map((row) => row.views)
				.reduce((sum, value) => sum + value, 0);

		it("count once an hour per visitor, never the owner or crawlers", async () => {
			const id = await addPortfolio("member");
			const portfolio = { id, userId: "member" };
			await publicPortfolio.recordPortfolioVisit({ portfolio, requestHeaders: visitor(), trustedClient: "10.0.0.1" });
			await publicPortfolio.recordPortfolioVisit({ portfolio, requestHeaders: visitor(), trustedClient: "10.0.0.1" });
			await publicPortfolio.recordPortfolioVisit({ portfolio, requestHeaders: visitor(), trustedClient: "10.0.0.2" });
			await publicPortfolio.recordPortfolioVisit({
				portfolio,
				requestHeaders: visitor("Googlebot/2.1 (+http://www.google.com/bot.html)"),
				trustedClient: "10.0.0.3",
			});
			fixture.viewer = { id: "member" };
			await publicPortfolio.recordPortfolioVisit({ portfolio, requestHeaders: visitor(), trustedClient: "10.0.0.4" });
			expect(await views(id)).toBe(2);
		});
	});
});
