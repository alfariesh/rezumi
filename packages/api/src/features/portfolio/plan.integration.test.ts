import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import sharp from "sharp";
import * as tables from "@rezumi/db/schema";
import { PLANS } from "@rezumi/schema/billing";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { defaultResumeData } from "@rezumi/schema/resume/default";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	billing: "on" as "off" | "admins" | "on",
	portfolio: "on" as "off" | "admins" | "on",
	files: new Map<string, Uint8Array>(),
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
				return fixture.portfolio;
			},
			CUSTOM_DOMAIN_TARGET: "domains.rezumi.test",
			CUSTOM_DOMAIN_PROVIDER_SECRET: "test-only",
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

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;
const MB = 1024 * 1024;

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const picture = async () =>
	new File(
		[
			new Uint8Array(
				await sharp({ create: { width: 300, height: 200, channels: 3, background: "#123456" } })
					.webp()
					.toBuffer(),
			),
		],
		"a.webp",
		{ type: "image/webp" },
	);

const pdf = (bytes: number) => {
	const data = new Uint8Array(bytes);
	data.set(new TextEncoder().encode("%PDF-1.7"));
	return new File([data], "case.pdf", { type: "application/pdf" });
};

const work = (index: number) => ({ id: `w${index}`, slug: `work-${index}`, title: `Work ${index}`, blocks: [] });

const planFeature = (feature: string) => ({
	code: "PLAN_FEATURE_REQUIRED",
	status: 403,
	data: { feature, planId: "free" },
});

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("portfolio plans", () => {
	let service: typeof import("./service").portfolioService;
	let domains: typeof import("../custom-domain/service").customDomainService;
	let findPublicPortfolio: typeof import("./public").findPublicPortfolio;
	let billingAdmin: typeof import("../billing/admin").billingAdmin;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `portfolio_plan_test_${randomUUID().replaceAll("-", "")}`;
	const usernameSuffix = randomUUID().slice(0, 8);

	const grantPlus = (userId = "member") =>
		billingAdmin.grantPeriod({ actorUserId: "owner", userId, planId: "plus", days: 30, reason: "Test" });

	const endPlans = (userId = "member") =>
		getDb()
			.update(tables.membershipPeriod)
			.set({ revokedAt: new Date() })
			.where(eq(tables.membershipPeriod.userId, userId));

	const current = async (userId = "member") => {
		const { portfolio } = await service.get(userId);
		if (!portfolio) throw new Error("No portfolio.");
		return portfolio;
	};

	/** Changes the saved data and saves it the way the editor does. */
	const edit = async (change: (data: PortfolioData) => void, userId = "member") => {
		const { data, updatedAt } = await current(userId);
		change(data);
		return service.update(userId, { data: parseWritablePortfolioData(data), expectedUpdatedAt: updatedAt });
	};

	const withWorks = (count: number, userId = "member") =>
		edit((data) => {
			data.works.items = parseWritablePortfolioData({
				...data,
				works: { items: Array.from({ length: count }, (_, index) => work(index)) },
			}).works.items;
		}, userId);

	const addStored = (bytes: number, userId = "member", unusedSince: Date | null = null) =>
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

	const resumeWithProjects = (count: number) => {
		const data = structuredClone(defaultResumeData);
		data.sections.projects.items = Array.from({ length: count }, (_, index) => ({
			id: `project-${index}`,
			hidden: false,
			name: `Project ${index}`,
			period: "",
			website: { url: "", label: "", inlineLink: false },
			description: "<p>About it</p>",
		})) as typeof data.sections.projects.items;
		return data;
	};

	const addResume = async (projects: number, userId = "member") => {
		const [row] = await getDb()
			.insert(tables.resume)
			.values({ name: "CV", slug: `cv-${randomUUID().slice(0, 8)}`, userId, data: resumeWithProjects(projects) })
			.returning({ id: tables.resume.id });
		return row?.id as string;
	};

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({
			connectionString: databaseUrl,
			max: 12,
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
		({ customDomainService: domains } = await import("../custom-domain/service"));
		({ findPublicPortfolio } = await import("./public"));
		({ billingAdmin } = await import("../billing/admin"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.billing = "on";
		fixture.portfolio = "on";
		fixture.files = new Map();
		await pool.query('TRUNCATE "user", released_username CASCADE');
		await getDb()
			.insert(tables.user)
			.values(
				[
					{ id: "member", role: "user" },
					{ id: "owner", role: "admin" },
				].map((account) => ({
					...account,
					name: `${account.id} name`,
					email: `${account.id}@example.test`,
					emailVerified: true,
					username: `plan-${account.id}-${usernameSuffix}`,
					displayUsername: `plan-${account.id}-${usernameSuffix}`,
				})),
			);
	});

	describe("themes and effects", () => {
		it("refuses a Plus theme on Free when creating, and takes it on Plus", async () => {
			await expect(service.create("member", { sourceResumeId: null, theme: "kanvas" })).rejects.toMatchObject(
				planFeature("premiumPortfolioThemes"),
			);
			expect((await service.get("member")).portfolio).toBeNull();
			await grantPlus();
			expect((await service.create("member", { sourceResumeId: null, theme: "kanvas" })).data.theme).toBe("kanvas");
		});

		it("refuses choosing a Plus theme or effect on Free, and leaves the data alone", async () => {
			await service.create("member", { sourceResumeId: null, theme: "lugas" });
			const before = await current();
			await expect(edit((data) => void (data.theme = "brutal"))).rejects.toMatchObject(
				planFeature("premiumPortfolioThemes"),
			);
			await expect(edit((data) => void (data.hero.effect.id = "typewriter"))).rejects.toMatchObject(
				planFeature("premiumHeroEffects"),
			);
			expect((await current()).updatedAt).toEqual(before.updatedAt);
			expect((await edit((data) => void (data.hero.effect.id = "shimmer"))).data.hero.effect.id).toBe("shimmer");
		});

		it("lets a portfolio keep a Plus theme and effect after its plan ends, but not pick another", async () => {
			await grantPlus();
			await service.create("member", { sourceResumeId: null, theme: "kanvas" });
			await edit((data) => void (data.hero.effect.id = "gradient"));
			await endPlans();

			const saved = await edit((data) => void (data.basics.headline = "Still editing"));
			expect(saved.data.theme).toBe("kanvas");
			expect(saved.data.hero.effect.id).toBe("gradient");
			await expect(edit((data) => void (data.theme = "mozaik"))).rejects.toMatchObject(
				planFeature("premiumPortfolioThemes"),
			);
			await expect(edit((data) => void (data.hero.effect.id = "scramble"))).rejects.toMatchObject(
				planFeature("premiumHeroEffects"),
			);
			expect((await edit((data) => void (data.theme = "prima"))).data.theme).toBe("prima");
		});
	});

	describe("the badge", () => {
		it("refuses hiding it on Free and allows it on Plus", async () => {
			await service.create("member", { sourceResumeId: null });
			await expect(edit((data) => void (data.credit.show = false))).rejects.toMatchObject(
				planFeature("hidePortfolioCredit"),
			);
			await grantPlus();
			expect((await edit((data) => void (data.credit.show = false))).data.credit.show).toBe(false);
		});

		it("makes the page show it again when the plan ends, keeping the stored choice", async () => {
			await grantPlus();
			await service.create("member", { sourceResumeId: null });
			await edit((data) => void (data.credit.show = false));
			await service.setPublic("member", { isPublic: true });
			const username = `plan-member-${usernameSuffix}`;
			expect((await findPublicPortfolio(username))?.entitlements.hidePortfolioCredit).toBe(true);

			const version = (await current()).updatedAt;
			await endPlans();
			const page = await findPublicPortfolio(username);
			expect(page?.entitlements.hidePortfolioCredit).toBe(false);
			expect(page?.data.credit.show).toBe(false);
			expect((await current()).updatedAt).toEqual(version);
		});
	});

	describe("works", () => {
		it("refuses the seventh work on Free and allows it on Plus", async () => {
			await service.create("member", { sourceResumeId: null });
			await withWorks(6);
			await expect(withWorks(7)).rejects.toMatchObject({
				code: "PLAN_LIMIT_REACHED",
				status: 403,
				data: { limit: "portfolioWorks", max: 6, used: 6, planId: "free" },
			});
			await grantPlus();
			expect((await withWorks(7)).data.works.items).toHaveLength(7);
		});

		it("keeps works over the limit after a plan ends, refusing only more", async () => {
			await grantPlus();
			await service.create("member", { sourceResumeId: null });
			await withWorks(9);
			await endPlans();
			expect((await edit((data) => void (data.basics.headline = "Edited"))).data.works.items).toHaveLength(9);
			await expect(withWorks(10)).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED" });
			expect((await withWorks(8)).data.works.items).toHaveLength(8);
			await expect(withWorks(9)).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED" });
			// Swapping a work for a new one adds a work: over the limit, that's refused too.
			await expect(
				edit((data) => {
					data.works.items[7] = parseWritablePortfolioData({ works: { items: [work(20)] } }).works.items[0] as never;
				}),
			).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED", data: { limit: "portfolioWorks", max: 6, used: 8 } });
			expect((await current()).data.works.items.map((item) => item.id)).not.toContain("w20");
		});

		it("lets a portfolio within its limit swap a work for a new one", async () => {
			await service.create("member", { sourceResumeId: null });
			await withWorks(6);
			const saved = await edit((data) => {
				data.works.items[5] = parseWritablePortfolioData({ works: { items: [work(20)] } }).works.items[0] as never;
			});
			expect(saved.data.works.items.map((item) => item.id)).toContain("w20");
		});

		it("starts a new portfolio with the first projects the plan can hold", async () => {
			const sourceResumeId = await addResume(9);
			const created = await service.create("member", { sourceResumeId });
			expect(created.data.works.items).toHaveLength(6);
			expect(created.data.works.items[0]?.title).toBe("Project 0");
		});

		it("refuses importing past the limit, adding nothing", async () => {
			await service.create("member", { sourceResumeId: await addResume(0) });
			const sourceResumeId = await addResume(4);
			await service.updateSettings("member", { sourceResumeId });
			await withWorks(4);
			const before = await current();
			await expect(
				service.importWorks("member", {
					resumeItemIds: ["project-0", "project-1", "project-2"],
					expectedUpdatedAt: before.updatedAt,
				}),
			).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED", data: { limit: "portfolioWorks", max: 6, used: 4 } });
			expect((await current()).data.works.items).toHaveLength(4);
			expect((await current()).updatedAt).toEqual(before.updatedAt);
		});

		it("lets exactly one of five parallel imports take the last slot", async () => {
			await service.create("member", { sourceResumeId: await addResume(0) });
			await service.updateSettings("member", { sourceResumeId: await addResume(5) });
			await withWorks(5);
			const { updatedAt } = await current();
			const results = await Promise.allSettled(
				Array.from({ length: 5 }, (_, index) =>
					service.importWorks("member", { resumeItemIds: [`project-${index}`], expectedUpdatedAt: updatedAt }),
				),
			);
			expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
			expect((await current()).data.works.items).toHaveLength(6);
		});

		it("lets exactly one of five parallel imports through when each has the latest version", async () => {
			await service.create("member", { sourceResumeId: await addResume(0) });
			await service.updateSettings("member", { sourceResumeId: await addResume(5) });
			await withWorks(5);
			// Each retries on a version conflict, so what stops the others is the limit and not a stale version.
			const results = await Promise.allSettled(
				Array.from({ length: 5 }, async (_, index) => {
					for (;;) {
						try {
							return await service.importWorks("member", {
								resumeItemIds: [`project-${index}`],
								expectedUpdatedAt: (await current()).updatedAt,
							});
						} catch (error) {
							if ((error as { code?: string }).code !== "PORTFOLIO_VERSION_CONFLICT") throw error;
						}
					}
				}),
			);
			expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
			for (const result of results.filter((item) => item.status === "rejected"))
				expect(result.reason).toMatchObject({ code: "PLAN_LIMIT_REACHED" });
			expect((await current()).data.works.items).toHaveLength(6);
		});
	});

	describe("storage", () => {
		it("reports the plan's quota and the works limit", async () => {
			await service.create("member", { sourceResumeId: null });
			expect((await service.get("member")).limits).toMatchObject({ works: 6, storageBytes: 100 * MB });
			await grantPlus();
			expect((await service.get("member")).limits).toMatchObject({
				works: PLANS.plus.limits.portfolioWorks,
				storageBytes: PORTFOLIO_UPLOAD.accountBytes,
			});
		});

		it("refuses uploads past the quota, counting files waiting for cleanup", async () => {
			await service.create("member", { sourceResumeId: null });
			await addStored(100 * MB - 1000, "member", new Date());
			const full = { code: "PLAN_LIMIT_REACHED", data: { limit: "portfolioStorageBytes", max: 100 * MB } };
			await expect(service.uploadPdf("member", { file: pdf(2000), pages: 1 })).rejects.toMatchObject(full);
			await expect(service.uploadImage("member", { file: await picture() })).resolves.toBeDefined();
			expect(fixture.files.size).toBe(1);
		});

		it("doesn't count files already due for deletion", async () => {
			await service.create("member", { sourceResumeId: null });
			await addStored(100 * MB, "member", new Date(0));
			await expect(service.uploadPdf("member", { file: pdf(2000), pages: 1 })).resolves.toBeDefined();
		});

		it("doesn't let a save bring back a file already due for deletion", async () => {
			await service.create("member", { sourceResumeId: null });
			const { key } = await service.uploadImage("member", { file: await picture() });
			await getDb()
				.update(tables.portfolioFile)
				.set({ unusedSince: new Date(0) })
				.where(eq(tables.portfolioFile.key, key));
			await expect(
				edit((data) => {
					data.basics.picture = { key, width: 300, height: 200, alt: "" };
				}),
			).rejects.toMatchObject({ code: "PORTFOLIO_FILE_NOT_FOUND" });
			const [row] = await getDb()
				.select({ unusedSince: tables.portfolioFile.unusedSince })
				.from(tables.portfolioFile)
				.where(eq(tables.portfolioFile.key, key));
			expect(row?.unusedSince).toEqual(new Date(0));
			expect((await service.get("member")).usage.storageBytes).toBe(0);
		});

		it("lets exactly one of five parallel uploads take the last room", async () => {
			await service.create("member", { sourceResumeId: null });
			await addStored(100 * MB - 1500);
			const results = await Promise.allSettled(
				Array.from({ length: 5 }, () => service.uploadPdf("member", { file: pdf(1000), pages: 1 })),
			);
			expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
			for (const result of results.filter((item) => item.status === "rejected"))
				expect(result.reason).toMatchObject({ code: "PLAN_LIMIT_REACHED" });
			expect(fixture.files.size).toBe(1);
		});

		it("keeps files over the quota after a plan ends, refusing only new ones", async () => {
			await grantPlus();
			await service.create("member", { sourceResumeId: null });
			await addStored(150 * MB);
			await expect(service.uploadPdf("member", { file: pdf(2000), pages: 1 })).resolves.toBeDefined();
			await endPlans();
			expect((await service.get("member")).usage.storageBytes).toBe(150 * MB + 2000);
			await expect(service.uploadPdf("member", { file: pdf(2000), pages: 1 })).rejects.toMatchObject({
				code: "PLAN_LIMIT_REACHED",
			});
		});

		it("leaves the technical ceiling to paid plans, as storage being full", async () => {
			await grantPlus();
			await service.create("member", { sourceResumeId: null });
			await addStored(PORTFOLIO_UPLOAD.accountBytes - 1000);
			await expect(service.uploadPdf("member", { file: pdf(2000), pages: 1 })).rejects.toMatchObject({
				code: "PORTFOLIO_STORAGE_FULL",
			});
		});
	});

	describe("custom domains", () => {
		it("needs the plan to connect one, also for an account without a portfolio", async () => {
			await expect(domains.set("member", "me.example.com")).rejects.toMatchObject(planFeature("customDomain"));
			await grantPlus();
			expect((await domains.set("member", "me.example.com")).hostname).toBe("me.example.com");
		});

		it("needs the plan to finish connecting one, not to re-check a connected one", async () => {
			await grantPlus();
			await domains.set("member", "me.example.com");
			await endPlans();
			await expect(domains.verify("member")).rejects.toMatchObject(planFeature("customDomain"));
			await getDb()
				.update(tables.customDomain)
				.set({ verifiedAt: new Date() })
				.where(eq(tables.customDomain.userId, "member"));
			await expect(domains.verify("member")).resolves.toMatchObject({ hostname: "me.example.com" });
		});
	});

	describe("custom domains while portfolios are closed", () => {
		it("connects a domain as before with PORTFOLIO_MODE=off, whatever the plan", async () => {
			fixture.portfolio = "off";
			await expect(domains.set("member", "me.example.com")).resolves.toMatchObject({ hostname: "me.example.com" });
		});
	});

	describe("while plans don't apply", () => {
		const unlimited = async () => {
			await service.create("member", { sourceResumeId: null, theme: "brutal" });
			await edit((data) => {
				data.hero.effect.id = "vector-hover";
				data.credit.show = false;
			});
			expect((await withWorks(PORTFOLIO_LIMITS.works)).data.works.items).toHaveLength(PORTFOLIO_LIMITS.works);
			await addStored(500 * MB);
			await expect(service.uploadPdf("member", { file: pdf(2000), pages: 1 })).resolves.toBeDefined();
			expect((await service.get("member")).limits).toMatchObject({
				works: PORTFOLIO_LIMITS.works,
				storageBytes: PORTFOLIO_UPLOAD.accountBytes,
			});
			await expect(domains.set("member", "me.example.com")).resolves.toBeDefined();
		};

		it("limits nothing with BILLING_MODE=off", async () => {
			fixture.billing = "off";
			await unlimited();
		});

		it("limits only admins with BILLING_MODE=admins", async () => {
			fixture.billing = "admins";
			await unlimited();
			await service.create("owner", { sourceResumeId: null });
			await expect(edit((data) => void (data.credit.show = false), "owner")).rejects.toMatchObject(
				planFeature("hidePortfolioCredit"),
			);
		});
	});
});
