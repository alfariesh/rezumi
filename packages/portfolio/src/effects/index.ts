import type { ThemePalette } from "../design";
import type { PortfolioView } from "../view";
import type { PortfolioHeroEffect } from "@rezumi/schema/portfolio/themes";
import { effectTarget } from "../shared/hero-text";
import { gradientTokens } from "./colors";
import { EFFECT_CSS, EFFECT_SHARED_CSS } from "./css";
import { EFFECT_RUNNERS } from "./runtime";

const compact = (source: string) =>
	source
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.join("\n");

/** The inline script of one script effect: its function's own source, called with the page's document. */
export function effectScript(id: PortfolioHeroEffect): string {
	const runner = EFFECT_RUNNERS[id];
	if (!runner) return "";
	const source = compact(String(runner));
	// A transpiler that keeps function names (tsx) may still call its `__name` helper: give it a harmless one.
	const run = source.includes("__name") ? `((__name)=>(${source}))((f)=>f)` : `(${source})`;
	return `${run}(document);`;
}

/** What a page adds for its intro effect: the effect's rules (and colours) and, for script effects, its script. */
export function effectAssets(view: PortfolioView, palette: ThemePalette): { css: string; script: string } {
	const target = effectTarget(view);
	const id = view.design.effect.id;
	if (!target || id === "none") return { css: "", script: "" };
	const css = [EFFECT_SHARED_CSS, EFFECT_CSS[id], id === "gradient" ? gradientTokens(view.design.accent, palette) : ""];
	return { css: css.filter(Boolean).join("\n"), script: effectScript(id) };
}
