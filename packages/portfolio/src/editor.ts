import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { gradientColors } from "./effects/colors";
import { LUGAS_PALETTE, readableOnNeutrals, THEME_PALETTES } from "./themes/palettes";

// What the editor needs to know about the themes without loading them (and React's server renderer): which ones it can
// offer, and how they treat an accent colour.

/** The themes the renderer draws as themselves, in gallery order: the editor offers only these (Phase 06 adds the rest). */
export const RENDERED_PORTFOLIO_THEMES: readonly PortfolioTheme[] = PORTFOLIO_THEMES.filter(
	(theme) => THEME_PALETTES[theme],
);

/**
 * Whether the page draws `accent` as text in a darker or lighter tone, to keep links and accent text readable on the
 * theme's background in that mode (`01-desain.md` section 6). The editor says so beside the colour. A theme without a
 * renderer draws as Lugas, so it is checked against Lugas' background.
 */
export function accentIsCorrected(theme: PortfolioTheme, accent: string, scheme: "light" | "dark"): boolean {
	const palette = THEME_PALETTES[theme] ?? LUGAS_PALETTE;
	return readableOnNeutrals(accent, palette[scheme]).toLowerCase() !== accent.toLowerCase();
}

/**
 * The colours an intro effect demo needs, as the page would draw them for `theme` in `mode`: background, text, the
 * accent as text, and Gradien hidup's three colours.
 */
export function effectDemoColors(theme: PortfolioTheme, accent: string, mode: "light" | "dark") {
	const palette = (THEME_PALETTES[theme] ?? LUGAS_PALETTE)[mode];
	return {
		bg: palette.bg,
		text: palette.text,
		accentText: readableOnNeutrals(accent, palette),
		gradient: gradientColors(accent, palette),
	};
}
