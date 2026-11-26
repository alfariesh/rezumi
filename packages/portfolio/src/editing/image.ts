/**
 * Photos: a large copy for the page and a small one for cards. Portraits (the person's own photo): the same, but the
 * small copy is always made, as JPEG, so the link preview card (which can't draw WebP) can show it. Logos: one copy
 * that keeps transparency.
 */
export type PortfolioImageKind = "photo" | "portrait" | "logo";

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
export const HEADER_BYTES = 256 * 1024;

export const QUALITY_STEPS = [0.82, 0.72, 0.62];

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
