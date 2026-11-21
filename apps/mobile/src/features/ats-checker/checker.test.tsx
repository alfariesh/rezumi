// The ATS checker's screens: a picked file becomes a report, a failed check says why, and a file too large to import
// offers a blank resume instead. The server call, the picker and the file system are replaced.
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { runAtsCheck } from "./check";
import { AtsChecker } from "./checker";
import { renderScreen } from "@/test/render-screen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
	useRouter: () => ({ replace: mockReplace, push: mockPush }),
	Stack: { Screen: () => null },
}));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/features/documents/import-file", () => ({
	ImportError: class extends Error {},
	importDocument: jest.fn(),
}));
jest.mock("./original-page", () => ({ OriginalPage: () => null }));
jest.mock("expo-file-system", () => ({ File: jest.fn(() => ({ size: 1000 })), Paths: { cache: "cache" } }));
jest.mock("expo-document-picker", () => ({
	getDocumentAsync: jest.fn(async () => ({
		canceled: false,
		assets: [{ uri: "file:///resume.pdf", name: "resume.pdf", size: mockSize.value, lastModified: 0 }],
	})),
}));
const mockSize = { value: 200_000 };
jest.mock("./check", () => ({
	...jest.requireActual("./check"),
	runAtsCheck: jest.fn(),
}));

const report = {
	score: 72,
	findings: [
		{ code: "NO_TEXT_LAYER", category: "parseability", severity: "blocker" },
		{ code: "GARBLED_TEXT", category: "parseability", severity: "blocker" },
	],
	tips: [],
	document: { truncated: false, pageCount: 1 },
	jd: null,
};

const pick = async () => {
	await renderScreen(<AtsChecker />);
	fireEvent.press(screen.getByTestId("ats-choose"));
};

beforeEach(() => {
	mockSize.value = 200_000;
	jest.mocked(runAtsCheck).mockReset();
});

test("a picked PDF shows its score, verdict and category rows", async () => {
	jest.mocked(runAtsCheck).mockResolvedValue({ report: report as never, fullText: "Ayu Pratiwi" });
	await pick();
	expect(await screen.findByLabelText("Readability score: 72 out of 100")).toBeTruthy();
	expect(screen.getByText("Mostly readable")).toBeTruthy();
	// The worst category opens first, with its findings.
	expect(screen.getByLabelText("Readability, 2")).toBeTruthy();
	expect(screen.getByText("No text could be read from this file.")).toBeTruthy();
	expect(screen.getByText("Fix these in the editor")).toBeTruthy();
});

test("a failed check goes back to the start with the reason", async () => {
	const { AtsCheckError } = jest.requireActual<typeof import("./check")>("./check");
	jest.mocked(runAtsCheck).mockRejectedValue(new AtsCheckError("You're offline. Connect to check a file."));
	await pick();
	expect(await screen.findByText("You're offline. Connect to check a file.")).toBeTruthy();
	expect(screen.getByText("Choose a PDF")).toBeTruthy();
});

test("a file too large to import offers a blank resume", async () => {
	mockSize.value = 12 * 1024 * 1024;
	jest.mocked(runAtsCheck).mockResolvedValue({ report: report as never, fullText: "" });
	await pick();
	expect(await screen.findByText("This file is 13 MB. Imports take files up to 10 MB.")).toBeTruthy();
	fireEvent.press(screen.getByText("Start blank"));
	await waitFor(() => expect(mockReplace).toHaveBeenCalled());
	expect(screen.queryByText("Fix these in the editor")).toBeNull();
});
