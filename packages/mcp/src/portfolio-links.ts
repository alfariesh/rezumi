import type { RouterClient } from "@orpc/server";
import type router from "@rezumi/api/routers";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";

type PortfolioClient = Pick<RouterClient<typeof router>["portfolio"], "unfurl" | "addImage">;
type Unfurled = Awaited<ReturnType<PortfolioClient["unfurl"]>>;
type BlockInput = Record<string, unknown>;

/** Most pages one call reads; blocks past it keep what the edit gave (a link's title falls back to its host). */
export const MAX_LINK_LOOKUPS = 10;

const isRecord = (value: unknown): value is BlockInput =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const given = (value: unknown) => typeof value === "string" && value.trim() !== "";

function hostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** The block inputs an edit adds: one block added to a work, or the blocks of a work added whole. */
function addedBlocks(edit: PortfolioEdit): BlockInput[] {
	if (edit.op !== "add") return [];
	if (edit.list === "blocks") return [edit.item];
	if (edit.list === "works" && Array.isArray(edit.item.blocks)) return edit.item.blocks.filter(isRecord);
	return [];
}

/** Whether the page behind a block's link could fill something the edit left out. */
function needsDetails(block: BlockInput): boolean {
	if (!given(block.url)) return false;
	switch (block.type) {
		case "link":
			return !given(block.title) || !given(block.description) || block.image === undefined;
		case "video":
		case "embed":
			return !given(block.title) || block.thumbnail === undefined;
		default:
			return false;
	}
}

/**
 * Fills what an edit left out of the link, video and embed blocks it adds, the way the editor does when a link is
 * pasted: the page's title, description, site name and logo, and its preview picture stored as an upload. What the
 * edit gives is kept. A page that can't be read leaves the block as given, except that a link without a title gets
 * its host. Returns copies of the edits and how many blocks changed.
 */
export async function fillLinkDetails(
	client: PortfolioClient,
	edits: readonly PortfolioEdit[],
): Promise<{ edits: PortfolioEdit[]; filled: number }> {
	const copy = structuredClone(edits) as PortfolioEdit[];
	const wanted = copy.flatMap(addedBlocks).filter(needsDetails);
	const pages = new Map<string, Promise<Unfurled | null>>();
	const read = (url: string) => {
		let page = pages.get(url);
		if (!page) {
			page = pages.size < MAX_LINK_LOOKUPS ? client.unfurl({ url }).catch(() => null) : Promise.resolve(null);
			pages.set(url, page);
		}
		return page;
	};
	const pictures = new Map<string, Promise<{ key: string; alt: string } | null>>();
	const store = (url: string | undefined, alt: string) => {
		if (!url) return Promise.resolve(null);
		let picture = pictures.get(url);
		if (!picture) {
			const text = alt.slice(0, PORTFOLIO_LIMITS.text.alt);
			picture = client
				.addImage({ url, ...(text ? { alt: text } : {}) })
				.then((image) => ({ key: image.key, alt: text }))
				.catch(() => null);
			pictures.set(url, picture);
		}
		return picture;
	};

	let filled = 0;
	await Promise.all(
		wanted.map(async (block) => {
			const url = String(block.url).trim();
			const page = await read(url);
			const before = JSON.stringify(block);
			if (block.type === "link") {
				const link = page?.kind === "link" ? page : null;
				if (!given(block.title)) block.title = page?.title || hostname(url);
				if (!given(block.description) && link?.description) block.description = link.description;
				if (!given(block.siteName) && link?.siteName) block.siteName = link.siteName;
				if (!given(block.brandIcon) && link?.brandIcon) block.brandIcon = link.brandIcon;
				if (block.image === undefined) {
					const source = page?.kind === "link" ? page.imageUrl : page?.thumbnailUrl;
					const image = await store(source, String(block.title));
					if (image) block.image = image;
				}
			} else if (page && page.kind !== "link" && page.kind === block.type) {
				if (!given(block.title) && page.title) block.title = page.title;
				// YouTube's picture comes with the video; Vimeo's and an embed's are stored like the editor stores them.
				const own = page.kind === "video" && page.provider === "youtube";
				if (block.thumbnail === undefined && !own) {
					const image = await store(page.thumbnailUrl, String(block.title ?? page.title ?? ""));
					if (image) block.thumbnail = image;
				}
			}
			if (JSON.stringify(block) !== before) filled++;
		}),
	);
	return { edits: copy, filled };
}
