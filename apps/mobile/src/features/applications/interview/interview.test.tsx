// The interview sheet's body (plans/mobile Phase 10): a new interview saves at the tapped slot on the user's clock,
// turning the reminder on asks for notifications and schedules it on save, an edit keeps the stored interview's id,
// and deleting removes the interview and cancels its reminder.
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { View } from "react-native";
import { InterviewFields } from "./interview-fields";
import { useInterviewEditor } from "./use-interview-editor";
import { InterviewFooter } from "@/features/applications/interview-sheet";
import { renderScreen } from "@/test/render-screen";

const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock("@/api/client", () => {
	const options = (call: (input: unknown) => unknown) => ({
		mutationOptions: () => ({ mutationFn: (input: unknown) => Promise.resolve(call(input)) }),
	});
	return {
		orpc: {
			applications: {
				addInterview: options((input) => mockAdd(input)),
				updateInterview: options((input) => mockUpdate(input)),
				deleteTimelineEntry: options((input) => mockDelete(input)),
			},
		},
	};
});
jest.mock("@/features/applications/queries", () => ({
	...jest.requireActual("@/features/applications/queries"),
	useInvalidateApplications: () => () => Promise.resolve(),
}));
jest.mock("@/features/settings/queries", () => ({ useProfile: () => ({ data: { timezone: "America/Los_Angeles" } }) }));
jest.mock("expo-notifications", () => ({
	getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true, status: "granted" })),
	requestPermissionsAsync: jest.fn(),
	getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
	scheduleNotificationAsync: jest.fn(() => Promise.resolve("id")),
	cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
	setNotificationChannelAsync: jest.fn(),
	SchedulableTriggerInputTypes: { DATE: "date" },
	AndroidImportance: { HIGH: 4 },
}));

const interview = {
	id: "i1",
	type: "interview",
	at: new Date("2030-01-15T18:00:00Z"),
	kind: "screening",
	durationMinutes: 45,
	location: "",
	notes: "",
	audience: "other",
	timezone: "America/Los_Angeles",
	participants: [],
} as unknown as InterviewTimelineEntry;

const application = { id: "a", role: "Product designer", company: "Acme", activity: [] as InterviewTimelineEntry[] };

type HarnessProps = {
	interview?: InterviewTimelineEntry | null;
	initial?: { date: string; time: string };
	onDone: () => void;
};

function Harness({ interview: editing, initial, onDone }: HarnessProps) {
	const editor = useInterviewEditor({
		application: editing ? { ...application, activity: [editing] } : application,
		interview: editing,
		initial,
		onDone,
	});
	return (
		<View>
			<InterviewFields editor={editor} onDelete={() => void editor.remove()} />
			<InterviewFooter editor={editor} />
		</View>
	);
}

// Finished mutations would wait five minutes in the cache (keeping Jest alive); here they stay for good instead.
const render = async (ui: Parameters<typeof renderScreen>[0]) => {
	const rendered = await renderScreen(ui);
	rendered.queryClient.setDefaultOptions({
		queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
		mutations: { gcTime: Number.POSITIVE_INFINITY },
	});
	await rendered.rerender(ui);
	return rendered;
};

afterEach(() => jest.clearAllMocks());

describe("Interview sheet", () => {
	it("saves a new interview at the tapped slot on the user's clock, without a reminder", async () => {
		mockAdd.mockReturnValue({ ...application, activity: [{ ...interview, id: "new1", at: "2030-01-15T18:00:00Z" }] });
		const onDone = jest.fn();
		await render(<Harness initial={{ date: "2030-01-15", time: "10:00" }} onDone={onDone} />);
		expect(screen.getByText("Product designer · Acme")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Technical"));
		await fireEvent.changeText(screen.getByLabelText("Location"), "Video call");
		await fireEvent.press(screen.getByTestId("interview-save"));
		await waitFor(() => expect(onDone).toHaveBeenCalled());
		expect(mockAdd).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "a",
				at: "2030-01-15T18:00:00.000Z",
				kind: "technical",
				durationMinutes: 60,
				location: "Video call",
				timezone: "America/Los_Angeles",
			}),
		);
		expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
	});

	it("asks for notifications when the reminder is turned on, and schedules it on save", async () => {
		mockAdd.mockReturnValue({ ...application, activity: [{ ...interview, id: "new1" }] });
		const onDone = jest.fn();
		await render(<Harness initial={{ date: "2030-01-15", time: "10:00" }} onDone={onDone} />);
		await fireEvent(screen.getByLabelText("Remind me on this device"), "selectedChange", true);
		await waitFor(() => expect(Notifications.getPermissionsAsync).toHaveBeenCalled());
		expect(screen.getByText("Before the interview")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("1 h"));
		await fireEvent.press(screen.getByTestId("interview-save"));
		await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled());
		expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				identifier: "interview:new1",
				trigger: expect.objectContaining({ date: new Date("2030-01-15T17:00:00Z") }),
			}),
		);
		expect(onDone).toHaveBeenCalled();
	});

	it("updates the stored interview, keeping its id and time", async () => {
		mockUpdate.mockReturnValue({ ...application, activity: [{ ...interview, kind: "technical" }] });
		const onDone = jest.fn();
		await render(<Harness interview={interview} onDone={onDone} />);
		expect(screen.getByRole("button", { name: /^Time, 10:00/ })).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Technical"));
		await fireEvent.press(screen.getByTestId("interview-save"));
		await waitFor(() => expect(onDone).toHaveBeenCalled());
		expect(mockUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "a",
				entryId: "i1",
				at: "2030-01-15T18:00:00.000Z",
				kind: "technical",
				durationMinutes: 45,
			}),
		);
	});

	it("deletes the interview and cancels its reminder", async () => {
		mockDelete.mockReturnValue({ ...application, activity: [] });
		const onDone = jest.fn();
		await render(<Harness interview={interview} onDone={onDone} />);
		expect(screen.getByText("Add to calendar")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("interview-delete"));
		await waitFor(() => expect(onDone).toHaveBeenCalled());
		expect(mockDelete).toHaveBeenCalledWith({ id: "a", entryId: "i1" });
		expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("interview:i1");
	});

	it("can't save a time that doesn't exist on the interview's clock", async () => {
		// 02:30 on 10 March 2030 is skipped in Los Angeles (clocks go forward).
		await render(<Harness initial={{ date: "2030-03-10", time: "02:30" }} onDone={jest.fn()} />);
		expect(screen.getByText("This time doesn't exist in that time zone. Choose another time.")).toBeOnTheScreen();
		expect(screen.getByTestId("interview-save")).toBeDisabled();
	});
});
