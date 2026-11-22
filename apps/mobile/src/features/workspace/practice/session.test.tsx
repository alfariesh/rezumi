// The practice session on the device (plans/mobile Phase 10): Record asks through the microphone primer; a refusal
// offers typing and Settings; allowed later, it records, transcribes with the person's connection and gets feedback.
// The recorder, the permission and transcription are fakes; the reducer and components are the real ones.
import type { RecordStop } from "../voice";
import type { VoiceSettings } from "../voice";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { testSaved } from "../test-fixtures";
import { Session } from "./session";
import { renderScreen } from "@/test/render-screen";

const mockAsk = jest.fn();
const mockTranscribe = jest.fn();
const mockGenerate = jest.fn();
const mockStart = jest.fn();
const mockCancel = jest.fn();
let mockStop: ((result: RecordStop) => void) | null = null;
let mockOnline = true;

jest.mock("@/shell/permissions", () => ({ askPermission: (...args: unknown[]) => mockAsk(...args) }));
jest.mock("@/api/online", () => ({ isOnline: () => mockOnline }));
jest.mock("../voice", () => ({
	microphone: { get: jest.fn(), request: jest.fn() },
	useRecorder: (onStop: (result: RecordStop) => void) => {
		mockStop = onStop;
		return { recording: false, seconds: 3, start: mockStart, cancel: mockCancel, stop: jest.fn() };
	},
	usePlayer: () => ({ playing: false, play: jest.fn(), stop: jest.fn() }),
	transcribe: (input: unknown) => mockTranscribe(input),
	deleteQuietly: jest.fn(),
	speak: jest.fn(),
}));
jest.mock("../drafts", () => ({
	useDraft: <T,>(_name: string | null, initial: T) => {
		const { useState: mockUseState } = jest.requireActual<typeof import("react")>("react");
		const [value, setValue] = mockUseState(initial);
		return { value, setValue, clear: jest.fn(), blocked: null, setBlocked: jest.fn(), reset: setValue };
	},
}));
jest.mock("../queries", () => ({
	...jest.requireActual("../queries"),
	useGenerate: () => ({ isPending: false, run: (task: unknown) => mockGenerate(task) }),
}));
jest.mock("@/api/client", () => ({
	client: { career: { voice: { saveTranscript: jest.fn(() => Promise.resolve()) } } },
}));
jest.mock("@/features/ai/providers", () => ({
	useHasAIProvider: () => ({ defaultProvider: { id: "p1", label: "OpenAI" }, usableProviders: [] }),
	AIProviderSetupSheet: () => null,
}));
jest.mock("expo-file-system", () => ({ File: class {} }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn() }));

const voice = {
	providerState: { isLoading: false, isUnavailable: false },
	transcribers: [],
	readers: [],
	update: jest.fn(),
	settings: {
		transcribe: {
			providerId: "p1",
			label: "OpenAI",
			model: "gpt-4o-mini-transcribe",
			models: ["gpt-4o-mini-transcribe"],
		},
		speak: null,
		speakOff: false,
		keep: false,
	},
} as unknown as VoiceSettings;

const questions = [{ text: "Why do you want this role?", origin: "simulated" as const }];
const transcript = "I want to build tools that help designers ship calmer products every week.";

function renderSession() {
	return renderScreen(
		<Session
			applicationId="app-1"
			interviewId={null}
			questions={questions}
			storyId={undefined}
			storyTitle={undefined}
			voice={voice}
			initialMode="spoken"
		/>,
	);
}

beforeEach(() => {
	jest.clearAllMocks();
	mockOnline = true;
});

describe("Session", () => {
	it("offers typing and Settings after a refused microphone, then records once allowed", async () => {
		mockAsk.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		mockStart.mockResolvedValue("started");
		mockTranscribe.mockResolvedValue({ id: "t1", text: transcript });
		mockGenerate.mockResolvedValue({
			item: testSaved({
				kind: "practice",
				question: questions[0]?.text ?? "",
				origin: "simulated",
				mode: "spoken",
				answer: transcript,
				title: "Clear and specific",
				works: "You name the outcome.",
				strengthen: "Say what you did yourself.",
				opening: "I build tools for designers.",
				note: "Clear",
			}),
		});
		await renderSession();

		await fireEvent.press(screen.getByRole("button", { name: "Record your answer" }));
		await waitFor(() => expect(screen.getByTestId("practice-denied")).toBeTruthy());
		expect(mockAsk).toHaveBeenCalledWith("microphone", expect.anything(), true);
		expect(mockStart).not.toHaveBeenCalled();
		expect(screen.getByText("Open Settings")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("practice-type-instead"));
		expect(screen.getByTestId("practice-answer")).toBeTruthy();

		const [speak] = screen.getAllByLabelText("Speak");
		if (!speak) throw new Error("No Speak option");
		await fireEvent.press(speak);
		await fireEvent.press(screen.getByRole("button", { name: "Record your answer" }));
		await waitFor(() => expect(screen.getByRole("button", { name: "Stop recording" })).toBeTruthy());
		expect(screen.getByText("Recording · 0:03")).toBeTruthy();

		mockStop?.({
			kind: "recorded",
			recording: { uri: "file:///answer.m4a", seconds: 41, name: "practice-answer.m4a", type: "audio/mp4" },
			atLimit: false,
		});
		await waitFor(() => expect(screen.getByDisplayValue(transcript)).toBeTruthy());
		expect(mockTranscribe).toHaveBeenCalledWith(
			expect.objectContaining({ providerId: "p1", model: "gpt-4o-mini-transcribe", applicationId: "app-1" }),
		);
		expect(screen.getByText("Transcribed · 0:41 · check numbers and names before using it")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("practice-feedback-button"));
		await waitFor(() => expect(screen.getByTestId("practice-feedback")).toBeTruthy());
		expect(mockGenerate).toHaveBeenCalledWith(
			expect.objectContaining({ task: "practice", mode: "spoken", answer: transcript }),
		);
		await fireEvent.press(screen.getByTestId("practice-next"));
		expect(screen.getByTestId("practice-finished")).toBeTruthy();
	});

	it("keeps the recording after a failed transcription and offers Try again", async () => {
		mockAsk.mockResolvedValue(true);
		mockStart.mockResolvedValue("started");
		mockTranscribe.mockRejectedValueOnce(new Error("Transcription failed (502)"));
		await renderSession();
		await fireEvent.press(screen.getByRole("button", { name: "Record your answer" }));
		await waitFor(() => expect(screen.getByRole("button", { name: "Stop recording" })).toBeTruthy());
		mockStop?.({
			kind: "recorded",
			recording: { uri: "file:///answer.m4a", seconds: 12, name: "practice-answer.m4a", type: "audio/mp4" },
			atLimit: false,
		});
		await waitFor(() => expect(screen.getByTestId("practice-transcription")).toBeTruthy());
		mockTranscribe.mockResolvedValueOnce({ id: "t2", text: transcript });
		await fireEvent.press(screen.getByText("Try again"));
		await waitFor(() => expect(screen.getByDisplayValue(transcript)).toBeTruthy());
	});

	it("refuses an empty recording and sends nothing while offline", async () => {
		mockAsk.mockResolvedValue(true);
		mockStart.mockResolvedValue("started");
		await renderSession();
		await fireEvent.press(screen.getByRole("button", { name: "Record your answer" }));
		await waitFor(() => expect(screen.getByRole("button", { name: "Stop recording" })).toBeTruthy());
		mockStop?.({ kind: "empty", atLimit: false });
		await waitFor(() => expect(screen.getByTestId("practice-audio-problem")).toBeTruthy());
		expect(mockTranscribe).not.toHaveBeenCalled();

		mockOnline = false;
		await fireEvent.press(screen.getByRole("button", { name: "Record your answer" }));
		expect(screen.getByTestId("practice-offline")).toBeTruthy();
		expect(mockAsk).toHaveBeenCalledTimes(1);
	});
});
