import type { JobListing } from "@rezumi/schema/jobs/listing";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const applications = vi.hoisted(() => ({
	findBySourceKey: vi.fn(),
	findIdsBySourceKeys: vi.fn(),
	create: vi.fn(),
}));
vi.mock("../applications/service", () => ({ applicationService: applications }));

const { trackListing, trackedApplications, trackedSalary, trackedSource } = await import("./track");

const listing = (overrides: Partial<JobListing> = {}): JobListing => ({
	id: "listing-1",
	provider: "hirebase",
	externalId: "hb-1",
	title: "Product Manager, Payments",
	company: { name: "Acme Ltd", logoUrl: "https://logos.example.com/acme.png" },
	location: { city: "London", country: "United Kingdom", countryCode: "GB", text: "London, United Kingdom" },
	workArrangement: "hybrid",
	salary: { min: 70_000, max: 85_000, currency: "GBP", period: "year" },
	description: "Lead the payments roadmap.",
	skills: ["Payments"],
	postingUrl: "https://jobs.ashbyhq.com/acme/1234",
	source: "ashby",
	firstSeenAt: "2026-11-20T00:00:00.000Z",
	lastVerifiedAt: "2026-11-20T01:00:00.000Z",
	closedAt: null,
	...overrides,
});

beforeEach(() => {
	vi.clearAllMocks();
	applications.findBySourceKey.mockResolvedValue(null);
	applications.create.mockResolvedValue("app-1");
});

describe("tracked fields", () => {
	it("names job boards and careers sites as people say them", () => {
		expect(trackedSource({ source: "ashby" })).toBe("Company careers site");
		expect(trackedSource({ source: "linkedin" })).toBe("LinkedIn");
		expect(trackedSource({ source: "some-board" })).toBe("some-board");
		expect(trackedSource({})).toBe("Rezumi job search");
	});

	it("writes listed pay in its own currency and period", () => {
		expect(trackedSalary({ min: 70_000, max: 85_000, currency: "GBP", period: "year" })).toBe("£70,000–£85,000 a year");
		expect(trackedSalary({ min: 25, currency: "USD", period: "hour" })).toBe("$25 an hour");
		expect(trackedSalary({ max: 9_000_000, currency: "IDR", period: "month" })).toMatch(/9,000,000 a month$/);
		expect(trackedSalary({ currency: "USD", period: "year" })).toBeUndefined();
		expect(trackedSalary(undefined)).toBeUndefined();
	});
});

describe("trackListing", () => {
	it("saves the listing as an application with the provider's copy and the original link", async () => {
		await expect(trackListing("u1", listing(), new Date("2026-11-20T02:00:00.000Z"))).resolves.toEqual({
			applicationId: "app-1",
			created: true,
		});
		expect(applications.create).toHaveBeenCalledWith({
			userId: "u1",
			company: "Acme Ltd",
			role: "Product Manager, Payments",
			status: "saved",
			source: "Company careers site",
			sourceUrl: "https://jobs.ashbyhq.com/acme/1234",
			location: "London, United Kingdom",
			salary: "£70,000–£85,000 a year",
			jobDescription: "Lead the payments roadmap.",
			postingSource: {
				method: "job-search",
				format: "text",
				requestedUrl: "https://jobs.ashbyhq.com/acme/1234",
				resolvedUrl: "https://jobs.ashbyhq.com/acme/1234",
				retrievedAt: "2026-11-20T02:00:00.000Z",
				providerFetchedAt: "2026-11-20T01:00:00.000Z",
				truncated: false,
				completeness: "unknown",
			},
		});
	});

	it("gives back the application already saved for the same posting", async () => {
		applications.findBySourceKey.mockResolvedValue({ id: "app-existing" });
		await expect(trackListing("u1", listing())).resolves.toEqual({ applicationId: "app-existing", created: false });
		expect(applications.create).not.toHaveBeenCalled();
	});

	it("leaves out a place and pay the listing doesn't state", async () => {
		await trackListing("u1", listing({ location: { text: "" }, salary: undefined, description: "" }));
		const saved = applications.create.mock.calls[0]?.[0];
		expect(saved).not.toHaveProperty("location");
		expect(saved).not.toHaveProperty("salary");
		expect(saved.jobDescription).toBeNull();
	});
});

describe("trackedApplications", () => {
	it("marks every listing whose posting the person already saved", async () => {
		const first = listing();
		const twin = listing({ id: "listing-2", provider: "jobspipe", externalId: "jp-1" });
		const other = listing({ id: "listing-3", postingUrl: "https://example.com/careers/other" });
		applications.findIdsBySourceKeys.mockImplementation(
			async ({ keys }: { keys: string[] }) => new Map([[keys[0], "app-9"]]),
		);
		await expect(trackedApplications("u1", [first, twin, other])).resolves.toEqual({
			"listing-1": "app-9",
			"listing-2": "app-9",
		});
		expect(applications.findIdsBySourceKeys.mock.calls[0]?.[0].keys).toHaveLength(2);
	});
});
