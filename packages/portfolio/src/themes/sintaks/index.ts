import type { ThemeRenderer } from "..";
import { SINTAKS_CSS } from "./css";
import { SINTAKS_PALETTE } from "./palette";
import { SintaksPage } from "./theme";

/** Sintaks as the renderer uses it. Its options (`headingWeights`, `nameWeight`, `headingDisplay`) belong here. */
export const SINTAKS_RENDERER: ThemeRenderer = {
	id: "sintaks",
	Page: SintaksPage,
	css: SINTAKS_CSS,
	palette: SINTAKS_PALETTE,
};
