import type { Sharp } from "sharp";
import { crc32 } from "node:zlib";
import { describe, expect, it } from "vite-plus/test";
import sharp from "sharp";
import { readPortfolioImageHeader } from "@rezumi/portfolio/image-header";
import { stripPictureMetadata } from "./image-metadata";

const GPS_DATUM = "WGS-84 HOME STREET";

const has = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(Buffer.from(text, "latin1"));

const base = (width = 64, height = 40) =>
	sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 200 } } });

/** EXIF with a GPS tag and a camera, XMP with a creator: what a phone or editor writes. */
const withMetadata = (image: Sharp) =>
	image
		.withExif({ IFD0: { Make: "PhoneMaker", Copyright: "Dana Private" }, IFD3: { GPSMapDatum: GPS_DATUM } })
		.withXmp(
			'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" dc:creator="XMP Dana"/></rdf:RDF></x:xmpmeta>',
		);

const pixels = async (bytes: Uint8Array) => sharp(bytes).raw().toBuffer();

function pngChunk(type: string, data: Uint8Array) {
	const head = Buffer.alloc(8);
	head.writeUInt32BE(data.length, 0);
	head.write(type, 4, "latin1");
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "latin1"), data])) >>> 0, 0);
	return Buffer.concat([head, data, crc]);
}

/** A PNG with text, EXIF and time chunks after its header: the chunks tools add. */
async function pngWithChunks() {
	const png = Buffer.from(await base().png().toBuffer());
	const afterHeader = 8 + 25;
	const extra = Buffer.concat([
		pngChunk("tEXt", new Uint8Array(Buffer.from(`Comment\0${GPS_DATUM}`, "latin1"))),
		pngChunk("iTXt", new Uint8Array(Buffer.from("Author\0\0\0\0\0Dana Private", "latin1"))),
		pngChunk("tIME", new Uint8Array([0x07, 0xea, 11, 14, 8, 0, 0])),
		pngChunk("eXIf", new Uint8Array(Buffer.from(`MM\0*${GPS_DATUM}`, "latin1"))),
	]);
	return new Uint8Array(Buffer.concat([png.subarray(0, afterHeader), extra, png.subarray(afterHeader)]));
}

describe("stripping picture metadata", () => {
	it("drops a JPEG's EXIF (GPS included), XMP and comments, and keeps its pixels", async () => {
		const before = new Uint8Array(await withMetadata(base().jpeg({ quality: 90 })).toBuffer());
		expect(has(before, GPS_DATUM)).toBe(true);
		expect(has(before, "XMP Dana")).toBe(true);
		const stripped = stripPictureMetadata(before, "image/jpeg");
		if (!stripped) throw new Error("Not stripped");
		expect(stripped.orientation).toBe(1);
		for (const text of [GPS_DATUM, "Dana Private", "PhoneMaker", "XMP Dana", "Exif"])
			expect(has(stripped.data, text), text).toBe(false);
		const meta = await sharp(stripped.data).metadata();
		expect(meta.exif).toBeUndefined();
		expect(meta.xmp).toBeUndefined();
		expect([meta.width, meta.height]).toEqual([64, 40]);
		expect(readPortfolioImageHeader(stripped.data)).toEqual(readPortfolioImageHeader(before));
		expect(await pixels(stripped.data)).toEqual(await pixels(before));
	});

	it("keeps a progressive JPEG's later scans, its colour profile, and drops what follows the picture", async () => {
		const jpeg = Buffer.from(
			await withMetadata(base(80, 60).jpeg({ progressive: true }))
				.withIccProfile("p3")
				.toBuffer(),
		);
		const before = new Uint8Array(Buffer.concat([jpeg, Buffer.from(`MOTION CLIP ${GPS_DATUM}`, "latin1")]));
		const stripped = stripPictureMetadata(before, "image/jpeg");
		if (!stripped) throw new Error("Not stripped");
		expect(has(stripped.data, GPS_DATUM)).toBe(false);
		expect(has(stripped.data, "MOTION CLIP")).toBe(false);
		expect(has(stripped.data, "ICC_PROFILE")).toBe(true);
		expect((await sharp(stripped.data).metadata()).isProgressive).toBe(true);
		expect(await pixels(stripped.data)).toEqual(await pixels(new Uint8Array(jpeg)));
	});

	it("keeps only the orientation a turned photo needs", async () => {
		const before = new Uint8Array(
			await base()
				.jpeg()
				.withMetadata({ orientation: 6 })
				.withExifMerge({ IFD0: { Make: "PhoneMaker" }, IFD3: { GPSMapDatum: GPS_DATUM } })
				.toBuffer(),
		);
		expect((await sharp(before).metadata()).orientation).toBe(6);
		expect(has(before, GPS_DATUM)).toBe(true);
		const stripped = stripPictureMetadata(before, "image/jpeg");
		if (!stripped) throw new Error("Not stripped");
		expect(stripped.orientation).toBe(6);
		expect(has(stripped.data, GPS_DATUM)).toBe(false);
		expect(has(stripped.data, "PhoneMaker")).toBe(false);
		expect((await sharp(stripped.data).metadata()).orientation).toBe(6);
		expect(await pixels(stripped.data)).toEqual(await pixels(before));
	});

	it("drops a PNG's text, EXIF and time chunks and keeps its image", async () => {
		const before = await pngWithChunks();
		expect((await sharp(before).metadata()).width).toBe(64);
		expect(has(before, GPS_DATUM)).toBe(true);
		const stripped = stripPictureMetadata(before, "image/png");
		if (!stripped) throw new Error("Not stripped");
		for (const text of [GPS_DATUM, "Dana Private", "tEXt", "iTXt", "tIME", "eXIf"])
			expect(has(stripped.data, text), text).toBe(false);
		expect(readPortfolioImageHeader(stripped.data)).toEqual(readPortfolioImageHeader(before));
		expect(await pixels(stripped.data)).toEqual(await pixels(before));
		// Anything after the end chunk goes too.
		const trailing = new Uint8Array(Buffer.concat([Buffer.from(before), Buffer.from(GPS_DATUM, "latin1")]));
		expect(has(stripPictureMetadata(trailing, "image/png")?.data ?? new Uint8Array(), GPS_DATUM)).toBe(false);
	});

	it("drops a WebP's EXIF and XMP chunks, clears their flags and fixes its size", async () => {
		const before = new Uint8Array(await withMetadata(base().webp({ quality: 80 })).toBuffer());
		expect(has(before, GPS_DATUM)).toBe(true);
		expect(has(before, "XMP ")).toBe(true);
		const stripped = stripPictureMetadata(before, "image/webp");
		if (!stripped) throw new Error("Not stripped");
		for (const text of [GPS_DATUM, "XMP Dana", "EXIF", "XMP "]) expect(has(stripped.data, text), text).toBe(false);
		const view = Buffer.from(stripped.data);
		expect(view.readUInt32LE(4)).toBe(view.length - 8);
		if (view.toString("latin1", 12, 16) === "VP8X") expect((view[20] ?? 0) & 0x0c).toBe(0);
		const meta = await sharp(stripped.data).metadata();
		expect(meta.exif).toBeUndefined();
		expect(meta.xmp).toBeUndefined();
		expect(readPortfolioImageHeader(stripped.data)).toEqual(readPortfolioImageHeader(before));
		expect(await pixels(stripped.data)).toEqual(await pixels(before));
	});

	it("leaves pictures without metadata as they are", async () => {
		const jpeg = new Uint8Array(await base().jpeg().toBuffer());
		const webp = new Uint8Array(await base().webp().toBuffer());
		const png = new Uint8Array(await base().png().toBuffer());
		expect(await pixels(stripPictureMetadata(jpeg, "image/jpeg")?.data ?? jpeg)).toEqual(await pixels(jpeg));
		expect(stripPictureMetadata(webp, "image/webp")?.data).toEqual(webp);
		expect(stripPictureMetadata(png, "image/png")?.data).toEqual(png);
	});

	it("refuses bytes that aren't the well-formed picture their type says", async () => {
		const jpeg = new Uint8Array(await withMetadata(base().jpeg()).toBuffer());
		const png = await pngWithChunks();
		const webp = new Uint8Array(await withMetadata(base().webp()).toBuffer());
		// A segment or chunk whose length runs past the end.
		expect(stripPictureMetadata(jpeg.subarray(0, 40), "image/jpeg")).toBeNull();
		expect(stripPictureMetadata(png.subarray(0, png.length - 30), "image/png")).toBeNull();
		expect(stripPictureMetadata(webp.subarray(0, webp.length - 10), "image/webp")).toBeNull();
		// The wrong format altogether.
		expect(stripPictureMetadata(png, "image/jpeg")).toBeNull();
		expect(stripPictureMetadata(jpeg, "image/png")).toBeNull();
		expect(stripPictureMetadata(jpeg, "image/webp")).toBeNull();
		// Garbage where a JPEG marker should be.
		const broken = jpeg.slice();
		broken[2] = 0x00;
		expect(stripPictureMetadata(broken, "image/jpeg")).toBeNull();
	});
});
