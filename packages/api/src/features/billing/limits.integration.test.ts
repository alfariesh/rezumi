import type { BillingMode } from "./entitlements";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { defaultResumeData } from "@rezumi/schema/resume/default";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "off" as BillingMode,
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
			get BILLING_MODE() {
				return fixture.mode;
			},
		},
	};
});

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;

const withLetters = (count: number): ResumeData => {
	const data = structuredClone(defaultResumeData);
	data.customSections.push({
		id: "letters",
		type: "cover-letter",
		title: "Letters",
		columns: 1,
		hidden: false,
		items: Array.from({ length: count }, (_, index) => ({
			id: `letter-${index}`,
			hidden: false,
			recipient: "",
			content: `<p>Letter ${index}</p>`,
		})),
	} as unknown as ResumeData["customSections"][number]);
	return data;
};

const designed = (template: ResumeData["metadata"]["template"], css = ""): ResumeData => {
	const data = structuredClone(defaultResumeData);
	data.metadata.template = template;
	if (css) data.metadata.stylesheet = { mode: "semantic", source: { languageVersion: 1, text: css } };
	return data;
};

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("plan limits", () => {
	let resumes: typeof import("../resume/service").resumeService;
	let letters: typeof import("../cover-letters/service").coverLetterService;
	let documents: typeof import("../documents/service").documentsService;
	let billingAdmin: typeof import("./admin").billingAdmin;
	let automation: typeof import("./automation");
	let admin: Pool;
	let pool: Pool;
	const schemaName = `limits_test_${randomUUID().replaceAll("-", "")}`;

	const createResume = (userId = "member", name = "CV", data?: ResumeData, origin?: "import") =>
		resumes.create({
			userId,
			name,
			tags: [],
			locale: "en-US",
			...(data ? { data } : {}),
			...(origin ? { origin } : {}),
		});

	const activeCount = async (userId: string) => {
		const rows = await getDb()
			.select({ id: tables.resume.id })
			.from(tables.resume)
			.where(and(eq(tables.resume.userId, userId), isNull(tables.resume.trashedAt)));
		return rows.length;
	};

	const letterCount = async (userId: string) =>
		(await getDb().select().from(tables.coverLetter).where(eq(tables.coverLetter.userId, userId))).length;

	const grantPlus = (userId = "member") =>
		billingAdmin.grantPeriod({ actorUserId: "owner", userId, planId: "plus", days: 30, reason: "Test" });

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
		({ resumeService: resumes } = await import("../resume/service"));
		({ coverLetterService: letters } = await import("../cover-letters/service"));
		({ documentsService: documents } = await import("../documents/service"));
		({ billingAdmin } = await import("./admin"));
		automation = await import("./automation");
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		await pool.query('TRUNCATE "user", billing_audit_log CASCADE');
		await getDb()
			.insert(tables.user)
			.values(
				["owner", "member"].map((id) => ({
					id,
					name: id,
					email: `${id}@example.test`,
					username: id,
					displayUsername: id,
					...(id === "owner" ? { role: "admin" } : {}),
				})),
			);
	});

	describe("active documents", () => {
		it("allows up to the free limit, then refuses the next with the counts", async () => {
			for (const name of ["One", "Two", "Three"]) await createResume("member", name);
			const error = await createResume("member", "Four").catch((error: unknown) => error);
			expect(error).toMatchObject({
				code: "PLAN_LIMIT_REACHED",
				status: 403,
				data: { limit: "activeResumes", max: 3, used: 3, planId: "free" },
			});
			expect((error as Error).message).not.toMatch(/Rp|\d{2}\.\d{3}|https?:|buy|upgrade/i);
			expect(await activeCount("member")).toBe(3);
		});

		it("doesn't count Trash, counts a restore from Trash, and leaves a live document's restore alone", async () => {
			const ids = [await createResume(), await createResume(), await createResume()];
			await documents.trash({ userId: "member", type: "resume", id: ids[0] as string });
			const fourth = await createResume("member", "Fourth");
			await expect(documents.restore({ userId: "member", type: "resume", id: ids[0] as string })).rejects.toMatchObject(
				{ code: "PLAN_LIMIT_REACHED" },
			);
			// Restoring one that isn't in Trash changes nothing, so it isn't counted.
			await documents.restore({ userId: "member", type: "resume", id: fourth });
			await documents.trash({ userId: "member", type: "resume", id: fourth });
			await documents.restore({ userId: "member", type: "resume", id: ids[0] as string });
			expect(await activeCount("member")).toBe(3);
		});

		it("counts an import's resume and its letters together, and refuses the whole import over the limit", async () => {
			await letters.create({ userId: "member", name: "Kept" });
			await letters.create({ userId: "member", name: "Kept too" });
			const error = await createResume("member", "Import", withLetters(2), "import").catch((error: unknown) => error);
			expect(error).toMatchObject({
				code: "PLAN_LIMIT_REACHED",
				data: { limit: "activeCoverLetters", max: 3, used: 2, requested: { resumes: 1, coverLetters: 2 } },
			});
			expect((error as Error).message).toContain("1 resume and 2 cover letters");
			expect(await activeCount("member")).toBe(0);
			expect(await letterCount("member")).toBe(2);
			await createResume("member", "Import", withLetters(1), "import");
			expect(await letterCount("member")).toBe(3);
		});

		it("counts letters a resume save carries in", async () => {
			const id = await createResume();
			for (const name of ["A", "B", "C"]) await letters.create({ userId: "member", name });
			await expect(resumes.update({ id, userId: "member", data: withLetters(1) })).rejects.toMatchObject({
				code: "PLAN_LIMIT_REACHED",
				data: { limit: "activeCoverLetters" },
			});
			expect(await letterCount("member")).toBe(3);
		});

		it("counts letters from every path: create, duplicate and import", async () => {
			const first = await letters.create({ userId: "member", name: "One" });
			await letters.duplicate({ userId: "member", id: first.id });
			await letters.import({ userId: "member", document: await letters.export({ userId: "member", id: first.id }) });
			await expect(letters.create({ userId: "member", name: "Four" })).rejects.toMatchObject({
				code: "PLAN_LIMIT_REACHED",
			});
			await expect(letters.duplicate({ userId: "member", id: first.id })).rejects.toMatchObject({
				code: "PLAN_LIMIT_REACHED",
			});
			expect(await letterCount("member")).toBe(3);
		});

		it("counts copies for a job", async () => {
			const id = await createResume();
			await createResume();
			await documents.copyForJob({ userId: "member", resumeId: id });
			await expect(documents.copyForJob({ userId: "member", resumeId: id })).rejects.toMatchObject({
				code: "PLAN_LIMIT_REACHED",
			});
		});

		it("lets exactly one of five parallel creates take the last slot", async () => {
			await createResume();
			await createResume();
			// Slow every insert down so all five count before any commits; only the billing lock keeps them apart.
			await pool.query(
				`CREATE FUNCTION slow_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.05); RETURN NEW; END $$;
				CREATE TRIGGER slow_resume_insert BEFORE INSERT ON resume FOR EACH ROW EXECUTE FUNCTION slow_insert();`,
			);
			await Promise.all(Array.from({ length: 8 }, () => pool.query("SELECT 1")));
			const results = await Promise.allSettled(
				Array.from({ length: 5 }, (_, index) => createResume("member", `Parallel ${index}`)),
			).finally(() => pool.query("DROP TRIGGER slow_resume_insert ON resume; DROP FUNCTION slow_insert();"));
			expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
			for (const result of results.filter((item) => item.status === "rejected"))
				expect(result.reason).toMatchObject({ code: "PLAN_LIMIT_REACHED" });
			expect(await activeCount("member")).toBe(3);
		});

		it("raises the limit with a pass, and keeps every document when the pass is taken away", async () => {
			const period = await grantPlus();
			for (let index = 0; index < 5; index++) await createResume("member", `CV ${index}`);
			await billingAdmin.revokePeriod({ actorUserId: "owner", periodId: period.id, reason: "Test" });
			await expect(createResume()).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED", data: { used: 5 } });
			const [one] = await getDb().select().from(tables.resume).where(eq(tables.resume.userId, "member"));
			await resumes.update({ id: one?.id as string, userId: "member", name: "Still editable" });
			expect(await activeCount("member")).toBe(5);
		});
	});

	describe("design", () => {
		it("keeps a premium template through edits and copies, but refuses switching to one", async () => {
			await getDb()
				.insert(tables.resume)
				.values({ id: "premium", userId: "member", name: "Premium", slug: "premium", data: designed("pikachu") });
			const edited = designed("pikachu");
			edited.basics.name = "Ada";
			await resumes.update({ id: "premium", userId: "member", data: edited });
			await resumes.patch({
				id: "premium",
				userId: "member",
				operations: [{ op: "replace", path: "/basics/headline", value: "Engineer" }],
			});
			const copy = await createResume(
				"member",
				"Copy",
				(await resumes.getById({ id: "premium", userId: "member" })).data,
			);
			expect((await resumes.getById({ id: copy, userId: "member" })).data.metadata.template).toBe("pikachu");

			const plain = await createResume();
			await expect(resumes.update({ id: plain, userId: "member", data: designed("pikachu") })).rejects.toMatchObject({
				code: "PLAN_FEATURE_REQUIRED",
				data: { feature: "premiumTemplates", planId: "free" },
			});
			await expect(
				resumes.patch({
					id: plain,
					userId: "member",
					operations: [{ op: "replace", path: "/metadata/template", value: "gengar" }],
				}),
			).rejects.toMatchObject({ code: "PLAN_FEATURE_REQUIRED" });
			await resumes.patch({
				id: plain,
				userId: "member",
				operations: [{ op: "replace", path: "/metadata/template", value: "rhyhorn" }],
			});
		});

		it("keeps saved custom styles, allows removing them, and refuses adding or changing them", async () => {
			await getDb()
				.insert(tables.resume)
				.values({
					id: "styled",
					userId: "member",
					name: "Styled",
					slug: "styled",
					data: designed("onyx", "a { b: c }"),
				});
			const kept = designed("onyx", "a { b: c }");
			kept.basics.name = "Ada";
			await resumes.update({ id: "styled", userId: "member", data: kept });
			await expect(
				resumes.update({ id: "styled", userId: "member", data: designed("onyx", "a { b: d }") }),
			).rejects.toMatchObject({ code: "PLAN_FEATURE_REQUIRED", data: { feature: "customStyles" } });
			await resumes.update({ id: "styled", userId: "member", data: designed("onyx") });
			await expect(
				resumes.update({ id: "styled", userId: "member", data: designed("onyx", "a { b: c }") }),
			).rejects.toMatchObject({ code: "PLAN_FEATURE_REQUIRED" });
		});

		it("fits an imported file to the plan instead of refusing it", async () => {
			const id = await createResume("member", "Import", designed("pikachu", "a { b: c }"), "import");
			const { data } = await resumes.getById({ id, userId: "member" });
			expect(data.metadata.template).toBe("bronzor");
			expect(data.metadata.stylesheet).toBeUndefined();

			const letter = await letters.create({ userId: "member", name: "Letter" });
			const document = await letters.export({ userId: "member", id: letter.id });
			document.style.metadata.template = "gengar";
			expect((await letters.import({ userId: "member", document })).style.metadata.template).toBe("bronzor");
		});

		it("refuses a premium template chosen for a letter", async () => {
			await expect(letters.create({ userId: "member", name: "Letter", template: "gengar" })).rejects.toMatchObject({
				code: "PLAN_FEATURE_REQUIRED",
			});
			const letter = await letters.create({ userId: "member", name: "Letter", template: "onyx" });
			await expect(
				letters.update({ userId: "member", id: letter.id, expectedRevision: letter.revision, template: "gengar" }),
			).rejects.toMatchObject({ code: "PLAN_FEATURE_REQUIRED" });
		});

		it("opens premium templates and custom styles with a pass", async () => {
			await grantPlus();
			const id = await createResume("member", "Import", designed("pikachu", "a { b: c }"), "import");
			expect((await resumes.getById({ id, userId: "member" })).data.metadata.template).toBe("pikachu");
			await resumes.update({ id, userId: "member", data: designed("gengar", "a { b: d }") });
		});
	});

	describe("API and MCP access", () => {
		const insertClient = (clientId: string, redirectUris: string[]) =>
			getDb().insert(tables.oauthClient).values({ clientId, redirectUris, name: clientId });
		const request = (method: "apiKey" | "bearer" | "session", clientId?: string) => ({
			user: { id: "member" },
			method,
			...(clientId ? { clientId } : {}),
		});

		beforeEach(async () => {
			await getDb().delete(tables.oauthClient);
			await insertClient("mobile", ["https://rezumi.app/auth/native-callback"]);
			await insertClient("mobile-dev", ["app.rezumi:/auth/native-callback"]);
			await insertClient("claude", ["https://claude.ai/api/mcp/auth_callback"]);
			await insertClient("mixed", ["https://rezumi.app/auth/native-callback", "https://evil.example/cb"]);
		});

		it("lets the official apps and web sessions in on the free plan, and refuses other clients", async () => {
			await automation.assertAutomationAccess(request("session"));
			await automation.assertAutomationAccess(request("bearer", "mobile"));
			await automation.assertAutomationAccess(request("bearer", "mobile-dev"));
			for (const credential of [request("apiKey"), request("bearer", "claude"), request("bearer", "mixed")])
				await expect(automation.assertAutomationAccess(credential)).rejects.toMatchObject({
					code: "PLAN_FEATURE_REQUIRED",
					data: { feature: "automationApi" },
				});
		});

		it("lets API keys and third-party clients in with a pass", async () => {
			await grantPlus();
			await automation.assertAutomationAccess(request("apiKey"));
			await automation.assertAutomationAccess(request("bearer", "claude"));
		});
	});

	describe("while billing is off", () => {
		it("refuses nothing", async () => {
			fixture.mode = "off";
			for (let index = 0; index < 5; index++) await createResume("member", `CV ${index}`);
			const id = await createResume("member", "Import", designed("pikachu", "a { b: c }"), "import");
			expect((await resumes.getById({ id, userId: "member" })).data.metadata.template).toBe("pikachu");
			await resumes.update({ id, userId: "member", data: designed("gengar", "a { b: d }") });
			for (let index = 0; index < 5; index++)
				await letters.create({ userId: "member", name: `L${index}`, template: "gengar" });
			await createResume("member", "With letters", withLetters(3), "import");
			await automation.assertAutomationAccess({ user: { id: "member" }, method: "apiKey" });
			await automation.assertAutomationAccess({ user: { id: "member" }, method: "bearer", clientId: "claude" });
			// Off never takes a billing lock, so no account row appears.
			expect(await getDb().select().from(tables.billingAccount)).toEqual([]);
		});

		it("applies plans only to admins in admins mode", async () => {
			fixture.mode = "admins";
			for (let index = 0; index < 4; index++) await createResume("member", `CV ${index}`);
			for (let index = 0; index < 3; index++) await createResume("owner", `CV ${index}`);
			await expect(createResume("owner")).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED" });
		});
	});
});
