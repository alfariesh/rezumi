import { describe, expect, it } from "vite-plus/test";
import { accentIsCorrected, RENDERED_PORTFOLIO_THEMES } from "./editor";
import { RENDERED_THEMES } from "./themes";

describe("what the editor knows about the themes", () => {
	it("offers exactly the themes the renderer draws", () => {
		expect([...RENDERED_PORTFOLIO_THEMES].sort()).toEqual([...RENDERED_THEMES].sort());
		expect(RENDERED_PORTFOLIO_THEMES).toContain("lugas");
	});

	it("says when an accent is too light or too dark to read as text", () => {
		// Kunyit on white is too light for small text; the page draws a deeper shade.
		expect(accentIsCorrected("lugas", "#EAB308", "light")).toBe(true);
		expect(accentIsCorrected("lugas", "#1D4ED8", "light")).toBe(false);
		// Samudra on Lugas' dark background needs lightening.
		expect(accentIsCorrected("lugas", "#1D4ED8", "dark")).toBe(true);
		// A theme without a renderer yet is checked as Lugas, which draws it.
		expect(accentIsCorrected("kanvas", "#EAB308", "light")).toBe(true);
	});
});
