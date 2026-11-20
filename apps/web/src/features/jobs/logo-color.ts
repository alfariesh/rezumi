import type { JobListingCard } from "@rezumi/schema/jobs/search";
import { useEffect, useSyncExternalStore } from "react";

/**
 * The colour of a listing's logo, for tinting the open listing in the results (2026-11-20, owner). Logos are read
 * through Rezumi's own address (`/api/jobs/listings/<id>/logo`): the providers' image hosts send no CORS headers, so
 * the browser couldn't read their pixels, and they don't learn who looks at a listing.
 */

/** A listing's logo through Rezumi, or null when the provider gave none. */
export const listingLogoUrl = (listing: Pick<JobListingCard, "id" | "company">) =>
	listing.company.logoUrl ? `/api/jobs/listings/${encodeURIComponent(listing.id)}/logo` : null;

type Rgb = { r: number; g: number; b: number };

/** A colour a widget can sit on, with the text colour that reads on it. */
export type LogoTint = { background: string; foreground: string };

const HUE_BINS = 24;
/** Below this saturation a colour reads as grey: kept apart, used only when the logo has no colour at all. */
const MIN_SATURATION = 0.3;

function hsl({ r, g, b }: Rgb) {
	const max = Math.max(r, g, b) / 255;
	const min = Math.min(r, g, b) / 255;
	const lightness = (max + min) / 2;
	const delta = max - min;
	const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
	let hue = 0;
	if (delta !== 0) {
		const [rr, gg, bb] = [r / 255, g / 255, b / 255];
		if (max === rr) hue = ((gg - bb) / delta + 6) % 6;
		else if (max === gg) hue = (bb - rr) / delta + 2;
		else hue = (rr - gg) / delta + 4;
		hue *= 60;
	}
	return { hue, saturation, lightness };
}

/**
 * The logo's most vibrant colour from its RGBA pixels: the hue most covered by saturated pixels, averaged. A logo
 * without colour (black or grey on white) gives its darkest ink instead; a blank one, null. Transparent and near-white
 * pixels (the logo's background) don't count.
 */
export function vibrantColor(pixels: Uint8ClampedArray): Rgb | null {
	const bins = Array.from({ length: HUE_BINS }, () => ({ weight: 0, r: 0, g: 0, b: 0, count: 0 }));
	const ink = { r: 0, g: 0, b: 0, count: 0 };
	let opaque = 0;
	for (let index = 0; index + 3 < pixels.length; index += 4) {
		if ((pixels[index + 3] ?? 0) < 160) continue;
		const color = { r: pixels[index] ?? 0, g: pixels[index + 1] ?? 0, b: pixels[index + 2] ?? 0 };
		const { hue, saturation, lightness } = hsl(color);
		if (lightness > 0.93) continue;
		opaque++;
		if (saturation >= MIN_SATURATION && lightness > 0.12 && lightness < 0.88) {
			const bin = bins[Math.floor(hue / (360 / HUE_BINS)) % HUE_BINS];
			if (!bin) continue;
			bin.weight += saturation;
			bin.r += color.r;
			bin.g += color.g;
			bin.b += color.b;
			bin.count++;
		} else if (lightness < 0.6) {
			ink.r += color.r;
			ink.g += color.g;
			ink.b += color.b;
			ink.count++;
		}
	}
	if (opaque === 0) return null;
	const best = bins.reduce((top, bin) => (bin.weight > top.weight ? bin : top));
	// A few stray coloured pixels (anti-aliasing) don't make a coloured logo.
	if (best.count >= Math.max(3, opaque * 0.03))
		return { r: best.r / best.count, g: best.g / best.count, b: best.b / best.count };
	if (ink.count >= Math.max(3, opaque * 0.05))
		return { r: ink.r / ink.count, g: ink.g / ink.count, b: ink.b / ink.count };
	return null;
}

/** The dark text colour, #18181b. */
const DARK_TEXT: Rgb = { r: 24, g: 24, b: 27 };

/** sRGB relative luminance (WCAG). */
function luminance({ r, g, b }: Rgb) {
	const channel = (value: number) => {
		const c = value / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The widget's colours from the logo's: the colour as it is, and white or near-black text, whichever reads better. */
export function tintFor(color: Rgb): LogoTint {
	const [r, g, b] = [color.r, color.g, color.b].map(Math.round);
	const light = luminance(color);
	const onWhite = 1.05 / (light + 0.05);
	const onDark = (light + 0.05) / (luminance(DARK_TEXT) + 0.05);
	return { background: `rgb(${r} ${g} ${b})`, foreground: onWhite >= onDark ? "#ffffff" : "#18181b" };
}

/** Read once per logo for the page's life; null when the logo couldn't be read or has no colour. */
const tints = new Map<string, LogoTint | null>();
const reading = new Set<string>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => void listeners.delete(listener);
};

function readTint(src: string): Promise<LogoTint | null> {
	return new Promise((resolve) => {
		const image = new Image();
		image.decoding = "async";
		image.onload = () => {
			try {
				const size = 32;
				const canvas = document.createElement("canvas");
				canvas.width = size;
				canvas.height = size;
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context) return resolve(null);
				context.drawImage(image, 0, 0, size, size);
				const color = vibrantColor(context.getImageData(0, 0, size, size).data);
				resolve(color ? tintFor(color) : null);
			} catch {
				resolve(null);
			}
		};
		image.onerror = () => resolve(null);
		image.src = src;
	});
}

/** The tint of a logo at `src` once it's read; undefined while reading, null without one. */
export function useLogoTint(src: string | null): LogoTint | null | undefined {
	// A store, not state: every widget with the same logo shares one read, and the value lives outside React.
	const tint = useSyncExternalStore(
		subscribe,
		() => (src ? tints.get(src) : null),
		() => undefined,
	);
	useEffect(() => {
		if (!src || tints.has(src) || reading.has(src)) return;
		reading.add(src);
		void readTint(src).then((read) => {
			tints.set(src, read);
			reading.delete(src);
			for (const listener of listeners) listener();
		});
	}, [src]);
	return tint;
}
