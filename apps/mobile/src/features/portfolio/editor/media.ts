import type { PortfolioImageKind } from "@rezumi/portfolio/editing";
import type { PortfolioBlock, PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { ImagePickerAsset } from "expo-image-picker";
import { t } from "@lingui/core/macro";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
	fitSize,
	isAnimatedGif,
	looksLikeSvg,
	MAX_SOURCE_BYTES,
	MAX_SOURCE_PIXELS,
	QUALITY_STEPS,
	clip,
	readLinkAddress,
	linkBlockFromUnfurl,
	videoBlockFromUnfurl,
} from "@rezumi/portfolio/editing";
import { parseEmbedUrl } from "@rezumi/schema/portfolio/embed";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { parseVideoUrl, youtubeThumbnailUrl } from "@rezumi/schema/portfolio/video";
import { generateId } from "@rezumi/utils/string";
import { pdfPages } from "../../../../modules/pdf-pages";
import { client, portfolioUpload } from "@/api/client";

export class MediaError extends Error {}

export function deleteTemporary(file: File) {
	try {
		if (file.exists) file.delete();
	} catch {
		/* Cache cleanup is best effort. */
	}
}

export async function pickPictures(camera: boolean, limit: number): Promise<ImagePickerAsset[]> {
	if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
		throw new MediaError(t`Camera access is off. You can still choose a picture from your library.`);
	const options: ImagePicker.ImagePickerOptions = {
		mediaTypes: ["images"],
		allowsMultipleSelection: !camera && limit > 1,
		selectionLimit: limit,
		exif: false,
	};
	const result = camera
		? await ImagePicker.launchCameraAsync(options)
		: await ImagePicker.launchImageLibraryAsync(options);
	return result.canceled ? [] : result.assets.slice(0, limit);
}

type Picture = { uri: string; width?: number; height?: number; fileName?: string | null; mimeType?: string };

async function encode(picture: Picture, max: number, format: SaveFormat) {
	const initial = ImageManipulator.manipulate(picture.uri);
	try {
		if (picture.width && picture.height) initial.resize(fitSize(picture.width, picture.height, max));
		const upright = await initial.renderAsync();
		try {
			if (upright.width * upright.height > MAX_SOURCE_PIXELS) throw new MediaError(t`This picture is too large.`);
			let side = max;
			for (let step = 0; step < 6; step++) {
				const context = ImageManipulator.manipulate(upright);
				try {
					context.resize(fitSize(upright.width, upright.height, side));
					const rendered = await context.renderAsync();
					try {
						for (const compress of format === SaveFormat.PNG ? [1] : QUALITY_STEPS) {
							const file = new File((await rendered.saveAsync({ format, compress })).uri);
							if (file.size > 0 && file.size <= PORTFOLIO_UPLOAD.imageBytes) return file;
							deleteTemporary(file);
						}
					} finally {
						rendered.release();
					}
				} finally {
					context.release();
				}
				side = Math.round(side * 0.8);
			}
		} finally {
			upright.release();
		}
	} finally {
		initial.release();
	}
	throw new MediaError(t`This picture is too large.`);
}

export async function uploadPicture(
	picture: Picture,
	kind: PortfolioImageKind,
	scope: string,
): Promise<PortfolioImage> {
	const original = new File(picture.uri);
	if (original.size > MAX_SOURCE_BYTES || (picture.width ?? 0) * (picture.height ?? 0) > MAX_SOURCE_PIXELS)
		throw new MediaError(t`This picture is too large.`);
	const header = new Uint8Array(await original.slice(0, 512).arrayBuffer());
	if (looksLikeSvg(header, picture.mimeType, picture.fileName ?? undefined))
		throw new MediaError(t`Choose a raster picture, such as JPEG or PNG.`);
	if (String.fromCharCode(...header.subarray(0, 3)) === "GIF" && isAnimatedGif(await original.bytes()))
		throw new MediaError(t`Choose a still picture.`);
	const size = kind === "logo" ? PORTFOLIO_UPLOAD.logoSide : PORTFOLIO_UPLOAD.imageSide;
	const format = kind === "logo" || picture.mimeType === "image/png" ? SaveFormat.PNG : SaveFormat.JPEG;
	const file = await encode(picture, size, format);
	let thumbnail: File | undefined;
	try {
		if (
			kind === "portrait" ||
			(kind === "photo" && Math.max(picture.width ?? 0, picture.height ?? 0) > PORTFOLIO_UPLOAD.thumbSide)
		)
			thumbnail = await encode(picture, PORTFOLIO_UPLOAD.thumbSide, kind === "portrait" ? SaveFormat.JPEG : format);
		const { key, thumbKey, width, height } = await portfolioUpload(
			"uploadImage",
			{},
			{ file, ...(thumbnail ? { thumbnail } : {}) },
			scope,
		);
		return { key, ...(thumbKey ? { thumbKey } : {}), width, height, alt: "" };
	} finally {
		deleteTemporary(file);
		if (thumbnail) deleteTemporary(thumbnail);
	}
}

async function copyRemotePicture(url: string, scope: string) {
	const remote = await client.portfolio.fetchRemoteImageBytes({ url }, { context: { scope } });
	const temp = new File(Paths.cache, `portfolio-${generateId()}`);
	try {
		temp.create();
		temp.write(remote.base64, { encoding: "base64" });
		return await uploadPicture({ uri: temp.uri, mimeType: remote.contentType }, "photo", scope);
	} finally {
		deleteTemporary(temp);
	}
}

type LinkBlock = PortfolioBlockOf<"video" | "embed" | "link">;
type ResolvedBlock = { block: LinkBlock; url: string };

export async function blockFromLink(text: string, scope: string, expected?: LinkBlock["type"]): Promise<ResolvedBlock> {
	const address = readLinkAddress(text);
	if (!address.ok) throw new MediaError(t`Use a link to a web page.`);
	const { url } = address;
	const video = parseVideoUrl(url);
	const embed = parseEmbedUrl(url);
	if (expected === "video" && !video) throw new MediaError(t`Use a YouTube or Vimeo link.`);
	if (expected === "embed" && !embed) throw new MediaError(t`This service can't be embedded.`);
	const read = await client.portfolio.unfurl({ url }, { context: { scope } }).catch(() => null);
	const cover = (picture: string | undefined) =>
		picture ? copyRemotePicture(picture, scope).catch(() => undefined) : undefined;
	if (expected !== "link" && video) {
		const resolved = read?.kind === "video" ? read : video;
		const thumb = read?.kind === "video" ? read.thumbnailUrl : undefined;
		const thumbnailUrl = thumb ?? (video.provider === "youtube" ? youtubeThumbnailUrl(video.videoId) : undefined);
		const block = videoBlockFromUnfurl({ ...resolved, thumbnailUrl });
		return { url, block: { ...block, thumbnail: await cover(thumbnailUrl) } };
	}
	if (expected !== "link" && embed) {
		const resolved = read?.kind === "embed" ? read : undefined;
		const title = resolved?.title ? clip(resolved.title, PORTFOLIO_LIMITS.text.mediaTitle) : undefined;
		return {
			url,
			block: { id: generateId(), type: "embed", ...embed, title, thumbnail: await cover(resolved?.thumbnailUrl) },
		};
	}
	const resolved = read?.kind === "link" ? read : { url, title: "" };
	return {
		url,
		block: {
			...linkBlockFromUnfurl(resolved, url),
			image: await cover(read?.kind === "link" ? read.imageUrl : undefined),
		},
	};
}

export async function pickPdf(scope: string): Promise<PortfolioBlock | null> {
	const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
	if (result.canceled) return null;
	const asset = result.assets[0];
	if (!asset) return null;
	const file = new File(asset.uri);
	try {
		if (file.size > PORTFOLIO_UPLOAD.pdfBytes) throw new MediaError(t`This PDF is too large.`);
		const doc = await pdfPages.open(await file.bytes()).catch(() => {
			throw new MediaError(t`Choose a PDF that opens without a password.`);
		});
		try {
			const first = doc.pages[0];
			if (!first || doc.pages.length > PORTFOLIO_LIMITS.pdfPages)
				throw new MediaError(t`This PDF has an unsupported number of pages.`);
			const [page] = await pdfPages.rasterize(
				doc.id,
				[0],
				Math.max(0.1, Math.min(2, PORTFOLIO_UPLOAD.imageSide / Math.max(first.width, first.height))),
			);
			if (!page) throw new MediaError(t`Couldn't draw the first page of this PDF.`);
			let preview: PortfolioImage;
			try {
				preview = await uploadPicture(page, "photo", scope);
			} finally {
				deleteTemporary(new File(page.uri));
			}
			const uploaded = await portfolioUpload("uploadPdf", { pages: doc.pages.length }, { file }, scope);
			return {
				id: generateId(),
				type: "pdf",
				file: uploaded.key,
				pages: uploaded.pages,
				bytes: uploaded.bytes,
				title: asset.name.replace(/\.pdf$/i, "").slice(0, PORTFOLIO_LIMITS.text.mediaTitle),
				preview,
			};
		} finally {
			await pdfPages.close(doc.id);
		}
	} finally {
		deleteTemporary(file);
	}
}
