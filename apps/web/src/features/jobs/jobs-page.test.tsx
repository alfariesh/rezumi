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
			track: { mutationOptions: () => ({ mutationFn: api.track }) },
			hide: { mutationOptions: () => ({ mutationFn: api.hide }) },
		},
		applications: { saveLogo: { mutationOptions: () => ({ mutationFn: api.saveLogo }) } },
	},
}));
vi.mock("@/features/applications/use-application-actions", () => ({ useInvalidateApplications: () => api.invalidate }));
vi.mock("@/dialogs/store", () => ({
	useDialogStore: (select: (state: { openDialog: typeof api.openDialog }) => unknown) =>
		select({ openDialog: api.openDialog }),
}));
vi.mock("@rezumi/ui/hooks/use-breakpoint", () => ({ useBreakpoint: () => "desktop" }));
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
		expect(screen.getByDisplayValue("Leeds")).toBeTruthy();
		expect(api.search).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Midwife" }));
		expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ q: "Midwife", country: "GB", location: "Leeds" }));
	});

	it("shows results with the original posting link, and tracks one", async () => {
		api.track.mockResolvedValue({ applicationId: "app-1", created: true });
		mount({ q: "data analyst", country: "GB" });
		const item = await screen.findByRole("article", { name: "Data Analyst 1" });
		const original = within(item).getByRole("link", { name: /View original/ });
		expect(original.getAttribute("href")).toBe("https://jobs.example.com/1");
		expect(original.getAttribute("target")).toBe("_blank");
		expect(original.getAttribute("rel")).toBe("noopener noreferrer");
		expect(within(item).getByText(/via LinkedIn/)).toBeTruthy();
		expect(screen.getByText("14 searches left today (of 15)")).toBeTruthy();

		fireEvent.click(within(item).getByRole("button", { name: "Track" }));
		expect(await within(item).findByRole("link", { name: /Tracked/ })).toBeTruthy();
		expect(api.track.mock.calls[0]?.[0]).toEqual({ id: "1" });
		expect(api.invalidate).toHaveBeenCalled();
	});

	it("marks listings the person already tracks", async () => {
		api.search.mockResolvedValue(result({ tracked: { "1": "app-7" } }));
		mount({ q: "data analyst" });
		const item = await screen.findByRole("article", { name: "Data Analyst 1" });
		expect(within(item).getByRole("link", { name: /Tracked/ })).toBeTruthy();
		expect(within(item).queryByRole("button", { name: "Track" })).toBeNull();
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
		const country = screen.getByRole("combobox", { name: "Country" });
		fireEvent.focus(country);
		fireEvent.keyDown(country, { key: "Enter" });
		fireEvent.keyUp(country, { key: "Enter" });
		fireEvent.click(screen.getByRole("button", { name: "Search" }));
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
});
