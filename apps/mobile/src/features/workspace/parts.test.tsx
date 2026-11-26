// Each workspace part from a fictional workspace (plans/mobile Phase 10): it renders, and its main action calls its
// procedure. Fit also covers the AI consent path: declining the consent sends nothing and shows no error. Data hooks
// and procedures are fakes; the parts and the design system are real.
import type { WorkspacePartProps } from "./part";
import type { CareerWorkspace } from "@rezumi/schema/career";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { EMPTY_WORKSPACE } from "@rezumi/schema/career";
import { ApplyPart } from "./apply/apply-part";
import { DebriefPart } from "./debrief/debrief-part";
import { FitPart } from "./fit/fit-part";
import { MessagesPart } from "./messages/messages-part";
import { PracticePart } from "./practice/practice-part";
import { PreparePart } from "./prepare/prepare-part";
import { SavedPart } from "./saved/saved-part";
import { testApplication, testInterview, testNow, testSaved } from "./test-fixtures";
import { renderScreen } from "@/test/render-screen";

const mockMutate = jest.fn();
const mockToast = jest.fn();
const mockSave = jest.fn();
const mockWithUndo = jest.fn();
let mockWorkspace: CareerWorkspace = EMPTY_WORKSPACE;
let mockSaved: unknown[] = [];

jest.mock("@/api/client", () => {
	const node = (path: string[]): unknown =>
		new Proxy(() => undefined, {
			apply: (_target, _this, args: unknown[]) => mockMutate(path.join("."), args[0]),
			get: (_target, key: string) =>
				key === "mutationOptions"
					? // No five-minute cache timer after a mutation, so Jest exits when the tests are done.
						() => ({
							mutationFn: (input: unknown) => mockMutate(path.join("."), input),
							gcTime: Number.POSITIVE_INFINITY,
						})
					: key === "key"
						? () => path
						: node([...path, key]),
		});
	return { orpc: node([]), client: node(["client"]) };
});
jest.mock("./queries", () => ({
	...jest.requireActual("./queries"),
	useWorkspace: () => ({
		data: mockWorkspace,
		current: () => mockWorkspace,
		save: (patch: unknown) => {
			mockSave(patch);
			return Promise.resolve({ ok: true });
		},
		settled: () => Promise.resolve(mockWorkspace),
		fetchConfirmed: () => Promise.resolve(mockWorkspace),
		isPending: false,
		query: { isError: false, data: mockWorkspace },
		queryKey: ["workspace"],
	}),
	useSavedItems: () => ({ data: mockSaved, isPending: false }),
	useFacts: () => ({ data: [] }),
	useStories: () => ({ data: [], isPending: false, isError: false }),
	useTicks: () => ({ ticked: [], toggle: jest.fn() }),
	useSchedules: () => ({ data: [] }),
}));
jest.mock("@/features/ai/providers", () => ({
	useHasAIProvider: () => ({
		defaultProvider: { id: "p1", label: "Claude" },
		usableProviders: [{ id: "p1", label: "Claude" }],
		hasAIProvider: true,
		isLoading: false,
		isUnavailable: false,
		error: null,
	}),
	AIProviderSetupSheet: () => null,
}));
jest.mock("@/features/ai/report-content", () => ({ ReportAiContent: () => null }));
jest.mock("@/features/account/queries", () => ({ useProfile: () => ({ data: { timezone: "UTC" } }) }));
jest.mock("@/auth/session", () => {
	// One session object, as the app's store keeps it: drafts re-read their scope when it changes.
	const session = { status: "signed-in", server: "https://rezumi.app" };
	return {
		useSession: () => session,
		getServer: () => "https://rezumi.app",
	};
});
jest.mock("@/draft", () => ({ getDraftScope: () => Promise.resolve("https://rezumi.app:person") }));
jest.mock("@/api/flags", () => ({ useFlags: () => ({ data: { careerSchedulingEnabled: true } }) }));
jest.mock("@/features/applications/queries", () => ({ useInvalidateApplications: () => () => Promise.resolve() }));
jest.mock("@/features/career/undo", () => ({ withUndo: (options: unknown) => mockWithUndo(options) }));
jest.mock("@/ui", () => ({ ...jest.requireActual("@/ui"), showToast: (options: unknown) => mockToast(options) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("expo-crypto", () => ({ randomUUID: () => "uuid-1" }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("./share", () => ({ shareText: jest.fn() }));
jest.mock("./voice", () => ({ useVoiceSettings: () => ({ settings: {} }) }));
jest.mock("./practice/session", () => {
	const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
	return { Session: ({ questions }: { questions: { text: string }[] }) => <Text>{questions[0]?.text}</Text> };
});

const go = jest.fn();
const addInterview = jest.fn();
const props = (extra: Partial<WorkspacePartProps> = {}): WorkspacePartProps => ({
	application: testApplication(),
	version: undefined,
	interview: undefined,
	speak: false,
	story: undefined,
	now: testNow,
	go,
	addInterview,
	...extra,
});

beforeEach(() => {
	jest.clearAllMocks();
	mockWorkspace = EMPTY_WORKSPACE;
	mockSaved = [];
	mockMutate.mockResolvedValue({ item: null });
});

describe("Fit", () => {
	it("checks fit through career.generate", async () => {
		await renderScreen(<FitPart {...props()} />);
		expect(screen.getByText("Check this role against your evidence")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("fit-check"));
		await waitFor(() =>
			expect(mockMutate).toHaveBeenCalledWith("career.generate", expect.objectContaining({ task: { task: "fit" } })),
		);
	});

	it("sends nothing and shows no error when the AI consent is declined", async () => {
		mockMutate.mockRejectedValueOnce(Object.assign(new Error("Declined"), { name: "AbortError" }));
		await renderScreen(<FitPart {...props()} />);
		await fireEvent.press(screen.getByTestId("fit-check"));
		await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(screen.getByText("Check fit")).toBeTruthy());
		expect(mockToast).not.toHaveBeenCalled();
	});

	it("shows each requirement and saves new evidence to the Profile", async () => {
		mockSaved = [
			testSaved({
				kind: "fit",
				headline: "A strong match",
				summary: "Most requirements are backed.",
				requirements: [
					{ text: "Figma prototyping", origin: "posting", status: "missing", evidence: "Nothing yet.", factIds: [] },
				],
				checks: [],
				ask: null,
			}),
		];
		mockMutate.mockResolvedValue({ id: "fact-1" });
		await renderScreen(<FitPart {...props()} />);
		expect(screen.getByText("A strong match")).toBeTruthy();
		await fireEvent.press(screen.getByText("Add evidence"));
		await fireEvent.changeText(
			screen.getByLabelText("What you did: Figma prototyping"),
			"Prototyped checkout in Figma.",
		);
		await fireEvent.press(screen.getByText("Save to Profile"));
		await waitFor(() =>
			expect(mockMutate).toHaveBeenCalledWith("career.saveFact", expect.objectContaining({ category: "experience" })),
		);
		await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ evidence: { "Figma prototyping": "fact-1" } }));
	});
});

describe("Apply", () => {
	it("adds a question and marks the application applied", async () => {
		mockWorkspace = {
			...EMPTY_WORKSPACE,
			answers: [{ id: "a1", question: "Why us?", answer: "Your design system work.", factIds: [] }],
		};
		await renderScreen(<ApplyPart {...props()} />);
		expect(screen.getByDisplayValue("Your design system work.")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("apply-add-question"));
		expect(mockSave).toHaveBeenCalledWith({
			answers: [...mockWorkspace.answers, expect.objectContaining({ id: "uuid-1" })],
		});
		await fireEvent.press(screen.getByTestId("apply-mark-applied"));
		await waitFor(() =>
			expect(mockMutate).toHaveBeenCalledWith(
				"career.submitApplication",
				expect.objectContaining({ applicationId: "app-1", answers: mockWorkspace.answers }),
			),
		);
	});
});

describe("Prepare", () => {
	it("asks for an interview first", async () => {
		await renderScreen(<PreparePart {...props()} />);
		await fireEvent.press(screen.getByText("Add an interview"));
		expect(addInterview).toHaveBeenCalled();
	});

	it("plans the next round through career.generate", async () => {
		const interview = testInterview();
		await renderScreen(<PreparePart {...props({ interview })} />);
		await fireEvent.press(screen.getByTestId("prepare-plan"));
		await waitFor(() =>
			expect(mockMutate).toHaveBeenCalledWith(
				"career.generate",
				expect.objectContaining({ task: { task: "briefing", interviewId: "interview-1" } }),
			),
		);
	});

	it("switches to the short checklist ten minutes before", async () => {
		const interview = testInterview({ at: new Date("2026-11-22T09:05:00.000Z") });
		await renderScreen(<PreparePart {...props({ interview })} />);
		expect(screen.getByText("Starts in 5 minutes")).toBeTruthy();
		await fireEvent.press(screen.getByText("Rehearse aloud"));
		expect(go).toHaveBeenCalledWith("practise", { speak: true });
	});
});

const attempt = testSaved({
	kind: "practice",
	question: "Why this role?",
	origin: "simulated",
	mode: "typed",
	answer: "Because I love calm tools.",
	title: "Clear",
	works: "Specific.",
	strengthen: "Add a result.",
	opening: "I build calm tools.",
	note: "Clear",
});

describe("Practice", () => {
	it("starts on a general question and lists the attempts", async () => {
		mockSaved = [attempt];
		await renderScreen(<PracticePart {...props()} />);
		expect(screen.getByText(/proud of/)).toBeTruthy();
		await fireEvent.press(screen.getByText("Because I love calm tools."));
		expect(go).toHaveBeenCalledWith("practise", { version: attempt.id });
	});

	it("shows a saved attempt read-only", async () => {
		mockSaved = [attempt];
		await renderScreen(<PracticePart {...props({ version: attempt })} />);
		expect(screen.getByTestId("practice-feedback")).toBeTruthy();
		expect(screen.getByText("Your answer · typed")).toBeTruthy();
	});
});

describe("Debrief", () => {
	it("reviews what was asked and said through career.generate", async () => {
		const interview = testInterview({ at: new Date("2026-11-21T10:00:00.000Z") });
		await renderScreen(
			<DebriefPart {...props({ application: testApplication({ status: "interview", activity: [interview] }) })} />,
		);
		expect(screen.getByText("After the technical interview · Sat, Nov 21")).toBeTruthy();
		await fireEvent.changeText(screen.getByLabelText("What did they ask?"), "Walk me through a redesign.");
		await fireEvent.changeText(
			screen.getByLabelText("What did you say, as close as you remember?"),
			"I explained the checkout redesign.",
		);
		await fireEvent.press(screen.getByTestId("debrief-landed-mixed"));
		await fireEvent.press(screen.getByTestId("debrief-review"));
		await waitFor(() =>
			expect(mockMutate).toHaveBeenCalledWith(
				"career.generate",
				expect.objectContaining({
					task: expect.objectContaining({ task: "debrief", interviewId: "interview-1", landed: "mixed" }),
				}),
			),
		);
	});
});

describe("Messages", () => {
	it("applies the chosen changes after the Undo window", async () => {
		const application = testApplication({ status: "applied" });
		mockSaved = [
			testSaved({
				kind: "reply",
				message: "We'd like to invite you to a screening call.",
				title: "A screening invite",
				asks: ["Pick a time"],
				unconfirmed: [],
				reply: "Thank you, Tuesday works.",
				changes: [{ type: "stage", stage: "screening" }],
				offer: null,
				applied: null,
			}),
		];
		await renderScreen(<MessagesPart {...props({ application })} />);
		expect(screen.getByDisplayValue("Thank you, Tuesday works.")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("messages-apply"));
		const undo = mockWithUndo.mock.calls[0]?.[0] as { message: string; commit: () => Promise<void> };
		expect(undo.message).toBe("Application updated");
		await undo.commit();
		expect(mockMutate).toHaveBeenCalledWith("client.career.applyReply", { id: "saved-reply", changes: [0] });
	});
});

describe("Saved", () => {
	it("opens an item read-only in its part and deletes with Undo", async () => {
		const fit = testSaved({
			kind: "fit",
			headline: "A match",
			summary: "Good.",
			requirements: [],
			checks: [],
			ask: null,
		});
		mockSaved = [fit];
		await renderScreen(<SavedPart {...props()} />);
		await fireEvent.press(screen.getByText("Open in Fit"));
		expect(go).toHaveBeenCalledWith("fit", { version: fit.id });
		await fireEvent.press(screen.getByRole("button", { name: `Delete ${fit.title}` }));
		expect(screen.getByTestId("saved-empty")).toBeTruthy();
		const undo = mockWithUndo.mock.calls[0]?.[0] as { message: string; commit: () => Promise<void> };
		expect(undo.message).toBe("Deleted from Saved");
		await undo.commit();
		expect(mockMutate).toHaveBeenCalledWith("client.career.deleteSavedItem", { id: fit.id });
	});

	it("says what lands here when nothing is saved", async () => {
		await renderScreen(<SavedPart {...props()} />);
		await fireEvent.press(screen.getByText("Check fit"));
		expect(go).toHaveBeenCalledWith("fit");
	});
});
