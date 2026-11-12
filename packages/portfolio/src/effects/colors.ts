import type { ThemePalette } from "../design";
import { readableOnNeutrals } from "../themes/palettes";

/** Small text needs 4.5:1; the effect colours meet it on the mode's background (`01-desain.md` section 18). */
const TEXT_CONTRAST = 4.5;

function hexToHsl(hex: string): [number, number, number] {
	const value = Number.parseInt(hex.slice(1, 7), 16);
	const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => channel / 255) as [
		number,
		number,
		number,
	];
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const light = (max + min) / 2;
	const delta = max - min;
	if (!delta) return [0, 0, light];
	const saturation = delta / (1 - Math.abs(2 * light - 1));
	const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
	return [(hue * 60 + 360) % 360, saturation, light];
}

function hslToHex([hue, saturation, light]: [number, number, number]): string {
	const chroma = (1 - Math.abs(2 * light - 1)) * saturation;
	const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = light - chroma / 2;
	const [r, g, b] =
		hue < 60
			? [chroma, x, 0]
			: hue < 120
				? [x, chroma, 0]
				: hue < 180
					? [0, chroma, x]
					: hue < 240
						? [0, x, chroma]
						: hue < 300
							? [x, 0, chroma]
							: [chroma, 0, x];
	return `#${[r, g, b]
		.map((channel) =>
			Math.round((channel + m) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

/** The accent turned around the colour wheel by `degrees`. */
function rotateHue(hex: string, degrees: number): string {
	const [hue, saturation, light] = hexToHsl(hex);
	return hslToHex([(hue + degrees + 360) % 360, saturation, light]);
}

/** Gradient hidup's three colours in one mode: the accent as text and its two neighbours, readable on page and cards. */
export function gradientColors(accent: string, neutrals: { bg: string; surface: string }): [string, string, string] {
	return [accent, rotateHue(accent, 36), rotateHue(accent, -36)].map((colour) =>
		readableOnNeutrals(colour, neutrals, TEXT_CONTRAST),
	) as [string, string, string];
}

/**
 * Gradient hidup's three colours per mode: the accent as text and two neighbours on the colour wheel (±36°), each made
 * readable on that mode's background, plus the dark set for an intro over a picture.
 */
export function gradientTokens(accent: string, palette: ThemePalette): string {
	const colours = (neutrals: { bg: string; surface: string }) => gradientColors(accent, neutrals);
	const declare = (values: string[], suffix = "") =>
		values.map((value, index) => `--pf-fx-${"abc"[index]}${suffix}:${value}`).join(";");
	const light = colours(palette.light);
	const dark = colours(palette.dark);
	return [
		`:root{${declare(light)};${declare(dark, "-dark")}}`,
		// On screens only, as the page's own dark tokens (`designCss`).
		`@media screen{:root[data-pf-scheme="dark"]{${declare(dark)}}}`,
		`@media screen and (prefers-color-scheme:dark){:root[data-pf-scheme="auto"]{${declare(dark)}}}`,
	].join("\n");
}
