import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { parseVideoUrl, youtubeThumbnailUrl } from "@rezumi/schema/portfolio/video";
import { generateId } from "@rezumi/utils/string";
import { portfolioErrorCode, portfolioErrorMessage } from "../errors";
import { imageUploadErrorMessage, isAbort, stopIfAborted, uploadPortfolioImage } from "../images/upload";
import { videoBlockFromUnfurl } from "./link-blocks";
import { client } from "@/libs/orpc/client";

/** What `portfolio.unfurl` read from a pasted link: a video (YouTube, Vimeo) or any other page. */
export type UnfurledLink = Exclude<Awaited<ReturnType<typeof client.portfolio.unfurl>>, { kind: "embed" }>;

const signalOption = (signal: AbortSignal | undefined) => (signal ? { signal } : undefined);

/** Why a link couldn't be read, in words, ending with what to do: fill the card in by hand. */
export function unfurlErrorMessage(error: unknown): string {
	const fallback = t`This site can't be read automatically. Fill the card in by hand.`;
	if (!(error instanceof ORPCError)) return fallback;
	const reason = (error.data as { reason?: unknown } | undefined)?.reason;
	return portfolioErrorMessage(error, {
		fallback,
		byCode: {
			TOO_MANY_REQUESTS: t`Too many links read in a short time. Wait a while, or fill the card in by hand.`,
			PORTFOLIO_LINK_UNREADABLE:
				reason === "unsafe-url" ? t`This address can't be read. Use a public web page.` : fallback,
		},
	});
}

/** Reads a pasted link through the server (safe fetch, no cookies, no user data); the result is only a suggestion. */
export async function unfurlLink(url: string, signal?: AbortSignal): Promise<UnfurledLink> {
	const result = await client.portfolio.unfurl({ url }, signalOption(signal));
	// Phase 13 Langkah 0: the editor has no Embed block yet, so an embeddable page reads as a link card for now
	// (`pf-web` replaces this with the Embed block and its offer).
	if (result.kind === "embed")
		return {
			kind: "link",
			url: result.url,
			title: result.title ?? "",
			...(result.thumbnailUrl ? { imageUrl: result.thumbnailUrl } : {}),
		};
	return result;
}

/**
 * Copies a picture from another site into the portfolio's storage, once the person agreed to use it: the server
 * fetches it safely, the browser shrinks it like any upload. The page never links to another site's picture.
 */
export async function importRemotePicture(url: string, alt: string, signal?: AbortSignal): Promise<PortfolioImage> {
	const file = await client.portfolio.fetchRemoteImage({ url }, signalOption(signal));
	stopIfAborted(signal);
	return uploadPortfolioImage(file, { alt, ...(signal ? { signal } : {}) });
}

/** The words for a picture that couldn't be copied. */
export function remotePictureErrorMessage(error: unknown): string {
	if (error instanceof ORPCError && error.code === "PORTFOLIO_LINK_UNREADABLE")
		return t`The picture couldn't be copied from the site. Upload one yourself instead.`;
	return imageUploadErrorMessage(error);
}

/**
 * The thumbnail to copy for a video: YouTube's largest (it may not exist for old videos; the standard one always
 * does), or the one Vimeo's oEmbed named.
 */
export function videoThumbnailCandidates(
	block: Pick<PortfolioBlockOf<"video">, "provider" | "videoId" | "thumbnailUrl">,
) {
	if (block.provider === "youtube")
		return [`https://i.ytimg.com/vi/${block.videoId}/maxresdefault.jpg`, youtubeThumbnailUrl(block.videoId)];
	return block.thumbnailUrl ? [block.thumbnailUrl] : [];
}

/** Errors after which no other picture would fit either. */
const NO_ROOM = new Set(["PLAN_LIMIT_REACHED", "PORTFOLIO_STORAGE_FULL"]);

/**
 * Copies a video's thumbnail into storage, trying each candidate; undefined when none could be copied. `onFailure`
 * gets the last error then, for copies the person asked for (background copies stay quiet).
 */
export async function importVideoThumbnail(
	block: Pick<PortfolioBlockOf<"video">, "provider" | "videoId" | "thumbnailUrl" | "title">,
	signal?: AbortSignal,
	onFailure?: (error: unknown) => void,
): Promise<PortfolioImage | undefined> {
	let last: unknown;
	for (const url of videoThumbnailCandidates(block)) {
		try {
			return await importRemotePicture(url, block.title ?? "", signal);
		} catch (error) {
			if (isAbort(error, signal)) throw error;
			last = error;
			// No room stays no room for the next picture.
			if (NO_ROOM.has(portfolioErrorCode(error) ?? "")) break;
			// The next candidate, or none.
		}
	}
	if (last !== undefined) onFailure?.(last);
	return undefined;
}

/**
 * A Video block for a pasted YouTube or Vimeo address, with the title and thumbnail oEmbed gives (Vimeo has no
 * thumbnail address to guess). Null when it isn't a video address the page can play.
 */
export async function videoBlockFromUrl(url: string, signal?: AbortSignal): Promise<PortfolioBlockOf<"video"> | null> {
	const parsed = parseVideoUrl(url);
	if (!parsed) return null;
	try {
		const result = await unfurlLink(url, signal);
		if (result.kind === "video" && result.provider === parsed.provider && result.videoId === parsed.videoId)
			return videoBlockFromUnfurl(result);
	} catch (error) {
		if (isAbort(error, signal)) throw error;
		// The video plays without a title; the person can type one.
	}
	return {
		id: generateId(),
		type: "video",
		...parsed,
		...(parsed.provider === "youtube" ? { thumbnailUrl: youtubeThumbnailUrl(parsed.videoId) } : {}),
	};
}
