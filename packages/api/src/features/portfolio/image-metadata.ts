/**
 * Drops what a picture says about where, when and with what it was taken (EXIF with GPS, XMP, IPTC, comments, text
 * chunks), byte by byte and without decoding it: the server can't re-encode pictures (no `sharp` on Workers), and the
 * editor's uploads lose their metadata by being encoded again in the browser. Pictures AI or an API client adds
 * (`addImage`) skip the browser, so they come through here. The image data, colour profile and what decoders need stay
 * untouched; what follows the image (an appended second picture, a motion clip) goes too. Null for bytes that aren't
 * the well-formed picture their header said.
 */

export type StrippedPicture = {
	data: Uint8Array;
	/** A JPEG's EXIF orientation (1–8), kept because browsers draw the picture turned by it; 1 when it has none. */
	orientation: number;
};

type Format = "image/jpeg" | "image/png" | "image/webp";

const ascii = (bytes: Uint8Array, start: number, length: number) =>
	start + length > bytes.length ? "" : String.fromCharCode(...bytes.subarray(start, start + length));
const u16be = (bytes: Uint8Array, at: number) => ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
const u32be = (bytes: Uint8Array, at: number) => u16be(bytes, at) * 0x1_00_00 + u16be(bytes, at + 2);
const u32le = (bytes: Uint8Array, at: number) =>
	((bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16)) + (bytes[at + 3] ?? 0) * 0x1_00_00_00;

function concat(parts: readonly Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.byteLength;
	}
	return out;
}

export function stripPictureMetadata(data: Uint8Array, format: Format): StrippedPicture | null {
	if (format === "image/jpeg") return stripJpeg(data);
	const stripped = format === "image/png" ? stripPng(data) : stripWebp(data);
	return stripped ? { data: stripped, orientation: 1 } : null;
}

// ── JPEG ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP14 = 0xee;
const APP15 = 0xef;
const COM = 0xfe;
const SOS = 0xda;
const EOI = 0xd9;

/**
 * Whether a JPEG segment stays: everything decoders use (tables, frame and scan headers), JFIF (APP0), an ICC colour
 * profile (APP2 `ICC_PROFILE`) and Adobe's colour transform (APP14). Every other application segment (EXIF and XMP in
 * APP1, IPTC in APP13, maker data, multi-picture indexes) and comments go.
 */
function keepsJpegSegment(marker: number, payload: Uint8Array): boolean {
	if (marker === COM) return false;
	if (marker < APP0 || marker > APP15) return true;
	if (marker === APP0) return ascii(payload, 0, 5) === "JFIF\0";
	if (marker === APP2) return ascii(payload, 0, 12) === "ICC_PROFILE\0";
	return marker === APP14 && ascii(payload, 0, 5) === "Adobe";
}

/** The orientation an EXIF payload (`Exif\0\0` + TIFF) gives the picture, or 1. */
function exifOrientation(payload: Uint8Array): number {
	if (ascii(payload, 0, 6) !== "Exif\0\0") return 1;
	const tiff = payload.subarray(6);
	const order = ascii(tiff, 0, 2);
	if (order !== "II" && order !== "MM") return 1;
	const u16 = (at: number) => (order === "MM" ? u16be(tiff, at) : (tiff[at] ?? 0) | ((tiff[at + 1] ?? 0) << 8));
	const u32 = (at: number) => (order === "MM" ? u32be(tiff, at) : u32le(tiff, at));
	const ifd = u32(4);
	const count = u16(ifd);
	for (let entry = 0; entry < count; entry++) {
		const at = ifd + 2 + entry * 12;
		if (at + 12 > tiff.length) break;
		if (u16(at) === 0x0112) {
			const value = u16(at + 8);
			return value >= 1 && value <= 8 ? value : 1;
		}
	}
	return 1;
}

/** An APP1 segment holding only an EXIF orientation: what browsers need to draw a turned photo upright. */
function orientationSegment(orientation: number): Uint8Array {
	const latin1 = (text: string) => Array.from(text, (character) => character.charCodeAt(0));
	const payload = [
		...latin1("Exif\0\0"),
		// A big-endian TIFF header whose first IFD follows it at offset 8.
		...latin1("MM\0*"),
		0,
		0,
		0,
		8,
		// One entry: tag 0x0112 (Orientation), type SHORT, count 1, the value; then no next IFD.
		0,
		1,
		0x01,
		0x12,
		0,
		3,
		0,
		0,
		0,
		1,
		0,
		orientation,
		0,
		0,
		0,
		0,
		0,
		0,
	];
	const length = payload.length + 2;
	return new Uint8Array([0xff, APP1, length >> 8, length & 0xff, ...payload]);
}

/**
 * Walks the segments, keeping what `keepsJpegSegment` keeps. Scans are copied as they are up to the next marker that
 * isn't part of them (byte stuffing and restart markers are), so progressive pictures keep their later tables and
 * scans; the picture ends at its end-of-image marker and anything appended after it is dropped.
 */
function stripJpeg(data: Uint8Array): StrippedPicture | null {
	if (data[0] !== 0xff || data[1] !== 0xd8) return null;
	const parts: Uint8Array[] = [data.subarray(0, 2)];
	let orientation = 1;
	let at = 2;
	while (at < data.length) {
		if (data[at] !== 0xff) return null;
		let markerAt = at + 1;
		while (data[markerAt] === 0xff) markerAt++;
		const marker = data[markerAt];
		if (marker === undefined) return null;
		if (marker === EOI) {
			parts.push(new Uint8Array([0xff, EOI]));
			break;
		}
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			parts.push(new Uint8Array([0xff, marker]));
			at = markerAt + 1;
			continue;
		}
		const length = u16be(data, markerAt + 1);
		const end = markerAt + 1 + length;
		if (length < 2 || end > data.length) return null;
		const payload = data.subarray(markerAt + 3, end);
		if (marker === APP1 && orientation === 1) orientation = exifOrientation(payload);
		if (keepsJpegSegment(marker, payload)) parts.push(new Uint8Array([0xff, marker]), data.subarray(markerAt + 1, end));
		at = end;
		if (marker !== SOS) continue;
		// The scan's entropy-coded data: up to the next marker other than stuffing (FF00) and restarts (FFD0–FFD7).
		let scan = at;
		while (scan < data.length) {
			if (data[scan] === 0xff) {
				const next = data[scan + 1];
				if (next === undefined) break;
				if (next !== 0x00 && next !== 0xff && !(next >= 0xd0 && next <= 0xd7)) break;
			}
			scan++;
		}
		parts.push(data.subarray(at, scan));
		at = scan;
	}
	// Where EXIF sits: right after the start, or after JFIF when that comes first.
	if (orientation !== 1) parts.splice(parts[1]?.[1] === APP0 ? 3 : 1, 0, orientationSegment(orientation));
	return { data: concat(parts), orientation };
}

// ── PNG ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Text (which tools fill with authors, software, comments and EXIF), EXIF itself and the last-modified time. */
const PNG_METADATA = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

function stripPng(data: Uint8Array): Uint8Array | null {
	if (ascii(data, 0, 8) !== "\x89PNG\r\n\x1a\n") return null;
	const parts: Uint8Array[] = [data.subarray(0, 8)];
	let at = 8;
	while (at + 12 <= data.length) {
		const length = u32be(data, at);
		const type = ascii(data, at + 4, 4);
		const end = at + 12 + length;
		if (end > data.length || !/^[A-Za-z]{4}$/.test(type)) return null;
		if (!PNG_METADATA.has(type)) parts.push(data.subarray(at, end));
		at = end;
		if (type === "IEND") return concat(parts);
	}
	return null;
}

// ── WebP ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const WEBP_EXIF_FLAG = 0x08;
const WEBP_XMP_FLAG = 0x04;

function stripWebp(data: Uint8Array): Uint8Array | null {
	if (ascii(data, 0, 4) !== "RIFF" || ascii(data, 8, 4) !== "WEBP") return null;
	const riffEnd = 8 + u32le(data, 4);
	if (riffEnd > data.length || riffEnd < 12) return null;
	const chunks: Uint8Array[] = [];
	let at = 12;
	while (at < riffEnd) {
		if (at + 8 > riffEnd) return null;
		const type = ascii(data, at, 4);
		const size = u32le(data, at + 4);
		const end = at + 8 + size + (size % 2);
		if (at + 8 + size > riffEnd) return null;
		if (type === "VP8X") {
			const chunk = data.slice(at, Math.min(end, riffEnd));
			if (chunk.length < 9) return null;
			chunk[8] = (chunk[8] ?? 0) & ~(WEBP_EXIF_FLAG | WEBP_XMP_FLAG);
			chunks.push(chunk);
		} else if (type !== "EXIF" && type !== "XMP ") chunks.push(data.subarray(at, Math.min(end, riffEnd)));
		at = end;
	}
	if (!chunks.length) return null;
	const body = concat(chunks);
	const size = body.length + 4;
	// "RIFF", the size of what follows it (little-endian), "WEBP".
	const header = new Uint8Array([
		0x52,
		0x49,
		0x46,
		0x46,
		size & 0xff,
		(size >> 8) & 0xff,
		(size >> 16) & 0xff,
		(size >>> 24) & 0xff,
		0x57,
		0x45,
		0x42,
		0x50,
	]);
	return concat([header, body]);
}
