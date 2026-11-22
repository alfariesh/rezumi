// Applications → List (Phase 10): loading, failed, first run, groups in the list order, a filter with no match,
// offline, the row menu's Move to and Delete, a full swipe to the next stage, and select mode's bulk move. The reads
// and the stage actions are fixtures; the screen, its rows and its wording are the real ones.
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { ApplicationsListScreen } from "./list-screen";
import { useApplicationSearch } from "./search";
import { renderScreen } from "@/test/render-screen";

type Query = { data: unknown; isError: boolean; isPending: boolean; refetch: jest.Mock };
const mockQuery: { current: Query } = {
	current: { data: undefined, isError: false, isPending: true, refetch: jest.fn() },
};
const mockActions = {
	pending: false,
	moveTo: jest.fn(),
	moveMany: jest.fn(),
	remove: jest.fn(),
	removeMany: jest.fn(),
};
const mockOnline = { current: true };
const mockOpen = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, setParams: jest.fn() }) }));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
	subscribeIdentity: () => () => undefined,
}));
jest.mock("@/shell/use-is-tablet", () => ({ useIsTablet: () => false }));
jest.mock("@/api/online", () => ({ useOnline: () => mockOnline.current }));
jest.mock("../queries", () => ({
	useApplications: () => mockQuery.current,
	useApplicationActions: () => mockActions,
	useApplicationDetailPrefetch: () => () => undefined,
}));
jest.mock("../date", () => ({
	useNow: () => new Date("2026-11-20T10:00:00Z"),
	useUserTime: () => ({ timeZone: "UTC", locale: "en" }),
}));
jest.mock("../frame", () => ({
	ApplicationsFrame: ({ children }: { children: unknown }) => children,
	useOpenApplication: () => mockOpen,
	useOpenApplicationId: () => null,
}));
jest.mock("../save-sheet", () => {
	const { Text } = jest.requireActual("react-native");
	return { SaveJobSheet: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <Text>Save a job sheet</Text> : null) };
});
jest.mock("../detail/detail-sheet", () => ({ ApplicationDetailPane: () => null }));
// Legend List measures before it renders rows, which Jest never does: a plain stand-in renders every row.
jest.mock("@legendapp/list/react-native", () => {
	const { ScrollView, View } = jest.requireActual("react-native");
	type MockListProps = {
		data: { key: string }[];
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
// A sheet that presents and dismisses when asked, so the row menu's rows render.
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

const application = (patch: Record<string, unknown>) => ({
	company: "Acme",
	role: "Designer",
	location: null,
	salary: null,
	status: "applied",
	closedReason: null,
	resumeId: null,
	coverLetterId: null,
	source: null,
	tags: [],
	sourceUrl: null,
	companyLogoUrl: null,
	matchScore: null,
	followUpAt: null,
	followUpNote: null,
	contacts: [],
	activity: [],
	appliedAt: new Date("2026-11-18T12:00:00Z"),
	createdAt: new Date("2026-11-18T12:00:00Z"),
	updatedAt: new Date("2026-11-18T12:00:00Z"),
	...patch,
});
const rows = [
	application({ id: "a1", role: "Product designer", company: "Acme", status: "applied", tags: ["remote"] }),
	application({ id: "a2", role: "Frontend engineer", company: "Globex", status: "interview" }),
	application({ id: "a3", role: "Data analyst", company: "Initech", status: "saved" }),
	application({ id: "a4", role: "Old role", company: "Hooli", status: "closed", closedReason: "withdrew" }),
];
const loaded = (data: unknown): Query => ({ data, isError: false, isPending: false, refetch: jest.fn() });

beforeEach(() => {
	jest.clearAllMocks();
	mockOnline.current = true;
	useApplicationSearch.setState({ search: "" });
});

describe("ApplicationsListScreen", () => {
	it("shows the loading shape first", async () => {
		mockQuery.current = { data: undefined, isError: false, isPending: true, refetch: jest.fn() };
		await renderScreen(<ApplicationsListScreen />);
		expect(screen.getByTestId("applications-loading")).toBeTruthy();
	});

	it("offers Try again when the list fails to load", async () => {
		const refetch = jest.fn();
		mockQuery.current = { data: undefined, isError: true, isPending: false, refetch };
		await renderScreen(<ApplicationsListScreen />);
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalled();
	});

	it("starts with Save a job on the first visit", async () => {
		mockQuery.current = loaded([]);
		await renderScreen(<ApplicationsListScreen />);
		expect(screen.getByText("Your job search starts here")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Save a job" }));
		expect(screen.getByText("Save a job sheet")).toBeTruthy();
	});

	it("groups open applications by what needs you first and hides closed ones", async () => {
		mockQuery.current = loaded(rows);
		await renderScreen(<ApplicationsListScreen />);
		const groups = screen.getAllByTestId(/^group-/).map((node) => node.props.testID);
		expect(groups).toEqual(["group-interview", "group-applied", "group-saved"]);
		expect(screen.getByRole("button", { name: "Interview, 1 application" })).toBeTruthy();
		expect(screen.queryByText("Old role")).toBeNull();
		await fireEvent.press(screen.getByRole("switch", { name: "Show closed" }));
		expect(screen.getByText("Old role")).toBeTruthy();
	});

	it("says what matched nothing and clears the filters", async () => {
		mockQuery.current = loaded(rows);
		await renderScreen(<ApplicationsListScreen />);
		await fireEvent.changeText(screen.getByTestId("applications-search"), "zzz");
		expect(screen.getByText("No applications match “zzz”")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Clear filters" }));
		expect(screen.getByText("Product designer")).toBeTruthy();
	});

	it("keeps the last list while offline, with a marker", async () => {
		mockOnline.current = false;
		mockQuery.current = loaded(rows);
		await renderScreen(<ApplicationsListScreen />);
		expect(screen.getByTestId("applications-offline")).toBeTruthy();
		expect(screen.getByText("Product designer")).toBeTruthy();
	});

	it("opens an application with a tap", async () => {
		mockQuery.current = loaded(rows);
		await renderScreen(<ApplicationsListScreen />);
		await fireEvent.press(screen.getByTestId("application-a1"));
		expect(mockOpen).toHaveBeenCalledWith("a1");
	});

	it("moves an application from its menu, and deletes one after confirming", async () => {
		mockQuery.current = loaded(rows);
		await renderScreen(<ApplicationsListScreen />);
		await fireEvent.press(screen.getByRole("button", { name: "Options for Product designer at Acme" }));
		await fireEvent.press(screen.getByTestId("application-menu-move"));
		await fireEvent.press(screen.getByTestId("move-to-screening"));
		expect(mockActions.moveTo).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }), "screening");

		await fireEvent.press(screen.getByRole("button", { name: "Options for Frontend engineer at Globex" }));
		await fireEvent.press(screen.getByTestId("application-menu-delete"));
		await fireEvent.press(await screen.findByRole("button", { name: "Delete application" }));
		expect(mockActions.remove).toHaveBeenCalledWith("a2", expect.any(Function));
	});

	it("closes with a reason from the menu", async () => {
		mockQuery.current = loaded(rows);
		await renderScreen(<ApplicationsListScreen />);
		await fireEvent.press(screen.getByRole("button", { name: "Options for Data analyst at Initech" }));
		await fireEvent.press(screen.getByTestId("application-menu-close"));
		await fireEvent.press(screen.getByTestId("close-reason-no-response"));
		expect(mockActions.moveTo).toHaveBeenCalledWith(expect.objectContaining({ id: "a3" }), "closed", "no-response");
	});

	it("a full swipe moves the row to its next stage", async () => {
		mockQuery.current = loaded([rows[0]]);
		await renderScreen(<ApplicationsListScreen />);
		await fireEvent(screen.getByTestId("application-row-a1"), "layout", {
			nativeEvent: { layout: { width: 300, height: 80 } },
		});
		fireGestureHandler(getByGestureTestId("swipeable-row-full-swipe"), [
			{ state: State.BEGAN, translationX: 0 },
			{ state: State.ACTIVE, translationX: -60 },
			{ state: State.ACTIVE, translationX: -200 },
			{ state: State.END, translationX: -200 },
		]);
		await waitFor(() =>
			expect(mockActions.moveTo).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }), "screening"),
		);
	});

	it("a long press selects, and the bulk bar moves every selected application", async () => {
		mockQuery.current = loaded(rows);
		await renderScreen(<ApplicationsListScreen />);
		await fireEvent(screen.getByTestId("application-a1"), "longPress");
		await fireEvent.press(screen.getByTestId("application-a3"));
		const bar = screen.getByTestId("bulk-bar");
		expect(within(bar).getByText("2 selected")).toBeTruthy();
		await fireEvent.press(within(bar).getByTestId("bulk-move"));
		await fireEvent.press(screen.getByTestId("move-to-interview"));
		expect(mockActions.moveMany).toHaveBeenCalledWith(
			[expect.objectContaining({ id: "a1" }), expect.objectContaining({ id: "a3" })],
			"interview",
		);
		expect(screen.queryByTestId("bulk-bar")).toBeNull();
	});
});
