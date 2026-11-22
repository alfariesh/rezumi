// New (plans/mobile Phase 07 step 3): the choices in the web's words, New resume and New letter creating and opening
// the document in place of the sheet, Copy a resume for a job, an import that fails with a way forward, and Save a job.
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { NewDocumentScreen } from "./new-document-screen";
import { useNewDocuments } from "./new-documents";
import { renderScreen } from "@/test/render-screen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockParams: Record<string, string | undefined> = {};
const mockClient = {
	createResume: jest.fn((_input: unknown) => Promise.resolve("resume-new")),
	createLetter: jest.fn((_input: unknown) => Promise.resolve({ id: "letter-new" })),
	copyForJob: jest.fn((_input: unknown) => Promise.resolve("resume-copy")),
	linkApplication: jest.fn((_input: unknown) => Promise.resolve()),
};
const mockApplications: { applications: unknown[] } = { applications: [] };
const mockPicker = jest.fn();
const mockImport = jest.fn();
const mockToast = jest.fn();

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
		documents: {
			copyForJob: (input: unknown) => mockClient.copyForJob(input),
			linkApplication: (input: unknown) => mockClient.linkApplication(input),
		},
	},
	orpc: {
		documents: { key: () => ["documents"], list: { key: () => ["documents", "list"] } },
		resume: { key: () => ["resume"] },
		coverLetters: { key: () => ["coverLetters"] },
		applications: {
			key: () => ["applications"],
			listSummary: {
				queryOptions: () => ({
					queryKey: ["applications"],
					queryFn: () => Promise.resolve(mockApplications.applications),
				}),
			},
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
jest.mock("@/features/applications/save-sheet", () => {
	const { Text } = jest.requireActual("react-native");
	return { SaveJobSheet: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <Text>Save a job sheet</Text> : null) };
});
jest.mock("@/ui", () => ({ ...jest.requireActual("@/ui"), showToast: (options: unknown) => mockToast(options) }));

beforeEach(() => {
	jest.clearAllMocks();
	mockApplications.applications = [];
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

describe("New: recovering from interruptions", () => {
	it("Back from an open list in Copy for a job returns to the copy form", async () => {
		mockParams.step = "copy";
		await renderScreen(<NewDocumentScreen />);
		await fireEvent.press(screen.getByText("Start from"));
		expect(screen.queryByRole("button", { name: "Create copy" })).toBeNull();
		await fireEvent.press(screen.getByTestId("new-copy-back"));
		expect(screen.getByRole("button", { name: "Create copy" })).toBeTruthy();
		await fireEvent.press(screen.getByTestId("new-copy-back"));
		expect(screen.getByText("Import a resume")).toBeTruthy();
	});

	it("keeps a closed application New was opened from", async () => {
		mockParams.step = "copy";
		mockParams.applicationId = "a1";
		mockApplications.applications = [{ id: "a1", status: "closed", company: "Lumen", role: "Designer" }];
		await renderScreen(<NewDocumentScreen />);
		expect(await screen.findByDisplayValue("Product designer — Lumen")).toBeTruthy();
	});

	it("opens the new resume even when linking it to the application fails", async () => {
		mockParams.applicationId = "a1";
		mockClient.linkApplication.mockRejectedValueOnce(new Error("offline"));
		await renderScreen(<NewDocumentScreen />);
		await fireEvent.press(screen.getByTestId("new-resume"));
		await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/builder/resume-new/write"));
		expect(mockClient.createResume).toHaveBeenCalledTimes(1);
		expect(mockToast).toHaveBeenCalledWith({
			title: "Couldn't link the application. Check Applications before retrying.",
			variant: "warning",
		});
	});

	it("warns that a canceled import may have finished, and lists it if it did", async () => {
		mockPicker.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cv.pdf", name: "cv.pdf" }] });
		let finish: (document: unknown) => void = () => {};
		mockImport.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			}),
		);
		await renderScreen(<NewDocumentScreen />);
		await fireEvent.press(screen.getByTestId("new-import"));
		await fireEvent.press(await screen.findByRole("button", { name: "Cancel" }));
		expect(mockToast).toHaveBeenCalledWith({
			title: "Import canceled. Refresh Documents before retrying if the upload had finished.",
			variant: "warning",
		});
		finish({ type: "resume", id: "resume-late", design: null });
		await waitFor(() => expect(useNewDocuments.getState().ids).toContain("https://rezumi.app:resume:resume-late"));
		expect(screen.getByText("Import a resume")).toBeTruthy();
	});
});
