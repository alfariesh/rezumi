// The resume editor's document menu: the chrome's ⋯ opens it (or its own ⋯ outside the chrome), Lock editing saves
// first, and Move to Trash leaves the editor with an Undo toast. Draft, printing and the server are stand-ins.
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { DocumentMenu } from "./document-menu";
import { renderScreen } from "@/test/render-screen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockToast = jest.fn();
const mockChrome: { onMenu?: (() => void) | undefined } = {};
const mockServer = {
	setLocked: jest.fn((_input: unknown) => Promise.resolve()),
	trash: jest.fn((_input: unknown) => Promise.resolve()),
	restore: jest.fn((_input: unknown) => Promise.resolve()),
};
const mockDraft = { refresh: jest.fn(() => Promise.resolve()), close: jest.fn(() => Promise.resolve()) };
const mockFlush = jest.fn((_id: string) => Promise.resolve({ tags: [] }));

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock("expo-network", () => ({
	getNetworkStateAsync: () => Promise.resolve({ isConnected: true, isInternetReachable: true }),
}));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => ({
	client: {
		documents: {
			setLocked: (input: unknown) => mockServer.setLocked(input),
			trash: (input: unknown) => mockServer.trash(input),
			restore: (input: unknown) => mockServer.restore(input),
		},
	},
	orpc: {
		documents: { key: () => ["documents"] },
		resume: { key: () => ["resume"] },
		coverLetters: { key: () => ["coverLetters"] },
		applications: { key: () => ["applications"] },
	},
}));
jest.mock("@/draft", () => {
	const { create } = require("zustand");
	return {
		useResumeStore: create(() => ({
			document: {
				id: "r1",
				name: "Product designer",
				isLocked: false,
				data: { metadata: { notes: "" } },
			},
			close: () => mockDraft.close(),
		})),
		resumeFieldFocus: { onFocus: jest.fn(), onBlur: jest.fn() },
	};
});
jest.mock("@/draft/runtime", () => ({ resume: { refresh: () => mockDraft.refresh() } }));
jest.mock("@/features/share/document", () => ({ flushResume: (id: string) => mockFlush(id) }));
jest.mock("@/features/share/files", () => ({ printResume: jest.fn(() => Promise.resolve()) }));
jest.mock("@/features/entries/rich-text-field", () => ({ RichTextField: () => null }));
jest.mock("@/shell/builder-chrome", () => ({
	useBuilderChrome: (slots: { onMenu?: () => void }) => {
		mockChrome.onMenu = slots.onMenu;
	},
}));
jest.mock("@/shell/key-commands", () => ({ useKeyCommands: () => undefined }));
jest.mock("@/ui", () => ({ ...jest.requireActual("@/ui"), showToast: (options: unknown) => mockToast(options) }));
jest.mock("@lodev09/react-native-true-sheet", () => {
	const { forwardRef, useImperativeHandle, useState: useMockState } = require("react");
	type MockSheetProps = { children?: unknown; onDidDismiss?: () => void };
	const TrueSheet = forwardRef((props: MockSheetProps, ref: unknown) => {
		const [shown, setShown] = useMockState(false);
		useImperativeHandle(ref, () => ({
			present: () => {
				setShown(true);
				return Promise.resolve();
			},
			dismiss: () => {
				setShown(false);
				props.onDidDismiss?.();
				return Promise.resolve();
			},
			resize: () => Promise.resolve(),
		}));
		return shown ? props.children : null;
	});
	return { TrueSheet, TrueSheetProvider: ({ children }: { children: unknown }) => children };
});

beforeEach(() => {
	jest.clearAllMocks();
	mockChrome.onMenu = undefined;
});

async function openFromChrome() {
	await renderScreen(<DocumentMenu id="r1" inChrome />);
	expect(mockChrome.onMenu).toBeDefined();
	await act(async () => mockChrome.onMenu?.());
	await waitFor(() => expect(screen.getByText("Lock editing")).toBeTruthy());
}

describe("DocumentMenu", () => {
	it("opens from the editor chrome with the web builder's items", async () => {
		await openFromChrome();
		for (const label of ["Rename…", "Duplicate", "Notes", "Details", "Print", "More download formats", "History"])
			expect(screen.getByText(label)).toBeTruthy();
		expect(screen.getByText("Move to Trash")).toBeTruthy();
		await fireEvent.press(screen.getByText("History"));
		expect(mockPush).toHaveBeenCalledWith("/builder/r1/history");
	});

	it("saves before locking and refreshes the open resume", async () => {
		await openFromChrome();
		await fireEvent.press(screen.getByText("Lock editing"));
		await waitFor(() =>
			expect(mockServer.setLocked).toHaveBeenCalledWith({ type: "resume", id: "r1", isLocked: true }),
		);
		expect(mockFlush).toHaveBeenCalledWith("r1");
		expect(mockDraft.refresh).toHaveBeenCalled();
	});

	it("moves the resume to Trash, leaves the editor and offers Undo", async () => {
		await openFromChrome();
		await fireEvent.press(screen.getByTestId("builder-document-menu-trash"));
		await waitFor(() => expect(mockServer.trash).toHaveBeenCalledWith({ type: "resume", id: "r1" }));
		expect(mockDraft.close).toHaveBeenCalled();
		expect(mockReplace).toHaveBeenCalledWith("/documents");
		const toast = mockToast.mock.calls.find(([options]) => options.undo)?.[0] as {
			title: string;
			undo: { onUndo: () => void };
		};
		expect(toast.title).toBe("“Product designer” moved to Trash");
		toast.undo.onUndo();
		await waitFor(() => expect(mockServer.restore).toHaveBeenCalledWith({ type: "resume", id: "r1" }));
	});

	it("brings its own ⋯ outside the editor chrome", async () => {
		await renderScreen(<DocumentMenu id="r1" />);
		await fireEvent.press(screen.getByRole("button", { name: "Document options" }));
		await waitFor(() => expect(screen.getByText("Lock editing")).toBeTruthy());
		expect(screen.queryByText("More download formats")).toBeNull();
	});
});
