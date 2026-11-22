// The application detail (Phase 10): the Posting closed marker, Move to the next stage, Mark as applied from Saved,
// Open workspace, notes saved through the queue, and Delete after confirming. Writes are fixtures; the body is real.
import type { Application } from "../types";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { DetailBody } from "./detail-body";
import { renderScreen } from "@/test/render-screen";

const mockActions = {
	pending: false,
	moveTo: jest.fn(),
	moveMany: jest.fn(),
	remove: jest.fn(),
	removeMany: jest.fn(),
};
const mutation = () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false });
const mockPush = jest.fn();
const mockUpdateNotes = jest.fn((_input: unknown) => Promise.resolve({}));

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("@/auth/session", () => ({ getServer: () => "https://rezumi.app" }));
jest.mock("@/draft", () => ({ getDraftScope: () => Promise.resolve("scope") }));
jest.mock("@/api/client", () => ({
	client: { applications: { update: (input: unknown) => mockUpdateNotes(input) } },
	orpc: { applications: { key: () => ["applications"] } },
}));
jest.mock("../queries", () => ({
	useApplicationActions: () => mockActions,
	useApplicationMutations: () => ({ update: mutation() }),
	useDetailMutations: () => ({
		addNote: mutation(),
		updateEntry: mutation(),
		deleteEntry: mutation(),
		removeDocument: mutation(),
		createLetter: mutation(),
		attach: mutation(),
	}),
	useDocuments: () => ({ data: [], isPending: false }),
	reminderTargets: () => [],
	interviewReminder: () => null,
	followUpReminder: () => null,
}));
jest.mock("../date", () => ({
	useNow: () => new Date("2026-11-20T10:00:00Z"),
	todayKey: () => "2026-11-20",
	leadLabel: (minutes: number) => `${minutes} min`,
	useUserTime: () => ({
		timeZone: "UTC",
		locale: "en",
		day: () => "Fri 20 Nov",
		time: () => "10:00",
		when: () => "Fri 20 Nov, 10:00",
		date: () => "18 Nov 2026",
		utcDay: () => "18 Nov",
	}),
}));
jest.mock("@/features/reminders", () => ({
	syncReminders: () => Promise.resolve(),
	shareIcs: () => Promise.resolve(),
	followUpStart: () => new Date(),
	useReminders: () => ({ leadFor: () => null, turnOn: jest.fn(), turnOff: jest.fn() }),
	DEFAULT_LEAD: 30,
	REMINDER_LEADS: [10, 30, 60, 1440],
}));
jest.mock("../interview-sheet", () => ({ InterviewSheet: () => null }));

const base = {
	id: "a1",
	userId: "u1",
	company: "Acme",
	role: "Product designer",
	location: "Berlin",
	salary: null,
	status: "applied",
	closedReason: null,
	resumeId: null,
	coverLetterId: null,
	source: null,
	tags: [],
	sourceUrl: "https://jobs.example.com/1",
	jobDescription: null,
	requirements: [],
	postingSource: null,
	postingClosedAt: null,
	notes: "",
	contacts: [],
	activity: [{ id: "s1", type: "stage", stage: "applied", at: "2026-11-18T12:00:00.000Z" }],
	followUpAt: null,
	followUpNote: null,
	appliedAt: new Date("2026-11-18T12:00:00Z"),
	resumeFileUrl: null,
	resumeFileName: null,
	coverLetterUrl: null,
	coverLetterName: null,
	sentResumeVersionId: null,
	sentCoverLetterVersionId: null,
	sentCheckScore: null,
	createdAt: new Date("2026-11-18T12:00:00Z"),
	updatedAt: new Date("2026-11-18T12:00:00Z"),
};
const make = (patch: Record<string, unknown> = {}) => ({ ...base, ...patch }) as unknown as Application;
const onClose = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe("DetailBody", () => {
	it("marks a posting the employer took down, with its date", async () => {
		await renderScreen(
			<DetailBody application={make({ postingClosedAt: new Date() })} showTitle stale={false} onClose={onClose} />,
		);
		expect(screen.getByText("Posting closed 18 Nov 2026")).toBeTruthy();
	});

	it("leaves the marker out while the posting is up", async () => {
		await renderScreen(<DetailBody application={make()} showTitle stale={false} onClose={onClose} />);
		expect(screen.queryByTestId("posting-closed")).toBeNull();
		expect(screen.getByText("Product designer")).toBeTruthy();
	});

	it("moves to the next stage with Undo from the actions", async () => {
		await renderScreen(<DetailBody application={make()} showTitle stale={false} onClose={onClose} />);
		await fireEvent.press(screen.getByTestId("detail-next-stage"));
		expect(mockActions.moveTo).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }), "screening");
	});

	it("opens the workspace", async () => {
		await renderScreen(<DetailBody application={make()} showTitle stale={false} onClose={onClose} />);
		await fireEvent.press(screen.getByTestId("open-workspace"));
		expect(mockPush).toHaveBeenCalledWith("/applications/a1/default");
	});

	it("reopens a closed application", async () => {
		await renderScreen(
			<DetailBody
				application={make({ status: "closed", closedReason: "withdrew" })}
				showTitle
				stale={false}
				onClose={onClose}
			/>,
		);
		expect(screen.getByText("· I withdrew")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("detail-reopen"));
		expect(mockActions.moveTo).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }), "applied");
	});

	it("saves notes when the field is left", async () => {
		await renderScreen(<DetailBody application={make()} showTitle stale={false} onClose={onClose} />);
		const input = screen.getByTestId("notes-input");
		// The device key for unsaved text resolves first.
		await waitFor(() => expect(input).toBeTruthy());
		await new Promise((resolve) => setTimeout(resolve, 0));
		await fireEvent.changeText(input, "Ask about the team");
		await fireEvent(input, "blur");
		await waitFor(() => expect(mockUpdateNotes).toHaveBeenCalledWith({ id: "a1", notes: "Ask about the team" }));
	});

	it("deletes only after confirming", async () => {
		await renderScreen(<DetailBody application={make()} showTitle stale={false} onClose={onClose} />);
		await fireEvent.press(screen.getByTestId("detail-delete"));
		expect(mockActions.remove).not.toHaveBeenCalled();
		await fireEvent.press(await screen.findByRole("button", { name: "Delete application" }));
		expect(mockActions.remove).toHaveBeenCalledWith("a1", onClose);
	});

	it("says when it shows what's stored on the device", async () => {
		await renderScreen(<DetailBody application={make()} showTitle stale onClose={onClose} />);
		expect(screen.getByText("Showing the details saved on this device. They couldn't be refreshed.")).toBeTruthy();
	});
});
