import { describe, expect, it } from "vite-plus/test";
import { panelLocale } from "./i18n";

describe("panelLocale", () => {
	it.each([
		["id", "id"],
		["id-ID", "id"],
		["in", "id"],
		["en-US", "en"],
		["de-DE", "en"],
		["", "en"],
	])("%s → %s", (uiLanguage, locale) => {
		expect(panelLocale(uiLanguage)).toBe(locale);
	});
});
