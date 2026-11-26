// The calendar (plans/mobile Phase 10): interviews land on the day and time of the user's clock (a profile time zone
// west of UTC here), a drag or a screen-reader action reschedules, tapping an interview opens its sheet, a follow-up
// opens its application, and scheduling from the calendar starts by picking the application.
import type { ApplicationSummary } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { ApplicationPickerList } from "./application-picker";
import { CalendarBody } from "./calendar-view";
import { useApplications } from "@/features/applications/queries";
import { renderScreen } from "@/test/render-screen";

const mockOpen = jest.fn();
const mockReschedule = jest.fn();

jest.mock("@/features/applications/queries", () => ({ useApplications: jest.fn() }));
jest.mock("@/features/account/queries", () => ({ useProfile: () => ({ data: { timezone: "America/Los_Angeles" } }) }));
jest.mock("@/features/applications/frame", () => ({ useOpenApplication: () => mockOpen }));
jest.mock("@/shell/use-is-tablet", () => ({ useIsTablet: () => false }));
jest.mock("@/features/applications/interview/use-reschedule", () => ({ useRescheduleInterview: () => mockReschedule }));
// Noon on Monday 23 November in Los Angeles (20:00 UTC).
jest.mock("@/features/career/hooks", () => ({ useNow: () => new Date("2026-11-23T20:00:00Z") }));
jest.mock("@/features/applications/interview-sheet", () => ({
	InterviewSheet: (props: {
		applicationId: string;
		interview?: { id: string } | null;
		initial?: { date: string; time: string };
		isOpen: boolean;
	}) => {
		const { Text: MockText } = jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<MockText>{`sheet ${props.applicationId} ${props.interview?.id ?? "new"} ${props.isOpen ? "open" : "closed"}`}</MockText>
		);
	},
}));

const interview: InterviewTimelineEntry = {
	id: "i1",
	type: "interview",
	// 18:00 on Monday 23 November in Los Angeles; already Tuesday in UTC.
	at: new Date("2026-11-24T02:00:00Z"),
	kind: "technical",
	durationMinutes: 60,
	location: "Video call",
	notes: "",
	audience: "other",
	timezone: "America/Los_Angeles",
	participants: [],
} as unknown as InterviewTimelineEntry;

const application = (overrides: Partial<ApplicationSummary>) =>
	({
		id: "a",
		role: "Product designer",
		company: "Acme",
		location: null,
		status: "interview",
		closedReason: null,
		activity: [],
		appliedAt: new Date("2026-11-01T12:00:00Z"),
		updatedAt: new Date("2026-11-01T12:00:00Z"),
		followUpAt: null,
		followUpNote: null,
		tags: [],
		contacts: [],
		resumeId: null,
		source: null,
		...overrides,
	}) as ApplicationSummary;

const rows = [
	application({ id: "a", activity: [interview] }),
	// Follow-ups are stored at 09:00 on the user's clock: Wednesday 25 November.
	application({ id: "b", company: "Globex", status: "applied", followUpAt: new Date("2026-11-25T17:00:00Z") }),
];

beforeEach(() => {
	jest.mocked(useApplications).mockReturnValue({
		data: rows,
		isPending: false,
		isError: false,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useApplications>);
});
afterEach(() => jest.clearAllMocks());

describe("Calendar week on a phone", () => {
	it("shows three days from today, with the interview on the user's day and time", async () => {
		await renderScreen(<CalendarBody />);
		expect(screen.getByTestId("day-column-2026-11-23")).toBeOnTheScreen();
		expect(screen.getByTestId("day-column-2026-11-25")).toBeOnTheScreen();
		expect(screen.queryByTestId("day-column-2026-11-26")).toBeNull();
		const event = within(screen.getByTestId("day-column-2026-11-23")).getByTestId("grid-event-i1");
		expect(
			within(event).getByLabelText(/^Technical interview, Acme, Product designer, .*18:00 – 19:00$/),
		).toBeOnTheScreen();
		expect(within(screen.getByTestId("day-column-2026-11-24")).queryByTestId("grid-event-i1")).toBeNull();
		expect(screen.getByText("1 interview")).toBeOnTheScreen();
	});

	it("reschedules from the screen-reader actions", async () => {
		await renderScreen(<CalendarBody />);
		const event = screen.getByLabelText(/^Technical interview, Acme/);
		const names = (event.props.accessibilityActions as { name: string }[]).map((action) => action.name);
		expect(names).toEqual(["activate", "reschedule", "earlier", "later", "previous-day", "next-day"]);
		await fireEvent(event, "accessibilityAction", { nativeEvent: { actionName: "later" } });
		expect(mockReschedule).toHaveBeenCalledWith(
			expect.objectContaining({ kind: "interview", id: "interview:i1" }),
			new Date("2026-11-24T02:15:00Z"),
			60,
		);
		await fireEvent(event, "accessibilityAction", { nativeEvent: { actionName: "next-day" } });
		expect(mockReschedule).toHaveBeenLastCalledWith(expect.anything(), new Date("2026-11-25T02:00:00Z"), 60);
	});

	it("reschedules when an interview is dragged two hours later", async () => {
		await renderScreen(<CalendarBody />);
		fireGestureHandler(getByGestureTestId("grid-drag-interview:i1"), [
			{ state: State.BEGAN, translationX: 0, translationY: 0 },
			{ state: State.ACTIVE, translationX: 0, translationY: 0 },
			{ state: State.ACTIVE, translationX: 0, translationY: 96 },
			{ state: State.END, translationX: 0, translationY: 96 },
		]);
		// 20:00 in Los Angeles is 04:00 the next day in UTC.
		await waitFor(() =>
			expect(mockReschedule).toHaveBeenCalledWith(expect.anything(), new Date("2026-11-24T04:00:00Z"), 60),
		);
	});

	it("opens the interview's sheet on tap, and a follow-up's application", async () => {
		await renderScreen(<CalendarBody />);
		await fireEvent.press(screen.getByLabelText(/^Technical interview, Acme/));
		expect(screen.getByText("sheet a i1 open")).toBeOnTheScreen();
		await fireEvent.press(screen.getByLabelText(/^Follow up: Globex, Wednesday/));
		expect(mockOpen).toHaveBeenCalledWith("b");
	});

	it("lists what's coming up, with Reschedule on each interview", async () => {
		await renderScreen(<CalendarBody />);
		expect(screen.getByText("Coming up")).toBeOnTheScreen();
		// Today's interview, then Wednesday's follow-up.
		expect(screen.getByText("Wednesday, November 25")).toBeOnTheScreen();
		await fireEvent.press(screen.getAllByText("Reschedule…")[0] as never);
		expect(screen.getByText("sheet a i1 open")).toBeOnTheScreen();
	});
});

describe("ApplicationPickerList", () => {
	it("asks which application a new interview is for", async () => {
		const onPick = jest.fn();
		await renderScreen(<ApplicationPickerList applications={rows} when="Wed 25 Nov, 10:00" onPick={onPick} />);
		expect(screen.getByText("For Wed 25 Nov, 10:00. Which application is it for?")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("calendar-pick-b"));
		expect(onPick).toHaveBeenCalledWith("b");
	});
});
