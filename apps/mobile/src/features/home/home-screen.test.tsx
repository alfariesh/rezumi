// Home's states (plans/mobile Phase 03): loading, empty (first run), with content, failed, and offline with the last
// content kept. The reads are replaced by fixtures; the components and their wording are the real ones.
import { fireEvent, screen } from "@testing-library/react-native";
import { HomeScreen } from "./home-screen";
import { renderScreen } from "@/test/render-screen";

const mockNow = new Date("2026-11-21T09:00:00Z");

type Query = { data: unknown; isPending: boolean; isError: boolean; refetch: jest.Mock };
const query = (data: unknown, state: Partial<Query> = {}): Query => ({
	data,
	isPending: data === undefined && !state.isError,
	isError: false,
	refetch: jest.fn(() => Promise.resolve()),
	...state,
});

const mockReads: Record<string, Query> = {};
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, navigate: mockPush, setParams: jest.fn() }),
}));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => {
	const key = (...path: string[]) => ({ key: () => path, queryOptions: () => ({}) });
	return {
		client: { career: {}, applications: {} },
		orpc: {
			career: { key: () => ["career"], notifications: key("n"), schedules: key("s"), opportunities: key("o") },
			applications: { key: () => ["applications"] },
			documents: { key: () => ["documents"] },
			portfolio: { status: key("p") },
		},
	};
});
jest.mock("./queries", () => ({
	useNotifications: () => mockReads.notifications,
	useOpportunities: () => mockReads.opportunities,
	useSchedules: () => mockReads.schedules,
	useBriefings: () => mockReads.briefings,
}));
jest.mock("@/features/applications/queries", () => ({ useApplications: () => mockReads.applications }));
jest.mock("@/features/documents/queries", () => ({ useDocuments: () => mockReads.documents }));
jest.mock("@/features/settings/queries", () => ({ useProfile: () => ({ data: { timezone: "UTC" } }) }));
jest.mock("@/features/career/hooks", () => ({ useNow: () => mockNow }));
jest.mock("@/features/career/schedule-sheet", () => ({
	ScheduleSheet: () => null,
	scheduleTitle: (kind: string) => (kind === "discovery" ? "Opportunity discovery" : "Interview preparation"),
}));
jest.mock("@/features/documents/thumbnail", () => ({ Thumbnail: () => null }));
jest.mock("@/shell/tab-chrome", () => {
	const { Text } = jest.requireActual("react-native");
	return { TabTopBar: ({ title }: { title: string }) => <Text>{title}</Text>, NewFab: () => null };
});
jest.mock("@/shell/use-is-tablet", () => ({ useIsTablet: () => false }));
// Handing a new account over to onboarding has its own tests (features/onboarding).
jest.mock("@/features/onboarding/use-onboarding-redirect", () => ({ useOnboardingRedirect: () => undefined }));

const application = {
	id: "app_1",
	company: "Acme",
	role: "Designer",
	status: "interview",
	activity: [{ type: "interview", id: "int_1", kind: "technical", at: "2026-11-22T10:00:00Z", durationMinutes: 45 }],
};
const notification = {
	id: "n_1",
	title: "Posting closed",
	body: "Acme closed the Designer posting before you applied.",
	notice: { type: "posting-closed", company: "Acme", role: "Designer" },
	url: "/dashboard/applications/app_1",
	applicationId: "app_1",
	readAt: null,
	createdAt: "2026-11-21T08:00:00Z",
};
const opportunity = {
	id: "o_1",
	role: "Product designer",
	company: "Globex",
	location: "Jakarta",
	url: "https://jobs.example.com/1",
	snippet: "Design the next thing.",
	matches: ["Remote"],
	unknowns: ["salary"],
	firstSeenAt: "2026-11-21T07:00:00Z",
	trackedApplicationId: null,
	listing: null,
};
const schedule = {
	id: "s_1",
	kind: "discovery",
	query: "Product designer",
	search: null,
	enabled: true,
	intervalDays: 1,
	lastQueuedAt: null,
	nextRunAt: "2026-11-22T07:00:00Z",
	timezone: "UTC",
	createdAt: "2026-11-01T00:00:00Z",
	applicationId: null,
	interviewId: null,
	lead: null,
	email: false,
	aiProviderId: null,
};
const document = { id: "d_1", type: "resume", name: "Design resume", updatedAt: new Date("2026-11-20T00:00:00Z") };

function setReads(values: Partial<Record<string, Query>>) {
	Object.assign(mockReads, {
		notifications: query(undefined),
		opportunities: query(undefined),
		schedules: query(undefined),
		briefings: query(undefined),
		applications: query(undefined),
		documents: query(undefined),
		...values,
	});
}

describe("HomeScreen", () => {
	beforeEach(() => mockPush.mockClear());

	it("shows skeletons in the shape of each block while loading", async () => {
		setReads({});
		await renderScreen(<HomeScreen />);
		expect(screen.getByText("Home")).toBeOnTheScreen();
		expect(screen.getAllByLabelText("Loading").length).toBeGreaterThan(0);
		expect(screen.queryByText("Let's start with what you have")).toBeNull();
	});

	it("offers bringing in details or starting a document to an account without any, and says each block is empty", async () => {
		setReads({
			notifications: query([]),
			opportunities: query([]),
			schedules: query([]),
			briefings: query([]),
			applications: query([]),
			documents: query([]),
		});
		await renderScreen(<HomeScreen />);
		expect(screen.getByText("Let's start with what you have")).toBeOnTheScreen();
		expect(
			screen.getByText("You're up to date. New roles, reminders and finished briefings appear here."),
		).toBeOnTheScreen();
		expect(screen.getByText("Get new jobs for your search here every morning")).toBeOnTheScreen();
		expect(screen.getByText("Nothing scheduled yet.")).toBeOnTheScreen();
		expect(screen.queryByText("Coming up")).toBeNull();
		await fireEvent.press(screen.getByText("Bring in my details"));
		expect(mockPush).toHaveBeenCalledWith("/onboarding");
		await fireEvent.press(screen.getByText("Start a document"));
		expect(mockPush).toHaveBeenCalledWith("/new");
	});

	it("shows what needs the person, new roles, the next interview, schedules and recent documents", async () => {
		setReads({
			notifications: query([notification]),
			opportunities: query([opportunity]),
			schedules: query([schedule]),
			briefings: query([{ interviewId: "int_1" }]),
			applications: query([application]),
			documents: query([document]),
		});
		await renderScreen(<HomeScreen />);
		expect(screen.getByText("Posting closed")).toBeOnTheScreen();
		expect(screen.getByText("Design the next thing.")).toBeOnTheScreen();
		expect(screen.getByText("Technical interview")).toBeOnTheScreen();
		expect(screen.getByText("Briefing ready")).toBeOnTheScreen();
		expect(screen.getByText("Opportunity discovery")).toBeOnTheScreen();
		expect(screen.getByText("Design resume")).toBeOnTheScreen();
		expect(screen.queryByText("Let's start with what you have")).toBeNull();
		// A closed posting opens its application through the deep-link map.
		await fireEvent.press(screen.getByText("Open"));
		expect(mockPush).toHaveBeenCalledWith("/applications/app_1/fit");
	});

	it("keeps the page usable when a read fails, with a retry per block", async () => {
		const failed = query(undefined, { isError: true });
		setReads({
			notifications: failed,
			opportunities: query([]),
			schedules: query([]),
			briefings: query([]),
			applications: query([]),
			documents: query([document]),
		});
		await renderScreen(<HomeScreen />);
		expect(screen.getByText("Couldn't load this. Check your connection.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Retry"));
		expect(failed.refetch).toHaveBeenCalled();
		expect(screen.getByText("Design resume")).toBeOnTheScreen();
	});

	it("shows the last content offline, while refetches are paused", async () => {
		const paused = (data: unknown) => query(data, { isPending: false });
		setReads({
			notifications: paused([notification]),
			opportunities: paused([]),
			schedules: paused([schedule]),
			briefings: paused([]),
			applications: paused([application]),
			documents: paused([document]),
		});
		await renderScreen(<HomeScreen />);
		expect(screen.getByText("Posting closed")).toBeOnTheScreen();
		expect(screen.queryAllByLabelText("Loading")).toHaveLength(0);
	});
});
