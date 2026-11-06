import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_STANDARD_SECTIONS } from "./sections";
import {
	defaultPortfolioTheme,
	isFreePortfolioTheme,
	PORTFOLIO_FONT_PAIRS,
	PORTFOLIO_HERO_EFFECTS,
	PORTFOLIO_THEME_INFO,
	PORTFOLIO_THEMES,
	PORTFOLIO_VARIANT_KEYS,
	PORTFOLIO_VARIANT_OPTIONS,
	portfolioThemeLineup,
	themeEffect,
	themeFontPair,
	themeScheme,
	themeVariant,
} from "./themes";

describe("portfolio themes", () => {
	it("ships the Phase 00 lineup, two of them free", () => {
		expect(portfolioThemeLineup.map((theme) => theme.id)).toEqual(["lugas", "prima", "kanvas", "mozaik"]);
		expect(PORTFOLIO_THEMES.filter(isFreePortfolioTheme)).toEqual(["lugas", "prima"]);
		expect(defaultPortfolioTheme).toBe("lugas");
	});

	it("matches the defaults the owner approved", () => {
		const summary = Object.fromEntries(
			portfolioThemeLineup.map((theme) => [
				theme.id,
				[theme.defaultScheme, theme.effects[0], theme.variants.metric[0], theme.fontPairs[0]],
			]),
		);
		expect(summary).toEqual({
			lugas: ["light", "fade-up", "big", "jakarta"],
			prima: ["light", "none", "kpi", "source-plex"],
			kanvas: ["dark", "vector-hover", "big", "archivo"],
			mozaik: ["light", "gradient", "kpi", "bricolage-onest"],
		});
	});

	it("declares only known variants, effects and font pairs, with every theme taking every metric variant", () => {
		for (const theme of portfolioThemeLineup) {
			for (const key of PORTFOLIO_VARIANT_KEYS) {
				const supported = theme.variants[key] as readonly string[];
				expect(supported.length, `${theme.id}.${key}`).toBeGreaterThan(0);
				for (const value of supported) expect(PORTFOLIO_VARIANT_OPTIONS[key]).toContain(value);
			}
			expect([...theme.variants.metric].sort()).toEqual(["ba", "big", "kpi"]);
			expect(theme.effects).toContain("none");
			for (const effect of theme.effects) expect(PORTFOLIO_HERO_EFFECTS).toContain(effect);
			expect(theme.fontPairs.length).toBeGreaterThanOrEqual(5);
			for (const pair of theme.fontPairs) expect(PORTFOLIO_FONT_PAIRS).toHaveProperty(pair);
			expect([...theme.sectionOrder].sort()).toEqual([...PORTFOLIO_STANDARD_SECTIONS].sort());
			expect(theme.sectionOrder.at(-1)).toBe("contact");
		}
		// Prima stays formal and Kanvas's huge name doesn't suit letter scrambling (`01-desain.md` section 18).
		expect(PORTFOLIO_THEME_INFO.prima.effects).not.toContain("gradient");
		expect(PORTFOLIO_THEME_INFO.prima.effects).not.toContain("vector-hover");
		expect(PORTFOLIO_THEME_INFO.kanvas.effects).not.toContain("scramble");
	});

	it("falls back to the theme's own choice when a stored one doesn't suit it", () => {
		expect(themeVariant("prima", "work", "grid-3")).toBe("grid-3");
		expect(themeVariant("prima", "work", "bento")).toBe("grid-2");
		expect(themeVariant("mozaik", "hero", undefined)).toBe("bento");
		expect(themeEffect("prima", "gradient")).toBe("none");
		expect(themeEffect("mozaik", "scramble")).toBe("scramble");
		expect(themeEffect("kanvas", undefined)).toBe("vector-hover");
		expect(themeFontPair("kanvas", "jakarta")).toBe("archivo");
		expect(themeFontPair("lugas", "manrope")).toBe("manrope");
		expect(themeScheme("kanvas", undefined)).toBe("dark");
		expect(themeScheme("kanvas", "auto")).toBe("auto");
	});
});
