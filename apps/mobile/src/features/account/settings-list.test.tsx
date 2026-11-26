import { fireEvent, screen } from "@testing-library/react-native";
import PreferencesScreen from "./preferences-screen";
import { renderScreen } from "@/test/render-screen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
	Stack: { Screen: () => null },
}));
jest.mock("./queries", () => ({ useProfile: () => ({ data: { timezone: "Asia/Jakarta" } }) }));
jest.mock("@/i18n", () => ({
	getLocalePreference: () => null,
	getDeviceLocale: () => "en-US",
	setLocalePreference: jest.fn(),
}));

it("groups device preferences and opens the selected settings page", async () => {
	await renderScreen(<PreferencesScreen />);
	expect(screen.getByText("Theme")).toBeOnTheScreen();
	expect(screen.getByText("Language")).toBeOnTheScreen();
	expect(screen.getByText("Asia/Jakarta")).toBeOnTheScreen();
	const pages = [
		["Notifications", "/account/notifications"],
		["AI & developer", "/account/ai"],
		["Offline storage", "/account/storage"],
		["Open-source licenses", "/account/licences"],
	] as const;
	for (const [label, href] of pages) {
		await fireEvent.press(screen.getByRole("button", { name: label }));
		expect(mockPush).toHaveBeenLastCalledWith(href);
	}
});
