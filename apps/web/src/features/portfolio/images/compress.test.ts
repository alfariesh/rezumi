import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
	compressImage,
	decodePicture,
	decodeWidth,
	fitSize,
	headerSize,
	isAnimatedGif,
	looksLikeSvg,
	pictureFiles,
	pictureFormat,
	PortfolioImageError,
} from "./compress";

/** A GIF with `frames` 1 × 1 frames (header, palette, then each frame's descriptor and data). */
function gif(frames: number): Uint8Array<ArrayBuffer> {
	const header = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255];
	const frame = [
		// Graphic control extension.
		0x21, 0xf9, 0x04, 0x00, 0x0a, 0x00, 0x00, 0x00,
		// Image descriptor, LZW minimum code size, one data sub-block, terminator.
		0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00,
	];
	return new Uint8Array([...header, ...Array.from({ length: frames }, () => frame).flat(), 0x3b]);
}

const u32 = (value: number) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
const ascii = (value: string) => [...value].map((char) => char.charCodeAt(0));

/** A PNG's header only (signature, IHDR, an empty IDAT): enough to read its size, nothing to decode. */
function pngHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
	return new Uint8Array([
		0x89,
		...ascii("PNG\r\n\x1a\n"),
		...u32(13),
		...ascii("IHDR"),
		...u32(width),
		...u32(height),
		8,
		6,
		0,
		0,
		0,
		...u32(0),
		...u32(0),
		...ascii("IDAT"),
		...u32(0),
	]);
}

const text = (value: string) => new TextEncoder().encode(value);

/** A decoded picture with no pixels, which `compressImage` refuses right after decoding. */
const emptyBitmap = () => ({ width: 0, height: 0, close: vi.fn() }) as unknown as ImageBitmap;

afterEach(() => {
	vi.unstubAllGlobals();
});

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

describe("decodeWidth", () => {
	it("decodes a large photo at the copy's size, whichever way its orientation tag turns it", () => {
		expect(decodeWidth(6000, 4000, 2000)).toBe(2000);
		expect(decodeWidth(4000, 6000, 2000)).toBe(2000);
	});

	it("decodes at full size when one side is already small, so nothing is enlarged", () => {
		expect(decodeWidth(1600, 1200, 2000)).toBeUndefined();
		expect(decodeWidth(20_000, 1500, 2000)).toBeUndefined();
	});
});

describe("pictureFormat", () => {
	it("writes WebP where the browser can, else PNG for transparency and JPEG otherwise", () => {
		expect(pictureFormat({ webp: true, keepAlpha: true })).toBe("image/webp");
		expect(pictureFormat({ webp: false, keepAlpha: true })).toBe("image/png");
		expect(pictureFormat({ webp: false, keepAlpha: false })).toBe("image/jpeg");
	});

	it("writes a portrait's small copy as JPEG, which the link preview card can draw", () => {
		expect(pictureFormat({ webp: true, keepAlpha: true, jpeg: true })).toBe("image/jpeg");
	});
});

describe("headerSize", () => {
	it("reads the pixel size of PNG, without decoding", async () => {
		expect(await headerSize(new Blob([pngHeader(6000, 4000)]))).toEqual({ width: 6000, height: 4000 });
	});

	it("knows nothing of other formats or broken headers", async () => {
		expect(await headerSize(new Blob([gif(1)]))).toBeNull();
		expect(await headerSize(new Blob([text("not a picture")]))).toBeNull();
	});
});

describe("decodePicture", () => {
	it("turns photos upright and decodes at the width asked for", async () => {
		const create = vi.fn(async () => emptyBitmap());
		await decodePicture(new Blob(), 2000, create);
		expect(create).toHaveBeenCalledWith(expect.any(Blob), {
			imageOrientation: "from-image",
			resizeWidth: 2000,
			resizeQuality: "high",
		});
	});

	it("tries again without the options a browser refuses (Safari 15 and the orientation option)", async () => {
		const create = vi
			.fn<(image: Blob, options?: ImageBitmapOptions) => Promise<ImageBitmap>>()
			.mockRejectedValueOnce(new TypeError("The provided value 'from-image' is not a valid enum value."))
			.mockResolvedValueOnce(emptyBitmap());
		await decodePicture(new Blob(), undefined, create);
		expect(create).toHaveBeenCalledTimes(2);
		expect(create.mock.calls[1]?.[1]).toEqual({});
	});

	it("doesn't hide a file that can't be decoded", async () => {
		const broken = new DOMException("The source image could not be decoded.", "InvalidStateError");
		const create = vi.fn(async () => {
			throw broken;
		});
		await expect(decodePicture(new Blob(), undefined, create)).rejects.toBe(broken);
		expect(create).toHaveBeenCalledTimes(1);
	});
});

describe("compressImage", () => {
	it("refuses a picture over 100 megapixels by its header, before decoding it", async () => {
		const create = vi.fn();
		vi.stubGlobal("createImageBitmap", create);
		const huge = new File([pngHeader(20_000, 20_000)], "huge.png", { type: "image/png" });
		await expect(compressImage(huge)).rejects.toEqual(new PortfolioImageError("too-large"));
		expect(create).not.toHaveBeenCalled();
	});

	it("decodes a large photo at a smaller size, and a logo at a logo's", async () => {
		const create = vi.fn(async () => emptyBitmap());
		vi.stubGlobal("createImageBitmap", create);
		const photo = new File([pngHeader(6000, 4000)], "photo.png", { type: "image/png" });
		await expect(compressImage(photo)).rejects.toEqual(new PortfolioImageError("unreadable"));
		expect(create).toHaveBeenLastCalledWith(photo, expect.objectContaining({ resizeWidth: 2000 }));
		await expect(compressImage(photo, "logo")).rejects.toEqual(new PortfolioImageError("unreadable"));
		expect(create).toHaveBeenLastCalledWith(photo, expect.objectContaining({ resizeWidth: 600 }));
	});

	it("refuses SVG and animated GIFs", async () => {
		await expect(compressImage(new File([text("<svg></svg>")], "logo.svg"))).rejects.toEqual(
			new PortfolioImageError("svg"),
		);
		await expect(compressImage(new File([gif(2)], "moving.gif", { type: "image/gif" }))).rejects.toEqual(
			new PortfolioImageError("animated"),
		);
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
