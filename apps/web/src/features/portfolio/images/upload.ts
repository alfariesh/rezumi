import type { PortfolioImageKind } from "./compress";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { compressImage, PortfolioImageError } from "./compress";
import { client } from "@/libs/orpc/client";

const EXTENSIONS: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };

function asFile(blob: Blob, name: string): File {
	return new File([blob], `${name}.${EXTENSIONS[blob.type] ?? "bin"}`, { type: blob.type });
}

/** What went wrong with one picture, in words for the person who chose it. */
function imageUploadErrorMessage(error: unknown, fileName?: string): string {
	const name = fileName ? `“${fileName}”: ` : "";
	if (error instanceof PortfolioImageError) {
		switch (error.problem) {
			case "svg":
				return name + t`SVG files can't be used. Export the picture as PNG or JPG, then upload it.`;
			case "animated":
				return name + t`Animated GIFs can't be used. Upload a still picture (JPG, PNG or WebP).`;
			case "too-large":
				return name + t`This picture is too large to prepare. Use one under 50 MB and 100 megapixels.`;
			case "unreadable":
				return name + t`This file isn't a picture your browser can read. Use a JPG, PNG or WebP file.`;
		}
	}
	if (error instanceof ORPCError) {
		if (error.code === "PORTFOLIO_FILE_TOO_LARGE")
			return name + t`The picture is still too large after shrinking it. Try a smaller picture.`;
		if (error.code === "PORTFOLIO_IMAGE_INVALID")
			return name + t`The server couldn't read this picture. Try another JPG, PNG or WebP file.`;
		if (error.code === "TOO_MANY_REQUESTS") return t`Too many uploads in a short time. Wait a minute, then try again.`;
		if (error.message) return name + error.message;
	}
	return name + t`The picture couldn't be uploaded. Check your connection and try again.`;
}

/**
 * Shrinks a picture in the browser and uploads it to the portfolio's storage. The server checks its type, size and
 * dimensions again and records it; the returned image can then be saved in the portfolio's data.
 */
async function uploadPortfolioImage(
	file: File,
	options: { kind?: PortfolioImageKind; alt?: string } = {},
): Promise<PortfolioImage> {
	const compressed = await compressImage(file, options.kind ?? "photo");
	const uploaded = await client.portfolio.uploadImage({
		file: asFile(compressed.file, "picture"),
		...(compressed.thumbnail ? { thumbnail: asFile(compressed.thumbnail, "picture-small") } : {}),
	});
	return {
		key: uploaded.key,
		...(uploaded.thumbKey ? { thumbKey: uploaded.thumbKey } : {}),
		width: uploaded.width,
		height: uploaded.height,
		alt: (options.alt ?? "").slice(0, 200),
	};
}

export type UploadProgress = { done: number; total: number; current: string | null };

export type UploadedImage = { image: PortfolioImage; fileName: string };

export type UploadOutcome = {
	/** The pictures that made it, with the name of the file each came from. */
	uploaded: UploadedImage[];
	/** One message per picture that couldn't be used; the others still upload. */
	errors: string[];
};

/**
 * Uploads several pictures one after another (a phone keeps its memory and connection for one at a time), reporting
 * progress. A picture that fails is skipped with its reason; the rest go on.
 */
export async function uploadPortfolioImages(
	files: readonly File[],
	options: {
		kind?: PortfolioImageKind;
		alt?: (index: number) => string;
		onProgress?: (progress: UploadProgress) => void;
	},
): Promise<UploadOutcome> {
	const uploaded: UploadedImage[] = [];
	const errors: string[] = [];
	for (const [index, file] of files.entries()) {
		options.onProgress?.({ done: index, total: files.length, current: file.name });
		try {
			const image = await uploadPortfolioImage(file, {
				...(options.kind ? { kind: options.kind } : {}),
				alt: options.alt?.(index) ?? "",
			});
			uploaded.push({ image, fileName: file.name });
		} catch (error) {
			errors.push(imageUploadErrorMessage(error, file.name));
		}
	}
	options.onProgress?.({ done: files.length, total: files.length, current: null });
	return { uploaded, errors };
}
