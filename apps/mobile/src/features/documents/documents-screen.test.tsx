// Documents (plans/mobile Phase 07 step 3): loading, failed, first run, a search with no match, a row's menu, a
// swipe to Trash with Undo, and Trash's Restore and Delete forever. The reads are fixtures; the screen, its actions
// (through the document operations) and its wording are the real ones.
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { DocumentsScreen } from "./documents-screen";
import { renderScreen } from "@/test/render-screen";

type Query = { data: unknown; isPending: boolean; isError: boolean; refetch: jest.Mock };
const query = (data: unknown, state: Partial<Query> = {}): Query => ({
	data,
	isPending: data === undefined && !state.isError,
	isError: false,
	refetch: jest.fn(() => Promise.resolve()),
	...state,
});

const mockReads: { live: Query; trash: Query } = { live: query(undefined), trash: query(undefined) };
const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockToast = jest.fn();
const mockClient = {
	trash: jest.fn((_input: unknown) => Promise.resolve()),
	restore: jest.fn((_input: unknown) => Promise.resolve()),
	purge: jest.fn((_input: unknown) => Promise.resolve()),
	duplicate: jest.fn((_input: unknown) => Promise.resolve("copy-1")),
};

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, replace: mockPush, setParams: mockSetParams }),
}));
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
			trash: (input: unknown) => mockClient.trash(input),
			restore: (input: unknown) => mockClient.restore(input),
			purge: (input: unknown) => mockClient.purge(input),
		},
		resume: { duplicate: (input: unknown) => mockClient.duplicate(input) },
	},
	orpc: {
		documents: { key: () => ["documents"] },
		resume: { key: () => ["resume"] },
		coverLetters: { key: () => ["coverLetters"] },
		applications: { key: () => ["applications"] },
	},
}));
jest.mock("./queries", () => ({
	...jest.requireActual("./queries"),
	useDocuments: (trashed: boolean) => (trashed ? mockReads.trash : mockReads.live),
}));
// Legend List measures before it renders rows, which Jest never does: a plain stand-in renders every row.
jest.mock("@legendapp/list/react-native", () => {
	const { ScrollView, View } = jest.requireActual("react-native");
	type MockListProps = {
		data: { id: string; type: string }[];
		ListHeaderComponent?: unknown;
		ListEmptyComponent?: unknown;
		keyExtractor: (item: unknown) => string;
		renderItem: (info: { item: unknown; index: number }) => unknown;
	};
	return {
		LegendList: ({ data, ListHeaderComponent, ListEmptyComponent, keyExtractor, renderItem }: MockListProps) => (
			<ScrollView>
				{ListHeaderComponent}
				{data.length === 0
					? ListEmptyComponent
					: data.map((item, index) => <View key={keyExtractor(item)}>{renderItem({ item, index })}</View>)}
			</ScrollView>
		),
	};
});
jest.mock("./pending", () => ({ usePendingDocuments: () => [] }));
jest.mock("./thumbnail", () => ({ Thumbnail: () => null }));
jest.mock("./public-link", () => ({ usePublicLink: () => null }));
jest.mock("@/features/home/queries", () => ({
	useDocumentCounts: () => ({ data: { resume: 2, letter: 1, trash: 1 }, refetch: jest.fn() }),
}));
jest.mock("@/shell/tab-chrome", () => {
	const { Text } = jest.requireActual("react-native");
	return { TabTopBar: ({ title }: { title: string }) => <Text>{title}</Text>, NewFab: () => null };
});
jest.mock("@/ui", () => ({ ...jest.requireActual("@/ui"), showToast: (options: unknown) => mockToast(options) }));
// A sheet that presents and dismisses when asked (reporting the dismissal like the native one), so the menu's rows
// render and it can open again.
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

const day = 86_400_000;
const doc = (patch: Record<string, unknown>) => ({
	type: "resume",
	tags: [],
	isLocked: false,
	isPublic: false,
	slug: null,
	trashedAt: null,
	createdAt: new Date(Date.now() - 10 * day),
	updatedAt: new Date(Date.now() - 2 * day),
	application: null,
	...patch,
});
const designer = doc({ id: "r1", name: "Product designer", tags: ["design"] });

beforeEach(() => {
	jest.clearAllMocks();
	mockReads.live = query(undefined);
	mockReads.trash = query(undefined);
});

describe("Documents", () => {
	it("shows rows in the list's shape while loading", async () => {
		await renderScreen(<DocumentsScreen segment="all" />);
		expect(screen.getByTestId("library-loading")).toBeTruthy();
		expect(screen.getByText("Documents")).toBeTruthy();
	});

	it("offers Try again when the library can't load", async () => {
		mockReads.live = query(undefined, { isError: true });
		await renderScreen(<DocumentsScreen segment="all" />);
		expect(screen.getByText("Couldn't load documents")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		expect(mockReads.live.refetch).toHaveBeenCalled();
	});

	it("leads a first visit to bringing in details or a new document", async () => {
		mockReads.live = query([]);
		await renderScreen(<DocumentsScreen segment="all" />);
		expect(screen.getByText("Let's start with what you have")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "New document" }));
		expect(mockPush).toHaveBeenCalledWith("/new");
	});

	it("says when a search matches nothing and clears it", async () => {
		mockReads.live = query([designer]);
		await renderScreen(<DocumentsScreen segment="all" />);
		expect(screen.getByText("Product designer")).toBeTruthy();
		await fireEvent.changeText(screen.getByLabelText("Search documents"), "pilot");
		expect(screen.getByText("Nothing matches “pilot”")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Clear search and filters" }));
		expect(screen.getByText("Product designer")).toBeTruthy();
	});

	it("says what goes in Letters before the first one", async () => {
		mockReads.live = query([designer]);
		await renderScreen(<DocumentsScreen segment="letter" />);
		expect(screen.getByText("No letters yet")).toBeTruthy();
	});

	it("opens a document's menu from ⋯ and from a long press", async () => {
		mockReads.live = query([designer]);
		await renderScreen(<DocumentsScreen segment="all" />);
		await fireEvent.press(screen.getByRole("button", { name: "Options for Product designer" }));
		await waitFor(() => expect(screen.getByTestId("document-menu-rename")).toBeTruthy());
		for (const label of ["Open", "Duplicate", "Copy for a job…", "Tags…", "History", "Lock editing", "Move to Trash"])
			expect(screen.getByText(label)).toBeTruthy();

		await fireEvent.press(screen.getByTestId("document-menu-copy-for-job"));
		expect(mockPush).toHaveBeenCalledWith("/new?step=copy&sourceResumeId=r1");

		await fireEvent(screen.getByTestId("document-r1"), "longPress");
		await waitFor(() => expect(screen.getByTestId("document-menu-trash")).toBeTruthy());
	});

	it("moves a swiped row to Trash at once, with Undo", async () => {
		mockReads.live = query([designer]);
		await renderScreen(<DocumentsScreen segment="all" />);
		// Jest's window is 750 pt wide (a tablet: cards); rows carry the swipe actions.
		if (screen.queryByRole("button", { name: "List" }))
			await fireEvent.press(screen.getByRole("button", { name: "List" }));
		await fireEvent(screen.getByTestId("document-row-r1"), "layout", {
			nativeEvent: { layout: { width: 350, height: 72 } },
		});
		fireGestureHandler(getByGestureTestId("swipeable-row-full-swipe"), [
			{ state: State.BEGAN, translationX: 0 },
			{ state: State.ACTIVE, translationX: -60 },
			{ state: State.ACTIVE, translationX: -250 },
			{ state: State.END, translationX: -250 },
		]);
		await waitFor(() => expect(mockClient.trash).toHaveBeenCalledWith({ type: "resume", id: "r1" }));
		await waitFor(() =>
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "“Product designer” moved to Trash", undo: expect.anything() }),
			),
		);
		const toast = mockToast.mock.calls.at(-1)?.[0] as { undo: { onUndo: () => void } } | undefined;
		toast?.undo.onUndo();
		await waitFor(() => expect(mockClient.restore).toHaveBeenCalledWith({ type: "resume", id: "r1" }));
	});

	it("restores from Trash and deletes forever only after confirming", async () => {
		const trashed = doc({ id: "r2", name: "Old resume", trashedAt: new Date(Date.now() - 2 * day) });
		mockReads.trash = query([trashed]);
		mockReads.live = query([designer]);
		await renderScreen(<DocumentsScreen segment="trash" />);
		expect(screen.getByText("Resume · 28 days left")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("document-r2"));
		await waitFor(() => expect(screen.getByTestId("document-menu-restore")).toBeTruthy());
		await fireEvent.press(screen.getByTestId("document-menu-restore"));
		await waitFor(() => expect(mockClient.restore).toHaveBeenCalledWith({ type: "resume", id: "r2" }));
		expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Restored “Old resume”" }));

		await fireEvent.press(screen.getByRole("button", { name: "Options for Old resume" }));
		await waitFor(() => expect(screen.getByTestId("document-menu-purge")).toBeTruthy());
		await fireEvent.press(screen.getByTestId("document-menu-purge"));
		expect(await screen.findByText("Delete “Old resume” forever?")).toBeTruthy();
		expect(mockClient.purge).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: "Delete forever" }));
		await waitFor(() => expect(mockClient.purge).toHaveBeenCalledWith({ type: "resume", id: "r2" }));
	});

	it("shows an empty Trash", async () => {
		mockReads.trash = query([]);
		await renderScreen(<DocumentsScreen segment="trash" />);
		expect(screen.getByText("Trash is empty")).toBeTruthy();
	});
});
