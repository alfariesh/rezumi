import type { ThemeRenderer } from "..";
import { SINTAKS_CSS } from "./css";
import { SINTAKS_PALETTE } from "./palette";
import { SintaksPage } from "./theme";

/**
 * Sintaks as the renderer uses it. Headings load in 700 only: the name, titles and figures are bold, and section titles,
 * labels and code-like details use the theme's mono face (JetBrains Mono, 400 and 700, `monoFont`).
 */
export const SINTAKS_RENDERER: ThemeRenderer = {
	id: "sintaks",
	Page: SintaksPage,
	css: SINTAKS_CSS,
	palette: SINTAKS_PALETTE,
	headingWeights: ["700"],
	nameWeight: "700",
};
