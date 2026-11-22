// The phone drawer (01-desain 2): the sections in the web's order with their counts, a press switching section or
// popping the open one to its top, the avatar that opens it, the account pages and the appearance switch.
import type { BottomTabBarProps } from "expo-router/tabs";
import type { ReactNode } from "react";
import { fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { AppDrawerMenu, DrawerButton, PhoneTabBridge, setAppDrawerOpen, useAppDrawerOpen } from "./app-drawer";
import { renderScreen } from "@/test/render-screen";

const mockRouter = { push: jest.fn(), navigate: jest.fn() };
const mockSetTheme = jest.fn();
let mockUnread: number | undefined = 3;
let mockScheme: "light" | "dark" = "light";

jest.mock("@/features/home/queries", () => ({
	useUnreadCount: () => mockUnread,
	useSidebarCounts: () => ({ documents: 4, applications: 2 }),
}));
jest.mock("@/features/settings/queries", () => ({
	useProfile: () => ({ data: { name: "Ana Putri", email: "ana@example.com", image: null } }),
}));
jest.mock("./account-menu", () => ({
	AccountAvatar: () => null,
	useAccountLinks: () => [
		{ id: "account", label: "Account", icon: "user-circle", href: "/account/account" },
		{ id: "help", label: "Help & legal", icon: "question", href: "/account" },
	],
	useSignOutConfirm: () => ({ ask: jest.fn(), disabled: false, dialog: null }),
}));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, usePathname: () => "/home" }));
jest.mock("@/ui", () => ({
	...jest.requireActual("@/ui"),
	setThemePreference: (value: string) => mockSetTheme(value),
	useColorSchemeValue: () => mockScheme,
}));

const names = ["home", "documents", "applications", "portfolio", "profile"] as const;

function tabProps(hidden: readonly string[] = []) {
	const navigateToTab = jest.fn();
	const emit = jest.fn(() => ({ defaultPrevented: false }));
	const props = {
		state: { index: 0, routes: names.map((name) => ({ key: `${name}-key`, name, params: undefined })) },
		descriptors: Object.fromEntries(
			names.map((name) => [`${name}-key`, { options: hidden.includes(name) ? { hidden: true } : {} }]),
		),
		emitter: { emit },
		navigateToTab,
		insets: { top: 0, right: 0, bottom: 0, left: 0 },
	} as unknown as BottomTabBarProps;
	return { props, navigateToTab, emit };
}

/** The drawer reads the tab navigator through the bridge the tab bar slot renders. */
async function renderMenu(extra: ReactNode = null, hidden: readonly string[] = []) {
	const tabs = tabProps(hidden);
	await renderScreen(
		<>
			<PhoneTabBridge {...tabs.props} />
			<AppDrawerMenu />
			{extra}
		</>,
	);
	return tabs;
}

/** Shows whether the drawer is open, as text the test can read. */
function OpenState() {
	return <Text testID="drawer-open">{String(useAppDrawerOpen())}</Text>;
}

beforeEach(() => {
	jest.clearAllMocks();
	mockUnread = 3;
	mockScheme = "light";
	setAppDrawerOpen(true);
});

describe("the phone drawer", () => {
	it("lists the sections in the web's order, with counts and the unread notifications", async () => {
		await renderMenu();
		const order = screen.getAllByRole("tab").map((tab) => tab.props.testID);
		expect(order).toEqual([
			"drawer-home",
			"drawer-portfolio",
			"drawer-documents",
			"drawer-profile",
			"drawer-applications",
		]);
		expect(screen.getByRole("tab", { name: "Home, 3 unread" })).toBeOnTheScreen();
		expect(screen.getByRole("tab", { name: "Documents, 4" })).toBeOnTheScreen();
		expect(screen.getByText("Ana Putri")).toBeOnTheScreen();
		expect(screen.getByText("ana@example.com")).toBeOnTheScreen();
	});

	it("leaves Portfolio out without access", async () => {
		await renderMenu(null, ["portfolio"]);
		expect(screen.queryByTestId("drawer-portfolio")).toBeNull();
	});

	it("switches section and closes", async () => {
		const tabs = await renderMenu(<OpenState />);
		await fireEvent.press(screen.getByTestId("drawer-documents"));
		expect(tabs.navigateToTab).toHaveBeenCalledWith("documents-key");
		expect(screen.getByTestId("drawer-open")).toHaveTextContent("false");
	});

	it("takes the open section back to its top instead of switching", async () => {
		const tabs = await renderMenu();
		await fireEvent.press(screen.getByTestId("drawer-home"));
		expect(tabs.emit).toHaveBeenCalledWith({ type: "tabPress", target: "home-key", canPreventDefault: true });
		expect(tabs.navigateToTab).not.toHaveBeenCalled();
	});

	it("opens the account pages, New and the other appearance", async () => {
		await renderMenu();
		await fireEvent.press(screen.getByTestId("drawer-link-account"));
		expect(mockRouter.push).toHaveBeenCalledWith("/account/account");
		await fireEvent.press(screen.getByTestId("drawer-new"));
		expect(mockRouter.push).toHaveBeenCalledWith("/new");
		await fireEvent.press(screen.getByRole("button", { name: "Use dark appearance" }));
		expect(mockSetTheme).toHaveBeenCalledWith("dark");
	});
});

describe("the drawer's avatar", () => {
	it("says how many notifications are unread and opens the drawer", async () => {
		setAppDrawerOpen(false);
		await renderScreen(
			<>
				<DrawerButton />
				<OpenState />
			</>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Open menu, 3 unread" }));
		expect(screen.getByTestId("drawer-open")).toHaveTextContent("true");
	});

	it("reads plainly with nothing unread", async () => {
		mockUnread = 0;
		await renderScreen(<DrawerButton />);
		expect(screen.getByRole("button", { name: "Open menu" })).toBeOnTheScreen();
	});
});
