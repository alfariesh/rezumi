import type { PortfolioView } from "./view";
import type { FontWeight } from "@rezumi/fonts";
import { getWebFont } from "@rezumi/fonts";
import { mixColors, readableAccent, readableOn } from "@rezumi/utils/contrast";

/** A theme's neutral colours in one mode (`01-desain.md` section 5, "Warna netral per tema"). */
type ThemeNeutrals = { bg: string; surface: string; text: string; muted: string; border: string };

export type ThemePalette = { light: ThemeNeutrals; dark: ThemeNeutrals };

/** Trend colours before contrast correction; each mode's are checked against its background. */
const TREND = {
	light: { positive: "#0f7a52", negative: "#b42318" },
	dark: { positive: "#4fd39b", negative: "#ff8a7d" },
} as const;

/** Small text needs 4.5:1 (WCAG AA); the accent as text, trend chips and links all reach it. */
const TEXT_CONTRAST = 4.5;

type SchemeTokens = Record<`--pf-${string}`, string>;

/** Every colour token of one mode, accent ones corrected for contrast against that mode's background. */
function schemeTokens(accent: string, neutrals: ThemeNeutrals, mode: "light" | "dark"): SchemeTokens {
	const accentText = readableAccent(accent, neutrals.bg, TEXT_CONTRAST);
	return {
		"--pf-bg": neutrals.bg,
		"--pf-surface": neutrals.surface,
		"--pf-text": neutrals.text,
		"--pf-muted": neutrals.muted,
		"--pf-border": neutrals.border,
		"--pf-accent": accent,
		"--pf-accent-text": accentText,
		"--pf-on-accent": readableOn(accent, "#111111"),
		// Mixed here rather than with color-mix(): a token built from var() on :root would keep the other mode's value
		// wherever a section switches mode (`02-teknis.md` section 25).
		"--pf-accent-soft": mixColors(accent, neutrals.bg, 0.11),
		"--pf-positive": readableAccent(TREND[mode].positive, neutrals.bg, TEXT_CONTRAST),
		"--pf-negative": readableAccent(TREND[mode].negative, neutrals.bg, TEXT_CONTRAST),
		"--pf-chart": accentText,
	};
}

const declarations = (tokens: Record<string, string>) =>
	Object.entries(tokens)
		.map(([name, value]) => `${name}:${value}`)
		.join(";");

const FALLBACK_STACKS: Record<string, string> = {
	serif: 'ui-serif,Georgia,"Times New Roman",serif',
	monospace: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
	"sans-serif": 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif',
};

const quoteFamily = (family: string) => `"${family.replace(/["\\<>{};]/g, "")}"`;

function fontStack(family: string): string {
	const category = getWebFont(family)?.category ?? "sans-serif";
	return `${quoteFamily(family)},${FALLBACK_STACKS[category] ?? FALLBACK_STACKS["sans-serif"]}`;
}

/**
 * The page's colour and type tokens: light and dark sets, the chosen mode on `<html data-pf-scheme>`, and "follow the
 * device" through `prefers-color-scheme`. Every accent shade is computed here, on the server, for both modes.
 */
export function designCss(view: PortfolioView, palette: ThemePalette): string {
	const { fonts, accent } = view.design;
	const darkTokens = schemeTokens(accent, palette.dark, "dark");
	const light = declarations(schemeTokens(accent, palette.light, "light"));
	const dark = declarations(darkTokens);
	const type = declarations({
		// For areas that stay dark in either mode, such as an intro over a picture.
		"--pf-accent-text-dark": darkTokens["--pf-accent-text"] as string,
		"--pf-font-heading": fontStack(fonts.heading),
		"--pf-font-body": fontStack(fonts.body),
		"--pf-font-mono": fontStack(fonts.mono),
		"--pf-name-stretch": fonts.nameStretch ?? "100%",
		"--pf-name-transform": fonts.nameUppercase ? "uppercase" : "none",
	});
	return [
		`:root{color-scheme:light;${light};${type}}`,
		`:root[data-pf-scheme="dark"]{color-scheme:dark;${dark}}`,
		`@media (prefers-color-scheme:dark){:root[data-pf-scheme="auto"]{color-scheme:dark;${dark}}}`,
	].join("\n");
}

type FontFace = { family: string; weight: FontWeight; italic: boolean; src: string };

const WEIGHTS: FontWeight[] = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];

/** The weight a family has that's closest to `wanted`, preferring the heavier one on a tie. */
function nearestWeight(available: readonly FontWeight[], wanted: FontWeight): FontWeight | null {
	if (!available.length) return null;
	const target = WEIGHTS.indexOf(wanted);
	return [...available].sort((a, b) => {
		const distance = Math.abs(WEIGHTS.indexOf(a) - target) - Math.abs(WEIGHTS.indexOf(b) - target);
		return distance || WEIGHTS.indexOf(b) - WEIGHTS.indexOf(a);
	})[0] as FontWeight;
}

/**
 * The font files a page loads: headings in 700 and 800, body text in 400 and 600 plus 400 italic, at most two
 * families. Files come from the web font list (the same files the resume pages load), with `font-display: swap`.
 */
export function portfolioFontFaces(view: PortfolioView): FontFace[] {
	const wanted = new Map<string, Set<string>>();
	const want = (family: string, weight: FontWeight, italic = false) => {
		const set = wanted.get(family) ?? new Set<string>();
		set.add(`${weight}${italic ? "i" : ""}`);
		wanted.set(family, set);
	};
	const { heading, body } = view.design.fonts;
	want(heading, "700");
	want(heading, "800");
	want(body, "400");
	want(body, "600");
	want(body, "400", true);

	const faces: FontFace[] = [];
	for (const [family, requests] of wanted) {
		const font = getWebFont(family);
		if (!font) continue;
		const seen = new Set<string>();
		for (const request of requests) {
			const italic = request.endsWith("i");
			const weight = nearestWeight(font.weights, request.replace("i", "") as FontWeight);
			if (!weight) continue;
			const key = `${weight}${italic ? "italic" : ""}`;
			const src = (font.files as Record<string, string | undefined>)[key];
			if (!src?.startsWith("https://") || seen.has(key)) continue;
			seen.add(key);
			faces.push({ family, weight, italic, src });
		}
	}
	return faces;
}

export function fontFaceCss(faces: readonly FontFace[]): string {
	return faces
		.map(
			(face) =>
				`@font-face{font-family:${quoteFamily(face.family)};font-weight:${face.weight};font-style:${face.italic ? "italic" : "normal"};font-display:swap;src:url("${encodeURI(face.src).replaceAll('"', "%22")}") format("truetype")}`,
		)
		.join("\n");
}

/** The heading font's heaviest file, which the name uses: worth a preload for a quicker first paint. */
export function preloadFont(view: PortfolioView, faces: readonly FontFace[]): string | null {
	const heading = faces.filter((face) => face.family === view.design.fonts.heading && !face.italic);
	return heading.at(-1)?.src ?? null;
}
