import type { ThemePalette } from "../design";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";

/** Lugas' neutrals (`01-desain.md` section 5). */
export const LUGAS_PALETTE: ThemePalette = {
	light: { bg: "#FFFFFF", surface: "#F3F4F6", text: "#111318", muted: "#596070", border: "#E4E6EA" },
	dark: { bg: "#0F1115", surface: "#191C21", text: "#ECEEF1", muted: "#9BA2AD", border: "#272B32" },
};

/**
 * The neutral colours of every theme with a renderer, apart from their CSS so the editor can read them without loading
 * the themes. Its keys are the themes the renderer draws as themselves (`themes/index.ts` has the same ones; a test
 * keeps them in step). Phase 06 adds Prima, Kanvas and Mozaik to both.
 */
export const THEME_PALETTES: Partial<Record<PortfolioTheme, ThemePalette>> = { lugas: LUGAS_PALETTE };
