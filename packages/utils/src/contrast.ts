import { parseColorString, rgbaStringToHex } from "./color";

/**
 * Colour contrast helpers shared by the PDF templates and the portfolio pages, so both correct a user's accent the
 * same way. Colours are any string `parseColorString` reads (hex or rgb/rgba); results are `#rrggbb`.
 */

type Rgb = [number, number, number];

const rgbOf = (color: string): Rgb => {
	const parsed = parseColorString(color) ?? parseColorString(rgbaStringToHex(color));
	return parsed ? [parsed.r, parsed.g, parsed.b] : [0, 0, 0];
};

const hex = ([r, g, b]: Rgb) =>
	`#${[r, g, b]
		.map((channel) =>
			Math.round(Math.max(0, Math.min(255, channel)))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;

/** `color` laid over `base` at `amount` (0–1), as one opaque colour. */
export const mixColors = (color: string, base: string, amount: number): string => {
	const [r1, g1, b1] = rgbOf(color);
	const [r2, g2, b2] = rgbOf(base);
	return hex([r2 + (r1 - r2) * amount, g2 + (g1 - g2) * amount, b2 + (b1 - b2) * amount]);
};

// WCAG relative luminance of an sRGB colour.
const luminance = (color: string) => {
	const [r, g, b] = rgbOf(color).map((channel) => {
		const value = channel / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	}) as Rgb;
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two colours, from 1 to 21. */
export const contrastRatio = (a: string, b: string): number => {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (light + 0.05) / (dark + 0.05);
};

/**
 * The accent as a text colour on `background`: the accent itself when it reaches `minContrast`, otherwise the accent
 * mixed toward black (or white, on a dark background) just far enough to reach it. The PDF templates ask for 3:1
 * (WCAG's floor for bold labels and large text); the portfolio pages ask for 4.5:1, the floor for small text.
 */
export const readableAccent = (accent: string, background: string, minContrast = 3): string => {
	if (contrastRatio(accent, background) >= minContrast) return accent;
	const toward = contrastRatio("#000000", background) >= contrastRatio("#ffffff", background) ? "#000000" : "#ffffff";
	for (let step = 1; step <= 20; step++) {
		const candidate = mixColors(accent, toward, 1 - step * 0.05);
		if (contrastRatio(candidate, background) >= minContrast) return candidate;
	}
	return toward;
};

/** Text on a block of `background`: white when it reads better than `ink`, otherwise `ink`. */
export const readableOn = (background: string, ink: string): string =>
	contrastRatio("#ffffff", background) >= contrastRatio(ink, background) ? "#ffffff" : ink;
