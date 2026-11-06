import type { UnfurledLink } from "./remote";
import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioData, PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { create } from "zustand/react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
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

/** A Link block from what a pasted page said about itself (a suggestion the person can change). */
export function linkBlockFromUnfurl(result: Extract<UnfurledLink, { kind: "link" }>): PortfolioBlockOf<"link"> {
	return {
		id: generateId(),
		type: "link",
		url: result.url,
		title: clip(result.title ?? "", max.linkTitle),
		...(result.description ? { description: clip(result.description, max.linkDescription) } : {}),
		...(result.siteName ? { siteName: clip(result.siteName, max.siteName) } : {}),
		...(result.brandIcon ? { brandIcon: result.brandIcon } : {}),
	};
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
	block: PortfolioBlockOf<"link"> | PortfolioBlockOf<"video">,
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
			const { [blockId]: _gone, ...rest } = state.pictures;
			return { pictures: rest };
		}),
}));
