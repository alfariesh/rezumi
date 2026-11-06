import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { readableAccent } from "@rezumi/utils/contrast";
import { THEME_PALETTES } from "./themes/palettes";

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
	const palette = THEME_PALETTES[theme] ?? THEME_PALETTES.lugas;
	if (!palette) return false;
	return readableAccent(accent, palette[scheme].bg, 4.5).toLowerCase() !== accent.toLowerCase();
}
