// Download (plans/mobile Phase 08): the export while it runs, after it fails, and without a connection. File work is
// replaced; the screen, its wording and its rules are the real ones.
import type { ResumeDocument } from "@/draft/types";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { DownloadTab } from "./download";
import { renderScreen } from "@/test/render-screen";

const mockFiles = {
	exportDirectory: jest.fn(() => ({})),
	exportFile: jest.fn<Promise<unknown>, unknown[]>(),
	shareExport: jest.fn<Promise<void>, unknown[]>(() => Promise.resolve()),
	printResume: jest.fn<Promise<void>, unknown[]>(() => Promise.resolve()),
};
const mockFlush = jest.fn();

jest.mock("./files", () => ({
	exportDirectory: () => mockFiles.exportDirectory(),
	exportFile: (...args: unknown[]) => mockFiles.exportFile(...args),
	shareExport: (...args: unknown[]) => mockFiles.shareExport(...args),
	printResume: (...args: unknown[]) => mockFiles.printResume(...args),
}));
jest.mock("./document", () => ({ flushResume: (id: string) => mockFlush(id) }));
jest.mock("./letter", () => ({ letterWords: jest.fn() }));
jest.mock("@/api/client", () => ({ client: {} }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/features/applications/queries", () => ({ useApplications: () => ({ data: [], isError: false }) }));
jest.mock("@/features/billing/plan", () => ({
	usePlan: () => null,
	hasPlanFeature: () => true,
	canShowPlans: () => true,
	showPlanAlert: jest.fn(),
}));
jest.mock("@/draft", () => {
	const resume = { document: null as unknown };
	return {
		useResumeStore: { getState: () => resume, setState: (next: object) => Object.assign(resume, next) },
		useLetterStore: { getState: () => ({ document: null }) },
	};
});

const { useResumeStore } = jest.requireMock<{ useResumeStore: { setState: (next: object) => void } }>("@/draft");

const resume = {
	id: "resume-1",
	name: "Designer",
	data: { ...defaultResumeData, basics: { ...defaultResumeData.basics, name: "Ada Lovelace" } },
	applicationId: null,
	isLocked: false,
} as unknown as ResumeDocument;

beforeEach(() => {
	jest.clearAllMocks();
	useResumeStore.setState({ document: resume });
	mockFlush.mockResolvedValue(resume);
	mockFiles.exportFile.mockResolvedValue({ uri: "file:///Ada-Lovelace-Resume.pdf" });
});

describe("Download", () => {
	it("shares the PDF rendered on this device", async () => {
		await renderScreen(<DownloadTab resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.press(screen.getByTestId("export-download"));
		});
		expect(mockFiles.exportFile).toHaveBeenCalledWith(
			expect.objectContaining({ format: "pdf", name: "Ada-Lovelace-Resume", data: resume.data }),
		);
		expect(mockFiles.shareExport).toHaveBeenCalledWith({ uri: "file:///Ada-Lovelace-Resume.pdf" }, "pdf");
	});

	it("says it's preparing while the file is made", async () => {
		mockFiles.exportFile.mockReturnValue(new Promise(() => undefined));
		await renderScreen(<DownloadTab resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.press(screen.getByTestId("export-download"));
		});
		expect(screen.getByText("Preparing file…")).toBeTruthy();
	});

	it("shows why an export failed and offers the PDF instead of a server format", async () => {
		mockFiles.exportFile.mockRejectedValue(
			new Error("Couldn't generate this file. Try again, or download PDF instead."),
		);
		await renderScreen(<DownloadTab resume={resume} offline={false} />);
		await fireEvent.press(screen.getByTestId("export-format-docx"));
		await act(async () => {
			await fireEvent.press(screen.getByTestId("export-download"));
		});
		expect(screen.getByText("Couldn't generate this file. Try again, or download PDF instead.")).toBeTruthy();
		expect(screen.getByText("Share PDF instead")).toBeTruthy();
		expect(mockFiles.shareExport).not.toHaveBeenCalled();
	});

	it("works offline for the PDF only, without saving to the server first", async () => {
		await renderScreen(<DownloadTab resume={resume} offline />);
		expect(screen.getByText(/You're offline\. Download PDF uses this device\./)).toBeTruthy();
		expect(screen.getByTestId("export-format-docx").props.accessibilityState).toMatchObject({ disabled: true });
		await act(async () => {
			await fireEvent.press(screen.getByTestId("export-download"));
		});
		expect(mockFlush).not.toHaveBeenCalled();
		expect(mockFiles.shareExport).toHaveBeenCalled();
	});

	it("makes one file however often the button is pressed", async () => {
		let release: (value: unknown) => void = () => undefined;
		mockFiles.exportFile.mockReturnValue(new Promise((resolve) => (release = resolve)));
		await renderScreen(<DownloadTab resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.press(screen.getByTestId("export-download"));
			await fireEvent.press(screen.getByTestId("export-download"));
		});
		await act(async () => release({ uri: "file:///Ada-Lovelace-Resume.pdf" }));
		expect(mockFiles.exportFile).toHaveBeenCalledTimes(1);
		expect(mockFiles.shareExport).toHaveBeenCalledTimes(1);
	});

	it("exports nothing while the latest edits couldn't be saved", async () => {
		mockFlush.mockRejectedValue(new Error("Couldn't save your changes. Try again before continuing."));
		await renderScreen(<DownloadTab resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.press(screen.getByTestId("export-download"));
		});
		expect(screen.getByText("Couldn't save your changes. Try again before continuing.")).toBeTruthy();
		expect(mockFiles.exportFile).not.toHaveBeenCalled();
	});
});
