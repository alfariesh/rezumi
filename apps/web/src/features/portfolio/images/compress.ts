import { readPortfolioImageHeader } from "@rezumi/portfolio/image-header";
import { PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";

/**
 * Pictures are made small in the browser before they're uploaded (`02-teknis.md` section 8): the server on Cloudflare
 * can't resize, and a phone photo of 10 MB would waste the visitor's data and the owner's quota. Drawing the picture
 * on a canvas and encoding it again also drops its metadata, GPS location included. The original never leaves the
 * device.
 */

/**
 * Photos: a large copy for the page and a small one for cards. Portraits (the person's own photo): the same, but the
 * small copy is always made, as JPEG, so the link preview card (which can't draw WebP) can show it. Logos: one copy
 * that keeps transparency.
 */
export type PortfolioImageKind = "photo" | "portrait" | "logo";

export type CompressedImage = {
	file: Blob;
	thumbnail: Blob | null;
	width: number;
	height: number;
};

/** Why a file can't become a portfolio picture; the editor says it in words. */
export type ImageProblem = "svg" | "animated" | "unreadable" | "too-large";

export class PortfolioImageError extends Error {
	readonly problem: ImageProblem;
	constructor(problem: ImageProblem) {
		super(`Portfolio image: ${problem}`);
		this.problem = problem;
	}
}

/** Files larger than this aren't read at all: decoding them could run a phone out of memory. */
export const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
/** About a 100-megapixel photo; anything larger is refused, before it's decoded when its header gives the size. */
export const MAX_SOURCE_PIXELS = 100_000_000;
/** How much of a file is read for its pixel size: a JPEG's EXIF data and colour profile can come first. */
const HEADER_BYTES = 256 * 1024;

const QUALITY_STEPS = [0.82, 0.72, 0.62];

/** The size that fits in a square of `max`, keeping proportions; never enlarges. */
export function fitSize(width: number, height: number, max: number): { width: number; height: number } {
	const longest = Math.max(width, height);
	if (longest <= max) return { width, height };
	const scale = max / longest;
	return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * The width to decode a picture at, so a large photo never fills memory at full size: `max`, when both sides are
 * larger than it. Whether or not the photo's orientation tag turns it, its longest side then stays at least `max`
 * (the copies keep their quality) and it's never enlarged. Undefined: decode at full size.
 */
export function decodeWidth(width: number, height: number, max: number): number | undefined {
	return Math.min(width, height) > max ? max : undefined;
}

/** Whether the bytes look like SVG (XML text), whatever the file claims to be. */
export function looksLikeSvg(bytes: Uint8Array, type = "", name = ""): boolean {
	if (type === "image/svg+xml" || /\.svgz?$/i.test(name)) return true;
	const head = new TextDecoder().decode(bytes.subarray(0, 512)).replace(/^﻿/, "").trimStart();
	return head.startsWith("<") && /<svg[\s>]/i.test(head);
}

/** Whether a GIF has more than one frame. Reads the block structure; anything malformed counts as one frame. */
export function isAnimatedGif(bytes: Uint8Array): boolean {
	const ascii = String.fromCharCode(...bytes.subarray(0, 6));
	if (ascii !== "GIF87a" && ascii !== "GIF89a") return false;
	let at = 13;
	const flags = bytes[10] ?? 0;
	if (flags & 0x80) at += 3 * 2 ** ((flags & 0x07) + 1);
	const skipSubBlocks = () => {
		while (at < bytes.length) {
			const size = bytes[at] ?? 0;
			at += 1;
			if (size === 0) return;
			at += size;
		}
	};
	let frames = 0;
	while (at < bytes.length) {
		const marker = bytes[at];
		if (marker === 0x2c) {
			frames += 1;
			if (frames > 1) return true;
			const local = bytes[at + 9] ?? 0;
			at += 10;
			if (local & 0x80) at += 3 * 2 ** ((local & 0x07) + 1);
			at += 1; // LZW minimum code size
			skipSubBlocks();
		} else if (marker === 0x21) {
			at += 2;
			skipSubBlocks();
		} else {
			return false;
		}
	}
	return false;
}

/**
 * The pixel size from the file's header (JPEG, PNG and WebP), read without decoding the picture. Null for other
 * formats (HEIC, AVIF, GIF) and headers that can't be read here; the decoder then decides.
 */
export async function headerSize(file: Blob): Promise<{ width: number; height: number } | null> {
	const header = readPortfolioImageHeader(new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer()));
	return header.ok ? { width: header.image.width, height: header.image.height } : null;
}

type CreateImageBitmap = (image: Blob, options?: ImageBitmapOptions) => Promise<ImageBitmap>;

/**
 * Decodes a picture, turned upright by its orientation tag and at `width` when given. Safari 15 refuses the
 * orientation option (it turns photos upright on its own) and some browsers the resize options: a TypeError tries
 * again with fewer options, so a picture never fails only because of them.
 */
export async function decodePicture(
	file: Blob,
	width: number | undefined,
	create: CreateImageBitmap = (image, options) => createImageBitmap(image, options),
): Promise<ImageBitmap> {
	const resize: ImageBitmapOptions = width ? { resizeWidth: width, resizeQuality: "high" } : {};
	const attempts: ImageBitmapOptions[] = [{ imageOrientation: "from-image", ...resize }, resize];
	if (width) attempts.push({});
	let failure: unknown;
	for (const options of attempts) {
		try {
			return await create(file, options);
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			failure = error;
		}
	}
	throw failure;
}

type Canvas = OffscreenCanvas | HTMLCanvasElement;

function createCanvas(width: number, height: number): Canvas {
	if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

/** Gives a canvas's memory back at once: iOS limits what all canvases together may hold. */
function release(canvas: Canvas) {
	canvas.width = 0;
	canvas.height = 0;
}

function toBlob(canvas: Canvas, type: string, quality?: number): Promise<Blob | null> {
	if ("convertToBlob" in canvas)
		return canvas.convertToBlob({ type, ...(quality === undefined ? {} : { quality }) }).catch(() => null);
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function draw(source: ImageBitmap, width: number, height: number, opaque: boolean): Canvas {
	const canvas = createCanvas(width, height);
	const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
	if (!context) {
		release(canvas);
		throw new PortfolioImageError("unreadable");
	}
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	// JPEG has no transparency: a transparent area would turn black, so it's white instead.
	if (opaque) {
		context.fillStyle = "#ffffff";
		context.fillRect(0, 0, width, height);
	}
	context.drawImage(source, 0, 0, width, height);
	return canvas;
}

/** Draws, encodes and frees the canvas. */
async function drawAndEncode(
	source: ImageBitmap,
	size: { width: number; height: number },
	type: string,
	quality?: number,
) {
	const canvas = draw(source, size.width, size.height, type === "image/jpeg");
	try {
		return await toBlob(canvas, type, quality);
	} finally {
		release(canvas);
	}
}

/** Whether any pixel is see-through, sampled on a small copy (enough to tell a logo on a clear background). */
function hasTransparency(source: ImageBitmap): boolean {
	const { width, height } = fitSize(source.width, source.height, 64);
	const canvas = draw(source, width, height, false);
	try {
		const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
		if (!context) return false;
		const pixels = context.getImageData(0, 0, width, height).data;
		for (let index = 3; index < pixels.length; index += 4) if ((pixels[index] ?? 255) < 250) return true;
		return false;
	} finally {
		release(canvas);
	}
}

let webpProbe: Promise<boolean> | null = null;

/** Whether this browser can write WebP (Safari before 17 writes PNG instead), tried once on a tiny canvas. */
function canEncodeWebp(): Promise<boolean> {
	webpProbe ??= (async () => {
		try {
			const canvas = createCanvas(1, 1);
			const blob = await toBlob(canvas, "image/webp", 0.8);
			release(canvas);
			return blob?.type === "image/webp";
		} catch {
			return false;
		}
	})();
	return webpProbe;
}

export type PictureFormat = "image/webp" | "image/png" | "image/jpeg";

/**
 * The format a copy is written in: JPEG when asked for (a portrait's small copy), else WebP when the browser writes it,
 * else PNG when transparency matters and JPEG otherwise.
 */
export function pictureFormat(options: { webp: boolean; keepAlpha: boolean; jpeg?: boolean }): PictureFormat {
	if (options.jpeg) return "image/jpeg";
	if (options.webp) return "image/webp";
	return options.keepAlpha ? "image/png" : "image/jpeg";
}

/** A canvas that wouldn't write the format asked for; the copy is made in one every browser writes. */
class UnwrittenFormat extends Error {}

async function encodeAs(source: ImageBitmap, max: number, format: PictureFormat) {
	let size = fitSize(source.width, source.height, max);
	for (let attempt = 0; attempt < 6; attempt++) {
		// PNG ignores quality: one try per size.
		for (const quality of format === "image/png" ? [undefined] : QUALITY_STEPS) {
			const blob = await drawAndEncode(source, size, format, quality);
			if (!blob || blob.type !== format) throw new UnwrittenFormat();
			if (blob.size <= PORTFOLIO_UPLOAD.imageBytes) return { blob, ...size };
		}
		size = fitSize(size.width, size.height, Math.round(Math.max(size.width, size.height) * 0.8));
	}
	throw new PortfolioImageError("too-large");
}

/**
 * One copy at most `max` pixels on its longest side and at most the upload limit in bytes (`pictureFormat` decides
 * its format). Quality steps down, then the size, until it fits.
 */
async function encode(
	source: ImageBitmap,
	max: number,
	options: { webp: boolean; keepAlpha: boolean; jpeg?: boolean },
): Promise<{ blob: Blob; width: number; height: number }> {
	const format = pictureFormat(options);
	try {
		return await encodeAs(source, max, format);
	} catch (error) {
		if (!(error instanceof UnwrittenFormat)) throw error;
		const fallback = pictureFormat({ ...options, webp: false });
		if (fallback === format) throw new PortfolioImageError("unreadable");
		return encode(source, max, { ...options, webp: false });
	}
}

/**
 * A picture ready to upload: SVG and animated GIF are refused, a photo over 100 megapixels too (by its header, before
 * it's decoded, when the format tells it), the photo is turned upright (its orientation tag), drawn at most 2,000 px
 * (logos 600 px) and encoded again, which removes its metadata. Photos larger than 800 px also get an 800 px copy for
 * cards; a portrait always gets one, as JPEG.
 */
export async function compressImage(file: File, kind: PortfolioImageKind = "photo"): Promise<CompressedImage> {
	if (file.size > MAX_SOURCE_BYTES) throw new PortfolioImageError("too-large");
	const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
	if (looksLikeSvg(head, file.type, file.name)) throw new PortfolioImageError("svg");
	if (String.fromCharCode(...head.subarray(0, 3)) === "GIF" && isAnimatedGif(new Uint8Array(await file.arrayBuffer())))
		throw new PortfolioImageError("animated");

	const max = kind === "logo" ? PORTFOLIO_UPLOAD.logoSide : PORTFOLIO_UPLOAD.imageSide;
	const size = await headerSize(file);
	if (size && size.width * size.height > MAX_SOURCE_PIXELS) throw new PortfolioImageError("too-large");

	let bitmap: ImageBitmap;
	try {
		bitmap = await decodePicture(file, size ? decodeWidth(size.width, size.height, max) : undefined);
	} catch {
		throw new PortfolioImageError("unreadable");
	}
	try {
		if (!bitmap.width || !bitmap.height) throw new PortfolioImageError("unreadable");
		if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) throw new PortfolioImageError("too-large");
		const keepAlpha = kind === "logo" || hasTransparency(bitmap);
		const webp = await canEncodeWebp();
		const main = await encode(bitmap, max, { webp, keepAlpha });
		const small =
			kind === "portrait"
				? await encode(bitmap, PORTFOLIO_UPLOAD.thumbSide, { webp, keepAlpha, jpeg: true })
				: kind === "photo" && Math.max(main.width, main.height) > PORTFOLIO_UPLOAD.thumbSide
					? await encode(bitmap, PORTFOLIO_UPLOAD.thumbSide, { webp, keepAlpha })
					: null;
		return { file: main.blob, thumbnail: small?.blob ?? null, width: main.width, height: main.height };
	} finally {
		bitmap.close();
	}
}

/** Files from a drop, a paste or a picker that may be pictures (the compressor still checks each one). */
export function pictureFiles(files: Iterable<File>): File[] {
	return [...files].filter(
		(file) => file.type.startsWith("image/") || /\.(?:jpe?g|png|webp|gif|heic|avif)$/i.test(file.name),
	);
}
