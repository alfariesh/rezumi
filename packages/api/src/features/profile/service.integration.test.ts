import type { ProfileData } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { profileFromResume, resumeDataFromProfile } from "@rezumi/resume/profile";
import { parseResumeData } from "@rezumi/schema/resume/data";
import { sampleResumeData } from "@rezumi/schema/resume/sample";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	events: [] as { resumeId: string; mutation: string }[],
}));

vi.mock("@rezumi/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
vi.mock("../resume/events", () => ({
	publishResumeUpdated: async (event: { resumeId: string; mutation: string }) => {
		fixture.events.push({ resumeId: event.resumeId, mutation: event.mutation });
	},
}));

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const databaseUrl = process.env.INTEGRATIONS_TEST_DATABASE_URL ?? process.env.COVER_LETTER_TEST_DATABASE_URL;

/** A full Profile: the sample resume's content. */
const sampleProfile = (): ProfileData => profileFromResume(parseResumeData(structuredClone(sampleResumeData)));

const firstJob = (data: ProfileData) => {
	const job = data.sections.experience[0];
	if (!job) throw new Error("The sample Profile has no experience.");
	return job;
};

// Real PostgreSQL, opt-in only. Every table and FK comes from shipped migrations in a unique schema.
describe.skipIf(!databaseUrl)("profile service on a real database", () => {
	let service: typeof import("./service").profileService;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `profile_test_${randomUUID().replaceAll("-", "")}`;

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({ connectionString: databaseUrl, max: 4, options: `-c search_path=${schemaName}` });
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
		service = (await import("./service")).profileService;
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.events = [];
		await pool.query('TRUNCATE "user" CASCADE');
		await getDb()
			.insert(tables.user)
			.values([
				{
					id: "alice",
					name: "Alice Account",
					email: "alice@example.test",
					username: "alice",
					displayUsername: "alice",
				},
				{
					id: "guest",
					name: "Anonymous",
					email: "temp-guest@example.test",
					username: "guest-1",
					displayUsername: "guest-1",
					isAnonymous: true,
				},
			]);
	});

	const addResume = async (
		data: ResumeData,
		values: Partial<typeof tables.resume.$inferInsert> = {},
	): Promise<string> => {
		const id = values.id ?? randomUUID();
		await getDb()
			.insert(tables.resume)
			.values({ id, name: `Resume ${id.slice(0, 6)}`, slug: `cv-${id.slice(0, 8)}`, userId: "alice", data, ...values });
		return id;
	};
	const resumeData = async (id: string) => {
		const [row] = await getDb()
			.select({ data: tables.resume.data })
			.from(tables.resume)
			.where(eq(tables.resume.id, id));
		return row?.data as ResumeData;
	};
	/** Saves Alice's Profile through the service and returns its version. */
	const save = async (data: ProfileData) => (await service.update("alice", { data })).updatedAt;

	it("starts as the account's name and email, never a guest's, until the first save", async () => {
		const alice = await service.read("alice");
		expect(alice.updatedAt).toBeNull();
		expect(alice.data.basics).toMatchObject({ name: "Alice Account", email: "alice@example.test" });
		expect(alice.data.sections.experience).toEqual([]);
		expect((await service.read("guest")).data.basics).toMatchObject({ name: "", email: "" });
	});

	it("carries a change into linked parts, leaves overrides, and skips locked resumes and resumes in Trash", async () => {
		const before = sampleProfile();
		await save(before);
		const linked = await addResume(resumeDataFromProfile(before));
		const own = resumeDataFromProfile(before);
		own.basics.headline = "My own headline for this job";
		const ownJob = own.sections.experience.items[0];
		if (!ownJob) throw new Error("Missing job.");
		ownJob.description = "<p>Tailored for Lumen.</p>";
		const overridden = await addResume(own);
		const locked = await addResume(resumeDataFromProfile(before), { isLocked: true });
		const trashed = await addResume(resumeDataFromProfile(before), { trashedAt: new Date() });

		const after = structuredClone(before);
		after.basics.headline = "Principal designer";
		after.basics.email = "new@example.test";
		firstJob(after).description = "<p>Led the redesign.</p>";
		const result = await service.update("alice", { data: after });

		expect(result.updatedResumes.map((resume) => resume.id).sort()).toEqual([linked, overridden].sort());
		expect(fixture.events).toEqual(
			expect.arrayContaining([
				{ resumeId: linked, mutation: "profile" },
				{ resumeId: overridden, mutation: "profile" },
			]),
		);

		const followed = await resumeData(linked);
		expect(followed.basics).toMatchObject({ headline: "Principal designer", email: "new@example.test" });
		expect(followed.sections.experience.items[0]?.description).toBe("<p>Led the redesign.</p>");

		// The resume's own versions stay; what it still shared with the Profile follows.
		const partly = await resumeData(overridden);
		expect(partly.basics.headline).toBe("My own headline for this job");
		expect(partly.basics.email).toBe("new@example.test");
		expect(partly.sections.experience.items[0]?.description).toBe("<p>Tailored for Lumen.</p>");

		for (const untouched of [locked, trashed])
			expect((await resumeData(untouched)).basics.headline).toBe(before.basics.headline);
	});

	it("keeps items removed from the Profile in the resumes that have them, and adds none to them", async () => {
		const before = sampleProfile();
		await save(before);
		const resume = await addResume(resumeDataFromProfile(before));
		const after = structuredClone(before);
		const removed = after.sections.experience.shift();
		const [skill] = after.sections.skills;
		if (!skill) throw new Error("The sample Profile has no skills.");
		after.sections.skills.push({ ...structuredClone(skill), id: "new-skill", name: "Figma" });
		await service.update("alice", { data: after });

		const data = await resumeData(resume);
		expect(data.sections.experience.items.map((item) => item.id)).toContain(removed?.id);
		expect(data.sections.skills.items.map((item) => item.id)).not.toContain("new-skill");
	});

	it("refuses a save over a version it didn't read", async () => {
		// Null: "read before its first save", which holds only until that save.
		const first = await service.update("alice", { data: sampleProfile(), expectedUpdatedAt: null });
		expect(first.updatedAt).toBeInstanceOf(Date);
		await expect(service.update("alice", { data: sampleProfile(), expectedUpdatedAt: null })).rejects.toMatchObject({
			code: "PROFILE_VERSION_CONFLICT",
			status: 409,
		});

		const changed = sampleProfile();
		changed.basics.headline = "Second";
		const second = await service.update("alice", { data: changed, expectedUpdatedAt: first.updatedAt });
		expect(second.updatedAt?.getTime()).toBeGreaterThan(first.updatedAt?.getTime() ?? 0);
		await expect(
			service.update("alice", { data: sampleProfile(), expectedUpdatedAt: first.updatedAt }),
		).rejects.toMatchObject({ code: "PROFILE_VERSION_CONFLICT", data: { updatedAt: second.updatedAt?.toISOString() } });

		// The same content again is no change: the version stays.
		const same = await service.update("alice", { data: changed, expectedUpdatedAt: second.updatedAt });
		expect(same.updatedAt?.getTime()).toBe(second.updatedAt?.getTime());
	});

	it("refuses data the resume's write rules don't accept", async () => {
		const invalid = sampleProfile();
		// Past the write cap on any one text.
		invalid.basics.name = "x".repeat(200_001);
		await expect(service.update("alice", { data: invalid })).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect((await service.read("alice")).updatedAt).toBeNull();
	});

	it("saves one resume's part to the Profile, and other linked resumes follow", async () => {
		const profile = sampleProfile();
		await save(profile);
		const source = resumeDataFromProfile(profile);
		source.basics.headline = "Saved from a resume";
		const job = source.sections.experience.items[0];
		if (!job) throw new Error("Missing job.");
		job.description = "<p>Better words.</p>";
		const [project] = source.sections.projects.items;
		if (!project) throw new Error("Missing project.");
		source.sections.projects.items.push({
			...structuredClone(project),
			id: "resume-only-project",
			name: "Side project",
		});
		const from = await addResume(source);
		const other = await addResume(resumeDataFromProfile(profile));

		const headline = await service.savePart("alice", { resumeId: from, part: { kind: "basics", field: "headline" } });
		expect(headline.data.basics.headline).toBe("Saved from a resume");
		expect(headline.updatedResumes.map((resume) => resume.id)).toEqual([other]);
		expect((await resumeData(other)).basics.headline).toBe("Saved from a resume");

		await service.savePart("alice", { resumeId: from, part: { kind: "item", section: "experience", id: job.id } });
		expect((await resumeData(other)).sections.experience.items[0]?.description).toBe("<p>Better words.</p>");

		// A new item joins the Profile where the resume's order puts it, and no other resume gets it.
		const added = await service.savePart("alice", {
			resumeId: from,
			part: { kind: "item", section: "projects", id: "resume-only-project" },
		});
		expect(added.data.sections.projects.map((item) => item.id)).toContain("resume-only-project");
		expect((await resumeData(other)).sections.projects.items.map((item) => item.id)).not.toContain(
			"resume-only-project",
		);

		// Only an active resume of the account's own.
		await getDb().update(tables.resume).set({ trashedAt: new Date() }).where(eq(tables.resume.id, from));
		await expect(service.savePart("alice", { resumeId: from, part: { kind: "summary" } })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(service.savePart("guest", { resumeId: other, part: { kind: "summary" } })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});

	it("fills only what the Profile lacks from a resume, and a second time adds nothing", async () => {
		const own = sampleProfile();
		own.basics.headline = "Kept headline";
		own.sections.experience = [];
		own.sections.skills = [];
		own.summary.content = "";
		await save(own);
		const resume = parseResumeData(structuredClone(sampleResumeData));
		resume.basics.headline = "Ignored headline";
		const id = await addResume(resume);

		const filled = await service.fillFromResume("alice", { resumeId: id });
		expect(filled.data.basics.headline).toBe("Kept headline");
		expect(filled.data.summary.content).toBe(resume.summary.content);
		expect(filled.data.sections.experience.map((item) => item.id)).toEqual(
			resume.sections.experience.items.map((item) => item.id),
		);
		// Sections the Profile already has stay as they were.
		expect(filled.data.sections.education).toEqual(own.sections.education);

		const again = await service.fillFromResume("alice", { resumeId: id });
		expect(again.updatedAt?.getTime()).toBe(filled.updatedAt?.getTime());
		expect(again.updatedResumes).toEqual([]);
	});

	it("completes the Profile from imported data at best, never failing the import", async () => {
		const imported = parseResumeData(structuredClone(sampleResumeData));
		await service.completeFrom("alice", imported);
		const profile = await service.read("alice");
		expect(profile.updatedAt).toBeInstanceOf(Date);
		// The account's name and email were already there; the rest came from the import.
		expect(profile.data.basics.name).toBe("Alice Account");
		expect(profile.data.sections.experience).toHaveLength(imported.sections.experience.items.length);

		// Data the Profile can't take is left out with a warning; the caller's import still stands.
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const broken = structuredClone(imported);
		broken.basics.name = "x".repeat(200_001);
		await expect(service.completeFrom("guest", broken)).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledOnce();
		expect((await service.read("guest")).updatedAt).toBeNull();
		warn.mockRestore();
	});
});
