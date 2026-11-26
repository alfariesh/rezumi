// Insights (plans/mobile Phase 10): the figures from a fixture list (funnel, heard back, median, tailored against base,
// the weekly summary, sources), and the loading, empty, error and offline states. The chart's canvas is native only.
import { fireEvent, screen } from "@testing-library/react-native";
import { InsightsBody } from "./insights-screen";
import { renderScreen } from "@/test/render-screen";

const mockReplace = jest.fn();
const mockRefetch = jest.fn(() => Promise.resolve());
let mockApplications: Record<string, unknown> = {};
let mockDocuments: unknown[] | undefined = [];
let mockOnline = true;

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace }) }));
jest.mock("heroui-native-pro/bar-chart", () => ({ BarChart: Object.assign(() => null, { Bar: () => null }) }));
jest.mock("@/features/applications/queries", () => ({ useApplications: () => mockApplications }));
jest.mock("@/features/documents/queries", () => ({
	useDocuments: () => ({ data: mockDocuments, refetch: mockRefetch }),
}));
jest.mock("@/features/account/queries", () => ({ useProfile: () => ({ data: { timezone: "UTC" } }) }));
jest.mock("@/features/career/hooks", () => ({ useNow: () => new Date("2026-11-22T09:00:00Z") }));
jest.mock("@/api/online", () => ({ useOnline: () => mockOnline }));
jest.mock("@/shell/use-is-tablet", () => ({ useIsTablet: () => false }));

const stage = (name: string, at: string) => ({ type: "stage", stage: name, at: `${at}T10:00:00Z` });
const application = (id: string, extra: Record<string, unknown>) => ({
	id,
	status: "applied",
	closedReason: null,
	resumeId: null,
	source: null,
	appliedAt: "2026-11-01T10:00:00Z",
	activity: [],
	...extra,
});

const list = [
	// Replied after 2 days, sent with a resume made for it.
	application("a1", {
		status: "screening",
		resumeId: "r1",
		source: "LinkedIn",
		activity: [stage("applied", "2026-11-18"), stage("screening", "2026-11-20")],
	}),
	// Replied after 4 days and reached Interview.
	application("a2", {
		status: "interview",
		source: "LinkedIn",
		activity: [stage("applied", "2026-11-10"), stage("screening", "2026-11-14"), stage("interview", "2026-11-16")],
	}),
	// No reply yet, sent with another resume.
	application("a3", { resumeId: "r2", source: "Referral", activity: [stage("applied", "2026-11-21")] }),
	// Saved, never sent.
	application("a4", { status: "saved", activity: [stage("saved", "2026-11-21")] }),
	// Turned down after 6 days: a reply too.
	application("a5", {
		status: "closed",
		closedReason: "not-selected",
		activity: [stage("applied", "2026-11-03"), stage("closed", "2026-11-09")],
	}),
];

beforeEach(() => {
	mockOnline = true;
	mockDocuments = [
		{ id: "r1", application: { id: "a1", company: "Northstar", role: "Designer" } },
		{ id: "r2", application: null },
	];
	mockApplications = { data: list, isError: false, isPending: false, refetch: mockRefetch };
	jest.clearAllMocks();
});

describe("Insights", () => {
	it("works out the funnel, replies, tailored resumes, weeks and sources from the list", async () => {
		await renderScreen(<InsightsBody />);
		expect(screen.getByLabelText("Heard back, 75%, 3 of 4 sent")).toBeTruthy();
		expect(screen.getByLabelText("Median to first reply, 4 days")).toBeTruthy();
		expect(screen.getByLabelText("Applied: 4")).toBeTruthy();
		expect(screen.getByLabelText("Screening: 2")).toBeTruthy();
		expect(screen.getByLabelText("Interview: 1")).toBeTruthy();
		expect(screen.getByLabelText("Offer: 0")).toBeTruthy();
		expect(
			screen.getByText(
				"1 of 1 tailored applications got a reply; 0 of 1 sent with another resume. Small numbers, but worth noticing.",
			),
		).toBeTruthy();
		expect(
			screen.getByRole("image", {
				name: "Applications sent per week: Oct 4: 0, Oct 11: 0, Oct 18: 0, Oct 25: 0, Nov 1: 1, Nov 8: 1, Nov 15: 2, Nov 22: 0",
			}),
		).toBeTruthy();
		expect(screen.getByLabelText("LinkedIn: 2")).toBeTruthy();
		expect(screen.getByLabelText("Referral: 1")).toBeTruthy();
		expect(screen.getByRole("image", { name: "Pipeline flow" })).toBeTruthy();
		expect(screen.getByText("Applied → Screening: 2 (67%)")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Share picture" })).toBeTruthy();
	});

	it("leaves tailored against base out until the documents list is in", async () => {
		mockDocuments = undefined;
		await renderScreen(<InsightsBody />);
		expect(screen.queryByText("Tailored vs. base resume")).toBeNull();
	});

	it("explains what shows once applications are sent", async () => {
		mockApplications = { ...mockApplications, data: [list[3]] };
		await renderScreen(<InsightsBody />);
		expect(screen.getByText("Nothing to measure yet")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Open applications" }));
		expect(mockReplace).toHaveBeenCalledWith("/applications");
	});

	it("shows a skeleton while loading, and Retry when the list fails", async () => {
		mockApplications = { data: undefined, isError: false, isPending: true, refetch: mockRefetch };
		const view = await renderScreen(<InsightsBody />);
		expect(screen.getByLabelText("Loading insights")).toBeTruthy();
		await view.unmount();

		mockApplications = { data: undefined, isError: true, isPending: false, refetch: mockRefetch };
		await renderScreen(<InsightsBody />);
		expect(screen.getByText("Couldn't load your applications")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
		expect(mockRefetch).toHaveBeenCalled();
	});

	it("says it's offline when nothing has loaded, and keeps the last figures when a refresh fails", async () => {
		mockOnline = false;
		mockApplications = { data: undefined, isError: false, isPending: true, refetch: mockRefetch };
		const view = await renderScreen(<InsightsBody />);
		expect(screen.getByText("You're offline")).toBeTruthy();
		await view.unmount();

		mockApplications = { data: list, isError: true, isPending: false, refetch: mockRefetch };
		await renderScreen(<InsightsBody />);
		expect(screen.getByText("Couldn't refresh. These figures are from the last update.")).toBeTruthy();
		expect(screen.getByLabelText("Applied: 4")).toBeTruthy();
	});
});
