import type { UnfurledLink } from "./remote";
import type { PortfolioBlock, PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioData, PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { ParsedVideo } from "@rezumi/schema/portfolio/video";
import { create } from "zustand/react";
import { brandIconSchema } from "@rezumi/schema/portfolio/blocks";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { isAllowedPortfolioUrl, PORTFOLIO_WEB_PROTOCOLS } from "@rezumi/schema/portfolio/links";
import { generateId } from "@rezumi/utils/string";
import { newWork, retitleWork } from "../works/works";

const { text: max } = PORTFOLIO_LIMITS;

/** Text cut to a limit at a word, with an ellipsis when cut. */
export function clip(text: string, limit: number): string {
	const clean = text.replace(/\s+/g, " ").trim();
	if (clean.length <= limit) return clean;
	const cut = clean.slice(0, limit - 1);
	const space = cut.lastIndexOf(" ");
	return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Adds https:// to an address typed without one ("behance.net/gallery/1"). */
function withScheme(text: string): string {
	return /^[a-z][\d+.a-z-]*:/i.test(text) ? text : `https://${text}`;
}

export type LinkAddress =
	| { ok: true; url: string }
	/** `email`: a mailto: address, which a link card can't open; `invalid`: anything else that isn't a web page. */
	| { ok: false; problem: "empty" | "email" | "invalid" };

/**
 * What someone pasted as a link card's address: a web page (https:// added when it's missing), or why it can't be one.
 * Only an address the portfolio's data accepts goes further, so a failed read never leaves a block the server refuses.
 */
export function readLinkAddress(text: string): LinkAddress {
	const trimmed = text.trim();
	if (!trimmed) return { ok: false, problem: "empty" };
	const url = withScheme(trimmed);
	if (/^mailto:/i.test(url)) return { ok: false, problem: "email" };
	return isAllowedPortfolioUrl(url, PORTFOLIO_WEB_PROTOCOLS) ? { ok: true, url } : { ok: false, problem: "invalid" };
}

/**
 * A Link block from what a pasted page said about itself (a suggestion the person can change). The address is where
 * the page ended up, when that's a web address the data takes, else the one pasted; a brand icon the data wouldn't take
 * is left out.
 */
export function linkBlockFromUnfurl(
	result: Extract<UnfurledLink, { kind: "link" }>,
	pasted?: string,
): PortfolioBlockOf<"link"> {
	const url = isAllowedPortfolioUrl(result.url, PORTFOLIO_WEB_PROTOCOLS) || !pasted ? result.url : pasted;
	return {
		id: generateId(),
		type: "link",
		url,
		title: clip(result.title ?? "", max.linkTitle),
		...(result.description ? { description: clip(result.description, max.linkDescription) } : {}),
		...(result.siteName ? { siteName: clip(result.siteName, max.siteName) } : {}),
		...(result.brandIcon && brandIconSchema.safeParse(result.brandIcon).success ? { brandIcon: result.brandIcon } : {}),
	};
}

/** The site an address is on ("behance.net"), or null when it isn't an address. */
export function siteOf(url: string): string | null {
	try {
		return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		return null;
	}
}

/** The address a video block plays, written the way its site does. */
export function videoAddress(block: Pick<PortfolioBlockOf<"video">, "provider" | "videoId" | "hash">): string {
	return block.provider === "youtube"
		? `https://www.youtube.com/watch?v=${block.videoId}`
		: `https://vimeo.com/${block.videoId}${block.hash ? `/${block.hash}` : ""}`;
}

/** Whether a parsed link is the video a block already plays (same site, video and unlisted hash). */
export function samePlayedVideo(
	block: Pick<PortfolioBlockOf<"video">, "provider" | "videoId" | "hash">,
	next: ParsedVideo,
): boolean {
	const hash = next.provider === "vimeo" ? next.hash : undefined;
	return next.provider === block.provider && next.videoId === block.videoId && hash === block.hash;
}

/** Whether a work's block still plays this video (it may have been removed or given another link meanwhile). */
export function stillPlays(
	block: PortfolioBlock | undefined,
	video: Pick<PortfolioBlockOf<"video">, "provider" | "videoId">,
): boolean {
	return block?.type === "video" && block.provider === video.provider && block.videoId === video.videoId;
}

/** A Video block from an unfurled video. */
export function videoBlockFromUnfurl(result: Extract<UnfurledLink, { kind: "video" }>): PortfolioBlockOf<"video"> {
	return {
		id: generateId(),
		type: "video",
		provider: result.provider,
		videoId: result.videoId,
		...(result.hash ? { hash: result.hash } : {}),
		...(result.title ? { title: clip(result.title, max.mediaTitle) } : {}),
		...(result.thumbnailUrl ? { thumbnailUrl: result.thumbnailUrl } : {}),
	};
}

/**
 * "Paste a link → new work" (`02-teknis.md` section 20): the card from the page (title, summary, the cover the
 * person agreed to, the link as its main link) and one Link or Video block.
 */
export function workFromLink(
	data: Pick<PortfolioData, "works">,
	link: { url: string; title: string; summary: string },
	block: PortfolioBlockOf<"link"> | PortfolioBlockOf<"video"> | PortfolioBlockOf<"embed">,
	cover?: PortfolioImage,
): PortfolioWork {
	const work = newWork(data);
	retitleWork(data, work, clip(link.title, max.workTitle));
	work.summary = clip(link.summary, max.workSummary);
	work.primaryLink = { label: "", url: link.url };
	work.blocks = [block];
	if (cover) work.cover = cover;
	return work;
}

type LinkSuggestions = {
	/** Pictures a pasted page offered, by Link block, until the person uses or declines them. */
	pictures: Record<string, string>;
	suggest: (blockId: string, url: string) => void;
	dismiss: (blockId: string) => void;
};

/** Suggested pictures stay outside the portfolio's data: nothing from another site is saved until it's copied. */
export const useLinkSuggestions = create<LinkSuggestions>()((set) => ({
	pictures: {},
	suggest: (blockId, url) => set((state) => ({ pictures: { ...state.pictures, [blockId]: url } })),
	dismiss: (blockId) =>
		set((state) => {
			if (!(blockId in state.pictures)) return state;
			const { [blockId]: _gone, ...rest } = state.pictures;
			return { pictures: rest };
		}),
}));
