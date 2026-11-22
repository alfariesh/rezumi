// The tab bar and sidebar (plans/mobile Phase 03): Portfolio only for accounts with portfolios, the Home badge for
// unread notifications, the sidebar in the web's order, and a press on another tab switching to it.
import type { BottomTabBarProps } from "expo-router/tabs";
import { fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { AppSidebar, PhoneTabBar } from "./app-tabs";
import { renderScreen } from "@/test/render-screen";
import { useToastBarHeight } from "@/ui";

let mockUnread: number | undefined = 3;
let mockFocused = true;

jest.mock("@/features/home/queries", () => ({
	useUnreadCount: () => mockUnread,
	useSidebarCounts: () => ({ documents: 4, applications: 2 }),
}));
jest.mock("./account-menu", () => ({ AccountButton: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }), useIsFocused: () => mockFocused }));

const names = ["home", "documents", "applications", "portfolio", "profile"] as const;

function tabProps(hidden: readonly string[] = []) {
	const navigateToTab = jest.fn();
	const props = {
		state: { index: 0, routes: names.map((name) => ({ key: `${name}-key`, name, params: undefined })) },
		descriptors: Object.fromEntries(
			names.map((name) => [`${name}-key`, { options: hidden.includes(name) ? { hidden: true } : {} }]),
		),
		emitter: { emit: jest.fn(() => ({ defaultPrevented: false })) },
		navigateToTab,
		insets: { top: 0, right: 0, bottom: 0, left: 0 },
	} as unknown as BottomTabBarProps;
	return { props, navigateToTab };
}

describe("PhoneTabBar", () => {
	beforeEach(() => {
		mockUnread = 3;
		mockFocused = true;
	});

	it("shows the five tabs, Home selected with its unread count", async () => {
		await renderScreen(<PhoneTabBar {...tabProps().props} />);
		for (const name of names) expect(screen.getByTestId(`tab-${name}`)).toBeOnTheScreen();
		expect(screen.getByRole("tab", { name: "Home, 3 unread", selected: true })).toBeOnTheScreen();
		expect(screen.getByText("3")).toBeOnTheScreen();
	});

	it("hides Portfolio for an account without portfolios", async () => {
		await renderScreen(<PhoneTabBar {...tabProps(["portfolio"]).props} />);
		expect(screen.queryByTestId("tab-portfolio")).toBeNull();
		expect(screen.getAllByRole("tab")).toHaveLength(4);
	});

	it("shows no badge at zero unread", async () => {
		mockUnread = 0;
		await renderScreen(<PhoneTabBar {...tabProps().props} />);
		expect(screen.getByRole("tab", { name: "Home", selected: true })).toBeOnTheScreen();
	});

	it("switches to another tab, and leaves a press on the current one to the tab (pop to top)", async () => {
		const { props, navigateToTab } = tabProps();
		await renderScreen(<PhoneTabBar {...props} />);
		await fireEvent.press(screen.getByTestId("tab-documents"));
		expect(navigateToTab).toHaveBeenCalledWith("documents-key");
		await fireEvent.press(screen.getByTestId("tab-home"));
		expect(navigateToTab).toHaveBeenCalledTimes(1);
		expect(props.emitter.emit).toHaveBeenCalledTimes(2);
	});

	it("lifts toasts above itself while it is in front, and lets them down when it goes", async () => {
		function ToastOffset() {
			return <Text testID="toast-offset">{String(useToastBarHeight())}</Text>;
		}
		const height = () => screen.getByTestId("toast-offset");
		// A new element each time, so the bar renders again and reads its focus.
		const ui = () => (
			<>
				<PhoneTabBar {...tabProps().props} />
				<ToastOffset />
			</>
		);
		const { rerender, unmount } = await renderScreen(ui());
		await fireEvent(screen.getByTestId("phone-tab-bar"), "layout", { nativeEvent: { layout: { height: 83 } } });
		expect(height()).toHaveTextContent("83");
		mockFocused = false;
		await rerender(ui());
		expect(height()).toHaveTextContent("0");
		mockFocused = true;
		await rerender(ui());
		expect(height()).toHaveTextContent("83");
		await unmount();
		await renderScreen(<ToastOffset />);
		expect(height()).toHaveTextContent("0");
	});
});

describe("AppSidebar", () => {
	it("lists the sections in the web's order, with counts", async () => {
		await renderScreen(<AppSidebar {...tabProps().props} />);
		const order = screen.getAllByRole("tab").map((tab) => tab.props.testID);
		expect(order).toEqual([
			"sidebar-home",
			"sidebar-portfolio",
			"sidebar-documents",
			"sidebar-profile",
			"sidebar-applications",
		]);
		expect(screen.getByRole("tab", { name: "Documents, 4" })).toBeOnTheScreen();
	});

	it("leaves Portfolio out without access", async () => {
		await renderScreen(<AppSidebar {...tabProps(["portfolio"]).props} />);
		expect(screen.queryByTestId("sidebar-portfolio")).toBeNull();
	});
});
