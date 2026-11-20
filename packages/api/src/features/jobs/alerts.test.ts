import type { JobSourceAdapter, ProviderListing, ProviderSearchOptions, ProviderSearchResult } from "./providers";
import type { JobSearchCriteria, JobSearchInput } from "@rezumi/schema/jobs/search";
import { describe, expect, it, vi } from "vite-plus/test";
import { jobSearchCriteriaSchema } from "@rezumi/schema/jobs/search";
import { fakeListing } from "./test-helpers";

const fixture = vi.hoisted(() => ({ env: { JOB_SEARCH_DAILY_BUDGET_USD: 1, DEPLOYMENT_NAMESPACE: "test" } }));
vi.mock("@rezumi/env/server", () => ({ env: fixture.env }));
vi.mock("@rezumi/db/client", () => ({ db: {} }));

const { checkJobAlert, JobAlertPostponed, nextBudgetDay } = await import("./alerts");
const { memoryCounters } = await import("./counters");
const { spentToday } = await import("./allowance");
const { TregError } = await import("./treg");

const NOW = new Date("2026-11-20T08:00:00.000Z");
const DAY = 86_400_000;

type Answer = ProviderListing[] | Error | Partial<ProviderSearchResult>;

function source(provider: "hirebase" | "jobspipe", answers: { search?: Answer; newListings?: Answer } = {}) {
	const calls: { kind: "search" | "new"; input: JobSearchInput; options: ProviderSearchOptions; delta?: string }[] = [];
	const reply = (answer: Answer | undefined): ProviderSearchResult => {
		if (answer instanceof Error) throw answer;
		const result = Array.isArray(answer) ? { listings: answer } : (answer ?? {});
		const listings = result.listings ?? [];
		return {
			provider,
			cursor: undefined,
			total: undefined,
			costMicro: listings.length * 1_500,
			ms: 1,
			dropped: 0,
			...result,
			listings,
		};
	};
	const adapter: JobSourceAdapter = {
		provider,
		pricePerListingUsd: 0.0015,
		search: async (input, options) => {
			calls.push({ kind: "search", input, options });
			return reply(answers.search);
		},
		newListings: async (input, delta, options) => {
			calls.push({ kind: "new", input, options, delta });
			return reply(answers.newListings);
		},
		count: async () => undefined,
	};
	return { adapter, calls };
}

const search = (value: Partial<JobSearchCriteria> = {}) =>
	jobSearchCriteriaSchema.parse({ query: "Product designer", country: "DE", ...value });
const many = (provider: "hirebase" | "jobspipe", count: number, from = 1) =>
	Array.from({ length: count }, (_, index) => fakeListing(provider, from + index));

function setup(hirebase: ReturnType<typeof source>, jobspipe = source("jobspipe")) {
	const counters = memoryCounters(() => NOW.getTime());
	const options = {
		now: NOW,
		intervalDays: 1,
		sources: { hirebase: hirebase.adapter, jobspipe: jobspipe.adapter },
		counters,
		configured: () => true,
		switchedOff: () => false,
	};
	return { options, counters, hirebase, jobspipe };
}

describe("checkJobAlert", () => {
	it("asks Hirebase for jobs first seen since an interval back, and overlaps the next check by an hour", async () => {
		const { options, counters, hirebase, jobspipe } = setup(source("hirebase", { search: many("hirebase", 12) }));
		const check = await checkJobAlert(search(), null, { ...options, intervalDays: 7 });
		expect(hirebase.calls).toEqual([
			expect.objectContaining({
				options: expect.objectContaining({
					limit: 20,
					kind: "discovery",
					fresh: true,
					ingestedAfter: new Date(NOW.getTime() - 7 * DAY).toISOString(),
				}),
			}),
		]);
		expect(jobspipe.calls).toEqual([]);
		expect(check).toMatchObject({ providers: ["hirebase"], costMicro: 18_000 });
		expect(check.listings).toHaveLength(12);
		expect(check.state).toEqual({ hirebaseAfter: "2026-11-20T07:00:00.000Z" });
		expect(await spentToday(counters, NOW)).toBe(18_000);

		await checkJobAlert(search(), check.state, options);
		expect(hirebase.calls[1]?.options.ingestedAfter).toBe("2026-11-20T07:00:00.000Z");
	});

	it("offers only open, fitting jobs once, and stores everything it paid for", async () => {
		const listings = [
			fakeListing("hirebase", 1),
			fakeListing("hirebase", 2, { closedAt: "2026-11-19T00:00:00.000Z" }),
			fakeListing("hirebase", 3, { location: { countryCode: "FR", text: "Paris" } }),
			fakeListing("hirebase", 4, { title: "Hirebase job 1", company: { name: "Company 1" } }),
			...many("hirebase", 10, 10),
		];
		const { options } = setup(source("hirebase", { search: listings }));
		const check = await checkJobAlert(search(), null, options);
		expect(check.returned).toHaveLength(14);
		const offered = check.listings.map((listing) => listing.externalId);
		expect(offered).toHaveLength(11);
		for (const left of ["hirebase-2", "hirebase-3", "hirebase-4"]) expect(offered).not.toContain(left);
	});

	it("tops up with a JobsPipe search below ten, keeping its delta cursor for next time", async () => {
		const jobspipe = source("jobspipe", { search: { listings: many("jobspipe", 3), deltaCursor: "delta-1" } });
		const { options } = setup(source("hirebase", { search: many("hirebase", 4) }), jobspipe);
		const check = await checkJobAlert(search(), null, options);
		expect(jobspipe.calls).toEqual([
			expect.objectContaining({ kind: "search", options: expect.objectContaining({ limit: 16 }) }),
		]);
		expect(check.listings).toHaveLength(7);
		expect(check.providers).toEqual(["hirebase", "jobspipe"]);
		expect(check.state).toMatchObject({ jobspipeDelta: "delta-1", jobspipeDeltaAt: NOW.toISOString() });
	});

	it("polls JobsPipe's new jobs with a recent cursor, and searches again once the cursor is old", async () => {
		const jobspipe = source("jobspipe", {
			newListings: { listings: many("jobspipe", 1), deltaCursor: "delta-2" },
			search: many("jobspipe", 2),
		});
		const { options } = setup(source("hirebase", { search: [] }), jobspipe);
		const recent = { jobspipeDelta: "delta-1", jobspipeDeltaAt: new Date(NOW.getTime() - 2 * DAY).toISOString() };
		const check = await checkJobAlert(search(), recent, options);
		expect(jobspipe.calls).toEqual([expect.objectContaining({ kind: "new", delta: "delta-1" })]);
		expect(check.state.jobspipeDelta).toBe("delta-2");

		const old = { jobspipeDelta: "delta-1", jobspipeDeltaAt: new Date(NOW.getTime() - 25 * DAY).toISOString() };
		const again = await checkJobAlert(search(), old, options);
		expect(jobspipe.calls[1]).toMatchObject({ kind: "search" });
		// The search answered more than one page, so it gave no cursor: the old one goes.
		expect(again.state).not.toHaveProperty("jobspipeDelta");
	});

	it("leaves JobsPipe out of visa sponsorship alerts", async () => {
		const { options, jobspipe } = setup(source("hirebase", { search: [] }));
		await checkJobAlert(search({ visaSponsorship: true }), null, options);
		expect(jobspipe.calls).toEqual([]);
	});

	it("keeps a failed provider's place, and fails when no provider answers", async () => {
		const failing = source("hirebase", { search: new TregError("unavailable") });
		const { options } = setup(failing, source("jobspipe", { search: many("jobspipe", 2) }));
		const state = { hirebaseAfter: "2026-11-19T07:00:00.000Z" };
		const check = await checkJobAlert(search(), state, options);
		expect(check.state.hirebaseAfter).toBe(state.hirebaseAfter);
		expect(check.listings).toHaveLength(2);

		const none = setup(failing, source("jobspipe", { search: new TregError("busy") }));
		await expect(checkJobAlert(search(), state, none.options)).rejects.toMatchObject({ code: "unavailable" });
	});

	it("postpones to the next UTC day when the budget is spent, here or at treg", async () => {
		const { options, counters, hirebase } = setup(source("hirebase", { search: many("hirebase", 12) }));
		await counters.add(`budget:${NOW.toISOString().slice(0, 10)}`, 1_000_000, { window: DAY });
		const spent = checkJobAlert(search(), null, options);
		await expect(spent).rejects.toBeInstanceOf(JobAlertPostponed);
		await expect(spent).rejects.toMatchObject({ until: new Date("2026-11-21T00:05:00.000Z") });
		expect(hirebase.calls).toEqual([]);
		expect(nextBudgetDay(new Date("2026-11-20T23:59:00Z")).toISOString()).toBe("2026-11-21T00:05:00.000Z");

		const capped = setup(source("hirebase", { search: new TregError("budget") }));
		await expect(checkJobAlert(search(), null, capped.options)).rejects.toBeInstanceOf(JobAlertPostponed);
	});

	it("does nothing while job search is switched off, and refuses without a treg token", async () => {
		const { options, hirebase } = setup(source("hirebase", { search: many("hirebase", 3) }));
		const state = { hirebaseAfter: "2026-11-19T07:00:00.000Z" };
		expect(await checkJobAlert(search(), state, { ...options, switchedOff: () => true })).toMatchObject({
			listings: [],
			state,
			costMicro: 0,
		});
		await expect(checkJobAlert(search(), state, { ...options, configured: () => false })).rejects.toMatchObject({
			code: "not-configured",
		});
		expect(hirebase.calls).toEqual([]);
	});
});
