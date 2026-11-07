import type { ThemePalette } from "../design";
import type { FontWeight } from "@rezumi/fonts";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ComponentType } from "react";
import { KANVAS_CSS } from "./kanvas/css";
import { KanvasPage } from "./kanvas/theme";
import { LUGAS_CSS } from "./lugas/css";
import { LugasPage } from "./lugas/theme";
import { MOZAIK_CSS } from "./mozaik/css";
import { MozaikPage } from "./mozaik/theme";
import { KANVAS_PALETTE, LUGAS_PALETTE, MOZAIK_PALETTE, PRIMA_PALETTE } from "./palettes";
import { PRIMA_CSS } from "./prima/css";
import { PrimaPage } from "./prima/theme";

/** A theme as the renderer uses it: its page component, its rules, and its neutral colours per mode. */
export type ThemeRenderer = {
	id: PortfolioTheme;
	Page: ComponentType<{ year: number; creditUrl: string }>;
	css: string;
	palette: ThemePalette;
	/** Heading weights the page loads (default 700 and 800). */
	headingWeights?: readonly FontWeight[];
	/** The name's weight, whose file is preloaded (default: the heaviest heading weight). */
	nameWeight?: FontWeight;
	/** `optional` keeps a very large name from reflowing the first screen when its font arrives late (default swap). */
	headingDisplay?: "swap" | "optional";
};

/** Every theme's renderer: the record is complete, so a new theme doesn't build without one. */
const RENDERERS: Record<PortfolioTheme, ThemeRenderer> = {
	lugas: { id: "lugas", Page: LugasPage, css: LUGAS_CSS, palette: LUGAS_PALETTE },
	prima: {
		id: "prima",
		Page: PrimaPage,
		css: PRIMA_CSS,
		palette: PRIMA_PALETTE,
		// Name and titles in 600, metric values in 700, testimonial quotes in 400 (the browser loads it only when used).
		headingWeights: ["400", "600", "700"],
		nameWeight: "600",
	},
	kanvas: {
		id: "kanvas",
		Page: KanvasPage,
		css: KANVAS_CSS,
		headingDisplay: "optional",
		palette: KANVAS_PALETTE,
		// The Bodoni pair's display text is 600; Archivo shares the file with body text, so it adds no download.
		headingWeights: ["600", "700", "800"],
		nameWeight: "800",
	},
	mozaik: { id: "mozaik", Page: MozaikPage, css: MOZAIK_CSS, palette: MOZAIK_PALETTE },
};

/** The themes with a renderer, all of them; `@rezumi/portfolio/editor` lists the same ones without loading them. */
export const RENDERED_THEMES = Object.keys(RENDERERS) as PortfolioTheme[];

export function themeRenderer(theme: PortfolioTheme): ThemeRenderer {
	return RENDERERS[theme];
}
