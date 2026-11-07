import type { Sharp } from "sharp";
import { describe, expect, it } from "vite-plus/test";
import sharp from "sharp";
import { readPortfolioImageHeader } from "@rezumi/portfolio/image-header";

const canvas = (width: number, height: number, alpha = false) =>
	sharp({
		create: { width, height, channels: alpha ? 4 : 3, background: alpha ? "#3366ff80" : "#3366ff" },
	});
const bytes = async (image: Sharp) => new Uint8Array(await image.toBuffer());

function chunk(type: string, data: number[] = []) {
	const length = data.length;
	return [
		(length >>> 24) & 0xff,
		(length >>> 16) & 0xff,
		(length >>> 8) & 0xff,
		length & 0xff,
		...[...type].map((char) => char.charCodeAt(0)),
		...data,
		0,
		0,
		0,
		0,
	];
}

const be32 = (value: number) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
const le24 = (value: number) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff];
const text = (value: string) => [...value].map((char) => char.charCodeAt(0));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG header: IHDR, then the given chunks, then image data. */
function png(width: number, height: number, before: number[][] = []) {
	return new Uint8Array([
		...PNG_SIGNATURE,
		...chunk("IHDR", [...be32(width), ...be32(height), 8, 2, 0, 0, 0]),
		...before.flat(),
		...chunk("IDAT", [0]),
	]);
}

/** An extended WebP header (VP8X) with its flags. */
function webpExtended(width: number, height: number, flags: number) {
	const body = [...text("VP8X"), 10, 0, 0, 0, flags, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)];
	return new Uint8Array([...text("RIFF"), ...le24(body.length + 4), 0, ...text("WEBP"), ...body]);
}

describe("readPortfolioImageHeader", () => {
	it("reads the size of real JPEG, PNG and WebP pictures", async () => {
		const cases: [Uint8Array, string, string][] = [
			[await bytes(canvas(640, 480).jpeg()), "image/jpeg", "jpg"],
			[await bytes(canvas(640, 480).jpeg({ progressive: true })), "image/jpeg", "jpg"],
			[await bytes(canvas(640, 480).png()), "image/png", "png"],
			[await bytes(canvas(640, 480).webp({ quality: 80 })), "image/webp", "webp"],
			[await bytes(canvas(640, 480).webp({ lossless: true })), "image/webp", "webp"],
			// Lossy with transparency is the extended format (VP8X).
			[await bytes(canvas(640, 480, true).webp({ quality: 80 })), "image/webp", "webp"],
			[await bytes(canvas(640, 480, true).png()), "image/png", "png"],
		];
		for (const [data, contentType, extension] of cases)
			expect(readPortfolioImageHeader(data)).toEqual({
				ok: true,
				image: { contentType, extension, width: 640, height: 480 },
			});
	});

	it("reads odd and large sizes", async () => {
		expect(readPortfolioImageHeader(await bytes(canvas(1999, 3).webp({ lossless: true })))).toMatchObject({
			image: { width: 1999, height: 3 },
		});
		expect(readPortfolioImageHeader(await bytes(canvas(3, 2001).jpeg()))).toMatchObject({
			image: { width: 3, height: 2001 },
		});
		expect(readPortfolioImageHeader(png(12_000, 9000))).toMatchObject({ image: { width: 12_000, height: 9000 } });
		expect(readPortfolioImageHeader(webpExtended(16_383, 2, 0x10))).toMatchObject({
			image: { width: 16_383, height: 2 },
		});
	});

	it("refuses files that aren't JPEG, PNG or WebP, whatever their name", async () => {
		expect(readPortfolioImageHeader(new TextEncoder().encode("I'm a text file named photo.jpg"))).toEqual({
			ok: false,
			reason: "type",
		});
		expect(readPortfolioImageHeader(await bytes(canvas(4, 4).gif()))).toEqual({ ok: false, reason: "type" });
		expect(
			readPortfolioImageHeader(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
		).toEqual({ ok: false, reason: "type" });
		expect(readPortfolioImageHeader(new Uint8Array())).toEqual({ ok: false, reason: "type" });
	});

	it("refuses animated WebP and PNG pictures", () => {
		expect(readPortfolioImageHeader(webpExtended(100, 100, 0x02))).toEqual({ ok: false, reason: "animated" });
		expect(readPortfolioImageHeader(png(100, 100, [chunk("acTL", [...be32(2), ...be32(0)])]))).toEqual({
			ok: false,
			reason: "animated",
		});
		// Other chunks before the image data are fine.
		expect(readPortfolioImageHeader(png(100, 100, [chunk("tEXt", text("Title"))]))).toMatchObject({ ok: true });
	});

	it("calls a broken header unreadable", async () => {
		const jpeg = await bytes(canvas(64, 64).jpeg());
		expect(readPortfolioImageHeader(jpeg.subarray(0, 20))).toEqual({ ok: false, reason: "unreadable" });
		expect(readPortfolioImageHeader(png(100, 100).subarray(0, 16))).toEqual({ ok: false, reason: "unreadable" });
		expect(readPortfolioImageHeader(png(0, 100))).toEqual({ ok: false, reason: "unreadable" });
		expect(readPortfolioImageHeader(new Uint8Array([...text("RIFF"), 0, 0, 0, 0, ...text("WEBPVP8 ")]))).toEqual({
			ok: false,
			reason: "unreadable",
		});
		// A JPEG whose image data starts before any frame header.
		expect(readPortfolioImageHeader(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toEqual({
			ok: false,
			reason: "unreadable",
		});
	});
});
