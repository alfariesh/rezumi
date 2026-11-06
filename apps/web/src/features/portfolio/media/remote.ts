import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { parseVideoUrl, youtubeThumbnailUrl } from "@rezumi/schema/portfolio/video";
import { generateId } from "@rezumi/utils/string";
import { imageUploadErrorMessage, uploadPortfolioImage } from "../images/upload";
import { client } from "@/libs/orpc/client";

/** What `portfolio.unfurl` read from a pasted link: a video (YouTube, Vimeo) or any other page. */
export type UnfurledLink = Awaited<ReturnType<typeof client.portfolio.unfurl>>;

/** Why a link couldn't be read, in words, ending with what to do: fill the card in by hand. */
export function unfurlErrorMessage(error: unknown): string {
	if (error instanceof ORPCError) {
		if (error.code === "TOO_MANY_REQUESTS")
			return t`Too many links read in a short time. Wait a while, or fill the card in by hand.`;
		if (error.code === "PORTFOLIO_LINK_UNREADABLE") {
			const reason = (error.data as { reason?: string } | undefined)?.reason;
			if (reason === "unsafe-url") return t`This address can't be read. Use a public web page.`;
		}
	}
	return t`This site can't be read automatically. Fill the card in by hand.`;
}

/** Reads a pasted link through the server (safe fetch, no cookies, no user data); the result is only a suggestion. */
export function unfurlLink(url: string): Promise<UnfurledLink> {
	return client.portfolio.unfurl({ url });
}

/**
 * Copies a picture from another site into the portfolio's storage, once the person agreed to use it: the server
 * fetches it safely, the browser shrinks it like any upload. The page never links to another site's picture.
 */
export async function importRemotePicture(url: string, alt: string): Promise<PortfolioImage> {
	const file = await client.portfolio.fetchRemoteImage({ url });
	return uploadPortfolioImage(file, { alt });
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

/** Copies a video's thumbnail into storage, trying each candidate; undefined when none could be copied. */
export async function importVideoThumbnail(
	block: Pick<PortfolioBlockOf<"video">, "provider" | "videoId" | "thumbnailUrl" | "title">,
): Promise<PortfolioImage | undefined> {
	for (const url of videoThumbnailCandidates(block)) {
		try {
			return await importRemotePicture(url, block.title ?? "");
		} catch {
			// The next candidate, or none.
		}
	}
	return undefined;
}

/**
 * A Video block for a pasted YouTube or Vimeo address, with the title and thumbnail oEmbed gives (Vimeo has no
 * thumbnail address to guess). Null when it isn't a video address the page can play.
 */
export async function videoBlockFromUrl(url: string): Promise<PortfolioBlockOf<"video"> | null> {
	const parsed = parseVideoUrl(url);
	if (!parsed) return null;
	const block: PortfolioBlockOf<"video"> = { id: generateId(), type: "video", ...parsed };
	if (parsed.provider === "youtube") block.thumbnailUrl = youtubeThumbnailUrl(parsed.videoId);
	try {
		const result = await unfurlLink(url);
		if (result.kind === "video") {
			if (result.title) block.title = result.title.slice(0, 140);
			if (result.thumbnailUrl) block.thumbnailUrl = result.thumbnailUrl;
		}
	} catch {
		// The video plays without a title; the person can type one.
	}
	return block;
}
