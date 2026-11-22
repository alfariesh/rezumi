// Jobs' states (plans/mobile Phase 09): not on this server, before the first search, results with a tracked card and a
// skills match, no match, today's limit (neutral, no plan or price), the server's budget, offline with the last
// results, and tracking a listing from its sheet. The search state is a fixture; the components are the real ones.
import type { JobListingCard, JobSearchResult } from "@rezumi/schema/jobs/search";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { ORPCError } from "@orpc/client";
import { jobsSearchSchema } from "@rezumi/career/jobs";
import { JobsScreen } from "./jobs-screen";
import { ListingDetail } from "./listing-detail";
import { useListingActions } from "./use-listing-actions";
import { renderScreen } from "@/test/render-screen";

const mockPush = jest.fn();
const mockTrack = jest.fn();
const mockShowToast = jest.fn();
let mockJobs: Record<string, unknown> = {};

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock("@/ui", () => ({ ...jest.requireActual("@/ui"), showToast: (options: unknown) => mockShowToast(options) }));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => ({
	client: {
		jobs: { track: (input: unknown) => mockTrack(input), hide: jest.fn() },
		applications: { saveLogo: jest.fn() },
	},
	orpc: { career: { schedules: { key: () => ["s"] } }, jobs: { recent: { key: () => ["recent"] } } },
}));
jest.mock("./use-jobs", () => ({ useJobs: () => mockJobs }));
jest.mock("./queries", () => ({
	useListing: () => ({ data: { description: "Design the payments flow.\n\nWork with research." }, isError: false }),
	useListingFit: () => ({ data: { fit: null, outdated: false }, isPending: false }),
	listingFitKey: () => ["fit"],
	isGone: () => false,
}));
jest.mock("@/features/applications/queries", () => ({ useInvalidateApplications: () => () => Promise.resolve() }));
jest.mock("@/features/home/queries", () => ({ useSchedules: () => ({ data: [] }) }));
jest.mock("@/features/ai/providers", () => ({
	useHasAIProvider: () => ({ hasAIProvider: true, isLoading: false, defaultProvider: { label: "Claude" } }),
}));
jest.mock("@/features/ai/report-content", () => ({ ReportAiContent: () => null }));
jest.mock("@/features/career/hooks", () => ({ useNow: () => new Date("2026-11-22T09:00:00Z") }));
jest.mock("@/features/career/schedule-sheet", () => ({ ScheduleSheet: () => null }));
jest.mock("@/features/applications/add-sheet", () => ({ AddApplicationSheet: () => null }));
jest.mock("@/features/applications-board/views-row", () => ({ ApplicationsViewsRow: () => null }));
jest.mock("@/shell/tab-chrome", () => {
	const { Text } = jest.requireActual("react-native");
	return { TabTopBar: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock("@/shell/use-is-tablet", () => ({ useIsTablet: () => false }));

const listing = (id: string, title: string, extra: Partial<JobListingCard> = {}): JobListingCard =>
	({
		id,
		title,
		company: { name: "Northstar Labs", logoUrl: undefined },
		location: { text: "Berlin, Germany" },
		postingUrl: `https://careers.example.com/${id}`,
		source: "greenhouse",
		skills: ["Figma", "Research"],
		postedAt: "2026-11-21T08:00:00Z",
		workArrangement: "hybrid",
		salary: { min: 60_000, max: 78_000, currency: "EUR", period: "year" },
		...extra,
	}) as unknown as JobListingCard;

const page = (listings: JobListingCard[], extra: Partial<JobSearchResult> = {}): JobSearchResult => ({
	listings,
	fetchedAt: "2026-11-22T08:58:00Z",
	fromCache: false,
	stale: false,
	budgetLimited: false,
	quota: { used: 2, max: 40, resetsAt: "2026-11-23T00:00:00Z" },
	tracked: {},
	matches: {},
	...extra,
});

const testNow = new Date("2026-11-22T09:00:00Z");
const search = jobsSearchSchema.parse({ q: "Product designer", country: "DE" });

function jobs(state: Record<string, unknown> = {}) {
	const pages = (state.pages as JobSearchResult[] | undefined) ?? [];
	const all = pages.flatMap((item) => item.listings);
	return {
		search: null,
		request: null,
		form: jobsSearchSchema.parse({}),
		setDraft: jest.fn(),
		submit: jest.fn(),
		restart: jest.fn(),
		resuming: false,
		quota: { data: { available: true, cacheOnly: false, quota: { used: 2, max: 40, resetsAt: "x" } } },
		defaults: { data: { query: "", location: "", country: "DE", remote: "any", suggestions: ["Product designer"] } },
		recent: { searches: [], isPending: false, forget: jest.fn(), clear: jest.fn() },
		results: { isPending: false, isFetching: false, isFetchingNextPage: false, hasNextPage: false, error: null },
		last: pages.at(-1),
		listings: all,
		tracked: Object.assign({}, ...pages.map((item) => item.tracked)),
		matches: Object.assign({}, ...pages.map((item) => item.matches)),
		online: true,
		offlineCopy: null,
		...state,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
});

describe("JobsScreen", () => {
	it("says job search isn't on this server and offers to save a job instead", async () => {
		mockJobs = jobs({ quota: { data: { available: false, cacheOnly: false, quota: { used: 0, max: 0 } } } });
		await renderScreen(<JobsScreen />);
		expect(screen.getByText("Job search isn't available here yet")).toBeTruthy();
		expect(screen.getByText("Save a job")).toBeTruthy();
		expect(screen.queryByTestId("jobs-query")).toBeNull();
	});

	it("starts with the roles from the preferences as one-press searches", async () => {
		const submit = jest.fn();
		mockJobs = jobs({ submit });
		await renderScreen(<JobsScreen />);
		expect(screen.getByText("Find jobs that fit")).toBeTruthy();
		expect(screen.getByText("38 searches left today (of 40)")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("jobs-suggestion-Product designer"));
		expect(submit).toHaveBeenCalledWith(expect.objectContaining({ q: "Product designer" }));
	});

	it("shows the results with what each states, its skills match and whether it's tracked", async () => {
		mockJobs = jobs({
			search,
			request: { query: "Product designer" },
			pages: [
				page([listing("l1", "Product designer"), listing("l2", "Senior Product designer")], {
					tracked: { l2: "app_2" },
					matches: { l1: { matched: ["Figma"], missing: ["Research"] } },
				}),
			],
		});
		await renderScreen(<JobsScreen />);
		expect(screen.getByText("Product designer")).toBeTruthy();
		expect(screen.getByText("Matches 1 of 2 skills")).toBeTruthy();
		// Hermes writes €60,000, Node €60K: the pay is the provider's, in its own currency.
		expect(screen.getAllByText(/^€60.*a year$/).length).toBeGreaterThan(0);
		expect(screen.getByText("Tracked")).toBeTruthy();
		expect(screen.getByText("2 jobs · updated 2 min ago")).toBeTruthy();
		expect(screen.getByText("Get job alerts")).toBeTruthy();
	});

	it("offers to clear the filters when nothing matches", async () => {
		const submit = jest.fn();
		mockJobs = jobs({
			search: { ...search, visa: true },
			request: { query: "Product designer" },
			pages: [page([])],
			submit,
		});
		await renderScreen(<JobsScreen />);
		expect(screen.getByText("No jobs match yet.")).toBeTruthy();
		await fireEvent.press(screen.getByText("Clear filters"));
		expect(submit).toHaveBeenCalledWith(expect.objectContaining({ visa: false, q: "Product designer" }));
	});

	it("explains today's limit neutrally, without plans or prices", async () => {
		mockJobs = jobs({
			search,
			request: { query: "Product designer" },
			results: {
				isPending: true,
				isFetching: false,
				isError: true,
				isFetchingNextPage: false,
				hasNextPage: false,
				error: new ORPCError("PLAN_LIMIT_REACHED", { data: { limit: "jobSearchesPerDay" } }),
			},
		});
		await renderScreen(<JobsScreen />);
		expect(screen.getByText(/You've reached today's search limit/)).toBeTruthy();
		expect(screen.queryByText(/plan/i)).toBeNull();
	});

	it("says when only saved results can be shown", async () => {
		mockJobs = jobs({
			search,
			request: { query: "Product designer" },
			pages: [page([listing("l1", "Product designer")], { budgetLimited: true })],
		});
		await renderScreen(<JobsScreen />);
		expect(screen.getByText(/New searches are limited right now/)).toBeTruthy();
	});

	it("shows the last results kept on this device when offline", async () => {
		const pages = [page([listing("l1", "Product designer")])];
		mockJobs = jobs({ online: false, pages, offlineCopy: { search, pages, savedAt: "2026-11-21T08:00:00Z" } });
		await renderScreen(<JobsScreen />);
		expect(screen.getByTestId("jobs-offline-copy")).toBeTruthy();
		expect(screen.getByText("Product designer")).toBeTruthy();
	});

	it("tracks a listing from its detail, keeping View original, and tailors a resume for it", async () => {
		mockTrack.mockResolvedValue({ applicationId: "app_9", created: true });
		const onTailor = jest.fn();
		function Detail() {
			const actions = useListingActions({}, { onTailor });
			return (
				<ListingDetail listing={listing("l1", "Product designer")} match={undefined} actions={actions} now={testNow} />
			);
		}
		await renderScreen(<Detail />);
		expect(screen.getByText("Design the payments flow.\n\nWork with research.")).toBeTruthy();
		expect(screen.getByTestId("job-original")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("job-track"));
		await waitFor(() => expect(mockTrack).toHaveBeenCalledWith({ id: "l1" }));
		await waitFor(() => expect(screen.getByTestId("job-tracked")).toBeTruthy());
		expect(mockShowToast).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Tracking Product designer at Northstar Labs" }),
		);
		await fireEvent.press(screen.getByText("Tailor resume"));
		await waitFor(() => expect(onTailor).toHaveBeenCalledWith("app_9"));
		// Tracked once: Tailor reuses the application.
		expect(mockTrack).toHaveBeenCalledTimes(1);
	});
});
