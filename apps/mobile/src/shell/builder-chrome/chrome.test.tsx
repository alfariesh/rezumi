import type { SaveStatus } from "@rezumi/resume/draft";
import { fireEvent, screen } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { create } from "zustand";
import { DraftChrome } from "./draft-chrome";
import { slot } from "./slots";
import { EditorTopBar } from "./top-bar";
import { renderScreen } from "@/test/render-screen";

const mockGuard = jest.fn();
jest.mock("../unsaved-changes", () => ({ useUnsavedChangesGuard: (options: unknown) => mockGuard(options) }));
jest.mock("../key-commands", () => ({ useKeyCommands: () => undefined }));

type State = {
	document: { name: string } | null;
	status: SaveStatus;
	locked: boolean;
	canUndo: boolean;
	canRedo: boolean;
	undo: () => void;
	redo: () => void;
	retry: () => void;
	updateDocument: (recipe: (draft: { name: string }) => void) => void;
};

function makeStore(overrides: Partial<State> = {}) {
	const store = create<State>((set, get) => ({
		document: { name: "Product designer" },
		status: "saved",
		locked: false,
		canUndo: true,
		canRedo: false,
		undo: jest.fn(),
		redo: jest.fn(),
		retry: jest.fn(),
		updateDocument: (recipe) => {
			const document = { name: get().document?.name ?? "" };
			recipe(document);
			set({ document });
		},
		...overrides,
	}));
	return store;
}

async function renderChrome(store: ReturnType<typeof makeStore>) {
	const onBack = jest.fn();
	await renderScreen(
		<slot.Provider>
			<EditorTopBar fallbackTitle="Resume" onBack={onBack} onExport={jest.fn()} safeTop />
			<DraftChrome useStore={store} />
		</slot.Provider>,
	);
	return { onBack };
}

describe("editor chrome", () => {
	it("shows the name, the save state, undo and redo from the draft", async () => {
		const store = makeStore();
		const { onBack } = await renderChrome(store);

		expect(screen.getByRole("button", { name: "Document name: Product designer" })).toBeTruthy();
		expect(screen.getByText("Saved")).toBeTruthy();
		expect(screen.getByLabelText("Redo").props.accessibilityState).toMatchObject({ disabled: true });

		await fireEvent.press(screen.getByLabelText("Undo"));
		expect(store.getState().undo).toHaveBeenCalled();
		await fireEvent.press(screen.getByLabelText("Back"));
		expect(onBack).toHaveBeenCalled();
	});

	it("renames in place", async () => {
		const store = makeStore();
		await renderChrome(store);

		await fireEvent.press(screen.getByRole("button", { name: "Document name: Product designer" }));
		await fireEvent.changeText(screen.getByTestId("editable-title-input"), "Senior designer");
		await fireEvent(screen.getByTestId("editable-title-input"), "submitEditing");
		expect(store.getState().document?.name).toBe("Senior designer");
		expect(screen.getByRole("button", { name: "Document name: Senior designer" })).toBeTruthy();
	});

	it("locks the name, undo and redo of a locked document", async () => {
		await renderChrome(makeStore({ locked: true }));

		expect(screen.queryByRole("button", { name: /Document name/ })).toBeNull();
		expect(screen.getByText("Locked")).toBeTruthy();
		expect(screen.getByLabelText("Undo").props.accessibilityState).toMatchObject({ disabled: true });
	});

	it("offers Retry after a failed save and guards leaving", async () => {
		const store = makeStore({ status: "error" });
		await renderChrome(store);

		await fireEvent.press(screen.getByRole("button", { name: "Retry saving" }));
		expect(store.getState().retry).toHaveBeenCalled();
		expect(mockGuard).toHaveBeenLastCalledWith(expect.objectContaining({ dirty: true, leaveLabel: "Leave" }));
	});

	it("keeps Back clear of a landscape notch", async () => {
		const insets = { top: 0, bottom: 21, left: 59, right: 47 };
		await renderScreen(
			<SafeAreaInsetsContext value={insets}>
				<slot.Provider>
					<EditorTopBar fallbackTitle="Resume" onBack={jest.fn()} safeTop />
				</slot.Provider>
			</SafeAreaInsetsContext>,
		);
		expect(screen.getByTestId("editor-top-bar")).toHaveStyle({ paddingLeft: 59, paddingRight: 47 });
	});

	it("explains offline editing", async () => {
		await renderChrome(makeStore({ status: "offline" }));

		expect(screen.getByText("Offline · saved on this device")).toBeTruthy();
		expect(screen.getByText(/Changes sync when you're back online/)).toBeTruthy();
		expect(mockGuard).toHaveBeenLastCalledWith(expect.objectContaining({ dirty: false }));
	});
});
