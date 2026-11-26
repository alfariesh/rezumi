import type { WebsiteImportEvent } from "@rezumi/schema/profile/website-import";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { defaultResumeData } from "@rezumi/schema/resume/default";

/**
 * A website import against a real PostgreSQL: the run's row, the account's one free import (also with two tabs at
 * once), the daily limit, the kept result and the upkeep. The web, the AI provider and the credit ledger are fakes; the
 * credit ledger itself is covered by `metered-ai.integration.test.ts`.
 */

const fixture = vi.hoisted(() => ({
	db: undefined as unknown,
	rezumi: true,
	runs: [] as { free: boolean; outcome: "succeeded" | "failed" | "open" }[],
	pages: new Map<string, { html: string; content: string } | Error>(),
	sitemap: null as string | null,
	answers: { picker: '{"pages":[1,2],"worksOnHome":false}', works: "" },
	profileName: "Dewi Lestari",
	reads: [] as { url: string; allowance: string | undefined }[],
}));

vi.mock("@rezumi/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));

vi.mock("../../../web/service", async () => {
	const { WebError } = await vi.importActual<typeof import("../../../web/contracts")>("../../../web/contracts");
	return {
		readPage: vi.fn(async (url: string, context: { allowance?: string; signal?: AbortSignal }) => {
			context.signal?.throwIfAborted();
			fixture.reads.push({ url, allowance: context.allowance });
			const page = fixture.pages.get(url);
			if (!page) throw new WebError("not-found");
			if (page instanceof Error) throw page;
			return {
				requestedUrl: url,
				resolvedUrl: url,
				content: page.content,
				html: page.html,
				format: "text",
				retrievedAt: new Date().toISOString(),
				method: "builtin",
				truncated: false,
				completeness: "unknown",
			};
		}),
		readSitemapXml: vi.fn(async () => fixture.sitemap),
	};
});

vi.mock("../../../ai/service", async () => {
	const { defaultResumeData: resume } = await vi.importActual<typeof import("@rezumi/schema/resume/default")>(
		"@rezumi/schema/resume/default",
	);
	return {
		aiService: {
			parseWebsite: vi.fn(async () => ({
				...structuredClone(resume),
				basics: { ...structuredClone(resume.basics), name: fixture.profileName },
			})),
		},
	};
});

vi.mock("../../../billing/metered-ai", () => {
	const model = new MockLanguageModelV4({
		modelId: "test",
		doGenerate: async (options) => {
			const system = JSON.stringify(options.prompt[0]);
			const text = system.includes("find the pages about their work") ? fixture.answers.picker : fixture.answers.works;
			return {
				content: [{ type: "text", text }],
				finishReason: { unified: "stop", raw: "end_turn" },
				usage: {
					inputTokens: { total: 1_000, noCache: 1_000, cacheRead: 0, cacheWrite: 0 },
					outputTokens: { total: 200, text: 200, reasoning: 0 },
				},
				warnings: [],
			};
		},
	});
	return {
		resolveAiSource: vi.fn(async () => ({ provider: {}, rezumi: fixture.rezumi })),
		startResolvedAiRun: vi.fn(async (_resolved: unknown, request: { free?: boolean }) => {
			const record = { free: Boolean(request.free), outcome: "open" as "succeeded" | "failed" | "open" };
			fixture.runs.push(record);
			return {
				model,
				metered: fixture.rezumi,
				credits: fixture.rezumi && !request.free ? 5 : 0,
				succeed: async () => {
					record.outcome = "succeeded";
				},
				fail: async () => {
					record.outcome = "failed";
				},
				spent: () =>
					fixture.rezumi
						? { provider: "openai", model: "m", inputTokens: 3_000, outputTokens: 600, costUsdMicros: 4_200 }
						: null,
			};
		}),
	};
});

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;

const HOME = "https://dewi.design/";
const html = (body: string) => `<html><head><title>Dewi</title></head><body>${body}</body></html>`;

function sitePages() {
	fixture.pages = new Map([
		[
			HOME,
			{
				html: html(`<a href="/work/kopi">Kopi checkout</a><a href="/work/bank">Bank app</a><a href="/about">About</a>`),
				content: "Dewi Lestari, product designer in Jakarta.",
			},
		],
		[
			"https://dewi.design/work/kopi",
			{
				html: html(
					`<img src="/img/kopi.jpg" width="1600" height="1000" alt="Checkout"><a href="https://apps.apple.com/app/kopi">App Store</a>`,
				),
				content: "Kopi checkout. Six steps became three.",
			},
		],
		[
			"https://dewi.design/work/bank",
			{ html: html(`<img src="/img/bank.jpg" alt="Bank">`), content: "Bank app redesign." },
		],
	]);
}

const worksAnswer = JSON.stringify({
	works: [
		{ page: 1, title: "Kopi checkout", summary: "Six steps became three.", cover: 1, primaryLink: 1 },
		{ page: 2, title: "Bank app", summary: "A redesign." },
	],
});

describe.skipIf(!databaseUrl)("website import", () => {
	let admin: Pool;
	let pool: Pool;
	let run: typeof import("./run");
	let jobs: typeof import("./jobs");
	const schemaName = `website_import_test_${randomUUID().replaceAll("-", "")}`;
	const db = () => fixture.db as ReturnType<typeof drizzle>;

	const collect = async (userId = "dewi", request: Record<string, unknown> = {}, signal?: AbortSignal) => {
		const events: WebsiteImportEvent[] = [];
		for await (const event of run.importWebsite(userId, { url: "dewi.design", aiSource: "rezumi", ...request }, signal))
			events.push(event);
		return events;
	};
	const resultOf = (events: WebsiteImportEvent[]) => {
		const last = events.at(-1);
		if (last?.type !== "done") throw new Error("The import didn't finish.");
		return last.result;
	};
	const rows = (userId = "dewi") =>
		db().select().from(tables.websiteImport).where(eq(tables.websiteImport.userId, userId));

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({ connectionString: databaseUrl, max: 4, options: `-c search_path=${schemaName}` });
		fixture.db = drizzle({ client: pool });
		const migrations = new URL("../../../../../../../migrations/", import.meta.url);
		const directories = (await readdir(migrations, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
			.map((entry) => entry.name)
			.sort();
		for (const directory of directories) {
			const file = new URL(`${directory}/migration.sql`, migrations);
			if (existsSync(file)) await pool.query((await readFile(file, "utf8")).replaceAll('"public".', ""));
		}
		run = await import("./run");
		jobs = await import("./jobs");
	}, 60_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.rezumi = true;
		fixture.runs = [];
		fixture.reads = [];
		fixture.sitemap = null;
		fixture.profileName = "Dewi Lestari";
		fixture.answers = { picker: '{"pages":[1,2],"worksOnHome":false}', works: worksAnswer };
		sitePages();
		await pool.query('TRUNCATE "user" CASCADE');
		await db()
			.insert(tables.user)
			.values(
				["dewi", "other"].map((id) => ({
					id,
					name: id,
					email: `${id}@example.test`,
					username: id,
					displayUsername: id,
				})),
			);
	});

	it("reads the site, reports its progress and keeps the result for review", async () => {
		const events = await collect();
		expect(events.map((event) => event.type)).toEqual(["reading", "found", "page", "page", "extracting", "done"]);
		expect(events[1]).toEqual({ type: "found", pages: 2 });
		const result = resultOf(events);
		expect(result.profile.data.basics.name).toBe("Dewi Lestari");
		expect(result.works.map((work) => work.title)).toEqual(["Kopi checkout", "Bank app"]);
		expect(result.works[0]?.cover?.url).toBe("https://dewi.design/img/kopi.jpg");
		expect(result.works[0]?.primaryLink?.url).toBe("https://apps.apple.com/app/kopi");
		expect(result.notes).toEqual([]);
		// Every page of an import is read on the import's own allowance.
		expect(fixture.reads.every((read) => read.allowance === "import")).toBe(true);

		const [row] = await rows();
		expect(row).toMatchObject({ status: "succeeded", url: HOME, pagesRead: 3, workCount: 2, free: true, credits: 0 });
		expect(await run.readWebsiteImportResult("dewi", result.runId)).toEqual(result);
		await expect(run.readWebsiteImportResult("other", result.runId)).rejects.toMatchObject({
			code: "SOURCE_NOT_FOUND",
		});
	});

	it("makes the first import on Rezumi AI free, keeps its tokens, then charges the next", async () => {
		expect(await run.websiteImportIsFree("dewi")).toBe(true);
		expect(resultOf(await collect()).free).toBe(true);
		expect(await run.websiteImportIsFree("dewi")).toBe(false);
		expect(resultOf(await collect()).free).toBe(false);
		expect(fixture.runs).toEqual([
			{ free: true, outcome: "succeeded" },
			{ free: false, outcome: "succeeded" },
		]);
		const saved = (await rows()).toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		expect(saved.map((row) => [row.free, row.credits, row.inputTokens])).toEqual([
			[true, 0, 3_000],
			[false, 5, null],
		]);
	});

	it("gives only one of two imports started at once the free run", async () => {
		const [first, second] = await Promise.all([collect(), collect()]);
		expect([resultOf(first).free, resultOf(second).free].toSorted()).toEqual([false, true]);
	});

	it("keeps the free import for later when one fails, or when the person's own AI runs it", async () => {
		fixture.pages.set(HOME, new Error("down"));
		await expect(collect()).rejects.toThrow();
		expect(fixture.runs).toEqual([{ free: true, outcome: "failed" }]);
		expect((await rows())[0]).toMatchObject({ status: "failed", free: true });
		expect(await run.websiteImportIsFree("dewi")).toBe(true);

		sitePages();
		fixture.rezumi = false;
		expect(resultOf(await collect()).free).toBe(false);
		expect(await run.websiteImportIsFree("dewi")).toBe(true);
	});

	it("gives the credits back when the person stops listening part-way", async () => {
		const iterator = run.importWebsite("dewi", { url: "dewi.design", aiSource: "rezumi" });
		expect((await iterator.next()).value).toEqual({ type: "reading" });
		await iterator.return(undefined);
		expect(fixture.runs).toEqual([{ free: true, outcome: "failed" }]);
		expect((await rows())[0]).toMatchObject({ status: "failed", errorCode: "stopped" });
		expect(await run.websiteImportIsFree("dewi")).toBe(true);
	});

	it("goes on without the pages that can't be read, and says so", async () => {
		fixture.pages.delete("https://dewi.design/work/bank");
		fixture.answers.works = JSON.stringify({ works: [{ page: 1, title: "Kopi checkout" }] });
		const result = resultOf(await collect());
		expect(result.works.map((work) => work.title)).toEqual(["Kopi checkout"]);
		expect(result.notes).toEqual(["pages-failed"]);
	});

	it("reads a one-page portfolio's works from its home page", async () => {
		fixture.pages.set(HOME, {
			html: html("<h1>Dewi</h1>"),
			content: "Kopi checkout: three steps. Bank app: a redesign.",
		});
		fixture.answers.picker = '{"pages":[],"worksOnHome":true}';
		fixture.answers.works = JSON.stringify({
			works: [
				{ page: 1, title: "Kopi checkout" },
				{ page: 1, title: "Bank app" },
			],
		});
		const result = resultOf(await collect());
		expect(result.works.map((work) => [work.title, work.sourceUrl])).toEqual([
			["Kopi checkout", HOME],
			["Bank app", HOME],
		]);
	});

	it("offers the pages only the sitemap lists after the site's own links", async () => {
		fixture.sitemap = `<urlset><url><loc>https://dewi.design/work/kopi</loc></url><url><loc>https://dewi.design/work/old-zine</loc></url></urlset>`;
		fixture.answers.picker = '{"pages":[4],"worksOnHome":false}';
		fixture.pages.set("https://dewi.design/work/old-zine", { html: html(""), content: "An old zine." });
		fixture.answers.works = JSON.stringify({ works: [{ page: 1, title: "Old zine" }] });
		const result = resultOf(await collect());
		expect(result.works.map((work) => work.sourceUrl)).toEqual(["https://dewi.design/work/old-zine"]);
	});

	it("keeps the Profile when the site shows no work", async () => {
		fixture.answers.picker = '{"pages":[],"worksOnHome":false}';
		const result = resultOf(await collect());
		expect(result.works).toEqual([]);
		expect(result.notes).toEqual(["no-works"]);
		expect((await rows())[0]).toMatchObject({ status: "succeeded", workCount: 0 });
	});

	it("fails a site that says nothing about the person and shows no work, and charges nothing", async () => {
		fixture.profileName = "";
		fixture.answers.picker = '{"pages":[],"worksOnHome":false}';
		await expect(collect()).rejects.toMatchObject({ code: "SOURCE_NOT_FOUND" });
		expect(fixture.runs).toEqual([{ free: true, outcome: "failed" }]);
	});

	it("points Behance, Dribbble and LinkedIn elsewhere, before anything is read or charged", async () => {
		for (const url of ["behance.net/dewi", "https://dribbble.com/dewi", "linkedin.com/in/dewi"])
			await expect(collect("dewi", { url })).rejects.toMatchObject({ code: "SOURCE_INVALID" });
		expect(fixture.runs).toEqual([]);
		expect(await rows()).toEqual([]);
	});

	it("allows three imports a day, and ten attempts with failed ones", async () => {
		for (let index = 0; index < 3; index++) await collect();
		await expect(collect()).rejects.toMatchObject({ code: "SOURCE_LIMIT" });
		// Another account has its own.
		await expect(collect("other")).resolves.toBeDefined();

		await pool.query("TRUNCATE website_import");
		fixture.pages.set(HOME, new Error("down"));
		for (let index = 0; index < 10; index++) await expect(collect()).rejects.toThrow();
		sitePages();
		await expect(collect()).rejects.toMatchObject({ code: "SOURCE_LIMIT" });
	});

	it("clears results after a day and fails runs a stopped server left running", async () => {
		const result = resultOf(await collect());
		const [stale] = await db()
			.insert(tables.websiteImport)
			.values({
				userId: "dewi",
				url: HOME,
				status: "running",
				free: false,
				createdAt: new Date(Date.now() - 20 * 60_000),
			})
			.returning();
		const later = new Date(Date.now() + 25 * 60 * 60 * 1000);
		expect(await jobs.runWebsiteImportJobs(later)).toEqual({ clearedResults: 1, failedStale: 1 });
		await expect(run.readWebsiteImportResult("dewi", result.runId)).rejects.toMatchObject({ code: "SOURCE_NOT_FOUND" });
		if (!stale) throw new Error("The stale run wasn't saved.");
		const [after] = await db().select().from(tables.websiteImport).where(eq(tables.websiteImport.id, stale.id));
		expect(after).toMatchObject({ status: "failed", errorCode: "stale" });
	});

	it("starts from the resume data's empty shape", () => {
		// Guard for the fake Profile reader above.
		expect(defaultResumeData.basics.name).toBe("");
	});
});
