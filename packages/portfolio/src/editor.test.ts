import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { accentIsCorrected, RENDERED_PORTFOLIO_THEMES } from "./editor";
import { RENDERED_THEMES, themeRenderer } from "./themes";
import { THEME_PALETTES } from "./themes/palettes";

describe("what the editor knows about the themes", () => {
	it("offers exactly the themes the renderer draws: all of them, each as itself", () => {
		expect([...RENDERED_PORTFOLIO_THEMES].sort()).toEqual([...RENDERED_THEMES].sort());
		expect([...RENDERED_THEMES].sort()).toEqual([...PORTFOLIO_THEMES].sort());
		for (const theme of PORTFOLIO_THEMES) {
			expect(themeRenderer(theme).id).toBe(theme);
			expect(themeRenderer(theme).palette).toBe(THEME_PALETTES[theme]);
		}
	});

	it("says when an accent is too light or too dark to read as text", () => {
		// Kunyit on white is too light for small text; the page draws a deeper shade.
		expect(accentIsCorrected("lugas", "#EAB308", "light")).toBe(true);
		expect(accentIsCorrected("lugas", "#1D4ED8", "light")).toBe(false);
		// Samudra on Lugas' dark background needs lightening.
		expect(accentIsCorrected("lugas", "#1D4ED8", "dark")).toBe(true);
		// Each theme against its own neutrals: Prima's dark background lifts Samudra too.
		expect(accentIsCorrected("kanvas", "#EAB308", "light")).toBe(true);
		expect(accentIsCorrected("prima", "#1D4ED8", "dark")).toBe(true);
	});
});
