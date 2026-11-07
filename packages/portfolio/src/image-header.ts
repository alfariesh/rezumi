/**
 * Reads what a portfolio picture really is from its own bytes: its format and pixel size, from the header alone. The
 * server can't decode pictures on Workers (no `sharp`), and the browser already shrank and re-encoded them, so this
 * only checks that a file is the still raster picture it claims to be and isn't larger than the browser makes them.
 */

type PortfolioImageFormat = { contentType: "image/webp" | "image/jpeg" | "image/png"; extension: string };

type PortfolioImageHeader = PortfolioImageFormat & { width: number; height: number };

type PortfolioImageProblem = "type" | "animated" | "unreadable";

export type PortfolioImageHeaderResult =
	| { ok: true; image: PortfolioImageHeader }
	| { ok: false; reason: PortfolioImageProblem };

const PNG: PortfolioImageFormat = { contentType: "image/png", extension: "png" };
const JPEG: PortfolioImageFormat = { contentType: "image/jpeg", extension: "jpg" };
const WEBP: PortfolioImageFormat = { contentType: "image/webp", extension: "webp" };

const ascii = (bytes: Uint8Array, start: number, length: number) =>
	start + length > bytes.length ? "" : String.fromCharCode(...bytes.subarray(start, start + length));
const u16be = (bytes: Uint8Array, at: number) => ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
const u16le = (bytes: Uint8Array, at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const u24le = (bytes: Uint8Array, at: number) => u16le(bytes, at) | ((bytes[at + 2] ?? 0) << 16);
const u32be = (bytes: Uint8Array, at: number) => u16be(bytes, at) * 0x1_00_00 + u16be(bytes, at + 2);

const readable = (format: PortfolioImageFormat, width: number, height: number): PortfolioImageHeaderResult =>
	width > 0 && height > 0 ? { ok: true, image: { ...format, width, height } } : { ok: false, reason: "unreadable" };

/** PNG: the size from IHDR; an animation control chunk (`acTL`) before the image data makes it an animated PNG. */
function readPng(bytes: Uint8Array): PortfolioImageHeaderResult {
	if (ascii(bytes, 12, 4) !== "IHDR") return { ok: false, reason: "unreadable" };
	const width = u32be(bytes, 16);
	const height = u32be(bytes, 20);
	for (let at = 8; at + 8 <= bytes.length;) {
		const length = u32be(bytes, at);
		const type = ascii(bytes, at + 4, 4);
		if (type === "acTL") return { ok: false, reason: "animated" };
		if (type === "IDAT" || type === "IEND") return readable(PNG, width, height);
		at += 12 + length;
	}
	return { ok: false, reason: "unreadable" };
}

// Start-of-frame markers carry the size; C4 (Huffman tables), C8 (reserved) and CC (arithmetic coding) don't.
const JPEG_FRAME_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** JPEG: walks the marker segments to the first start-of-frame, which holds the height and width. */
function readJpeg(bytes: Uint8Array): PortfolioImageHeaderResult {
	let at = 2;
	while (at + 4 <= bytes.length) {
		if (bytes[at] !== 0xff) return { ok: false, reason: "unreadable" };
		const marker = bytes[at + 1] ?? 0;
		// Fill bytes, and markers that stand alone without a length.
		if (marker === 0xff) {
			at += 1;
			continue;
		}
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
			at += 2;
			continue;
		}
		// End of image, or the image data started, without a frame header first.
		if (marker === 0xd9 || marker === 0xda) return { ok: false, reason: "unreadable" };
		const length = u16be(bytes, at + 2);
		if (length < 2) return { ok: false, reason: "unreadable" };
		if (JPEG_FRAME_MARKERS.has(marker)) {
			if (at + 9 > bytes.length) return { ok: false, reason: "unreadable" };
			return readable(JPEG, u16be(bytes, at + 7), u16be(bytes, at + 5));
		}
		at += 2 + length;
	}
	return { ok: false, reason: "unreadable" };
}

/** WebP: lossy (`VP8 `), lossless (`VP8L`) or extended (`VP8X`, whose flags say whether it's animated). */
function readWebp(bytes: Uint8Array): PortfolioImageHeaderResult {
	switch (ascii(bytes, 12, 4)) {
		case "VP8 ": {
			// A key frame starts with the code 9d 01 2a, then 14-bit width and height.
			if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return { ok: false, reason: "unreadable" };
			return readable(WEBP, u16le(bytes, 26) & 0x3f_ff, u16le(bytes, 28) & 0x3f_ff);
		}
		case "VP8L": {
			if (bytes[20] !== 0x2f || bytes.length < 25) return { ok: false, reason: "unreadable" };
			const [b0, b1, b2, b3] = [bytes[21] ?? 0, bytes[22] ?? 0, bytes[23] ?? 0, bytes[24] ?? 0];
			const width = 1 + (((b1 & 0x3f) << 8) | b0);
			const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
			return readable(WEBP, width, height);
		}
		case "VP8X": {
			if (bytes.length < 30) return { ok: false, reason: "unreadable" };
			if (((bytes[20] ?? 0) & 0x02) !== 0) return { ok: false, reason: "animated" };
			return readable(WEBP, 1 + u24le(bytes, 24), 1 + u24le(bytes, 27));
		}
		default:
			return { ok: false, reason: "unreadable" };
	}
}

/**
 * The picture's format and pixel size from its header, or why it can't be used: `type` for anything but PNG, JPEG or
 * WebP (GIF, SVG, text named `.jpg`), `animated` for animated WebP and PNG, `unreadable` for a broken header.
 */
export function readPortfolioImageHeader(bytes: Uint8Array): PortfolioImageHeaderResult {
	if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return readPng(bytes);
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return readJpeg(bytes);
	if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return readWebp(bytes);
	return { ok: false, reason: "type" };
}
