import type { IconStyle } from "@rezumi/schema/resume/data";
import { expandIcon, iconFiles } from "./forme/hugeicons";

type IconGlyphs = Readonly<Record<string, string>>;

const loading = new Map<IconStyle, Promise<IconGlyphs>>();

/**
 * Every resume icon in one icon style, as SVG shapes for a `0 0 24 24` viewBox in `currentColor`: what an icon picker
 * or preview outside the PDF draws. Each style loads once (≈300 KB gzipped); a failed download is tried again later.
 */
export function loadIconGlyphs(style: IconStyle): Promise<IconGlyphs> {
	let glyphs = loading.get(style);
	if (!glyphs) {
		glyphs = Promise.all([iconFiles[style].common(), iconFiles[style].rest()]).then(
			([common, rest]) =>
				Object.fromEntries(
					Object.entries({ ...common.default, ...rest.default }).map(([name, markup]) => [name, expandIcon(markup)]),
				),
			(error: unknown) => {
				loading.delete(style);
				throw error;
			},
		);
		loading.set(style, glyphs);
	}
	return glyphs;
}
