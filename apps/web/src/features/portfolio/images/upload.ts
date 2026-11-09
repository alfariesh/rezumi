import type { PortfolioImageKind } from "./compress";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { plural, t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { portfolioFileKeys } from "@rezumi/portfolio/files";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { usePortfolioEditorStore } from "../editor/store";
import { portfolioErrorCode, portfolioErrorMessage } from "../errors";
import { refreshPortfolioUsage } from "../works/storage-meter";
import { compressImage, MAX_SOURCE_BYTES, MAX_SOURCE_PIXELS, PortfolioImageError } from "./compress";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
import { client } from "@/libs/orpc/client";

const EXTENSIONS: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };

/** At most this many pictures go up in one batch: the server takes 60 uploads a minute from an account. */
export const MAX_BATCH_PICTURES = 50;

function asFile(blob: Blob, name: string): File {
	return new File([blob], `${name}.${EXTENSIONS[blob.type] ?? "bin"}`, { type: blob.type });
}

/** Stops when `signal` was aborted, with its reason (an `AbortError`). */
export function stopIfAborted(signal: AbortSignal | undefined): void {
	if (signal?.aborted) throw signal.reason ?? new DOMException("The upload was cancelled.", "AbortError");
}

/** Whether a failure is the request being cancelled, not something to tell the person about. */
export function isAbort(error: unknown, signal?: AbortSignal): boolean {
	return Boolean(signal?.aborted) || (error instanceof DOMException && error.name === "AbortError");
}

/** What went wrong with one picture, in words for the person who chose it (named, when there's a file name). */
export function imageUploadErrorMessage(error: unknown, fileName?: string): string {
	const message = imageProblemMessage(error);
	return fileName ? t`“${fileName}”: ${message}` : message;
}

function imageProblemMessage(error: unknown): string {
	if (error instanceof PortfolioImageError) {
		switch (error.problem) {
			case "svg":
				return t`SVG files can't be used. Export the picture as PNG or JPG, then upload it.`;
			case "animated":
				return t`Animated GIFs can't be used. Upload a still picture (JPG, PNG or WebP).`;
			case "too-large": {
				const megabytes = MAX_SOURCE_BYTES / 1024 / 1024;
				const megapixels = MAX_SOURCE_PIXELS / 1_000_000;
				return t`This picture is too large to prepare. Use one under ${megabytes} MB and ${megapixels} megapixels.`;
			}
			case "unreadable":
				return t`This file isn't a picture your browser can read. Use a JPG, PNG or WebP file.`;
		}
	}
	const fallback = t`The picture couldn't be uploaded. Check your connection and try again.`;
	if (!(error instanceof ORPCError)) return fallback;
	const tooLarge = t`The picture is still too large after shrinking it. Try a smaller picture.`;
	return portfolioErrorMessage(error, {
		fallback,
		byCode: {
			PORTFOLIO_FILE_TOO_LARGE: tooLarge,
			// The API refuses a file over its size limit before reading it, as a bad request.
			BAD_REQUEST: tooLarge,
			TOO_MANY_REQUESTS: t`Too many uploads in a short time. Wait a minute, then try again.`,
		},
	});
}

/** Refusals after which the rest of a batch can't go up either: too many at once, or no storage left. */
const BATCH_STOPPERS = new Map<string | undefined, NonNullable<UploadOutcome["stopped"]>>([
	["TOO_MANY_REQUESTS", "rate-limited"],
	["PORTFOLIO_STORAGE_FULL", "storage-full"],
	["PLAN_LIMIT_REACHED", "storage-full"],
]);

export type UploadImageOptions = {
	kind?: PortfolioImageKind;
	alt?: string;
	/** Cancels the upload; a cancelled one never resolves with a picture, and one already stored is deleted. */
	signal?: AbortSignal;
};

/**
 * Shrinks a picture in the browser and uploads it to the portfolio's storage. The server checks its type, size and
 * dimensions again and records it; the returned image can then be saved in the portfolio's data.
 */
export async function uploadPortfolioImage(file: File, options: UploadImageOptions = {}): Promise<PortfolioImage> {
	const { signal } = options;
	stopIfAborted(signal);
	const compressed = await compressImage(file, options.kind ?? "photo");
	stopIfAborted(signal);
	const uploaded = await client.portfolio.uploadImage(
		{
			file: asFile(compressed.file, "picture"),
			...(compressed.thumbnail ? { thumbnail: asFile(compressed.thumbnail, "picture-small") } : {}),
		},
		signal ? { signal } : undefined,
	);
	refreshPortfolioUsage();
	const image: PortfolioImage = {
		key: uploaded.key,
		...(uploaded.thumbKey ? { thumbKey: uploaded.thumbKey } : {}),
		width: uploaded.width,
		height: uploaded.height,
		alt: (options.alt ?? "").slice(0, PORTFOLIO_LIMITS.text.alt),
	};
	if (signal?.aborted) {
		void discardUploadedImages([image]);
		stopIfAborted(signal);
	}
	return image;
}

/**
 * Deletes pictures that were uploaded but never went into the portfolio (a cancelled batch, a picture there was no
 * more room for, one made for a place that changed meanwhile), so they don't count against the storage until the
 * cleanup job finds them. Failures are ignored: the server refuses a file the saved portfolio uses, and the cleanup
 * job deletes the rest a day later.
 */
export function discardUploadedImages(images: readonly Pick<PortfolioImage, "key" | "thumbKey">[]): Promise<void> {
	const keys = images.flatMap((image) => (image.thumbKey ? [image.key, image.thumbKey] : [image.key]));
	return Promise.all(keys.map((key) => client.portfolio.deleteFile({ key }).catch(() => undefined))).then(() =>
		refreshPortfolioUsage(),
	);
}

/** Of pictures just uploaded, the ones the data being edited doesn't use now, which `discardUploadedImages` takes. */
function unplacedImages<T extends Pick<PortfolioImage, "key">>(images: readonly T[]): T[] {
	const data = usePortfolioEditorStore.getState().portfolio?.data;
	const used = new Set(data ? portfolioFileKeys(data) : []);
	return images.filter((image) => !used.has(image.key));
}

/** Deletes the pictures just uploaded that didn't make it into the data (call right after the edit placing them). */
export function discardUnplacedImages(images: readonly PortfolioImage[]): void {
	const unplaced = unplacedImages(images);
	if (unplaced.length) void discardUploadedImages(unplaced);
}

export type UploadProgress = { done: number; total: number; current: string | null };

export type UploadedImage = { image: PortfolioImage; fileName: string };

export type UploadOutcome = {
	/** The pictures that made it, with the name of the file each came from. */
	uploaded: UploadedImage[];
	/** One message per picture that couldn't be used, naming its file, and one when the batch stopped early. */
	errors: string[];
	/** Why the batch stopped before its end: cancelled, the server asked to slow down, or the storage is full. */
	stopped: "cancelled" | "rate-limited" | "storage-full" | null;
};

export type BatchOptions = {
	kind?: PortfolioImageKind;
	/** The alternative text each picture starts with, by its place in the batch. */
	alt?: (index: number) => string;
	onProgress?: (progress: UploadProgress) => void;
	signal?: AbortSignal;
	/** Uploads one picture; tests pass their own. */
	upload?: (file: File, options: UploadImageOptions) => Promise<PortfolioImage>;
};

/**
 * Uploads pictures one after another (a phone keeps its memory and connection for one at a time), reporting progress.
 * A picture that fails is skipped with its reason and the rest go on; the batch stops when it's cancelled, when the
 * server says too many came in a short time, or when the account's storage is full, and takes at most
 * `MAX_BATCH_PICTURES`.
 */
export async function uploadImageBatch(files: readonly File[], options: BatchOptions = {}): Promise<UploadOutcome> {
	const { signal, upload = uploadPortfolioImage } = options;
	const batch = files.slice(0, MAX_BATCH_PICTURES);
	const uploaded: UploadedImage[] = [];
	const errors: string[] = [];
	let stopped: UploadOutcome["stopped"] = null;

	for (const [index, file] of batch.entries()) {
		if (signal?.aborted) {
			stopped = "cancelled";
			break;
		}
		options.onProgress?.({ done: index, total: batch.length, current: file.name });
		try {
			const image = await upload(file, {
				...(options.kind ? { kind: options.kind } : {}),
				alt: options.alt?.(index) ?? "",
				...(signal ? { signal } : {}),
			});
			uploaded.push({ image, fileName: file.name });
		} catch (error) {
			if (isAbort(error, signal)) {
				stopped = "cancelled";
				break;
			}
			const stopper = BATCH_STOPPERS.get(portfolioErrorCode(error));
			if (stopper) {
				stopped = stopper;
				openPlanDialogForError(error);
				const left = batch.length - index;
				const problem = imageProblemMessage(error);
				const notUploaded = plural(left, { one: "# picture wasn't uploaded.", other: "# pictures weren't uploaded." });
				// One message with both parts, so a language can order and punctuate them its own way.
				errors.push(t`${problem} ${notUploaded}`);
				break;
			}
			errors.push(imageUploadErrorMessage(error, file.name));
		}
	}
	if (files.length > batch.length && stopped === null)
		errors.push(t`Up to ${MAX_BATCH_PICTURES} pictures are uploaded at a time. Add the others afterwards.`);
	options.onProgress?.({ done: batch.length, total: batch.length, current: null });
	return { uploaded, errors, stopped };
}
