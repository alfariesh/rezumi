// Turning a schedule on or off on Home (plans/mobile Phase 03): the switch flips at once in the one shared cache copy,
// and a failed save puts it back. The real Home queries run against a fixture API.
import type { HomeTime } from "./time";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Schedules } from "./schedules";
import { renderScreen } from "@/test/render-screen";

const mockSave = jest.fn();
const mockShowToast = jest.fn();
const mockFetch = jest.fn();

jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => ({
	client: { career: { saveSchedule: (input: unknown) => mockSave(input) } },
	orpc: {
		career: {
			schedules: {
				key: () => [["career", "schedules"], {}],
				queryOptions: () => ({ queryKey: [["career", "schedules"], { input: {} }], queryFn: () => mockFetch() }),
			},
		},
	},
}));
jest.mock("@/features/applications/queries", () => ({ useApplications: () => ({ data: [] }) }));
jest.mock("@/features/career/schedule-sheet", () => ({ scheduleTitle: () => "Opportunity discovery" }));
jest.mock("@/ui", () => ({ ...jest.requireActual("@/ui"), showToast: (options: unknown) => mockShowToast(options) }));

const time = {
	when: () => "22 Nov 2026, 07:00",
	time: () => "07:00",
	day: () => "Sun, 22 Nov",
} as unknown as HomeTime;

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

const toggle = () => screen.getByRole("switch", { name: "Opportunity discovery, Product designer" });

describe("Schedules", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockFetch.mockResolvedValue([schedule]);
	});

	it("pauses a schedule at once, before the server answers, and names the row in its labels", async () => {
		let answer: (value: unknown) => void = () => {};
		mockSave.mockReturnValue(new Promise((resolve) => (answer = resolve)));
		await renderScreen(<Schedules time={time} deleted={[]} onOpenSchedule={jest.fn()} />);
		expect(await screen.findByRole("button", { name: "Edit Opportunity discovery, Product designer" })).toBeTruthy();
		expect(toggle()).toBeChecked();
		await fireEvent.press(toggle());
		// The cache notifies on its next tick; the server has not answered yet.
		await waitFor(() => expect(toggle()).not.toBeChecked());
		expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: "s_1", enabled: false }));
		mockFetch.mockResolvedValue([{ ...schedule, enabled: false }]);
		await act(async () => answer({ ...schedule, enabled: false }));
		await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith({ title: "Opportunity discovery paused" }));
		await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
		expect(toggle()).not.toBeChecked();
	});

	it("puts the switch back and says so when saving fails", async () => {
		let fail: (error: Error) => void = () => {};
		mockSave.mockReturnValue(new Promise((_resolve, reject) => (fail = reject)));
		await renderScreen(<Schedules time={time} deleted={[]} onOpenSchedule={jest.fn()} />);
		await screen.findByRole("switch", { name: "Opportunity discovery, Product designer" });
		await fireEvent.press(toggle());
		await waitFor(() => expect(toggle()).not.toBeChecked());
		await act(async () => fail(new Error("offline")));
		await waitFor(() => expect(toggle()).toBeChecked());
		expect(mockShowToast).toHaveBeenCalledWith({
			title: "Couldn't change this schedule. Try again.",
			variant: "danger",
		});
	});
});
