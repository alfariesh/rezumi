// New (plans/mobile Phase 07 step 3): the choices in the web's words, New resume and New letter creating and opening
// the document in place of the sheet, Copy a resume for a job, an import that fails with a way forward, and Save a job.
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { NewDocumentScreen } from "./new-document-screen";
import { renderScreen } from "@/test/render-screen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockParams: Record<string, string | undefined> = {};
const mockClient = {
	createResume: jest.fn((_input: unknown) => Promise.resolve("resume-new")),
	createLetter: jest.fn((_input: unknown) => Promise.resolve({ id: "letter-new" })),
	copyForJob: jest.fn((_input: unknown) => Promise.resolve("resume-copy")),
};
const mockPicker = jest.fn();
const mockImport = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
	useLocalSearchParams: () => mockParams,
	Stack: { Screen: () => null },
}));
jest.mock("expo-network", () => ({
	getNetworkStateAsync: () => Promise.resolve({ isConnected: true, isInternetReachable: true }),
}));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: () => mockPicker() }));
jest.mock("expo-file-system", () => ({ File: class {} }));
jest.mock("./import-file", () => {
	class ImportError extends Error {}
	return { ImportError, importDocument: (...args: unknown[]) => mockImport(...args) };
});
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => ({
	client: {
		resume: { create: (input: unknown) => mockClient.createResume(input) },
		coverLetters: { create: (input: unknown) => mockClient.createLetter(input) },
		documents: { copyForJob: (input: unknown) => mockClient.copyForJob(input) },
	},
	orpc: {
		documents: { key: () => ["documents"], list: { key: () => ["documents", "list"] } },
		resume: { key: () => ["resume"] },
		coverLetters: { key: () => ["coverLetters"] },
		applications: {
			key: () => ["applications"],
			listSummary: { queryOptions: () => ({ queryKey: ["applications"], queryFn: () => Promise.resolve([]) }) },
		},
	},
}));
jest.mock("./queries", () => ({
	...jest.requireActual("./queries"),
	useDocuments: () => ({
		data: [
			{
				type: "resume",
				id: "r1",
				name: "Product designer",
				tags: [],
				updatedAt: new Date("2026-11-20T00:00:00Z"),
			},
		],
		isError: false,
		refetch: jest.fn(),
	}),
}));
jest.mock("@/features/ai/providers", () => ({
	useHasAIProvider: () => ({ hasAIProvider: false, isLoading: false }),
	AIProviderSetupSheet: () => null,
}));
jest.mock("@/features/billing/plan", () => ({ usePlan: () => undefined, describeImportedDesign: () => null }));
jest.mock("@/features/applications/add-sheet", () => {
	const { Text } = jest.requireActual("react-native");
	return { AddApplicationSheet: () => <Text>Save a job sheet</Text> };
});

beforeEach(() => {
	jest.clearAllMocks();
	for (const key of Object.keys(mockParams)) delete mockParams[key];
});

describe("New", () => {
	it("offers import, a new resume or letter, a copy for a job and saving a job", async () => {
		await renderScreen(<NewDocumentScreen />);
		for (const label of ["Import a resume", "New resume", "New letter", "Copy a resume for a job", "Save a job"])
			expect(screen.getByText(label)).toBeTruthy();
		expect(screen.getByText("Try with a sample resume")).toBeTruthy();
	});

	it("creates a blank resume and opens it in place of the sheet", async () => {
		await renderScreen(<NewDocumentScreen />);
		await fireEvent.press(screen.getByTestId("new-resume"));
		await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/builder/resume-new/write"));
		expect(mockClient.createResume).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Untitled resume", autoName: true, withSampleData: false }),
		);
	});

	it("creates a letter and opens the letter editor", async () => {
		await renderScreen(<NewDocumentScreen />);
		await fireEvent.press(screen.getByTestId("new-letter"));
		await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/letter/letter-new/write"));
	});

	it("copies a resume for a job from the link's resume", async () => {
		mockParams.step = "copy";
		mockParams.sourceResumeId = "r1";
		await renderScreen(<NewDocumentScreen />);
		expect(screen.getByDisplayValue("Product designer (copy)")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Create copy" }));
		await waitFor(() =>
			expect(mockClient.copyForJob).toHaveBeenCalledWith({ resumeId: "r1", name: "Product designer (copy)" }),
		);
		expect(mockReplace).toHaveBeenCalledWith("/builder/resume-copy/write");
	});

	it("shows why an import failed, with another file or a blank start", async () => {
		mockPicker.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cv.pdf", name: "cv.pdf" }] });
		const { ImportError } = jest.requireMock<{ ImportError: new (message: string) => Error }>("./import-file");
		mockImport.mockRejectedValue(new ImportError("File is too large. Choose a file up to 10 MB."));
		await renderScreen(<NewDocumentScreen />);
		await fireEvent.press(screen.getByTestId("new-import"));
		expect(await screen.findByText("Couldn't import")).toBeTruthy();
		expect(screen.getByText("File is too large. Choose a file up to 10 MB.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Choose another file" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Start blank" })).toBeTruthy();
	});

	it("opens Save a job", async () => {
		await renderScreen(<NewDocumentScreen />);
		await fireEvent.press(screen.getByTestId("new-save-job"));
		expect(screen.getByText("Save a job sheet")).toBeTruthy();
	});
});
