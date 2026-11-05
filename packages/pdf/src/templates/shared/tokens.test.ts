import { describe, expect, it } from "vite-plus/test";
import { readableAccent } from "./tokens";

// WCAG contrast, recomputed here so the test does not trust the helper's own maths.
const channel = (value: number) => {
	const v = value / 255;
	return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
	const [r, g, b] = [1, 3, 5].map((i) => channel(Number.parseInt(hex.slice(i, i + 2), 16))) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
};

describe("readableAccent", () => {
	it("keeps an accent that already reads on the page", () => {
		expect(readableAccent("#1d4ed8", "#ffffff")).toBe("#1d4ed8");
		expect(readableAccent("#b91c1c", "#ffffff")).toBe("#b91c1c");
	});

	it.each(["#facc15", "#fde047", "#a3e635", "#67e8f9", "#ffffff"])(
		"darkens light accent %s to 3:1 on white",
		(accent) => {
			const text = readableAccent(accent, "#ffffff");
			expect(text).not.toBe(accent);
			expect(contrast(text, "#ffffff")).toBeGreaterThanOrEqual(3);
		},
	);

	it("darkens only as far as needed", () => {
		const text = readableAccent("#facc15", "#ffffff");
		expect(contrast(text, "#ffffff")).toBeLessThan(3.6);
	});

	it("lightens a dark accent on a dark page", () => {
		const text = readableAccent("#1e3a8a", "#111111");
		expect(contrast(text, "#111111")).toBeGreaterThanOrEqual(3);
		expect(luminance(text)).toBeGreaterThan(luminance("#1e3a8a"));
	});
});
