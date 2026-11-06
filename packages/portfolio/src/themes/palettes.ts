import type { ThemePalette } from "../design";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { readableAccent } from "@rezumi/utils/contrast";

/**
 * A colour as small text on one mode of a theme: shifted until it reaches `minimum` against the page background and
 * against cards (`--pf-surface`), which every theme draws text on too. Both sit on the same side (light or dark), so
 * moving away from one never moves closer to the other.
 */
export function readableOnNeutrals(colour: string, neutrals: { bg: string; surface: string }, minimum = 4.5): string {
	return readableAccent(readableAccent(colour, neutrals.bg, minimum), neutrals.surface, minimum);
}

/** Lugas' neutrals (`01-desain.md` section 5). */
export const LUGAS_PALETTE: ThemePalette = {
	light: { bg: "#FFFFFF", surface: "#F3F4F6", text: "#111318", muted: "#596070", border: "#E4E6EA" },
	dark: { bg: "#0F1115", surface: "#191C21", text: "#ECEEF1", muted: "#9BA2AD", border: "#272B32" },
};

/** Prima: white cards on a very light grey page, ink-blue text. */
export const PRIMA_PALETTE: ThemePalette = {
	light: { bg: "#F5F6F8", surface: "#FFFFFF", text: "#0E1726", muted: "#4D596B", border: "#D9DEE6" },
	dark: { bg: "#0B101A", surface: "#121A28", text: "#E7EBF2", muted: "#9BA6B7", border: "#243147" },
};

/** Kanvas: near-black by default, warm greys. */
export const KANVAS_PALETTE: ThemePalette = {
	light: { bg: "#FFFFFF", surface: "#F1F1EF", text: "#121212", muted: "#5B5B58", border: "#E3E3E0" },
	dark: { bg: "#0F0F10", surface: "#1A1A1B", text: "#F2F0EB", muted: "#A8A49C", border: "#2C2B2A" },
};

/** Mozaik: white tiles on a green-grey page. */
export const MOZAIK_PALETTE: ThemePalette = {
	light: { bg: "#EEF1EF", surface: "#FFFFFF", text: "#14201E", muted: "#52605C", border: "#DBE2DF" },
	dark: { bg: "#0B1110", surface: "#141C1B", text: "#E7EFED", muted: "#9BADA9", border: "#24302E" },
};

/**
 * The neutral colours of every theme with a renderer, apart from their CSS so the editor can read them without loading
 * the themes. Its keys are the themes the renderer draws as themselves (`themes/index.ts` has the same ones; a test
 * keeps them in step).
 */
export const THEME_PALETTES: Partial<Record<PortfolioTheme, ThemePalette>> = {
	lugas: LUGAS_PALETTE,
	prima: PRIMA_PALETTE,
	kanvas: KANVAS_PALETTE,
	mozaik: MOZAIK_PALETTE,
};
