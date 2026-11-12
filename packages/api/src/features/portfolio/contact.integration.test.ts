import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as "off" | "admins" | "on",
	deliveries: [] as { to: string; notice: Record<string, unknown> }[],
	deliveryFails: false,
	deliveryResult: "sent" as "sent" | "unconfigured",
	detailed: true,
	secret: "1x0000000000000000000000000000000AA" as string | undefined,
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
		},
	};
});
vi.mock("@rezumi/email/portfolio", () => ({
	deliverPortfolioMessageNotice: (input: { to: string; notice: Record<string, unknown> }) => {
		if (fixture.deliveryFails) return Promise.reject(new Error("smtp down"));
		fixture.deliveries.push(input);
		return Promise.resolve(fixture.deliveryResult);
	},
}));
vi.mock("../billing/entitlements", async () => {
	const actual = await vi.importActual<typeof import("../billing/entitlements")>("../billing/entitlements");
	return {
		...actual,
		getEntitlements: () =>
			Promise.resolve({
				features: { detailedPortfolioStats: fixture.detailed, hidePortfolioCredit: false },
				limits: {},
			}),
	};
});

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("portfolio contact form", () => {
	let admin: Pool;
	let pool: Pool;
	let contact: typeof import("./contact");
	let jobs: typeof import("./jobs");
	let statistics: typeof import("./statistics");
	const schemaName = `portfolio_contact_test_${randomUUID().replaceAll("-", "")}`;
	const suffix = randomUUID().slice(0, 8);
	const username = (id: string) => `pfmsg-${id}-${suffix}`;
	let nextIp = 1;
	const ip = () => `198.51.${Math.floor(nextIp / 250)}.${(nextIp++ % 250) + 1}`;

	const data = (overrides: Record<string, unknown> = {}) =>
		({
			version: 1,
			contact: { form: true },
			services: { items: [{ id: "s1", title: "Logo design" }] },
			works: { items: [{ id: "w1", title: "Coffee app" }] },
			...overrides,
		}) as never;

	const addAccount = async (id: string, timezone = "UTC") =>
		getDb()
			.insert(tables.user)
			.values({
				id,
				name: id,
				email: `${id}@example.test`,
				emailVerified: true,
				username: username(id),
				displayUsername: username(id),
				timezone,
				role: "admin",
			});

	const addPortfolio = async (userId: string, value = data()) => {
		await addAccount(userId);
		const [row] = await getDb()
			.insert(tables.portfolio)
			.values({ userId, isPublic: true, data: value })
			.returning({ id: tables.portfolio.id });
		return row?.id as string;
	};

	const stored = (portfolioId: string) =>
		getDb().select().from(tables.portfolioMessage).where(eq(tables.portfolioMessage.portfolioId, portfolioId));

	const form = (overrides: Record<string, unknown> = {}) => ({
		name: "Budi",
		email: "budi@example.test",
		message: "Halo, boleh minta penawaran?",
		website: "",
		"cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX",
		...overrides,
	});

	const submit = (userId: string, overrides: Record<string, unknown> = {}, trustedClient = ip()) =>
		contact.submitPortfolioMessage({ username: username(userId), form: form(overrides), trustedClient });

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
		contact = await import("./contact");
		jobs = await import("./jobs");
		statistics = await import("./statistics");
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		fixture.deliveries.length = 0;
		fixture.deliveryFails = false;
		fixture.deliveryResult = "sent";
		fixture.detailed = true;
		fixture.secret = "1x0000000000000000000000000000000AA";
		siteverify(true);
		await getDb().delete(tables.user);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("submitting", () => {
		it("stores a message that passes and counts it for the day", async () => {
			const id = await addPortfolio("a1");
			expect(await submit("a1", { serviceId: "s1" })).toEqual({ ok: true, portfolioId: id });
			const [row] = await stored(id);
			expect(row).toMatchObject({ name: "Budi", email: "budi@example.test", serviceId: "s1", readAt: null });
			const days = await getDb()
				.select()
				.from(tables.portfolioStatisticsDaily)
				.where(eq(tables.portfolioStatisticsDaily.portfolioId, id));
			expect(days[0]?.messages).toBe(1);
		});

		it("forgets a service the portfolio doesn't have", async () => {
			const id = await addPortfolio("a2");
			await submit("a2", { serviceId: "not-a-service" });
			expect((await stored(id))[0]?.serviceId).toBeNull();
		});

		it("refuses a message siteverify rejects, storing nothing", async () => {
			const id = await addPortfolio("b1");
			siteverify(false);
			expect(await submit("b1")).toEqual({ ok: false, code: "turnstile" });
			expect(await stored(id)).toHaveLength(0);
		});

		it("answers a filled trap with success and stores nothing", async () => {
			const id = await addPortfolio("b2");
			expect(await submit("b2", { website: "https://spam.example" })).toEqual({ ok: true });
			expect(await stored(id)).toHaveLength(0);
			expect(fetch).not.toHaveBeenCalled();
		});

		it.each([
			[{ name: "" }],
			[{ email: "not-an-email" }],
			[{ message: "" }],
			[{ message: "x".repeat(2001) }],
			[{ message: "see https://a.example https://b.example and www.c.example" }],
		])("refuses an invalid message %#", async (overrides) => {
			const account = `b3-${randomUUID().slice(0, 6)}`;
			const id = await addPortfolio(account);
			expect(await submit(account, overrides)).toEqual({ ok: false, code: "invalid" });
			expect(await stored(id)).toHaveLength(0);
		});

		it("allows up to the limit of links", async () => {
			await addPortfolio("b4");
			expect(await submit("b4", { message: "see https://a.example and https://b.example" })).toMatchObject({
				ok: true,
			});
		});

		it("limits one address to 3 messages an hour", async () => {
			const id = await addPortfolio("c1");
			const client = ip();
			for (let index = 0; index < 3; index++) expect(await submit("c1", {}, client)).toMatchObject({ ok: true });
			expect(await submit("c1", {}, client)).toEqual({ ok: false, code: "rate_limited" });
			expect(await stored(id)).toHaveLength(3);
		});

		it("lets one address use only part of a portfolio's day", async () => {
			const id = await addPortfolio("n4");
			const client = ip();
			const hour = 60 * 60 * 1000;
			let now = Date.parse("2026-11-09T01:00:00Z");
			vi.useFakeTimers({ now, toFake: ["Date"] });
			try {
				for (let index = 0; index < 5; index++) {
					expect(await submit("n4", {}, client)).toMatchObject({ ok: true });
					now += 2 * hour;
					vi.setSystemTime(now);
				}
				expect(await submit("n4", {}, client)).toEqual({ ok: false, code: "rate_limited" });
				expect(await submit("n4", {}, ip())).toMatchObject({ ok: true });
			} finally {
				vi.useRealTimers();
			}
			expect(await stored(id)).toHaveLength(6);
		});

		it("limits one portfolio to 30 messages a day, from any address", async () => {
			const id = await addPortfolio("c2");
			for (let index = 0; index < 30; index++) expect(await submit("c2")).toMatchObject({ ok: true });
			expect(await submit("c2")).toEqual({ ok: false, code: "rate_limited" });
			expect(await stored(id)).toHaveLength(30);
		}, 30_000);

		it("doesn't let rejected tokens use up a portfolio's daily limit", async () => {
			const id = await addPortfolio("c3");
			siteverify(false);
			for (let index = 0; index < 5; index++) await submit("c3");
			siteverify(true);
			expect(await submit("c3")).toMatchObject({ ok: true });
			expect(await stored(id)).toHaveLength(1);
		});

		it("drops NUL characters, which Postgres text can't hold", async () => {
			const id = await addPortfolio("n1");
			expect(await submit("n1", { message: "halo\0 dunia" })).toMatchObject({ ok: true });
			expect((await stored(id))[0]?.body).toBe("halo dunia");
		});

		it("is unavailable when the Contact section is hidden", async () => {
			await addPortfolio("n2", data({ sections: { hidden: ["contact"] } }));
			expect(await submit("n2")).toEqual({ ok: false, code: "unavailable" });
		});

		it("is unavailable when the form is off or the keys are missing", async () => {
			await addPortfolio("d1", data({ contact: { form: false } }));
			expect(await submit("d1")).toEqual({ ok: false, code: "unavailable" });
			await addPortfolio("d2");
			fixture.secret = undefined;
			expect(await submit("d2")).toEqual({ ok: false, code: "unavailable" });
		});

		it("finds no portfolio while the switch is off", async () => {
			await addPortfolio("d3");
			fixture.mode = "off";
			expect(await submit("n2")).toBeNull();
		});
	});

	describe("the owner's email", () => {
		const minutes = (at: Date, count: number) => new Date(at.getTime() + count * 60_000);

		it("sends one message in full, replying to its sender", async () => {
			const id = await addPortfolio("e1");
			await submit("e1", { serviceId: "s1" });
			expect(await contact.notifyPortfolioMessages(id)).toBe(true);
			expect(fixture.deliveries).toHaveLength(1);
			expect(fixture.deliveries[0]).toMatchObject({
				to: "e1@example.test",
				notice: {
					count: 1,
					message: { name: "Budi", email: "budi@example.test", service: "Logo design" },
					inboxUrl: "https://rezumi.example/dashboard/portfolio",
				},
			});
			expect((await stored(id))[0]?.notifiedAt).toBeInstanceOf(Date);
		});

		it("merges messages inside the 10-minute window into one later email", async () => {
			const id = await addPortfolio("e2");
			const start = new Date("2026-11-09T02:00:00Z");
			await submit("e2");
			expect(await contact.notifyPortfolioMessages(id, start)).toBe(true);
			await submit("e2");
			await submit("e2");
			expect(await contact.notifyPortfolioMessages(id, minutes(start, 3))).toBe(false);
			expect(fixture.deliveries).toHaveLength(1);

			expect(await jobs.runPortfolioJobs(minutes(start, 4))).toMatchObject({ messageEmails: 0 });
			expect(await jobs.runPortfolioJobs(minutes(start, 11))).toMatchObject({ messageEmails: 1 });
			expect(fixture.deliveries).toHaveLength(2);
			expect(fixture.deliveries[1]).toMatchObject({ notice: { count: 2 } });
			expect(fixture.deliveries[1]?.notice.message).toBeUndefined();
			expect(await jobs.runPortfolioJobs(minutes(start, 30))).toMatchObject({ messageEmails: 0 });
		});

		it("lets only one of several simultaneous messages send", async () => {
			const id = await addPortfolio("e3");
			await submit("e3");
			await submit("e3");
			const results = await Promise.all([contact.notifyPortfolioMessages(id), contact.notifyPortfolioMessages(id)]);
			expect(results.filter(Boolean)).toHaveLength(1);
			expect(fixture.deliveries).toHaveLength(1);
		});

		it("keeps messages waiting while email isn't set up", async () => {
			const id = await addPortfolio("n3");
			await submit("n3");
			fixture.deliveryResult = "unconfigured";
			const start = new Date("2026-11-09T03:00:00Z");
			expect(await contact.notifyPortfolioMessages(id, start)).toBe(false);
			fixture.deliveries.length = 0;
			fixture.deliveryResult = "sent";
			expect(await jobs.runPortfolioJobs(minutes(start, 1))).toMatchObject({ messageEmails: 0 });
			expect(await jobs.runPortfolioJobs(minutes(start, 11))).toMatchObject({ messageEmails: 1 });
			expect(fixture.deliveries).toHaveLength(1);
		});

		it("retries a failed send after the 10-minute window, logging nothing of the message", async () => {
			const id = await addPortfolio("e4");
			await submit("e4", { message: "a very private note" });
			fixture.deliveryFails = true;
			const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
			const start = new Date("2026-11-09T03:00:00Z");
			expect(await contact.notifyPortfolioMessages(id, start)).toBe(false);
			expect(JSON.stringify(log.mock.calls)).not.toContain("private note");
			log.mockRestore();
			fixture.deliveryFails = false;
			expect(await jobs.runPortfolioJobs(minutes(start, 1))).toMatchObject({ messageEmails: 0 });
			expect(await jobs.runPortfolioJobs(minutes(start, 11))).toMatchObject({ messageEmails: 1 });
			expect(fixture.deliveries).toHaveLength(1);
		});
	});

	describe("retention", () => {
		it("deletes messages after 90 days and keeps newer ones, even while the switch is off", async () => {
			const id = await addPortfolio("f1");
			const now = new Date("2026-11-09T00:00:00Z");
			const day = 86_400_000;
			const message = { portfolioId: id, name: "A", email: "a@example.test", body: "b" };
			await getDb()
				.insert(tables.portfolioMessage)
				.values([
					{ ...message, createdAt: new Date(now.getTime() - 91 * day) },
					{ ...message, createdAt: new Date(now.getTime() - 89 * day) },
				]);
			fixture.mode = "off";
			expect(await jobs.runPortfolioJobs(now)).toMatchObject({ deletedMessages: 1, deletedFiles: 0 });
			expect(await stored(id)).toHaveLength(1);
		});
	});

	describe("the inbox", () => {
		it("lists newest first, a page at a time, with the service's name", async () => {
			const id = await addPortfolio("g1");
			const at = (seconds: number) => new Date(Date.UTC(2026, 10, 9, 1, 0, seconds));
			await getDb()
				.insert(tables.portfolioMessage)
				.values([
					{ portfolioId: id, name: "One", email: "1@example.test", body: "1", createdAt: at(1) },
					{ portfolioId: id, name: "Two", email: "2@example.test", body: "2", createdAt: at(2), serviceId: "s1" },
					{ portfolioId: id, name: "Three", email: "3@example.test", body: "3", createdAt: at(3), readAt: at(4) },
				]);
			const portfolio = { id, services: [{ id: "s1", title: "Logo design" }] };
			const first = await contact.listPortfolioMessages(portfolio, { limit: 2 });
			expect(first.items.map((item) => item.name)).toEqual(["Three", "Two"]);
			expect(first.items[1]?.serviceTitle).toBe("Logo design");
			expect(first.unread).toBe(2);
			expect(first.nextCursor).toBeTruthy();
			const second = await contact.listPortfolioMessages(portfolio, {
				limit: 2,
				cursor: first.nextCursor ?? undefined,
			});
			expect(second.items.map((item) => item.name)).toEqual(["One"]);
			expect(second.nextCursor).toBeNull();
		});

		it("marks and deletes only the owner's own messages", async () => {
			const mine = await addPortfolio("g2");
			const theirs = await addPortfolio("g3");
			await submit("g2");
			const [message] = await stored(mine);
			const id = message?.id as string;
			await expect(contact.setPortfolioMessageRead(theirs, id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
			await expect(contact.deletePortfolioMessage(theirs, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
			expect((await stored(mine))[0]?.readAt).toBeNull();

			await contact.setPortfolioMessageRead(mine, id, true);
			expect((await stored(mine))[0]?.readAt).toBeInstanceOf(Date);
			await contact.setPortfolioMessageRead(mine, id, false);
			expect((await stored(mine))[0]?.readAt).toBeNull();
			await contact.deletePortfolioMessage(mine, id);
			expect(await stored(mine)).toHaveLength(0);
		});
	});

	describe("account data", () => {
		it("exports the account's messages only", async () => {
			await addPortfolio("h1");
			await addPortfolio("h2");
			await submit("h1", { message: "for h1" });
			await submit("h2", { message: "for h2" });
			expect((await contact.exportPortfolioMessages("h1")).map((row) => row.body)).toEqual(["for h1"]);
		});

		it("deletes messages and statistics with the account", async () => {
			const id = await addPortfolio("h3");
			await submit("h3");
			await getDb().delete(tables.user).where(eq(tables.user.id, "h3"));
			expect(await stored(id)).toHaveLength(0);
			const days = await getDb()
				.select()
				.from(tables.portfolioStatisticsDaily)
				.where(eq(tables.portfolioStatisticsDaily.portfolioId, id));
			expect(days).toHaveLength(0);
		});
	});

	describe("statistics", () => {
		const read = (portfolioId: string, userId: string) =>
			statistics.portfolioStatistics({
				portfolio: {
					id: portfolioId,
					data: { works: { items: [{ id: "w1", title: "Coffee app" }] } } as never,
				},
				userId,
				timeZone: "Asia/Jakarta",
				now: new Date("2026-11-09T18:30:00Z"),
			});

		it("sum the last 30 days in the owner's zone, zero-filled, with only works that still exist", async () => {
			const id = await addPortfolio("i1");
			await getDb()
				.insert(tables.portfolioStatisticsDaily)
				.values([
					{
						portfolioId: id,
						date: "2026-11-10",
						views: 4,
						clicks: { whatsapp: 2, pdf: 1 },
						works: { w1: 3, gone: 9 },
						messages: 1,
						sources: { linkedin: 3, direct: 1 },
					},
					{ portfolioId: id, date: "2026-10-12", views: 1 },
					{ portfolioId: id, date: "2026-10-11", views: 100 },
				]);
			const result = await read(id, "i1");
			expect(result.days).toHaveLength(30);
			expect(result.days.at(-1)).toEqual({ date: "2026-11-10", views: 4 });
			expect(result.days[0]).toEqual({ date: "2026-10-12", views: 1 });
			expect(result.totals.views).toBe(5);
			expect(result.totals.clicks).toMatchObject({ whatsapp: 2, pdf: 1, email: 0 });
			expect(result.totals.messages).toBe(1);
			expect(result.sources).toMatchObject({ linkedin: 3, direct: 1, google: 0 });
			expect(result.works).toEqual([{ id: "w1", title: "Coffee app", opens: 3 }]);
		});

		it("keep the breakdown for plans with detailed statistics, and report a missing binding", async () => {
			const id = await addPortfolio("i2");
			fixture.detailed = false;
			expect((await read(id, "i2")).details).toEqual({ state: "locked" });
			fixture.detailed = true;
			expect((await read(id, "i2")).details).toEqual({ state: "not-configured" });
		});
	});
});
