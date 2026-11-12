import type { UnfurledLink } from "./remote";
import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { EmbedProvider, ParsedEmbed } from "@rezumi/schema/portfolio/embed";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { t } from "@lingui/core/macro";
import { EMBED_PROVIDER_NAMES, parseEmbedUrl } from "@rezumi/schema/portfolio/embed";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";
import { portfolioErrorCode } from "../errors";
import { isAbort } from "../images/upload";
import { clip } from "./link-blocks";
import { importRemotePicture, unfurlLink } from "./remote";

/** An Embed block for a parsed link, before anything was read about it. */
export function embedBlockFrom(embed: ParsedEmbed, title?: string): PortfolioBlockOf<"embed"> {
	return {
		id: generateId(),
		type: "embed",
		provider: embed.provider,
		ref: embed.ref,
		...(title ? { title: clip(title, PORTFOLIO_LIMITS.text.mediaTitle) } : {}),
	};
}

/** An Embed block and the picture to copy for it, from what the server read about a link. */
export type EmbedFind = { block: PortfolioBlockOf<"embed">; thumbnailUrl: string | null };

/** From an `unfurl` answer that is something to embed. */
export function embedFromUnfurl(result: Extract<UnfurledLink, { kind: "embed" }>): EmbedFind {
	return {
		block: embedBlockFrom({ provider: result.provider, ref: result.ref }, result.title),
		thumbnailUrl: result.thumbnailUrl ?? null,
	};
}

/**
 * An Embed block for a pasted address: read in the browser, then through the server for its title and picture
 * (`portfolio.unfurl` reads the service's oEmbed, and follows short links such as `on.soundcloud.com`). Null when it
 * isn't something any of the five services lets pages embed. A failed read still makes the block, without title or
 * picture: the person can type and upload them.
 */
export async function embedFromUrl(url: string, signal?: AbortSignal): Promise<EmbedFind | null> {
	const parsed = parseEmbedUrl(url);
	try {
		const result = await unfurlLink(url, signal);
		if (result.kind === "embed") return embedFromUnfurl(result);
	} catch (error) {
		if (isAbort(error, signal)) throw error;
	}
	return parsed ? { block: embedBlockFrom(parsed), thumbnailUrl: null } : null;
}

/** Whether a block still shows this content (it may have been removed or given another link meanwhile). */
export function stillEmbeds(
	block: { type: string; provider?: unknown; ref?: unknown } | undefined,
	embed: ParsedEmbed,
): boolean {
	return block?.type === "embed" && block.provider === embed.provider && block.ref === embed.ref;
}

/** A copy refused because the portfolio has no room: worth saying even for a copy nobody pressed a button for. */
export function isNoRoomError(error: unknown): boolean {
	const code = portfolioErrorCode(error);
	return code === "PLAN_LIMIT_REACHED" || code === "PORTFOLIO_STORAGE_FULL";
}

/**
 * Copies the service's picture for an Embed block into the portfolio's storage (the page never loads it from the
 * service). Undefined when it couldn't be copied; `onFailure` hears why.
 */
export async function importEmbedThumbnail(
	url: string,
	title: string,
	signal?: AbortSignal,
	onFailure?: (error: unknown) => void,
): Promise<PortfolioImage | undefined> {
	try {
		return await importRemotePicture(url, title, signal);
	} catch (error) {
		if (isAbort(error, signal)) throw error;
		onFailure?.(error);
		return undefined;
	}
}

/** A word on what a service needs before its content shows on someone else's page, or null when it needs nothing. */
export function embedSharingHint(provider: EmbedProvider): string | null {
	switch (provider) {
		case "google-slides":
			return t`Share the presentation with “Anyone with the link” first, or it won't show.`;
		case "figma":
			return t`The file must be viewable by anyone with the link.`;
		default:
			return null;
	}
}

/** The service's name, as the page writes it ("Google Slides"). */
export const embedProviderName = (provider: EmbedProvider) => EMBED_PROVIDER_NAMES[provider];
