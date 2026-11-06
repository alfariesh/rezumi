import { describe, expect, it } from "vite-plus/test";
import { contrastRatio, mixColors, readableAccent, readableOn } from "./contrast";

describe("contrast", () => {
	it("measures WCAG contrast", () => {
		expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
		expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
	});

	it("mixes colours", () => {
		expect(mixColors("#000000", "#ffffff", 0.5)).toBe("#808080");
		expect(mixColors("rgba(255, 0, 0, 1)", "#ffffff", 1)).toBe("#ff0000");
	});

	it("keeps an accent that reads and darkens or lightens one that doesn't", () => {
		expect(readableAccent("#1d4ed8", "#ffffff", 4.5)).toBe("#1d4ed8");
		const onWhite = readableAccent("#eab308", "#ffffff", 4.5);
		expect(contrastRatio(onWhite, "#ffffff")).toBeGreaterThanOrEqual(4.5);
		const onDark = readableAccent("#1e3a8a", "#0f1115", 4.5);
		expect(contrastRatio(onDark, "#0f1115")).toBeGreaterThanOrEqual(4.5);
	});

	it("asks for 3:1 by default, as the PDF templates do", () => {
		const text = readableAccent("#facc15", "#ffffff");
		expect(contrastRatio(text, "#ffffff")).toBeGreaterThanOrEqual(3);
		expect(contrastRatio(text, "#ffffff")).toBeLessThan(4.5);
	});

	it("picks white or the ink for text on a coloured block", () => {
		expect(readableOn("#1d4ed8", "#111111")).toBe("#ffffff");
		expect(readableOn("#facc15", "#111111")).toBe("#111111");
	});
});
