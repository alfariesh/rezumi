import type { ThemeRenderer } from "..";
import { WARTA_CSS } from "./css";
import { WARTA_PALETTE } from "./palette";
import { WartaPage } from "./theme";

/**
 * Warta as the renderer uses it. The serif loads in 500 (the name, section titles, quotes, the drop cap) and 600 (the
 * articles' headlines); the name preloads in 500.
 */
export const WARTA_RENDERER: ThemeRenderer = {
	id: "warta",
	Page: WartaPage,
	css: WARTA_CSS,
	palette: WARTA_PALETTE,
	headingWeights: ["500", "600"],
	nameWeight: "500",
};
