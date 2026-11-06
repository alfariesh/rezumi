import { describe, expect, it } from "vite-plus/test";
import { fitSize, isAnimatedGif, looksLikeSvg, pictureFiles } from "./compress";

/** A GIF with `frames` 1 × 1 frames (header, palette, then each frame's descriptor and data). */
function gif(frames: number): Uint8Array {
	const header = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255];
	const frame = [
		// Graphic control extension.
		0x21, 0xf9, 0x04, 0x00, 0x0a, 0x00, 0x00, 0x00,
		// Image descriptor, LZW minimum code size, one data sub-block, terminator.
		0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00,
	];
	return new Uint8Array([...header, ...Array.from({ length: frames }, () => frame).flat(), 0x3b]);
}

const text = (value: string) => new TextEncoder().encode(value);

describe("fitSize", () => {
	it("shrinks the longest side to the limit, keeping proportions", () => {
		expect(fitSize(6000, 4000, 2000)).toEqual({ width: 2000, height: 1333 });
		expect(fitSize(3000, 4000, 800)).toEqual({ width: 600, height: 800 });
	});

	it("never enlarges a small picture", () => {
		expect(fitSize(640, 480, 2000)).toEqual({ width: 640, height: 480 });
	});

	it("keeps at least a pixel on each side", () => {
		expect(fitSize(10_000, 1, 600)).toEqual({ width: 600, height: 1 });
	});
});

describe("looksLikeSvg", () => {
	it("knows SVG by type, name or content", () => {
		expect(looksLikeSvg(text("x"), "image/svg+xml")).toBe(true);
		expect(looksLikeSvg(text("x"), "", "logo.SVG")).toBe(true);
		expect(looksLikeSvg(text('﻿  <?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg">'), "image/png")).toBe(
			true,
		);
	});

	it("leaves real pictures alone", () => {
		expect(looksLikeSvg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png", "a.png")).toBe(false);
		expect(looksLikeSvg(text("<html><body>not svg</body></html>"), "image/jpeg", "fake.jpg")).toBe(false);
	});
});

describe("isAnimatedGif", () => {
	it("counts frames", () => {
		expect(isAnimatedGif(gif(1))).toBe(false);
		expect(isAnimatedGif(gif(2))).toBe(true);
	});

	it("isn't fooled by other files or broken ones", () => {
		expect(isAnimatedGif(text("GIF89a"))).toBe(false);
		expect(isAnimatedGif(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
	});
});

describe("pictureFiles", () => {
	it("keeps pictures by type or extension and drops other files", () => {
		const files = [
			new File(["x"], "photo.jpg", { type: "image/jpeg" }),
			new File(["x"], "phone.HEIC", { type: "" }),
			new File(["x"], "notes.txt", { type: "text/plain" }),
			new File(["x"], "deck.pdf", { type: "application/pdf" }),
		];
		expect(pictureFiles(files).map((file) => file.name)).toEqual(["photo.jpg", "phone.HEIC"]);
	});
});
