import type { ProviderListing } from "./providers/shared";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { jobListingSchema } from "@rezumi/schema/jobs/listing";
import hirebaseSearch from "./__fixtures__/hirebase-search.json";
import jobspipeSearch from "./__fixtures__/jobspipe-search.json";

const fixture = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle> | undefined }));
vi.mock("@rezumi/env/server", () => ({ env: {} }));
vi.mock("@rezumi/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));

// Opt in with a disposable PostgreSQL database. Each run owns and removes a separate schema.
describe.skipIf(!process.env.INTEGRATIONS_TEST_DATABASE_URL)("job listing store", () => {
	let store: typeof import("./store");
	let hirebaseListing: ProviderListing;
	let jobspipeListing: ProviderListing;
	let pool: Pool;
	let admin: Pool;
	const schemaName = `jobs_test_${randomUUID().replaceAll("-", "")}`;

	beforeAll(async () => {
		admin = new Pool({ connectionString: process.env.INTEGRATIONS_TEST_DATABASE_URL });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({
			connectionString: process.env.INTEGRATIONS_TEST_DATABASE_URL,
			options: `-c search_path=${schemaName}`,
		});
		fixture.db = drizzle({ client: pool });
		const sql = await readFile(
			new URL("../../../../../migrations/20261120021955_orange_talon/migration.sql", import.meta.url),
			"utf8",
		);
		await pool.query(sql.split("--> statement-breakpoint").join("\n"));
		store = await import("./store");
		const { validListings } = await import("./providers/shared");
		const { mapHirebaseJob } = await import("./providers/hirebase");
		const { mapJobspipeJob } = await import("./providers/jobspipe");
		[hirebaseListing] = validListings([mapHirebaseJob(hirebaseSearch.jobs[0] as unknown as Record<string, unknown>)])
			.listings as [ProviderListing];
		[jobspipeListing] = validListings([mapJobspipeJob(jobspipeSearch.data[0] as unknown as Record<string, unknown>)])
			.listings as [ProviderListing];
	});

	beforeEach(async () => {
		await pool.query("TRUNCATE job_listing, job_search_cache");
	});

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	it("saves listings and returns them valid, in order", async () => {
		const saved = await store.upsertListings([jobspipeListing, hirebaseListing]);
		expect(saved.map((listing) => listing.provider)).toEqual(["jobspipe", "hirebase"]);
		for (const listing of saved) expect(jobListingSchema.safeParse(listing).success).toBe(true);
		expect(saved[1]).toMatchObject({
			title: hirebaseListing.title,
			company: { name: "Ramp", domain: "ramp.com" },
			location: { countryCode: "US" },
			closedAt: null,
		});
		const { rows } = await pool.query("SELECT country_code, search_text, raw FROM job_listing ORDER BY provider");
		expect(rows[0].country_code).toBe("US");
		expect(rows[0].search_text).toContain("ramp");
		expect(rows[0].raw).not.toHaveProperty("recruiter_emails");
	});

	it("is idempotent: the same job keeps its id and is stored once", async () => {
		const first = await store.upsertListings([hirebaseListing], new Date("2026-11-01T00:00:00Z"));
		const second = await store.upsertListings(
			[{ ...hirebaseListing, title: "Customer Success Manager" }, hirebaseListing],
			new Date("2026-11-10T00:00:00Z"),
		);
		expect(second).toHaveLength(1);
		expect(second[0]?.id).toBe(first[0]?.id);
		expect(second[0]?.title).toBe(hirebaseListing.title);
		expect(second[0]?.firstSeenAt).toBe("2026-11-01T00:00:00.000Z");
		expect(second[0]?.lastVerifiedAt).toBe("2026-11-10T00:00:00.000Z");
		const { rows } = await pool.query("SELECT count(*)::int AS count FROM job_listing");
		expect(rows[0].count).toBe(1);
	});

	it("keeps a closed date unless the provider says whether the job is open", async () => {
		const [stored] = await store.upsertListings([jobspipeListing]);
		await pool.query("UPDATE job_listing SET closed_at = '2026-11-15T00:00:00Z' WHERE id = $1", [stored?.id]);
		const [hirebaseStored] = await store.upsertListings([hirebaseListing]);
		await pool.query("UPDATE job_listing SET closed_at = '2026-11-15T00:00:00Z' WHERE id = $1", [hirebaseStored?.id]);
		// Hirebase doesn't say; JobsPipe says "active".
		const saved = await store.upsertListings([hirebaseListing, jobspipeListing]);
		expect(saved.map((listing) => listing.closedAt)).toEqual(["2026-11-15T00:00:00.000Z", null]);
	});

	it("does nothing for no listings", async () => {
		expect(await store.upsertListings([])).toEqual([]);
	});

	it("purges one provider's listings and the searches that used it", async () => {
		const [jobspipeStored, hirebaseStored] = await store.upsertListings([jobspipeListing, hirebaseListing]);
		await pool.query(
			`INSERT INTO job_search_cache (key, providers, query, listing_ids, expires_at) VALUES
				('a', ARRAY['hirebase'], '{}', ARRAY[$1], now() + interval '6 hours'),
				('b', ARRAY['hirebase','jobspipe'], '{}', ARRAY[$1, $2], now() + interval '6 hours'),
				('c', ARRAY['jobspipe'], '{}', ARRAY[$2], now() + interval '6 hours')`,
			[hirebaseStored?.id, jobspipeStored?.id],
		);
		expect(await store.purgeProvider("jobspipe")).toEqual({ listings: 1, searches: 2 });
		const listings = await pool.query("SELECT provider FROM job_listing");
		expect(listings.rows).toEqual([{ provider: "hirebase" }]);
		const searches = await pool.query("SELECT key FROM job_search_cache");
		expect(searches.rows).toEqual([{ key: "a" }]);
		expect(await store.purgeProvider("jobspipe")).toEqual({ listings: 0, searches: 0 });
	});
});
