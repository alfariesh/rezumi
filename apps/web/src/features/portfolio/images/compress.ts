import { PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";

/**
 * Pictures are made small in the browser before they're uploaded (`02-teknis.md` section 8): the server on Cloudflare
 * can't resize, and a phone photo of 10 MB would waste the visitor's data and the owner's quota. Drawing the picture
 * on a canvas and encoding it again also drops its metadata, GPS location included. The original never leaves the
 * device.
 */

/** Photos: a large copy for the page and a small one for cards. Logos: one copy that keeps transparency. */
export type PortfolioImageKind = "photo" | "logo";

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
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
/** About a 100-megapixel photo; anything larger is refused before drawing. */
const MAX_SOURCE_PIXELS = 100_000_000;

const QUALITY_STEPS = [0.82, 0.72, 0.62];

/** The size that fits in a square of `max`, keeping proportions; never enlarges. */
export function fitSize(width: number, height: number, max: number): { width: number; height: number } {
	const longest = Math.max(width, height);
	if (longest <= max) return { width, height };
	const scale = max / longest;
	return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
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

type Canvas = OffscreenCanvas | HTMLCanvasElement;

function createCanvas(width: number, height: number): Canvas {
	if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

function toBlob(canvas: Canvas, type: string, quality?: number): Promise<Blob | null> {
	if ("convertToBlob" in canvas)
		return canvas.convertToBlob({ type, ...(quality === undefined ? {} : { quality }) }).catch(() => null);
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function draw(source: ImageBitmap, width: number, height: number, opaque: boolean): Canvas {
	const canvas = createCanvas(width, height);
	const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
	if (!context) throw new PortfolioImageError("unreadable");
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

/** Whether any pixel is see-through, sampled on a small copy (enough to tell a logo on a clear background). */
function hasTransparency(source: ImageBitmap): boolean {
	const { width, height } = fitSize(source.width, source.height, 64);
	const canvas = draw(source, width, height, false);
	const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
	if (!context) return false;
	const pixels = context.getImageData(0, 0, width, height).data;
	for (let index = 3; index < pixels.length; index += 4) if ((pixels[index] ?? 255) < 250) return true;
	return false;
}

/**
 * One copy at most `max` pixels on its longest side and at most the upload limit in bytes: WebP, else (browsers that
 * can't write WebP) PNG when transparency matters and JPEG otherwise. Quality steps down, then the size, until it fits.
 */
async function encode(source: ImageBitmap, max: number, keepAlpha: boolean) {
	let size = fitSize(source.width, source.height, max);
	for (let attempt = 0; attempt < 6; attempt++) {
		for (const quality of QUALITY_STEPS) {
			const webp = await toBlob(draw(source, size.width, size.height, false), "image/webp", quality);
			let blob = webp?.type === "image/webp" ? webp : null;
			if (!blob)
				blob = keepAlpha
					? await toBlob(draw(source, size.width, size.height, false), "image/png")
					: await toBlob(draw(source, size.width, size.height, true), "image/jpeg", quality);
			if (!blob) throw new PortfolioImageError("unreadable");
			if (blob.size <= PORTFOLIO_UPLOAD.imageBytes) return { blob, ...size };
			// PNG ignores quality: go straight to a smaller size.
			if (blob.type === "image/png") break;
		}
		size = fitSize(size.width, size.height, Math.round(Math.max(size.width, size.height) * 0.8));
	}
	throw new PortfolioImageError("too-large");
}

/**
 * A picture ready to upload: SVG and animated GIF are refused, the photo is turned upright (its orientation tag),
 * drawn at most 2,000 px (logos 600 px) and encoded again, which removes its metadata. Photos larger than 800 px also
 * get an 800 px copy for cards.
 */
export async function compressImage(file: File, kind: PortfolioImageKind = "photo"): Promise<CompressedImage> {
	if (file.size > MAX_SOURCE_BYTES) throw new PortfolioImageError("too-large");
	const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
	if (looksLikeSvg(head, file.type, file.name)) throw new PortfolioImageError("svg");
	if (String.fromCharCode(...head.subarray(0, 3)) === "GIF" && isAnimatedGif(new Uint8Array(await file.arrayBuffer())))
		throw new PortfolioImageError("animated");

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch {
		throw new PortfolioImageError("unreadable");
	}
	try {
		if (!bitmap.width || !bitmap.height) throw new PortfolioImageError("unreadable");
		if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) throw new PortfolioImageError("too-large");
		const keepAlpha = kind === "logo" || hasTransparency(bitmap);
		const max = kind === "logo" ? PORTFOLIO_UPLOAD.logoSide : PORTFOLIO_UPLOAD.imageSide;
		const main = await encode(bitmap, max, keepAlpha);
		const thumbnail =
			kind === "photo" && Math.max(main.width, main.height) > PORTFOLIO_UPLOAD.thumbSide
				? (await encode(bitmap, PORTFOLIO_UPLOAD.thumbSide, keepAlpha)).blob
				: null;
		return { file: main.blob, thumbnail, width: main.width, height: main.height };
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
