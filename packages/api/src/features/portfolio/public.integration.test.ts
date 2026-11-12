import type { ResumeData } from "@rezumi/schema/resume/data";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { listedWorkSlugs, parsePortfolioData } from "@rezumi/schema/portfolio/data";
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
			// CI switches rate limits off for every suite; the password limits are what this file tests.
			FLAG_DISABLE_API_RATE_LIMIT: false,
			get PORTFOLIO_MODE() {
				return fixture.mode;
			},
		},
	};
});
vi.mock("../resume/access-policy", async () => {
	const actual = await vi.importActual<typeof import("../resume/access-policy")>("../resume/access-policy");
	// Like the real one, a request marked cross-site reads as anonymous.
	return {
		...actual,
		resolveViewer: (headers: Headers) =>
			Promise.resolve(headers.get("sec-fetch-site") === "cross-site" ? null : fixture.viewer),
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
	return data;
}

const visitor = (userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15") =>
	new Headers({ "user-agent": userAgent });

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("who /<username> belongs to", () => {
	let publicPortfolio: typeof import("./public");
	let visitorAccess: typeof import("./visitor-access");
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
		visitorAccess = await import("./visitor-access");
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

		it("keeps admins' test portfolios out of search engines until portfolios open to everyone", async () => {
			await addPortfolio("chief");
			fixture.mode = "admins";
			expect(await publicPortfolio.findPublicPortfolio(username("chief"))).toMatchObject({ indexable: false });
			expect(await publicPortfolio.countIndexablePortfolios()).toBe(0);
			fixture.mode = "on";
			expect(await publicPortfolio.findPublicPortfolio(username("chief"))).toMatchObject({ indexable: true });
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
			const portfolio = { id, userId: "member", timezone: "Asia/Jakarta" };
			const requestUrl = "https://rezumi.example/member";
			const record = (trustedClient: string, requestHeaders = visitor()) =>
				publicPortfolio.recordPortfolioVisit({ portfolio, requestHeaders, requestUrl, trustedClient });
			await record("10.0.0.1");
			await record("10.0.0.1");
			await record("10.0.0.2");
			await record("10.0.0.3", visitor("Googlebot/2.1 (+http://www.google.com/bot.html)"));
			fixture.viewer = { id: "member" };
			await record("10.0.0.4");
			expect(await views(id)).toBe(2);
		});

		it("leave out the owner arriving from another site, and clients that don't name themselves", async () => {
			const id = await addPortfolio("member");
			const portfolio = { id, userId: "member", timezone: "UTC" };
			const requestUrl = "https://rezumi.example/member";
			const record = (trustedClient: string, requestHeaders: Headers) =>
				publicPortfolio.recordPortfolioVisit({ portfolio, requestHeaders, requestUrl, trustedClient });
			fixture.viewer = { id: "member" };
			const fromLinkedIn = visitor();
			fromLinkedIn.set("sec-fetch-site", "cross-site");
			await record("10.0.1.1", fromLinkedIn);
			fixture.viewer = null;
			await record("10.0.1.2", new Headers());
			expect(await views(id)).toBe(0);
		});

		it("count one visitor across the addresses of one IPv6 /64", async () => {
			const id = await addPortfolio("member");
			const portfolio = { id, userId: "member", timezone: "UTC" };
			const requestUrl = "https://rezumi.example/member";
			for (const trustedClient of ["2001:db8:aa:1::1", "2001:db8:aa:1::2", "2001:db8:aa:1:ffff::9"])
				await publicPortfolio.recordPortfolioVisit({ portfolio, requestHeaders: visitor(), requestUrl, trustedClient });
			expect(await views(id)).toBe(1);
			await publicPortfolio.recordPortfolioVisit({
				portfolio,
				requestHeaders: visitor(),
				requestUrl,
				trustedClient: "2001:db8:aa:2::1",
			});
			expect(await views(id)).toBe(2);
		});

		it("tell people on one carrier-grade NAT address apart by their browser", async () => {
			const id = await addPortfolio("member");
			const portfolio = { id, userId: "member", timezone: "UTC" };
			const requestUrl = "https://rezumi.example/member";
			const record = (requestHeaders: Headers) =>
				publicPortfolio.recordPortfolioVisit({ portfolio, requestHeaders, requestUrl, trustedClient: "10.0.0.9" });
			await record(visitor("Mozilla/5.0 (Linux; Android 14; SM-A15) Mobile"));
			await record(visitor("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"));
			expect(await views(id)).toBe(2);
		});

		it("record the day in the owner's time zone and where the visit came from", async () => {
			const id = await addPortfolio("member");
			vi.useFakeTimers({ now: new Date("2026-11-09T18:30:00Z"), toFake: ["Date"] });
			try {
				await publicPortfolio.recordPortfolioVisit({
					portfolio: { id, userId: "member", timezone: "Asia/Jakarta" },
					requestHeaders: new Headers({
						"user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
						referer: "https://www.linkedin.com/feed",
					}),
					requestUrl: "https://rezumi.example/member",
					trustedClient: "10.0.0.20",
				});
			} finally {
				vi.useRealTimers();
			}
			const [row] = await getDb()
				.select()
				.from(tables.portfolioStatisticsDaily)
				.where(eq(tables.portfolioStatisticsDaily.portfolioId, id));
			expect(row?.date).toBe("2026-11-10");
			expect(row?.sources).toEqual({ linkedin: 1 });
		});

		it("count a prerendered work page's view beacon as that work opened, once with the page's own count", async () => {
			const id = await addPortfolio("member", {
				data: { version: 1, works: { items: [{ id: "w1", title: "Coffee app" }] } } as never,
			});
			const target = await publicPortfolio.findPortfolioEventTarget(username("member"), "w1");
			if (!target) throw new Error("target expected");
			const beacon = (trustedClient: string, workId = "w1") => {
				const requestHeaders = visitor();
				requestHeaders.set("referer", "https://rezumi.example/member/work/w1");
				return publicPortfolio.recordPortfolioEvent({
					target,
					kind: "view",
					workId,
					ref: "https://www.linkedin.com/feed",
					requestHeaders,
					trustedClient,
				});
			};
			const row = async () =>
				(
					await getDb()
						.select()
						.from(tables.portfolioStatisticsDaily)
						.where(eq(tables.portfolioStatisticsDaily.portfolioId, id))
				)[0];
			// Prerendered, then shown: the beacon counts the visit and the work, with the source from `ref`.
			await beacon("10.3.0.1");
			await beacon("10.3.0.1");
			// The same visitor's later normal load of the page adds nothing.
			await publicPortfolio.recordPortfolioVisit({
				portfolio: { id, userId: "member", timezone: "UTC" },
				requestHeaders: visitor(),
				requestUrl: "https://rezumi.example/member/work/w1",
				trustedClient: "10.3.0.1",
				workId: "w1",
			});
			expect(await row()).toMatchObject({ views: 1, works: { w1: 1 }, sources: { linkedin: 1 } });
			// A work the portfolio doesn't have counts as a visit only.
			const missing = await publicPortfolio.findPortfolioEventTarget(username("member"), "w-gone");
			if (!missing) throw new Error("target expected");
			const requestHeaders = visitor();
			requestHeaders.set("referer", "https://rezumi.example/member/work/x");
			await publicPortfolio.recordPortfolioEvent({
				target: missing,
				kind: "view",
				workId: "w-gone",
				requestHeaders,
				trustedClient: "10.3.0.2",
			});
			expect(await row()).toMatchObject({ views: 2, works: { w1: 1 } });
		});

		it("count a prerendered page's view beacon as its visit, once with the server's own count", async () => {
			const id = await addPortfolio("member");
			const portfolio = { id, userId: "member", timezone: "UTC" };
			const target = { ...portfolio, hasWork: false, passwordHash: null };
			const beacon = (trustedClient: string, referer = "https://rezumi.example/member?utm_source=linkedin") => {
				const requestHeaders = visitor();
				requestHeaders.set("referer", referer);
				return publicPortfolio.recordPortfolioEvent({ target, kind: "view", requestHeaders, trustedClient });
			};
			// A normal load: the server counts it, and a beacon from the same visitor adds nothing.
			await publicPortfolio.recordPortfolioVisit({
				portfolio,
				requestHeaders: visitor(),
				requestUrl: "https://rezumi.example/member",
				trustedClient: "10.2.0.1",
			});
			await beacon("10.2.0.1");
			expect(await views(id)).toBe(1);
			// A prerendered page the server skipped: only its beacon counts it, with the source in the page's address.
			await beacon("10.2.0.2");
			await beacon("10.2.0.2");
			expect(await views(id)).toBe(2);
			const [row] = await getDb()
				.select()
				.from(tables.portfolioStatisticsDaily)
				.where(eq(tables.portfolioStatisticsDaily.portfolioId, id));
			expect(row?.sources).toEqual({ direct: 1, linkedin: 1 });
			// Where the visitor came from before the page, sent along as `ref`.
			const fromGoogle = visitor();
			fromGoogle.set("referer", "https://rezumi.example/member");
			await publicPortfolio.recordPortfolioEvent({
				target,
				kind: "view",
				ref: "https://www.google.com/",
				requestHeaders: fromGoogle,
				trustedClient: "10.2.0.5",
			});
			const [after] = await getDb()
				.select()
				.from(tables.portfolioStatisticsDaily)
				.where(eq(tables.portfolioStatisticsDaily.portfolioId, id));
			expect(after?.sources).toEqual({ direct: 1, linkedin: 1, google: 1 });
			// Never the owner, and nothing without the page's address.
			await beacon("10.2.0.3", "not an address");
			fixture.viewer = { id: "member" };
			await beacon("10.2.0.4");
			expect(await views(id)).toBe(3);
		});
	});

	describe("beacons", () => {
		const works = (ids: string[]) => ({ version: 1, works: { items: ids.map((id) => ({ id, title: id })) } }) as never;
		const row = async (portfolioId: string) => {
			const rows = await getDb()
				.select()
				.from(tables.portfolioStatisticsDaily)
				.where(eq(tables.portfolioStatisticsDaily.portfolioId, portfolioId));
			return rows[0];
		};

		it("count a click once an hour per visitor and kind, never the owner or crawlers", async () => {
			const id = await addPortfolio("member");
			const target = { id, userId: "member", timezone: "UTC", hasWork: false, passwordHash: null };
			const send = (kind: "whatsapp" | "pdf", trustedClient: string, requestHeaders = visitor()) =>
				publicPortfolio.recordPortfolioEvent({ target, kind, requestHeaders, trustedClient });
			await send("whatsapp", "10.1.0.1");
			await send("whatsapp", "10.1.0.1");
			await send("pdf", "10.1.0.1");
			await send("whatsapp", "10.1.0.2");
			await send("whatsapp", "10.1.0.3", visitor("Googlebot/2.1 (+http://www.google.com/bot.html)"));
			fixture.viewer = { id: "member" };
			await send("whatsapp", "10.1.0.4");
			expect((await row(id))?.clicks).toEqual({ whatsapp: 2, pdf: 1 });
		});

		it("count a work's page as that work opened, and its clicks with the work, never a work beacon", async () => {
			const id = await addPortfolio("member", { data: works(["w1"]) });
			const name = username("member");
			const found = await publicPortfolio.findPortfolioEventTarget(name, "w1");
			const missing = await publicPortfolio.findPortfolioEventTarget(name, "w-gone");
			expect(found?.hasWork).toBe(true);
			expect(missing?.hasWork).toBe(false);
			if (!found || !missing) throw new Error("target expected");
			const portfolio = { id, userId: "member", timezone: "UTC" };
			const open = (trustedClient: string, workId: string, referer?: string) => {
				const requestHeaders = visitor();
				if (referer) requestHeaders.set("referer", referer);
				return publicPortfolio.recordPortfolioVisit({
					portfolio,
					requestHeaders,
					requestUrl: `https://rezumi.example/member/work/${workId}`,
					trustedClient,
					workId,
				});
			};
			// From the portfolio's home to the work: one portfolio visit, one work opened.
			await publicPortfolio.recordPortfolioVisit({
				portfolio,
				requestHeaders: visitor(),
				requestUrl: "https://rezumi.example/member",
				trustedClient: "10.1.1.1",
			});
			await open("10.1.1.1", "w1", "https://rezumi.example/member");
			await open("10.1.1.1", "w1", "https://rezumi.example/member");
			expect((await row(id))?.views).toBe(1);
			expect((await row(id))?.works).toEqual({ w1: 1 });
			// Another visitor straight to the work: a visit and an opening; crawlers and the owner count nothing.
			await open("10.1.1.2", "w1");
			fixture.viewer = { id: "member" };
			await open("10.1.1.4", "w1");
			fixture.viewer = null;
			const bot = visitor("Googlebot/2.1 (+http://www.google.com/bot.html)");
			await publicPortfolio.recordPortfolioVisit({
				portfolio,
				requestHeaders: bot,
				requestUrl: "https://rezumi.example/member/work/w1",
				trustedClient: "10.1.1.5",
				workId: "w1",
			});
			expect((await row(id))?.works).toEqual({ w1: 2 });
			expect((await row(id))?.views).toBe(2);
			// A click on the work's page counts per portfolio, whether or not the work exists.
			await publicPortfolio.recordPortfolioEvent({
				target: found,
				kind: "pdf",
				workId: "w1",
				requestHeaders: visitor(),
				trustedClient: "10.1.1.6",
			});
			await publicPortfolio.recordPortfolioEvent({
				target: missing,
				kind: "pdf",
				workId: "w-gone",
				requestHeaders: visitor(),
				trustedClient: "10.1.1.7",
			});
			expect((await row(id))?.clicks).toEqual({ pdf: 2 });
			expect((await row(id))?.works).toEqual({ w1: 2 });

			const today = (await row(id))?.date as string;
			const full = Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`w${index}`, 1]));
			await getDb()
				.update(tables.portfolioStatisticsDaily)
				.set({ works: full })
				.where(eq(tables.portfolioStatisticsDaily.portfolioId, id));
			const { countWorkOpen } = await import("./statistics");
			await countWorkOpen(id, today, "w999");
			await countWorkOpen(id, today, "w1");
			const stored = (await row(id))?.works ?? {};
			expect(Object.keys(stored)).toHaveLength(50);
			expect(stored.w999).toBeUndefined();
			expect(stored.w1).toBe(2);
		});

		it("find no target while the switch is off", async () => {
			await addPortfolio("member");
			fixture.mode = "off";
			expect(await publicPortfolio.findPortfolioEventTarget(username("member"))).toBeNull();
		});
	});

	describe("the work pages in the sitemap", () => {
		it("lists exactly the works listedWorkSlugs lists, worked out in SQL", async () => {
			const fixtures = [
				{
					works: {
						items: [
							{ id: "a", slug: "shown", title: "Shown" },
							{ id: "b", slug: "hidden", title: "Hidden", hidden: true },
							{ id: "c", slug: "untitled", title: "" },
							{ id: "d", slug: "spaces", title: " \u00a0\u3000\t " },
							{ id: "e", slug: "second", title: "  Second  " },
							{ id: "f", slug: "visible-false", title: "Shown too", hidden: false },
						],
					},
				},
				{
					sections: { hidden: ["work"] },
					works: { items: [{ id: "a", slug: "shown", title: "Shown" }] },
				},
				{ works: { items: [] } },
				{},
			];
			for (const [index, data] of fixtures.entries()) {
				const id = `parity-${index}`;
				await getDb()
					.insert(tables.user)
					.values({
						id,
						name: id,
						email: `${id}@example.test`,
						username: username(id),
						displayUsername: username(id),
						emailVerified: true,
						createdAt: new Date(Date.now() - 30 * 86_400_000),
					});
				await addPortfolio(id, { data: { version: 1, ...data } as never });
			}
			const listed = await publicPortfolio.listIndexablePortfolios(0);
			for (const [index, data] of fixtures.entries()) {
				const row = listed.find((item) => item.username === username(`parity-${index}`));
				expect(row?.workSlugs, `fixture ${index}`).toEqual(
					listedWorkSlugs(parsePortfolioData({ version: 1, ...data })),
				);
			}
			expect(listed.find((item) => item.username === username("parity-0"))?.workSlugs).toEqual([
				"shown",
				"second",
				"visible-false",
			]);
			expect(publicPortfolio.PORTFOLIO_SITEMAP_PAGE_SIZE).toBe(980);
		});
	});

	describe("a portfolio behind a password", () => {
		const lock = async (portfolioId: string, password = "rahasia-123") => {
			const { hash } = await import("bcryptjs");
			const passwordHash = await hash(password, 4);
			await getDb()
				.update(tables.portfolio)
				.set({ password: passwordHash })
				.where(eq(tables.portfolio.id, portfolioId));
			return passwordHash;
		};

		it("is never indexed or in the sitemap, and its files are served but not cached publicly", async () => {
			const id = await addPortfolio("member");
			await getDb()
				.insert(tables.portfolioFile)
				.values({ userId: "member", kind: "image", key: "uploads/member/pictures/portfolio/a.webp", bytes: 1 });
			expect(await publicPortfolio.portfolioFileAccess("uploads/member/pictures/portfolio/a.webp")).toBe("public");
			expect(await publicPortfolio.countIndexablePortfolios()).toBe(1);
			await lock(id);
			expect(await publicPortfolio.findPublicPortfolio(username("member"))).toMatchObject({
				indexable: false,
				passwordHash: expect.stringMatching(/^\$2/),
			});
			expect(await publicPortfolio.countIndexablePortfolios()).toBe(0);
			expect(await publicPortfolio.portfolioFileAccess("uploads/member/pictures/portfolio/a.webp")).toBe("protected");
			// The gate hands the uploads route the current password's hash, to check a file token against.
			expect(await publicPortfolio.portfolioFileGate("uploads/member/pictures/portfolio/a.webp")).toEqual({
				access: "protected",
				passwordHash: expect.stringMatching(/^\$2/),
			});
			expect(await publicPortfolio.isPublicPortfolioFile("uploads/member/pictures/portfolio/a.webp")).toBe(true);
			fixture.mode = "off";
			expect(await publicPortfolio.portfolioFileAccess("uploads/member/pictures/portfolio/a.webp")).toBe("none");
		});

		it("opens for the right password, for 12 hours on this host, and for its owner", async () => {
			const id = await addPortfolio("member");
			const passwordHash = await lock(id);
			const portfolio = { id, userId: "member", passwordHash };
			expect(await visitorAccess.portfolioAccess(portfolio, visitor())).toBe("locked");
			fixture.viewer = { id: "member" };
			expect(await visitorAccess.portfolioAccess(portfolio, visitor())).toBe("open");
			fixture.viewer = null;

			const wrong = new Headers();
			expect(
				await visitorAccess.verifyPortfolioPassword({
					username: username("member"),
					password: "salah-sekali",
					trustedClient: "10.9.0.1",
					responseHeaders: wrong,
				}),
			).toBe("wrong");
			expect(wrong.get("set-cookie")).toBeNull();

			const right = new Headers();
			expect(
				await visitorAccess.verifyPortfolioPassword({
					username: username("member"),
					password: "rahasia-123",
					trustedClient: "10.9.0.1",
					responseHeaders: right,
				}),
			).toBe("ok");
			const cookie = right.get("set-cookie") ?? "";
			expect(cookie).toMatch(
				new RegExp(`^portfolio_access_${id}=\\d+\\.[\\da-f]{64}; Path=/; Max-Age=43200; SameSite=Lax; HttpOnly`),
			);
			expect(cookie).not.toMatch(/Domain=/i);
			const withCookie = visitor();
			withCookie.set("cookie", cookie.split(";")[0] ?? "");
			expect(await visitorAccess.portfolioAccess(portfolio, withCookie)).toBe("open");
			// A new password takes the access away.
			const changed = await lock(id, "kata-baru-456");
			expect(await visitorAccess.portfolioAccess({ ...portfolio, passwordHash: changed }, withCookie)).toBe("locked");
		});

		it("allows 100 wrong tries per hour per portfolio from all addresses together, then none", async () => {
			const id = await addPortfolio("member");
			await lock(id);
			const attempt = (password: string, index: number) =>
				visitorAccess.verifyPortfolioPassword({
					username: username("member"),
					password,
					// A fresh /64 each time: the per-address budget never runs out.
					trustedClient: `2001:db8:${(index + 1).toString(16)}::1`,
					responseHeaders: new Headers(),
				});
			// The right password, among wrong ones, still opens it while the budget lasts.
			for (let index = 0; index < 50; index++) expect(await attempt("salah-sekali", index)).toBe("wrong");
			expect(await attempt("rahasia-123", 50)).toBe("ok");
			for (let index = 51; index < 101; index++) expect(await attempt("salah-sekali", index)).toBe("wrong");
			// Spent: every try is `limited` now, the right one too, from any address.
			expect(await attempt("rahasia-123", 200)).toBe("limited");
			expect(await attempt("salah-sekali", 201)).toBe("limited");
		}, 60_000);

		it("allows 5 tries in 10 minutes per address and portfolio, and answers a missing one like a wrong password", async () => {
			const id = await addPortfolio("member");
			await lock(id);
			const attempt = (password: string, name = username("member")) =>
				visitorAccess.verifyPortfolioPassword({
					username: name,
					password,
					trustedClient: "10.9.1.1",
					responseHeaders: new Headers(),
				});
			for (let index = 0; index < 5; index++) expect(await attempt("salah-sekali")).toBe("wrong");
			expect(await attempt("rahasia-123")).toBe("limited");
			// No portfolio there, or one without a password: wrong, after the same work.
			expect(await attempt("rahasia-123", username("nobody"))).toBe("wrong");
		});
	});
});
