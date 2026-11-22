// Save a job (Phase 10): a pasted link is read (parsePosting), checked, then saved; filling in by hand saves too; an
// unreadable link turns into pasting the text. The API is a fixture; the form is real.
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { ORPCError } from "@orpc/client";
import { SaveJobBody } from "./save-sheet";
import { renderScreen } from "@/test/render-screen";

const mockParse = jest.fn();
const mockCreate = jest.fn((_input: unknown) => Promise.resolve("new-app"));

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/auth/session", () => ({
	getServer: () => "https://rezumi.app",
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
}));
jest.mock("@/api/client", () => ({
	client: { applications: { ai: { parsePosting: (input: unknown) => mockParse(input), autofill: jest.fn() } } },
}));
jest.mock("./queries", () => ({
	useApplicationMutations: () => ({ create: { mutateAsync: (input: unknown) => mockCreate(input) } }),
	useDocuments: () => ({ data: [], isPending: false }),
}));
jest.mock("@/features/ai/provider-state", () => ({
	useHasAIProvider: () => ({ hasAIProvider: false, isLoading: false, error: null, retry: jest.fn() }),
}));

const posting = {
	company: "Acme",
	role: "Product designer",
	location: "Berlin",
	salary: "",
	requirements: ["Figma"],
	jobDescription: "Design things.",
	sourceUrl: "https://jobs.example.com/1",
	postingSource: { method: "json-ld", format: "html", truncated: false, completeness: "complete" },
	filledBy: "page",
	enrichmentWarning: null,
};

beforeEach(() => jest.clearAllMocks());

describe("SaveJobBody", () => {
	it("reads a link, shows what it found, and saves the job", async () => {
		mockParse.mockResolvedValue(posting);
		const onSaved = jest.fn();
		await renderScreen(<SaveJobBody initialUrl={undefined} onDirtyChange={jest.fn()} onSaved={onSaved} />);
		await fireEvent.changeText(screen.getByTestId("save-job-link"), "https://jobs.example.com/1");
		await fireEvent.press(screen.getByTestId("save-job-read"));
		await waitFor(() => expect(screen.getByTestId("save-job-role").props.value).toBe("Product designer"));
		expect(mockParse).toHaveBeenCalledWith({ input: "https://jobs.example.com/1" });
		expect(screen.getByTestId("save-job-company").props.value).toBe("Acme");
		await fireEvent.press(screen.getByTestId("save-job-save"));
		await waitFor(() => expect(onSaved).toHaveBeenCalledWith("new-app"));
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				company: "Acme",
				role: "Product designer",
				status: "saved",
				location: "Berlin",
				sourceUrl: "https://jobs.example.com/1",
				jobDescription: "Design things.",
				requirements: ["Figma"],
			}),
		);
	});

	it("saves a job filled in by hand", async () => {
		const onSaved = jest.fn();
		await renderScreen(<SaveJobBody initialUrl={undefined} onDirtyChange={jest.fn()} onSaved={onSaved} />);
		await fireEvent.press(screen.getByTestId("save-job-manual"));
		expect(screen.getByTestId("save-job-save")).toBeDisabled();
		await fireEvent.changeText(screen.getByTestId("save-job-role"), "Data analyst");
		await fireEvent.changeText(screen.getByTestId("save-job-company"), "Initech");
		await fireEvent.press(screen.getByTestId("save-job-save"));
		await waitFor(() => expect(onSaved).toHaveBeenCalledWith("new-app"));
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({ role: "Data analyst", company: "Initech", postingSource: null }),
		);
		expect(mockParse).not.toHaveBeenCalled();
	});

	it("keeps an unreadable link and asks for the posting's text", async () => {
		mockParse.mockRejectedValue(new ORPCError("POSTING_UNREADABLE"));
		await renderScreen(
			<SaveJobBody initialUrl="https://jobs.example.com/2" onDirtyChange={jest.fn()} onSaved={jest.fn()} />,
		);
		await fireEvent.press(screen.getByTestId("save-job-read"));
		expect(await screen.findByText("That link couldn't be read. Paste the posting text instead.")).toBeTruthy();
		expect(screen.getByTestId("save-job-text")).toBeTruthy();
	});
});
