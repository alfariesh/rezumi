// Letter Download (plans/mobile Phase 08): "Resume + letter" names both files to match, whatever the name field says,
// and the choice falls back to the PDF when the letter lets go of its resume. File work is replaced; the sheet, its
// wording and its rules are the real ones.
import type { LetterDocument } from "@/draft/types";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { LetterShareSheet } from "./share";
import { renderScreen } from "@/test/render-screen";

const mockFiles = {
	exportFile: jest.fn<Promise<unknown>, [{ name: string; format: string }]>(),
	shareExport: jest.fn<Promise<void>, unknown[]>(() => Promise.resolve()),
};
const mockGetResume = jest.fn();

jest.mock("@/features/share/files", () => ({
	exportDirectory: () => ({}),
	exportFile: (options: { name: string; format: string }) => mockFiles.exportFile(options),
	shareExport: (...args: unknown[]) => mockFiles.shareExport(...args),
}));
jest.mock("@/features/share/letter", () => ({ letterWords: () => Promise.resolve({}) }));
jest.mock("./compose", () => ({
	...jest.requireActual("./compose"),
	letterPageData: () => ({}),
}));
jest.mock("./save", () => ({ saveLetter: () => Promise.resolve(true), restoreLetterVersion: jest.fn() }));
jest.mock("./queries", () => ({
	useResumes: () => ({ data: [{ id: "resume-1", name: "Product designer" }], isError: false }),
}));
jest.mock("./page", () => ({ LetterPages: () => null }));
jest.mock("expo-network", () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock("@/api/client", () => ({ client: { resume: { getById: (input: unknown) => mockGetResume(input) } } }));
jest.mock("@/features/documents/queries", () => ({
	useDocumentOperations: () => ({ busy: false, error: null, run: jest.fn() }),
}));
jest.mock("@/features/billing/plan", () => ({
	usePlan: () => null,
	hasPlanFeature: () => true,
	canShowPlans: () => true,
	showPlanAlert: jest.fn(),
}));
jest.mock("@/draft", () => {
	const { create } = require("zustand");
	return { useLetterStore: create(() => ({ document: null, status: "saved" })) };
});
// A sheet that presents when asked, so the sheet's content renders.
jest.mock("@lodev09/react-native-true-sheet", () => {
	const { forwardRef, useImperativeHandle, useState: useMockState } = require("react");
	const TrueSheet = forwardRef((props: { children?: unknown }, ref: unknown) => {
		const [shown, setShown] = useMockState(false);
		useImperativeHandle(ref, () => ({
			present: () => {
				setShown(true);
				return Promise.resolve();
			},
			dismiss: () => {
				setShown(false);
				return Promise.resolve();
			},
			resize: () => Promise.resolve(),
		}));
		return shown ? props.children : null;
	});
	return { TrueSheet, TrueSheetProvider: ({ children }: { children: unknown }) => children };
});

const { useLetterStore } = jest.requireMock<{
	useLetterStore: { setState: (state: object) => void };
}>("@/draft");

const letter = (overrides: Partial<LetterDocument> = {}) =>
	({
		id: "letter-1",
		name: "Lumen letter",
		sourceResumeId: "resume-1",
		isLocked: false,
		style: {
			basics: { name: "Ada Lovelace" },
			metadata: { page: { locale: "en-US" } },
		},
		...overrides,
	}) as unknown as LetterDocument;

async function show(document: LetterDocument) {
	useLetterStore.setState({ document });
	await renderScreen(<LetterShareSheet id="letter-1" open onClose={jest.fn()} />);
}

beforeEach(() => {
	jest.clearAllMocks();
	mockFiles.exportFile.mockImplementation(({ name }) => Promise.resolve({ uri: `file:///${name}.pdf` }));
	mockGetResume.mockResolvedValue({
		id: "resume-1",
		name: "Product designer",
		slug: "product-designer",
		data: { basics: { name: "Ada Lovelace" } },
	});
});

describe("letter Download", () => {
	it("starts from the sender's name and needs a name for one file", async () => {
		await show(letter());
		const field = await screen.findByTestId("export-file-name");
		expect(field.props.value).toBe("Ada-Lovelace-Cover-Letter");
		await fireEvent.changeText(field, "");
		expect(screen.getByTestId("letter-download")).toBeDisabled();
	});

	it("names the resume and the letter to match for “Resume + letter”, whatever the name field says", async () => {
		await show(letter());
		await fireEvent.changeText(await screen.findByTestId("export-file-name"), "");
		await fireEvent.press(screen.getByTestId("export-format-both"));
		expect(screen.queryByTestId("export-file-name")).toBeNull();
		const download = screen.getByTestId("letter-download");
		expect(download).toBeEnabled();
		await act(async () => {
			await fireEvent.press(download);
		});
		expect(mockFiles.exportFile.mock.calls.map(([options]) => options.name)).toEqual([
			"Ada-Lovelace-Resume",
			"Ada-Lovelace-Cover-Letter",
		]);
		expect(mockFiles.shareExport).toHaveBeenCalledTimes(2);
	});

	it("falls back to the PDF when the letter lets go of its resume", async () => {
		await show(letter());
		await fireEvent.press(await screen.findByTestId("export-format-both"));
		await act(async () => useLetterStore.setState({ document: letter({ sourceResumeId: null }) }));
		expect(screen.queryByTestId("export-format-both")).toBeNull();
		expect(screen.getByTestId("export-file-name")).toBeOnTheScreen();
		expect(screen.getByText("Download PDF")).toBeOnTheScreen();
		await act(async () => {
			await fireEvent.press(screen.getByTestId("letter-download"));
		});
		expect(mockFiles.exportFile).toHaveBeenCalledTimes(1);
		expect(mockFiles.exportFile.mock.calls[0]?.[0]).toMatchObject({ format: "pdf", name: "Ada-Lovelace-Cover-Letter" });
	});
});
