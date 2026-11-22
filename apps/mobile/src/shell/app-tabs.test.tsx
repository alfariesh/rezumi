// The tablet sidebar (plans/mobile Phase 03): Portfolio only for accounts with portfolios and the sections in the
// web's order with their counts. The phone drawer has its own tests (app-drawer.test.tsx).
import type { BottomTabBarProps } from "expo-router/tabs";
import { screen } from "@testing-library/react-native";
import { AppSidebar } from "./app-tabs";
import { renderScreen } from "@/test/render-screen";

jest.mock("@/features/home/queries", () => ({
	useUnreadCount: () => 3,
	useSidebarCounts: () => ({ documents: 4, applications: 2 }),
}));
jest.mock("./account-menu", () => ({ AccountButton: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const names = ["home", "documents", "applications", "portfolio", "profile"] as const;

function tabProps(hidden: readonly string[] = []) {
	const props = {
		state: { index: 0, routes: names.map((name) => ({ key: `${name}-key`, name, params: undefined })) },
		descriptors: Object.fromEntries(
			names.map((name) => [`${name}-key`, { options: hidden.includes(name) ? { hidden: true } : {} }]),
		),
		emitter: { emit: jest.fn(() => ({ defaultPrevented: false })) },
		navigateToTab: jest.fn(),
		insets: { top: 0, right: 0, bottom: 0, left: 0 },
	} as unknown as BottomTabBarProps;
	return { props };
}

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
