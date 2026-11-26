import { I18nManager } from "react-native";
import { initI18n, i18n, setLocalePreference } from "./index";

const mockRead = jest.fn();

jest.mock("react-native/Libraries/Settings/Settings", () => ({ __esModule: true, default: { set: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "en-US", languageCode: "en" }] }));
jest.mock("expo-asset", () => ({
	Asset: { fromModule: (id: number) => ({ downloadAsync: async () => ({ localUri: id }) }) },
}));
jest.mock("expo-file-system", () => ({
	File: function File(id: number) {
		return { text: () => mockRead(id) };
	},
}));
jest.mock("../../.cache/lingui/en-US.l10n", () => 1, { virtual: true });
jest.mock("../../.cache/lingui/id-ID.l10n", () => 2, { virtual: true });
jest.mock("../../.cache/lingui/ar-SA.l10n", () => 3, { virtual: true });

it("loads the selected catalog on demand and updates text direction for Arabic", async () => {
	mockRead.mockImplementation(async (id) =>
		JSON.stringify({ messages: { demo: id === 1 ? "Search" : id === 2 ? "Cari" : "بحث" } }),
	);
	const direction = jest.spyOn(I18nManager, "forceRTL");
	await initI18n();
	expect(i18n.locale).toBe("en-US");
	expect(mockRead.mock.calls).toEqual([[1]]);
	await setLocalePreference("id-ID");
	expect(i18n._("demo")).toBe("Cari");
	expect(mockRead.mock.calls).toEqual([[1], [2]]);
	await setLocalePreference("ar-SA");
	expect(i18n._("demo")).toBe("بحث");
	expect(direction).toHaveBeenLastCalledWith(true);
	await setLocalePreference(null);
	expect(direction).toHaveBeenLastCalledWith(false);
	direction.mockRestore();
});
