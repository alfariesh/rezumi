// @vitest-environment happy-dom
import type { JobsSearch } from "./search";
import type { JobListingCard, JobSearchResult, JobSearchStatus } from "@rezumi/schema/jobs/search";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
	status: vi.fn(),
	defaults: vi.fn(),
	search: vi.fn(),
	track: vi.fn(),
	hide: vi.fn(),
	listing: vi.fn(),
	saveLogo: vi.fn(),
	invalidate: vi.fn(),
	openDialog: vi.fn(),
	schedules: vi.fn(),
	deleteSchedule: vi.fn(),
	recent: vi.fn(),
	forgetRecent: vi.fn(),
	clearRecent: vi.fn(),
}));

vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		jobs: {
			quota: {
				queryOptions: () => ({ queryKey: ["jobs", "quota"], queryFn: api.status }),
				queryKey: () => ["jobs", "quota"],
			},
			defaults: { queryOptions: () => ({ queryKey: ["jobs", "defaults"], queryFn: api.defaults }) },
			listing: {
				queryOptions: ({ input }: { input: { id: string } }) => ({
					queryKey: ["jobs", "listing", input.id],
					queryFn: () => api.listing(input),
				}),
			},
			search: {
				infiniteOptions: (options: {
					input: (cursor: string | undefined) => Record<string, unknown>;
					initialPageParam: undefined;
					getNextPageParam: (page: JobSearchResult) => string | undefined;
				}) => ({
					queryKey: ["jobs", "search", options.input(undefined)],
					queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.search(options.input(pageParam)),
					initialPageParam: options.initialPageParam,
					getNextPageParam: options.getNextPageParam,
				}),
			},
			recent: {
				queryOptions: () => ({ queryKey: ["jobs", "recent"], queryFn: api.recent }),
				key: () => ["jobs", "recent"],
			},
			forgetRecent: { mutationOptions: () => ({ mutationFn: api.forgetRecent }) },
			clearRecent: { mutationOptions: () => ({ mutationFn: api.clearRecent }) },
			track: { mutationOptions: () => ({ mutationFn: api.track }) },
			hide: { mutationOptions: () => ({ mutationFn: api.hide }) },
		},
		applications: { saveLogo: { mutationOptions: () => ({ mutationFn: api.saveLogo }) } },
		career: {
			schedules: { queryOptions: () => ({ queryKey: ["career", "schedules"], queryFn: api.schedules }) },
			deleteSchedule: { mutationOptions: () => ({ mutationFn: api.deleteSchedule }) },
		},
	},
}));
// The schedule sheet has its own tests; here it only shows what it was opened with.
vi.mock("@/features/career/schedule-sheet", () => ({
	ScheduleSheet: ({ schedule, search }: { schedule: string | undefined; search: unknown }) =>
		schedule ? (
			<div role="dialog" aria-label="Job alert" data-schedule={schedule}>
				{JSON.stringify(search)}
			</div>
		) : null,
}));
// The fit check has its own tests (listing-fit.test.tsx); here the open listing only needs to show.
vi.mock("./listing-fit", () => ({ ListingFit: () => null }));
vi.mock("@/features/applications/use-application-actions", () => ({ useInvalidateApplications: () => api.invalidate }));
vi.mock("@/dialogs/store", () => ({
	useDialogStore: (select: (state: { openDialog: typeof api.openDialog }) => unknown) =>
		select({ openDialog: api.openDialog }),
}));
const screenSize = vi.hoisted(() => ({ breakpoint: "wide" as "desktop" | "wide" }));
vi.mock("@rezumi/ui/hooks/use-breakpoint", () => ({ useBreakpoint: () => screenSize.breakpoint }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
		<a href={to} className={className}>
			{children}
		</a>
	),
}));

import { JobsPage } from "./jobs-page";
import { jobsSearchSchema } from "./search";

const quota = { used: 1, max: 15, resetsAt: "2026-11-21T00:00:00.000Z" };
const status = (overrides: Partial<JobSearchStatus> = {}): JobSearchStatus => ({
	available: true,
	cacheOnly: false,
	quota,
	...overrides,
});

const card = (id: string, overrides: Partial<JobListingCard> = {}): JobListingCard => ({
	id,
	provider: "hirebase",
	externalId: `hb-${id}`,
	title: `Data Analyst ${id}`,
	company: { name: "Acme" },
	location: { text: "London, United Kingdom" },
	skills: [],
	postingUrl: `https://jobs.example.com/${id}`,
	source: "linkedin",
	postedAt: "2026-11-18T00:00:00.000Z",
	firstSeenAt: "2026-11-20T00:00:00.000Z",
	lastVerifiedAt: "2026-11-20T00:00:00.000Z",
	closedAt: null,
	...overrides,
});

const result = (overrides: Partial<JobSearchResult> = {}): JobSearchResult => ({
	listings: [card("1")],
	fetchedAt: "2026-11-20T00:00:00.000Z",
	fromCache: false,
	stale: false,
	budgetLimited: false,
	quota,
	tracked: {},
	matches: {},
	...overrides,
});

const clients: QueryClient[] = [];
function mount(search: Partial<JobsSearch> = {}) {
	const onSearch = vi.fn();
	const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
	clients.push(client);
	render(
		<QueryClientProvider client={client}>
			<I18nProvider i18n={i18n}>
				<JobsPage search={jobsSearchSchema.parse(search)} onSearch={onSearch} />
			</I18nProvider>
		</QueryClientProvider>,
	);
	return { onSearch };
}

beforeEach(() => {
	vi.clearAllMocks();
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
	api.status.mockResolvedValue(status());
	api.defaults.mockResolvedValue({ query: "", location: "", country: "GB", remote: "any", suggestions: [] });
	api.search.mockResolvedValue(result());
	api.listing.mockResolvedValue({ ...card("1"), description: "About the role." });
	api.schedules.mockResolvedValue([]);
	api.recent.mockResolvedValue({ searches: [] });
});

const recentSearch = (query: string, seenToday: boolean, criteria: Record<string, unknown> = {}) => ({
	id: `recent-${query}`,
	criteria: { query, remote: "any", postedWithinDays: 30, includeNoSalary: true, ...criteria },
	searchedAt: "2026-11-20T08:00:00.000Z",
	seenToday,
});
afterEach(() => {
	cleanup();
	for (const client of clients.splice(0)) client.clear();
});

describe("JobsPage", () => {
	it("explains when the server can't search, and offers saving a job instead", async () => {
		api.status.mockResolvedValue(status({ available: false }));
		mount();
		expect(await screen.findByText("Job search isn't available here yet")).toBeTruthy();
		expect(screen.queryByRole("search")).toBeNull();
		expect(api.search).not.toHaveBeenCalled();
	});

	it("lists recent searches with whether each is free today, and runs one when picked", async () => {
		api.recent.mockResolvedValue({
			searches: [
				recentSearch("Product designer", false, { country: "AE", workArrangement: "hybrid" }),
				recentSearch("Nurse", false, { location: "Leeds", country: "GB" }),
			],
		});
		api.defaults.mockResolvedValue({ query: "", location: "", country: "", remote: "any", suggestions: ["Midwife"] });
		const { onSearch } = mount();
		const widget = await screen.findByRole("region", { name: "Recent job searches" });
		expect(within(widget).getByText("United Arab Emirates · Hybrid")).toBeTruthy();
		expect(within(widget).getByText("Leeds, United Kingdom")).toBeTruthy();
		expect(within(widget).getAllByText("Uses 1 search")).toHaveLength(2);
		// The roles from the preferences stay under the recent searches.
		expect(await screen.findByRole("button", { name: "Midwife" })).toBeTruthy();
		fireEvent.click(within(widget).getByRole("button", { name: "Product designer" }));
		expect(onSearch).toHaveBeenCalledWith(
			expect.objectContaining({ q: "Product designer", country: "AE", arrangement: "hybrid" }),
		);
		expect(api.search).not.toHaveBeenCalled();
	});

	it("forgets one recent search, and clears them all", async () => {
		api.recent.mockResolvedValue({ searches: [recentSearch("Nurse", false), recentSearch("Midwife", false)] });
		api.forgetRecent.mockResolvedValue({ ok: true });
		api.clearRecent.mockResolvedValue({ ok: true });
		mount();
		const widget = await screen.findByRole("region", { name: "Recent job searches" });
		fireEvent.click(within(widget).getByRole("button", { name: "Remove Nurse from recent searches" }));
		await waitFor(() => expect(api.forgetRecent.mock.calls[0]?.[0]).toEqual({ id: "recent-Nurse" }));
		fireEvent.click(within(widget).getByRole("button", { name: "Clear" }));
		await waitFor(() => expect(api.clearRecent).toHaveBeenCalled());
	});

	it("opens today's last search again when it's free, without adding a step to the history", async () => {
		api.recent.mockResolvedValue({
			searches: [recentSearch("Nurse", true, { country: "GB" }), recentSearch("Midwife", false)],
		});
		const { onSearch } = mount();
		await waitFor(() =>
			expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ q: "Nurse", country: "GB" }), { replace: true }),
		);
		expect(screen.queryByRole("region", { name: "Recent job searches" })).toBeNull();
	});

	it("doesn't open an older search by itself, since that would use one of today's searches", async () => {
		api.recent.mockResolvedValue({ searches: [recentSearch("Nurse", false)] });
		const { onSearch } = mount();
		expect(await screen.findByRole("region", { name: "Recent job searches" })).toBeTruthy();
		expect(onSearch).not.toHaveBeenCalled();
	});

	it("starts from the preferences and searches nothing until asked", async () => {
		api.defaults.mockResolvedValue({
			query: "Nurse",
			location: "Leeds",
			country: "GB",
			remote: "any",
			suggestions: ["Nurse", "Midwife"],
		});
		const { onSearch } = mount();
		expect(await screen.findByDisplayValue("Nurse")).toBeTruthy();
		// The country and city wait in the Filters sheet; its button names the place.
		expect(screen.getByRole("button", { name: "Filters · Leeds" })).toBeTruthy();
		expect(api.search).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Midwife" }));
		expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ q: "Midwife", country: "GB", location: "Leeds" }));
	});

	it("shows results with the original posting link, and tracks one", async () => {
		api.track.mockResolvedValue({ applicationId: "app-1", created: true });
		mount({ q: "data analyst", country: "GB" });
		const item = await screen.findByRole("article", { name: "Data Analyst 1" });
		// The first listing opens beside the results on a wide screen.
		const open = screen.getByRole("complementary", { name: "Job details" });
		const original = within(open).getByRole("link", { name: /View original/ });
		expect(original.getAttribute("href")).toBe("https://jobs.example.com/1");
		expect(original.getAttribute("target")).toBe("_blank");
		expect(original.getAttribute("rel")).toBe("noopener noreferrer");
		expect(within(open).getByText(/via LinkedIn/)).toBeTruthy();
		expect(screen.getByText("14 searches left today (of 15)")).toBeTruthy();

		fireEvent.click(within(open).getByRole("button", { name: "Track" }));
		expect(await within(open).findByRole("link", { name: /Tracked/ })).toBeTruthy();
		expect(within(item).getByText("Tracked")).toBeTruthy();
		expect(api.track.mock.calls[0]?.[0]).toEqual({ id: "1" });
		expect(api.invalidate).toHaveBeenCalled();
	});

	it("marks listings the person already tracks", async () => {
		api.search.mockResolvedValue(result({ tracked: { "1": "app-7" } }));
		mount({ q: "data analyst" });
		const item = await screen.findByRole("article", { name: "Data Analyst 1" });
		expect(within(item).getByText("Tracked")).toBeTruthy();
		const open = screen.getByRole("complementary", { name: "Job details" });
		expect(within(open).getByRole("link", { name: /Tracked/ })).toBeTruthy();
		expect(within(open).queryByRole("button", { name: "Track" })).toBeNull();
	});

	it("opens the first listing beside the results, and another when picked", async () => {
		api.search.mockResolvedValue(result({ listings: [card("1"), card("2")] }));
		mount({ q: "data analyst" });
		const second = await screen.findByRole("article", { name: "Data Analyst 2" });
		const open = () => screen.getByRole("complementary", { name: "Job details" });
		expect(within(open()).getByRole("heading", { name: "Data Analyst 1" })).toBeTruthy();
		fireEvent.click(within(second).getByRole("button", { name: "Data Analyst 2" }));
		expect(within(open()).getByRole("heading", { name: "Data Analyst 2" })).toBeTruthy();
		expect(within(second).getByRole("button", { name: "Data Analyst 2" }).getAttribute("aria-current")).toBe("true");
	});

	it("opens nothing by itself on a narrower screen, and a listing in a sheet when picked", async () => {
		screenSize.breakpoint = "desktop";
		try {
			api.search.mockResolvedValue(result({ listings: [card("1"), card("2")] }));
			mount({ q: "data analyst" });
			const first = await screen.findByRole("article", { name: "Data Analyst 1" });
			expect(screen.queryByRole("complementary", { name: "Job details" })).toBeNull();
			fireEvent.click(within(first).getByRole("button", { name: "Data Analyst 1" }));
			expect(await screen.findByRole("dialog")).toBeTruthy();
		} finally {
			screenSize.breakpoint = "wide";
		}
	});

	it("shows how a listing's skills read against the Profile, only when some match", async () => {
		api.search.mockResolvedValue(
			result({
				listings: [card("1", { skills: ["SQL", "Python", "dbt"] }), card("2", { skills: ["Rust"] })],
				matches: { "1": { matched: ["SQL", "Python"], missing: ["dbt"] }, "2": { matched: [], missing: ["Rust"] } },
			}),
		);
		mount({ q: "data analyst" });
		const first = await screen.findByRole("article", { name: "Data Analyst 1" });
		expect(within(first).getByText("Matches 2 of 3 skills")).toBeTruthy();
		const second = screen.getByRole("article", { name: "Data Analyst 2" });
		expect(within(second).queryByText(/Matches/)).toBeNull();
	});

	it("says the day's searches are used up, with plans on the web", async () => {
		api.search.mockRejectedValue(
			new ORPCError("PLAN_LIMIT_REACHED", { status: 403, data: { limit: "jobSearchesPerDay", max: 3, used: 3 } }),
		);
		mount({ q: "data analyst" });
		expect(await screen.findByText(/You've reached today's search limit/)).toBeTruthy();
		expect(screen.getByRole("link", { name: "See plans" }).getAttribute("href")).toBe("/dashboard/settings/billing");
	});

	it("says new searches are limited when the server's budget is spent, without blaming the person", async () => {
		api.search.mockRejectedValue(new ORPCError("JOBS_BUDGET_LIMITED", { status: 503 }));
		mount({ q: "data analyst" });
		expect(await screen.findByText(/New searches are limited right now/)).toBeTruthy();
		expect(screen.queryByRole("link", { name: "See plans" })).toBeNull();
	});

	it("marks saved results given while searching is limited", async () => {
		api.search.mockResolvedValue(result({ budgetLimited: true, stale: true, fromCache: true }));
		mount({ q: "data analyst" });
		expect(await screen.findByText(/These are results saved earlier; try again tomorrow/)).toBeTruthy();
		expect(screen.getByRole("article", { name: "Data Analyst 1" })).toBeTruthy();
	});

	it("offers to clear filters when nothing matches", async () => {
		api.search.mockResolvedValue(result({ listings: [] }));
		const { onSearch } = mount({ q: "data analyst", country: "DE", visa: true, minPay: 80_000, arrangement: "remote" });
		expect(await screen.findByText("No jobs match yet.")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
		expect(onSearch).toHaveBeenCalledWith(
			expect.objectContaining({ q: "data analyst", country: "DE", visa: false, minPay: undefined, arrangement: "any" }),
		);
	});

	it("asks the search with remote, visa and pay filters as the address holds them", async () => {
		mount({ q: "data analyst", country: "GB", arrangement: "remote", visa: true, minPay: 60_000, noPay: false });
		await screen.findByRole("article", { name: "Data Analyst 1" });
		expect(api.search).toHaveBeenCalledWith(
			expect.objectContaining({
				query: "data analyst",
				country: "GB",
				remote: "only",
				visaSponsorship: true,
				salaryMin: 60_000,
				salaryCurrency: "GBP",
				includeNoSalary: false,
			}),
		);
	});

	it("keeps the country when Enter is pressed in its field", async () => {
		const { onSearch } = mount({ q: "data analyst", country: "GB" });
		await screen.findByRole("article", { name: "Data Analyst 1" });
		fireEvent.click(screen.getByRole("button", { name: "Filters · United Kingdom" }));
		const sheet = await screen.findByRole("dialog", { name: "Filters" });
		const country = within(sheet).getByRole("combobox", { name: "Country" });
		fireEvent.focus(country);
		fireEvent.keyDown(country, { key: "Enter" });
		fireEvent.keyUp(country, { key: "Enter" });
		fireEvent.click(within(sheet).getByRole("button", { name: "Search" }));
		expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ country: "GB" }));
	});

	it("hides a listing with undo", async () => {
		api.hide.mockResolvedValue({ hidden: true });
		mount({ q: "data analyst" });
		await screen.findByRole("article", { name: "Data Analyst 1" });
		fireEvent.click(screen.getByRole("button", { name: "More for Data Analyst 1" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: /Hide this job/ }));
		await waitFor(() => expect(screen.queryByRole("article", { name: "Data Analyst 1" })).toBeNull());
		expect(api.hide.mock.calls[0]?.[0]).toEqual({ id: "1", hidden: true });
	});

	it("offers a job alert for the search shown, and opens the one that already repeats it", async () => {
		mount({ q: "data analyst", country: "GB", arrangement: "remote", visa: true });
		fireEvent.click(await screen.findByRole("button", { name: "Get job alerts" }));
		const sheet = await screen.findByRole("dialog", { name: "Job alert" });
		expect(sheet.dataset.schedule).toBe("new:discovery");
		expect(JSON.parse(sheet.textContent ?? "")).toMatchObject({
			query: "data analyst",
			country: "GB",
			remote: "only",
			visaSponsorship: true,
		});
		cleanup();

		api.schedules.mockResolvedValue([
			{
				id: "alert-1",
				kind: "discovery",
				enabled: true,
				search: {
					query: "Data Analyst",
					country: "GB",
					remote: "only",
					postedWithinDays: 30,
					includeNoSalary: true,
					visaSponsorship: true,
				},
			},
		]);
		mount({ q: "data analyst", country: "GB", arrangement: "remote", visa: true });
		fireEvent.click(await screen.findByRole("button", { name: "Job alert on" }));
		expect((await screen.findByRole("dialog", { name: "Job alert" })).dataset.schedule).toBe("alert-1");
	});
});
