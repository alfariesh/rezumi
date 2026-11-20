import type { JobDataPoint } from "../events";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { jobListingDraftSchema } from "@rezumi/schema/jobs/listing";
import { jobSearchInputSchema } from "@rezumi/schema/jobs/search";
import hirebaseSearch from "../__fixtures__/hirebase-search.json";
import jobspipeNew from "../__fixtures__/jobspipe-new.json";
import jobspipeSearch from "../__fixtures__/jobspipe-search.json";

vi.mock("@rezumi/env/server", () => ({ env: { TREG_API_KEY: undefined } }));
vi.spyOn(console, "info").mockImplementation(() => {});

const { configureJobEvents } = await import("../events");
const { hirebase, hirebaseSearchBody, mapHirebaseJob } = await import("./hirebase");
const { jobspipe, jobspipeSearchBody, mapJobspipeJob } = await import("./jobspipe");
const { validListings } = await import("./shared");

const hirebaseJob = hirebaseSearch.jobs[0] as unknown as Record<string, unknown>;
const jobspipeJob = jobspipeSearch.data[0] as unknown as Record<string, unknown>;
const CONTACTS = {
	recruiter_emails: ["jane.recruiter@example.com"],
	hiring_team: [
		{ name: "Jane Recruiter", email: "jane.recruiter@example.com", linkedin: "https://linkedin.com/in/jane" },
	],
	contact_email: "jobs@example.com",
};

const one = (mapped: ReturnType<typeof mapHirebaseJob>) => {
	const [listing, ...rest] = validListings([mapped]).listings;
	if (!listing || rest.length) throw new Error("Expected exactly one valid listing");
	return listing;
};

function fakeTreg(body: unknown, costMicro = 0) {
	const calls: Array<{ url: string; body: unknown }> = [];
	const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
		return new Response(JSON.stringify(body), { headers: { "x-treg-cost-micro": String(costMicro) } });
	}) as unknown as typeof globalThis.fetch;
	return { treg: { fetch, token: "test-token", sleep: async () => {} }, calls };
}

afterEach(() => configureJobEvents(undefined));

describe("Hirebase mapping", () => {
	it("maps the catalog example to a valid listing", () => {
		const listing = one(mapHirebaseJob(hirebaseJob));
		expect(jobListingDraftSchema.safeParse(listing).success).toBe(true);
		expect(listing).toMatchObject({
			provider: "hirebase",
			externalId: "6af6d7ef68fef158edfe90b0",
			title: "Custome Success Manager, Enterprise | Lifecycle",
			company: { name: "Ramp", domain: "ramp.com", size: "1001–5000", industry: "Finance" },
			location: {
				city: "New York",
				region: "New York",
				country: "United States",
				countryCode: "US",
				text: "New York, NY (HQ); San Francisco, CA",
			},
			workArrangement: "hybrid",
			seniority: "senior",
			employmentType: "Full Time",
			visaSponsorship: false,
			postingUrl: "https://jobs.ashbyhq.com/ramp/4727e0b5-eafa-41ab-89ce-f6a1d19d3f0e",
			applyUrl: "https://jobs.ashbyhq.com/ramp/4727e0b5-eafa-41ab-89ce-f6a1d19d3f0e",
			source: "ashby",
			language: "en",
			postedAt: "2026-11-13T00:00:00.000Z",
		});
		expect(listing.salary).toBeUndefined();
		expect(listing.skills).toContain("AI fluency");
	});

	it("turns the HTML description into plain text", () => {
		const listing = one(mapHirebaseJob(hirebaseJob));
		expect(listing.description).not.toMatch(/<[a-z]/i);
		expect(listing.description).toContain("Role Overview\nThe CSM, Enterprise");
		expect(listing.description).toContain("100% medical, dental & vision insurance");
		const script = one(
			mapHirebaseJob({ ...hirebaseJob, description: "<p>Hello</p><script>alert(1)</script><img src=x onerror=1>" }),
		);
		expect(script.description).toBe("Hello");
	});

	it("keeps listed pay with its period and currency", () => {
		const listing = one(
			mapHirebaseJob({ ...hirebaseJob, salary_range: { min: 120000, max: 150000, currency: "usd", period: "Yearly" } }),
		);
		expect(listing.salary).toEqual({ min: 120000, max: 150000, currency: "USD", period: "year" });
		const hourly = one(mapHirebaseJob({ ...hirebaseJob, salary_range: { min: 25, currency: "EUR", period: "hour" } }));
		expect(hourly.salary).toEqual({ min: 25, currency: "EUR", period: "hour" });
		const odd = one(mapHirebaseJob({ ...hirebaseJob, salary_range: { max: 9000, currency: "?", period: "weekly" } }));
		expect(odd.salary).toEqual({ max: 9000, currency: "", period: "unknown" });
		expect(one(mapHirebaseJob({ ...hirebaseJob, salary_range: { min: null, max: null } })).salary).toBeUndefined();
	});

	it("reads a place without a city", () => {
		const listing = one(
			mapHirebaseJob({
				...hirebaseJob,
				location_raw: null,
				locations: [{ country: "Germany", address: "Germany" }],
				location_type: "Remote",
			}),
		);
		expect(listing.location).toEqual({ country: "Germany", countryCode: "DE", text: "Germany" });
		expect(listing.workArrangement).toBe("remote");
		const nowhere = one(mapHirebaseJob({ ...hirebaseJob, location_raw: null, locations: [] }));
		expect(nowhere.location).toEqual({ text: "" });
	});

	it("never keeps contact details", () => {
		const mapped = mapHirebaseJob({ ...hirebaseJob, ...CONTACTS });
		const listing = one(mapped);
		const stored = JSON.stringify(listing);
		expect(stored).not.toContain("jane.recruiter");
		expect(stored).not.toContain("jobs@example.com");
		expect(Object.keys(listing.raw)).not.toEqual(expect.arrayContaining(["recruiter_emails"]));
		expect(listing.raw).not.toHaveProperty("hiring_team");
		expect(listing.raw).not.toHaveProperty("contact_email");
		expect(listing.raw.company_data).toEqual({
			size_range: { min: 1001, max: 5000 },
			industries: ["Finance", "Corporate Services"],
			type: expect.anything(),
		});
	});

	it("falls back to the job board link and drops a job without a title or link", () => {
		const board = one(mapHirebaseJob({ ...hirebaseJob, application_link: null }));
		expect(board.postingUrl).toBe("https://jobs.ashbyhq.com/ramp");
		expect(board.applyUrl).toBeUndefined();
		const { listings, dropped } = validListings([
			mapHirebaseJob({ ...hirebaseJob, job_title: "  " }),
			mapHirebaseJob({ ...hirebaseJob, application_link: "javascript:alert(1)", job_board_link: null }),
		]);
		expect(listings).toHaveLength(0);
		expect(dropped).toBe(2);
	});

	it("reads a job board link as no company domain", () => {
		expect(one(mapHirebaseJob({ ...hirebaseJob, company_link: "https://jobs.lever.co/palantir" })).company.domain).toBe(
			undefined,
		);
		expect(one(mapHirebaseJob({ ...hirebaseJob, company_link: "https://www.ramp.com/" })).company.domain).toBe(
			"ramp.com",
		);
	});
});

describe("Hirebase search", () => {
	const input = jobSearchInputSchema.parse({ query: "software engineer", country: "US", remote: "only" });

	it("sends only catalog parameters", () => {
		expect(hirebaseSearchBody(input, 20, 1)).toEqual({
			job_titles: ["software engineer"],
			geo_locations: [{ country: "United States" }],
			location_types: ["Remote"],
			days_ago: 30,
			limit: 20,
			page: 1,
		});
		const full = jobSearchInputSchema.parse({
			query: "nurse",
			location: "Berlin",
			country: "DE",
			remote: "exclude",
			postedWithinDays: 7,
			seniority: "lead",
			salaryMin: 50000,
			salaryCurrency: "EUR",
			includeNoSalary: false,
		});
		expect(hirebaseSearchBody(full, 10, 3)).toEqual({
			job_titles: ["nurse"],
			geo_locations: [{ city: "Berlin", country: "Germany" }],
			location_types: ["Hybrid", "In-Person"],
			days_ago: 7,
			experience_levels: ["Principal / Staff / Lead"],
			salary: { min: 50000 },
			currency: "EUR",
			limit: 10,
			page: 3,
		});
		// Jobs without pay stay in: the pay filter would drop them.
		expect(hirebaseSearchBody({ ...full, includeNoSalary: true }, 10, 1)).not.toHaveProperty("salary");
	});

	it("returns listings, the next page, the total and the cost, and records an event", async () => {
		const points: JobDataPoint[] = [];
		configureJobEvents({ dataset: () => ({ writeDataPoint: (point) => points.push(point) }) });
		const { treg, calls } = fakeTreg({ ...hirebaseSearch, page: 1, total_pages: 181 }, 1500);
		const result = await hirebase.search(input, { limit: 1, treg });
		expect(calls[0]?.url).toBe("https://treg.to/call/hirebase.jobs.search");
		expect(result).toMatchObject({ provider: "hirebase", cursor: "2", total: 181, costMicro: 1500, dropped: 0 });
		expect(result.listings).toHaveLength(1);
		expect(points).toEqual([
			{
				indexes: ["hirebase"],
				blobs: ["hirebase", "hirebase.jobs.search", "miss", "US", "search"],
				doubles: [1500, expect.any(Number), 1],
			},
		]);
	});

	it("continues from the cursor and stops on the last page", async () => {
		const { treg, calls } = fakeTreg({ ...hirebaseSearch, page: 181, total_pages: 181 });
		const result = await hirebase.search({ ...input, cursor: "181" }, { limit: 1, treg });
		expect(calls[0]?.body).toMatchObject({ page: 181 });
		expect(result.cursor).toBeUndefined();
	});

	it("records a spend limit as a budget event", async () => {
		const points: JobDataPoint[] = [];
		configureJobEvents({ dataset: () => ({ writeDataPoint: (point) => points.push(point) }) });
		const fetch = vi.fn(
			async () => new Response(JSON.stringify({ error: "member_spend_cap_reached" }), { status: 429 }),
		) as unknown as typeof globalThis.fetch;
		await expect(hirebase.search(input, { limit: 1, treg: { fetch, token: "t" } })).rejects.toMatchObject({
			code: "budget",
		});
		expect(points[0]?.blobs[2]).toBe("budget");
	});
});

describe("JobsPipe mapping", () => {
	it("maps the catalog example to a valid listing", () => {
		const listing = one(mapJobspipeJob(jobspipeJob));
		expect(jobListingDraftSchema.safeParse(listing).success).toBe(true);
		expect(listing).toMatchObject({
			provider: "jobspipe",
			externalId: "23e9b4d3e84b0dcb",
			title: "Data Engineering Solution Lead - Remote",
			company: { name: "Mindex", domain: "mindex.com" },
			location: { city: "Rochester", country: "United States", countryCode: "US", text: "Rochester, NY 14607" },
			seniority: "executive",
			salary: { min: 105000, max: 155000, currency: "USD", period: "year" },
			postingUrl: "https://www.indeed.com/viewjob?jk=23e9b4d3e84b0dcb",
			applyUrl: "https://apply.workable.com/j/0B945F033E",
			source: "indeed",
			postedAt: "2026-11-13T23:16:55.000Z",
			closedAt: null,
		});
		expect(listing.workArrangement).toBeUndefined();
		expect(listing.skills).toEqual(["snowflake", "azure", "sql", "mongodb", "python", "sql-server"]);
		expect(listing.raw).toMatchObject({ status: "active", ghost_score: 0, occupation_code: "2512" });
	});

	it("never shows an estimate as pay", () => {
		const listing = one(mapJobspipeJob({ ...jobspipeJob, min_annual_salary_usd: null, max_annual_salary_usd: null }));
		expect(listing.salary).toBeUndefined();
		expect(JSON.stringify(listing)).not.toContain("120393");
	});

	it("reads remote, a place without a city, and a closed job", () => {
		const listing = one(
			mapJobspipeJob({
				...jobspipeJob,
				location: "Germany",
				country_code: "de",
				remote: true,
				status: "closed",
				closed_at: "2026-11-18T10:00:00+00:00",
			}),
		);
		expect(listing.location).toEqual({ country: "Germany", countryCode: "DE", text: "Germany" });
		expect(listing.workArrangement).toBe("remote");
		expect(listing.closedAt).toBe("2026-11-18T10:00:00.000Z");
		const unknown = one(mapJobspipeJob({ ...jobspipeJob, status: undefined, location: null, country_code: null }));
		expect(unknown.closedAt).toBeUndefined();
		expect(unknown.location).toEqual({ text: "" });
		expect(one(mapJobspipeJob({ ...jobspipeJob, work_arrangement: "on_site" })).workArrangement).toBe("onsite");
	});

	it("turns HTML into text and never keeps contact details", () => {
		const listing = one(
			mapJobspipeJob({
				...jobspipeJob,
				...CONTACTS,
				description: "<h2>About</h2><p>Build &amp; ship</p>",
				sources: [{ provider: "linkedin", url: "https://www.linkedin.com/jobs/view/1", seen_at: "x", poster: "Jane" }],
			}),
		);
		expect(listing.description).toBe("About\nBuild & ship");
		const stored = JSON.stringify(listing);
		expect(stored).not.toContain("jane.recruiter");
		expect(stored).not.toContain("jobs@example.com");
		expect(stored).not.toContain("Jane");
		expect(listing.raw.sources).toEqual([
			{ provider: "linkedin", url: "https://www.linkedin.com/jobs/view/1", seen_at: "x" },
		]);
	});
});

describe("JobsPipe search", () => {
	it("sends only catalog parameters, and pay only when jobs without pay are excluded", () => {
		const input = jobSearchInputSchema.parse({
			query: "data analyst",
			country: "GB",
			location: "London",
			remote: "only",
			postedWithinDays: 14,
			salaryMin: 40000,
		});
		expect(jobspipeSearchBody(input, 20)).toEqual({
			job_title_or: ["data analyst"],
			job_country_code_or: ["GB"],
			city_or: ["London"],
			remote: true,
			posted_at_max_age_days: 14,
			status: "active",
			limit: 20,
		});
		expect(jobspipeSearchBody({ ...input, includeNoSalary: false, cursor: "abc" }, 20)).toMatchObject({
			min_salary_usd: 40000,
			cursor: "abc",
		});
		expect(jobspipeSearchBody({ ...input, includeNoSalary: false, salaryCurrency: "GBP" }, 20)).not.toHaveProperty(
			"min_salary_usd",
		);
	});

	it("returns listings with the provider's next cursor and cost", async () => {
		const { treg } = fakeTreg(jobspipeSearch, 3920);
		const input = jobSearchInputSchema.parse({ query: "data engineer", country: "US" });
		const result = await jobspipe.search(input, { limit: 1, treg });
		expect(result).toMatchObject({ provider: "jobspipe", costMicro: 3920, dropped: 0, total: undefined });
		expect(result.cursor).toBe(jobspipeSearch.metadata.next_cursor);
		expect(result.listings[0]?.externalId).toBe("23e9b4d3e84b0dcb");
	});
});

describe("New jobs for alerts", () => {
	const input = jobSearchInputSchema.parse({ query: "machine learning engineer", country: "DE" });

	it("asks Hirebase for jobs it first saw since the last check, newest first", async () => {
		expect(hirebaseSearchBody(input, 20, 1, "2026-11-19T07:00:00.000Z")).toMatchObject({
			ingested_after: "2026-11-19T07:00:00.000Z",
			sort_by: "first_ingested",
			sort_order: "desc",
		});
		expect(hirebaseSearchBody(input, 20, 1)).not.toHaveProperty("ingested_after");
		const { treg, calls } = fakeTreg(hirebaseSearch);
		await hirebase.search(input, { limit: 20, treg, kind: "discovery", ingestedAfter: "2026-11-19T07:00:00.000Z" });
		expect(calls[0]?.body).toMatchObject({ ingested_after: "2026-11-19T07:00:00.000Z" });
	});

	it("polls JobsPipe with the delta cursor and the same filters, and hands back the next one", async () => {
		const { treg, calls } = fakeTreg(jobspipeNew, 3920);
		const newListings = jobspipe.newListings;
		if (!newListings) throw new Error("JobsPipe has a new-jobs feed");
		const result = await newListings({ ...input, cursor: "page-2" }, "delta-cursor", { limit: 5, treg });
		expect(calls[0]?.url).toContain("/call/jobspipe.jobs.new");
		expect(calls[0]?.body).toEqual({
			job_title_or: ["machine learning engineer"],
			job_country_code_or: ["DE"],
			posted_at_max_age_days: 30,
			status: "active",
			limit: 5,
			delta_cursor: "delta-cursor",
		});
		expect(result).toMatchObject({ costMicro: 3920, deltaCursor: jobspipeNew.metadata.next_delta_cursor });
		expect(result.listings).toHaveLength(1);
	});

	it("reads a search's delta cursor only from its last page", async () => {
		const { treg } = fakeTreg(jobspipeSearch);
		const result = await jobspipe.search(input, { limit: 1, treg });
		expect(jobspipeSearch.metadata.next_cursor).toBeTruthy();
		expect(result.deltaCursor).toBeUndefined();
	});
});
