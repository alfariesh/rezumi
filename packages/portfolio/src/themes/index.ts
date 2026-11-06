import type { ThemePalette } from "../design";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ComponentType } from "react";
import { LUGAS_CSS, LUGAS_PALETTE } from "./lugas/css";
import { LugasPage } from "./lugas/theme";

/** A theme as the renderer uses it: its page component, its rules, and its neutral colours per mode. */
export type ThemeRenderer = {
	id: PortfolioTheme;
	Page: ComponentType<{ year: number; creditUrl: string }>;
	css: string;
	palette: ThemePalette;
};

const lugas: ThemeRenderer = { id: "lugas", Page: LugasPage, css: LUGAS_CSS, palette: LUGAS_PALETTE };

/**
 * Themes with a renderer. Prima, Kanvas and Mozaik arrive in Phase 06; until then a portfolio stored with one of them
 * draws as Lugas, which reads every variant value it doesn't offer as its own default.
 */
const RENDERERS: Partial<Record<PortfolioTheme, ThemeRenderer>> = { lugas };

export function themeRenderer(theme: PortfolioTheme): ThemeRenderer {
	return RENDERERS[theme] ?? lugas;
}
