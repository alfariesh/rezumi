import { describe, expect, it } from "vite-plus/test";
import { listingLogoUrl, tintFor, vibrantColor } from "./logo-color";

/** RGBA pixels: `count` of each colour given as [r, g, b, a]. */
const pixels = (...runs: [color: [number, number, number, number], count: number][]) =>
	new Uint8ClampedArray(runs.flatMap(([color, count]) => Array.from({ length: count }, () => color).flat()));

const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const CLEAR: [number, number, number, number] = [0, 0, 0, 0];

describe("vibrantColor", () => {
	it("finds the logo's colour on a white or transparent background", () => {
		const color = vibrantColor(pixels([WHITE, 600], [CLEAR, 300], [[228, 242, 33, 255], 124]));
		expect(color).toEqual({ r: 228, g: 242, b: 33 });
	});

	it("prefers the most covered hue over a few stray pixels", () => {
		const color = vibrantColor(pixels([[20, 90, 220, 255], 200], [[230, 30, 40, 255], 4], [WHITE, 300]));
		expect(color).toEqual({ r: 20, g: 90, b: 220 });
	});

	it("gives the ink of a logo without colour, and nothing for a blank one", () => {
		expect(vibrantColor(pixels([WHITE, 500], [[10, 10, 12, 255], 200]))).toEqual({ r: 10, g: 10, b: 12 });
		expect(vibrantColor(pixels([WHITE, 500], [CLEAR, 500]))).toBeNull();
	});
});

describe("tintFor", () => {
	it("keeps the colour and picks the text that reads on it", () => {
		expect(tintFor({ r: 228, g: 242, b: 33 })).toEqual({ background: "rgb(228 242 33)", foreground: "#18181b" });
		expect(tintFor({ r: 20, g: 90, b: 220 })).toEqual({ background: "rgb(20 90 220)", foreground: "#ffffff" });
		expect(tintFor({ r: 10, g: 10, b: 12 }).foreground).toBe("#ffffff");
	});
});

describe("listingLogoUrl", () => {
	it("reads the logo through Rezumi, only when the listing has one", () => {
		const company = { name: "Lumen", logoUrl: "https://logos.example/lumen.png" };
		expect(listingLogoUrl({ id: "abc", company })).toBe("/api/jobs/listings/abc/logo");
		expect(listingLogoUrl({ id: "abc", company: { name: "Lumen" } })).toBeNull();
	});
});
