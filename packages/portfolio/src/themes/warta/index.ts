import type { ThemeRenderer } from "..";
import { WARTA_CSS } from "./css";
import { WARTA_PALETTE } from "./palette";
import { WartaPage } from "./theme";

/** Warta as the renderer uses it. Its options (`headingWeights`, `nameWeight`, `headingDisplay`) belong here. */
export const WARTA_RENDERER: ThemeRenderer = { id: "warta", Page: WartaPage, css: WARTA_CSS, palette: WARTA_PALETTE };
