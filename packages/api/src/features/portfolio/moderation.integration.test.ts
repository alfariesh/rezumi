import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as "off" | "admins" | "on",
	alertEmail: "alerts@example.test" as string | undefined,
	secret: "1x0000000000000000000000000000000AA" as string | undefined,
	reports: [] as { to: string; subject: string; replyTo?: string | undefined; notice: { paragraphs: string[] } }[],
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
			APP_URL: "https://rezumi.example",
			FLAG_DISABLE_API_RATE_LIMIT: false,
			TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
			get TURNSTILE_SECRET_KEY() {
				return fixture.secret;
			},
			get PORTFOLIO_MODE() {
				return fixture.mode;
			},
			get BILLING_ALERT_EMAIL() {
				return fixture.alertEmail;
			},
		},
	};
});
vi.mock("@rezumi/email/portfolio", () => ({
	deliverPortfolioMessageNotice: () => Promise.resolve("sent"),
	deliverPortfolioReportNotice: (input: (typeof fixture.reports)[number]) => {
		fixture.reports.push(input);
		return Promise.resolve("sent");
	},
}));
vi.mock("../billing/entitlements", async () => {
	const actual = await vi.importActual<typeof import("../billing/entitlements")>("../billing/entitlements");
	return {
		...actual,
		getEntitlements: () => Promise.resolve({ features: { hidePortfolioCredit: false }, limits: {} }),
	};
});

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("portfolio reports and moderation", () => {
	let admin: Pool;
	let pool: Pool;
	let report: typeof import("./report");
	let moderation: typeof import("./moderation");
	let publicApi: typeof import("./public");
	let service: typeof import("./service");
	let exporter: typeof import("./export");
	const schemaName = `portfolio_moderation_test_${randomUUID().replaceAll("-", "")}`;
	const suffix = randomUUID().slice(0, 8);
	const username = (id: string) => `pfmod-${id}-${suffix}`;
	let nextIp = 1;
	const ip = () => `198.51.${Math.floor(nextIp / 250)}.${(nextIp++ % 250) + 1}`;
	const actor = "moderator";

	const addAccount = (id: string, role = "user") =>
		getDb()
			.insert(tables.user)
			.values({
				id,
				name: id,
				email: `${id}@example.test`,
				emailVerified: true,
				username: username(id),
				displayUsername: username(id),
				role,
				createdAt: new Date(Date.now() - 30 * 86_400_000),
			});

	const addPortfolio = async (userId: string, options: { role?: string } = {}) => {
		await addAccount(userId, options.role ?? "user");
		const [row] = await getDb()
			.insert(tables.portfolio)
			.values({ userId, isPublic: true, data: { version: 1 } as never })
			.returning({ id: tables.portfolio.id, updatedAt: tables.portfolio.updatedAt });
		return row as { id: string; updatedAt: Date };
	};

	const addFile = async (userId: string) => {
		const key = `uploads/${userId}/pictures/portfolio/${randomUUID()}.webp`;
		await getDb().insert(tables.portfolioFile).values({ userId, kind: "image", key, bytes: 10 });
		return key;
	};

	const form = (overrides: Record<string, unknown> = {}) => ({
		reason: "rights",
		details: "Logo ini dipakai tanpa izin.",
		email: "pelapor@example.test",
		website: "",
		"cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX",
		...overrides,
	});

	const submit = (userId: string, overrides: Record<string, unknown> = {}, trustedClient = ip()) =>
		report.submitPortfolioReport({ username: username(userId), form: form(overrides), trustedClient });

	const reportsOf = (portfolioId: string) =>
		getDb().select().from(tables.portfolioReport).where(eq(tables.portfolioReport.portfolioId, portfolioId));

	const logOf = (portfolioId: string) =>
		getDb()
			.select()
			.from(tables.portfolioModerationLog)
			.where(eq(tables.portfolioModerationLog.portfolioId, portfolioId));

	const row = async (portfolioId: string) => {
		const [found] = await getDb().select().from(tables.portfolio).where(eq(tables.portfolio.id, portfolioId));
		return found;
	};

	const siteverify = (success: boolean) =>
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success, hostname: "example.com" }), { status: 200 }))),
		);

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
		report = await import("./report");
		moderation = await import("./moderation");
		publicApi = await import("./public");
		service = await import("./service");
		exporter = await import("./export");
		await addAccount(actor, "admin");
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		fixture.alertEmail = "alerts@example.test";
		fixture.secret = "1x0000000000000000000000000000000AA";
		fixture.reports.length = 0;
		siteverify(true);
		await getDb().delete(tables.user).where(ne(tables.user.id, actor));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("reporting", () => {
		it("stores a report that passes Turnstile", async () => {
			const { id } = await addPortfolio("a1");
			const result = await submit("a1");
			expect(result).toMatchObject({ ok: true });
			expect(await reportsOf(id)).toMatchObject([
				{
					reason: "rights",
					details: "Logo ini dipakai tanpa izin.",
					reporterEmail: "pelapor@example.test",
					status: "open",
				},
			]);
		});

		it("refuses a report Turnstile rejects, and stores nothing", async () => {
			const { id } = await addPortfolio("a2");
			siteverify(false);
			expect(await submit("a2")).toEqual({ ok: false, code: "turnstile" });
			expect(await reportsOf(id)).toEqual([]);
		});

		it("answers success to the trap field without storing", async () => {
			const { id } = await addPortfolio("a3");
			expect(await submit("a3", { website: "https://spam.example" })).toEqual({ ok: true });
			expect(await reportsOf(id)).toEqual([]);
		});

		it("refuses an unknown reason and empty details", async () => {
			await addPortfolio("a4");
			expect(await submit("a4", { reason: "because" })).toEqual({ ok: false, code: "invalid" });
			expect(await submit("a4", { details: "   " })).toEqual({ ok: false, code: "invalid" });
		});

		it("takes a report with no email", async () => {
			const { id } = await addPortfolio("a5");
			expect(await submit("a5", { email: "" })).toMatchObject({ ok: true });
			expect((await reportsOf(id))[0]?.reporterEmail).toBeNull();
		});

		it("limits one visitor to two reports on a portfolio a day", async () => {
			await addPortfolio("a6");
			const client = ip();
			expect(await submit("a6", {}, client)).toMatchObject({ ok: true });
			expect(await submit("a6", {}, client)).toMatchObject({ ok: true });
			expect(await submit("a6", {}, client)).toEqual({ ok: false, code: "rate_limited" });
		});

		it("is closed without Turnstile keys", async () => {
			await addPortfolio("a7");
			fixture.secret = undefined;
			expect(await submit("a7")).toEqual({ ok: false, code: "unavailable" });
		});

		it("doesn't exist for an address with no live portfolio", async () => {
			await addPortfolio("a8");
			fixture.mode = "off";
			expect(await submit("a8")).toBeNull();
			fixture.mode = "on";
			expect(await submit("nobody")).toBeNull();
		});

		it("emails the operator with the reporter as reply address", async () => {
			await addPortfolio("a9");
			const result = await submit("a9");
			expect(await report.notifyPortfolioReport(result?.ok && result.reportId ? result.reportId : "")).toBe(true);
			expect(fixture.reports).toMatchObject([
				{
					to: "alerts@example.test",
					replyTo: "pelapor@example.test",
					notice: { paragraphs: ["Logo ini dipakai tanpa izin."] },
				},
			]);
			expect(fixture.reports[0]?.subject).not.toContain("Logo ini");
		});

		it("keeps the report waiting when no alert address is set", async () => {
			const { id } = await addPortfolio("a10");
			fixture.alertEmail = undefined;
			const result = await submit("a10");
			expect(await report.notifyPortfolioReport(result?.ok && result.reportId ? result.reportId : "")).toBe(false);
			expect(await reportsOf(id)).toHaveLength(1);
		});

		it("clears a reporter's address 90 days after handling, and not before", async () => {
			const { id } = await addPortfolio("a11");
			await submit("a11");
			await submit("a11");
			const [older, newer] = await reportsOf(id);
			const now = new Date();
			await getDb()
				.update(tables.portfolioReport)
				.set({ handledAt: new Date(now.getTime() - 91 * 86_400_000) })
				.where(eq(tables.portfolioReport.id, older?.id as string));
			await getDb()
				.update(tables.portfolioReport)
				.set({ handledAt: new Date(now.getTime() - 89 * 86_400_000) })
				.where(eq(tables.portfolioReport.id, newer?.id as string));
			expect(await report.clearHandledReporterEmails(now)).toBe(1);
			const after = await reportsOf(id);
			expect(after.find((item) => item.id === older?.id)?.reporterEmail).toBeNull();
			expect(after.find((item) => item.id === newer?.id)?.reporterEmail).toBe("pelapor@example.test");
		});
	});

	describe("taking a portfolio down", () => {
		const reason = "Melanggar hak cipta.";

		it("treats it as unpublished everywhere, without touching the data's version", async () => {
			const { id, updatedAt } = await addPortfolio("b1");
			const key = await addFile("b1");
			await submit("b1");
			expect(await publicApi.findPublicPortfolio(username("b1"))).not.toBeNull();
			expect(await publicApi.isPublicPortfolioFile(key)).toBe(true);

			await moderation.suspendPortfolio(actor, { portfolioId: id, reason });

			expect(await publicApi.findPublicPortfolio(username("b1"))).toBeNull();
			expect(await publicApi.isPublicPortfolioFile(key)).toBe(false);
			expect(await publicApi.listIndexablePortfolios(0)).toEqual([]);
			expect(await submit("b1")).toBeNull();
			const stored = await row(id);
			expect(stored?.updatedAt).toEqual(updatedAt);
			expect(stored?.suspendedReason).toBe(reason);
			expect(stored?.isPublic).toBe(true);
			expect(stored?.data).toEqual({ version: 1 });
		});

		it("marks open reports acted on and writes the log", async () => {
			const { id } = await addPortfolio("b2");
			await submit("b2");
			await moderation.suspendPortfolio(actor, { portfolioId: id, reason });
			expect(await reportsOf(id)).toMatchObject([{ status: "actioned", handledByUserId: actor }]);
			expect(await logOf(id)).toMatchObject([{ action: "suspended", reason, actorUserId: actor, targetUserId: "b2" }]);
		});

		it("can't be published again or deleted by its owner", async () => {
			const { id } = await addPortfolio("b3");
			await moderation.suspendPortfolio(actor, { portfolioId: id, reason });
			await expect(service.portfolioService.setPublic("b3", { isPublic: true })).rejects.toMatchObject({
				code: "PORTFOLIO_SUSPENDED",
			});
			await expect(service.portfolioService.delete("b3")).rejects.toMatchObject({ code: "PORTFOLIO_SUSPENDED" });
			expect(await row(id)).toBeDefined();
		});

		it("still lets its owner unpublish", async () => {
			const { id } = await addPortfolio("b4");
			await moderation.suspendPortfolio(actor, { portfolioId: id, reason });
			await service.portfolioService.setPublic("b4", { isPublic: false });
			expect((await row(id))?.isPublic).toBe(false);
		});

		it("shows again once lifted, with both actions in the log", async () => {
			const { id } = await addPortfolio("b5");
			const key = await addFile("b5");
			await moderation.suspendPortfolio(actor, { portfolioId: id, reason });
			await moderation.liftPortfolioSuspension(actor, { portfolioId: id, reason: "Sudah diperbaiki." });
			expect(await publicApi.findPublicPortfolio(username("b5"))).not.toBeNull();
			expect(await publicApi.isPublicPortfolioFile(key)).toBe(true);
			expect((await row(id))?.suspendedReason).toBeNull();
			expect((await logOf(id)).map((entry) => entry.action).sort()).toEqual(["lifted", "suspended"]);
		});

		it("reports a conflict for an action already taken, and not found for a missing portfolio", async () => {
			const { id } = await addPortfolio("b6");
			await moderation.suspendPortfolio(actor, { portfolioId: id, reason });
			await expect(moderation.suspendPortfolio(actor, { portfolioId: id, reason })).rejects.toMatchObject({
				code: "PORTFOLIO_MODERATION_CONFLICT",
			});
			await expect(moderation.liftPortfolioSuspension(actor, { portfolioId: "nope", reason })).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
		});

		it("lets an administrator read a taken-down portfolio with its reports and history", async () => {
			const { id } = await addPortfolio("b7");
			await submit("b7");
			await moderation.suspendPortfolio(actor, { portfolioId: id, reason });
			const review = await moderation.getPortfolioForAdmin(id);
			expect(review).toMatchObject({ username: username("b7"), suspendedReason: reason, ownerBanned: false });
			expect(review.reports).toHaveLength(1);
			expect(review.history).toMatchObject([{ action: "suspended", actorName: actor }]);
			expect((await moderation.findPortfolioForAdmin(`@${username("b7")}`)).portfolioId).toBe(id);
			expect((await moderation.findPortfolioForAdmin("b7@example.test")).portfolioId).toBe(id);
		});

		it("lists reports by status, newest first, and counts the open ones", async () => {
			await addPortfolio("b8");
			await submit("b8");
			const open = await moderation.listPortfolioReports({ status: "open" });
			expect(open.open).toBe(1);
			expect(open.items).toMatchObject([{ username: username("b8"), reason: "rights" }]);
			expect((await moderation.listPortfolioReports({ status: "dismissed" })).items).toEqual([]);
		});

		it("dismisses and reopens a report, logging both", async () => {
			const { id } = await addPortfolio("b9");
			await submit("b9");
			const [item] = await reportsOf(id);
			const reportId = item?.id as string;
			await moderation.setPortfolioReportStatus(actor, { reportId, status: "dismissed", reason: "Tidak terbukti." });
			expect((await reportsOf(id))[0]).toMatchObject({ status: "dismissed", handledByUserId: actor });
			await moderation.setPortfolioReportStatus(actor, { reportId, status: "open", reason: "Ada bukti baru." });
			expect((await reportsOf(id))[0]).toMatchObject({ status: "open", handledAt: null });
			expect(await logOf(id)).toHaveLength(2);
		});
	});

	describe("banning the owner", () => {
		it("hides the portfolio and its files, and signs the owner out", async () => {
			const { id } = await addPortfolio("c1");
			const key = await addFile("c1");
			const now = new Date();
			await getDb()
				.insert(tables.session)
				.values({
					id: "s1",
					userId: "c1",
					token: `token-${suffix}`,
					expiresAt: new Date(now.getTime() + 86_400_000),
					createdAt: now,
					updatedAt: now,
				});
			await moderation.setPortfolioOwnerBanned(actor, { portfolioId: id, banned: true, reason: "Penipuan berulang." });
			expect(await publicApi.findPublicPortfolio(username("c1"))).toBeNull();
			expect(await publicApi.isPublicPortfolioFile(key)).toBe(false);
			expect(await getDb().select().from(tables.session).where(eq(tables.session.userId, "c1"))).toEqual([]);
			expect(await logOf(id)).toMatchObject([{ action: "banned", targetUserId: "c1" }]);

			await moderation.setPortfolioOwnerBanned(actor, { portfolioId: id, banned: false, reason: "Salah sasaran." });
			expect(await publicApi.findPublicPortfolio(username("c1"))).not.toBeNull();
		});

		it("refuses an administrator, which also stops banning oneself", async () => {
			const { id } = await addPortfolio("c2", { role: "admin" });
			await expect(
				moderation.setPortfolioOwnerBanned(actor, { portfolioId: id, banned: true, reason: "Coba." }),
			).rejects.toMatchObject({ code: "PORTFOLIO_CANNOT_BAN_ADMIN" });
		});
	});

	describe("account data", () => {
		it("exports the portfolio, files, messages and reports, never who reported or their words", async () => {
			const { id } = await addPortfolio("d1");
			const key = await addFile("d1");
			await getDb()
				.insert(tables.portfolioMessage)
				.values({ portfolioId: id, name: "Budi", email: "budi@example.test", body: "Halo" });
			await submit("d1");
			const data = await exporter.exportPortfolioData("d1");
			expect(data.portfolio?.isPublic).toBe(true);
			expect(data.files).toMatchObject([{ key, kind: "image" }]);
			expect(data.messages).toMatchObject([{ name: "Budi", body: "Halo" }]);
			expect(data.reports).toMatchObject([{ reason: "rights", status: "open" }]);
			const written = JSON.stringify(data.reports);
			expect(written).not.toContain("pelapor@example.test");
			expect(written).not.toContain("Logo ini");
		});

		it("exports nothing for an account with no portfolio", async () => {
			await addAccount("d2");
			expect(await exporter.exportPortfolioData("d2")).toEqual({
				portfolio: null,
				files: [],
				messages: [],
				reports: [],
			});
		});

		it("deletes reports with the account, keeping the log without its owner", async () => {
			const { id } = await addPortfolio("d3");
			await submit("d3");
			await moderation.suspendPortfolio(actor, { portfolioId: id, reason: "Melanggar akun d3." });
			await getDb().delete(tables.user).where(eq(tables.user.id, "d3"));
			expect(await reportsOf(id)).toEqual([]);
			const entries = await getDb()
				.select()
				.from(tables.portfolioModerationLog)
				.where(eq(tables.portfolioModerationLog.reason, "Melanggar akun d3."));
			expect(entries).toMatchObject([{ portfolioId: null, targetUserId: null, action: "suspended" }]);
		});
	});
});
