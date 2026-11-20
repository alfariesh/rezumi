import { describe, expect, it, vi } from "vite-plus/test";
import { jobSearchInputSchema } from "@rezumi/schema/jobs/search";
import { duplicateKey, matchesSearch, withoutDuplicates } from "./filters";
import { JOB_PAGE_SIZE, routeSearch } from "./routing";
import { fakeListing, fakeSource, listings } from "./test-helpers";
import { TregError } from "./treg";

vi.mock("@rezumi/env/server", () => ({ env: {} }));

const input = (value: Record<string, unknown> = {}) => jobSearchInputSchema.parse({ query: "engineer", ...value });

function sources(hirebasePages: Parameters<typeof fakeSource>[1], jobspipePages: Parameters<typeof fakeSource>[1]) {
	const hirebase = fakeSource("hirebase", hirebasePages);
	const jobspipe = fakeSource("jobspipe", jobspipePages);
	return { hirebase, jobspipe, all: { hirebase: hirebase.adapter, jobspipe: jobspipe.adapter } };
}

describe("routeSearch", () => {
	it("asks Hirebase only when it finds enough", async () => {
		const { hirebase, jobspipe, all } = sources([listings("hirebase", 20), listings("hirebase", 20, 21)], []);
		const page = await routeSearch(input(), undefined, all);
		expect(hirebase.calls).toHaveLength(1);
		expect(hirebase.calls[0]?.limit).toBe(JOB_PAGE_SIZE);
		expect(jobspipe.calls).toHaveLength(0);
		expect(page.listings).toHaveLength(20);
		expect(page.providers).toEqual(["hirebase"]);
		expect(page.cursors).toEqual({ hirebase: "2" });
		expect(page.hasMore).toBe(true);
		expect(page.costMicro).toBe(20_000);
	});

	it("tops up with JobsPipe when Hirebase finds fewer than 10", async () => {
		const { jobspipe, all } = sources([listings("hirebase", 6)], [listings("jobspipe", 20), listings("jobspipe", 5)]);
		const page = await routeSearch(input(), undefined, all);
		expect(jobspipe.calls[0]?.limit).toBe(14);
		expect(page.listings.map((listing) => listing.provider)).toEqual([
			...Array<string>(6).fill("hirebase"),
			...Array<string>(14).fill("jobspipe"),
		]);
		expect(page.providers).toEqual(["hirebase", "jobspipe"]);
		// Hirebase has no more; JobsPipe continues on its own cursor.
		expect(page.cursors).toEqual({ hirebase: "", jobspipe: "2" });
		expect(page.hasMore).toBe(true);
	});

	it("tops up with JobsPipe when Hirebase fails, and says the page is partial", async () => {
		const { jobspipe, all } = sources([new TregError("busy")], [listings("jobspipe", 20)]);
		const page = await routeSearch(input(), undefined, all);
		expect(jobspipe.calls[0]?.limit).toBe(20);
		expect(page.listings).toHaveLength(20);
		expect(page.partial).toBe(true);
		// Hirebase wasn't answered, so a later page asks it again from the start.
		expect(page.cursors.hirebase).toBeUndefined();
	});

	it("continues each provider from its own cursor", async () => {
		const { hirebase, jobspipe, all } = sources(
			[listings("hirebase", 20), listings("hirebase", 3, 21)],
			[listings("jobspipe", 20), listings("jobspipe", 20, 21)],
		);
		const page = await routeSearch(input(), { hirebase: "2", jobspipe: "2" }, all);
		expect(hirebase.calls[0]?.input.cursor).toBe("2");
		expect(jobspipe.calls[0]?.input.cursor).toBe("2");
		expect(page.listings[0]?.externalId).toBe("hirebase-21");
		expect(page.listings[3]?.externalId).toBe("jobspipe-21");
		expect(page.cursors).toEqual({ hirebase: "", jobspipe: "" });
		expect(page.hasMore).toBe(false);
	});

	it("starts JobsPipe on a later page once Hirebase has nothing more", async () => {
		const { hirebase, jobspipe, all } = sources([listings("hirebase", 20)], [listings("jobspipe", 20)]);
		const page = await routeSearch(input(), { hirebase: "" }, all);
		expect(hirebase.calls).toHaveLength(0);
		expect(jobspipe.calls[0]?.input.cursor).toBeUndefined();
		expect(page.listings).toHaveLength(20);
	});

	it("leaves JobsPipe out of visa sponsorship searches, since its listings don't say", async () => {
		const sponsored = listings("hirebase", 3).map((listing) => ({ ...listing, visaSponsorship: true }));
		const { jobspipe, all } = sources([[...sponsored, ...listings("hirebase", 3, 4)]], [listings("jobspipe", 20)]);
		const page = await routeSearch(input({ visaSponsorship: true }), undefined, all);
		expect(jobspipe.calls).toHaveLength(0);
		expect(page.listings).toHaveLength(3);
		expect(page.returned).toHaveLength(6);
		expect(page.hasMore).toBe(false);
	});

	it("shows a job both providers have once, Hirebase's", async () => {
		const shared = fakeListing("jobspipe", 99, { title: "Hirebase Job 1!", company: { name: "company 1" } });
		const { all } = sources([listings("hirebase", 2)], [[shared, ...listings("jobspipe", 3)]]);
		const page = await routeSearch(input(), undefined, all);
		expect(page.listings.map((listing) => listing.externalId)).toEqual([
			"hirebase-1",
			"hirebase-2",
			"jobspipe-1",
			"jobspipe-2",
			"jobspipe-3",
		]);
		// Both are stored; only one shows.
		expect(page.returned).toHaveLength(6);
	});

	it("leaves out jobs an earlier page showed", async () => {
		const { all } = sources([listings("hirebase", 3)], []);
		const seen = new Set([duplicateKey(fakeListing("hirebase", 1))]);
		const page = await routeSearch(input({ visaSponsorship: undefined }), { jobspipe: "" }, all, { seen });
		expect(page.listings.map((listing) => listing.externalId)).toEqual(["hirebase-2", "hirebase-3"]);
	});

	it("stops at once when treg's budget is spent", async () => {
		const { jobspipe, all } = sources([new TregError("budget")], [listings("jobspipe", 20)]);
		await expect(routeSearch(input(), undefined, all)).rejects.toMatchObject({ code: "budget" });
		expect(jobspipe.calls).toHaveLength(0);
	});

	it("throws when no provider answers", async () => {
		const { all } = sources([new TregError("busy")], [new TregError("unavailable")]);
		await expect(routeSearch(input(), undefined, all)).rejects.toMatchObject({ code: "busy" });
	});
});

describe("matchesSearch", () => {
	const base = fakeListing("hirebase", 1);

	it("keeps listings that don't say, drops ones that clearly don't fit", () => {
		expect(matchesSearch(base, input({ country: "DE" }))).toBe(true);
		expect(matchesSearch(base, input({ country: "US" }))).toBe(false);
		expect(matchesSearch({ ...base, location: { text: "Anywhere" } }, input({ country: "US" }))).toBe(true);
		expect(matchesSearch({ ...base, workArrangement: "onsite" }, input({ remote: "only" }))).toBe(false);
		expect(matchesSearch(base, input({ remote: "only" }))).toBe(true);
		expect(matchesSearch({ ...base, workArrangement: "remote" }, input({ remote: "exclude" }))).toBe(false);
		expect(matchesSearch({ ...base, workArrangement: "hybrid" }, input({ workArrangement: "remote" }))).toBe(false);
		expect(matchesSearch({ ...base, seniority: "junior" }, input({ seniority: "senior" }))).toBe(false);
		expect(matchesSearch(base, input({ seniority: "senior" }))).toBe(true);
	});

	it("needs a stated sponsorship for a visa search", () => {
		expect(matchesSearch(base, input({ visaSponsorship: true }))).toBe(false);
		expect(matchesSearch({ ...base, visaSponsorship: true }, input({ visaSponsorship: true }))).toBe(true);
	});

	it("compares pay only in the same currency and per year, and keeps unpaid jobs on request", () => {
		const paid = (max: number, currency = "USD", period: "year" | "hour" = "year") => ({
			...base,
			salary: { max, currency, period },
		});
		expect(matchesSearch(paid(90_000), input({ salaryMin: 80_000 }))).toBe(true);
		expect(matchesSearch(paid(70_000), input({ salaryMin: 80_000 }))).toBe(false);
		expect(matchesSearch(paid(70_000, "EUR"), input({ salaryMin: 80_000 }))).toBe(true);
		expect(matchesSearch(paid(40, "USD", "hour"), input({ salaryMin: 80_000 }))).toBe(true);
		expect(matchesSearch(base, input({ salaryMin: 80_000 }))).toBe(true);
		expect(matchesSearch(base, input({ salaryMin: 80_000, includeNoSalary: false }))).toBe(false);
	});
});

describe("withoutDuplicates", () => {
	it("matches title, company and city ignoring case and punctuation", () => {
		const first = fakeListing("hirebase", 1, { title: "Senior Engineer (Backend)" });
		const second = fakeListing("jobspipe", 2, {
			title: "senior engineer - backend",
			company: { name: "COMPANY 1" },
		});
		const elsewhere = fakeListing("jobspipe", 3, { title: "Senior Engineer (Backend)", location: { text: "Paris" } });
		expect(withoutDuplicates([first, second, elsewhere])).toEqual([first, elsewhere]);
	});
});
