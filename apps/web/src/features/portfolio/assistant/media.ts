import type { PortfolioBlock, PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import type { Draft } from "immer";
import { embedPageUrl } from "@rezumi/schema/portfolio/embed";
import { editPortfolio, usePortfolioEditorStore } from "../editor/store";
import { discardUploadedImages } from "../images/upload";
import { embedFromUrl, importEmbedThumbnail, stillEmbeds } from "../media/embeds";
import { stillPlays } from "../media/link-blocks";
import { importVideoThumbnail } from "../media/remote";

// Video and Embed blocks the assistant adds get what the editor gives a pasted link (`blocks/add-media-block.tsx`):
// the video's thumbnail and the embed's picture, copied into the portfolio's storage. Their addresses are built from a
// checked id on the provider's own host. Link blocks are left as they are: reading a link the assistant chose would
// make the server fetch an address a page or an attachment may have dictated, with data in it, before anyone looked
// (`laporan-phase-14/security-review.md` M1); the person reads its page from the block ("Fill in from the link").
// All of it is best effort and quiet: a block without its picture still works.

type MediaBlock = PortfolioBlockOf<"video"> | PortfolioBlockOf<"embed">;
type Placed = { workId: string; block: MediaBlock };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** A Video or Embed block still missing its picture, or null. */
function mediaBlock(value: unknown): MediaBlock | null {
	if (!isRecord(value) || typeof value.id !== "string") return null;
	const block = value as PortfolioBlock;
	if (block.type === "video" && !block.thumbnail) return block;
	if (block.type === "embed" && !block.thumbnail) return block;
	return null;
}

/** The Video and Embed blocks the edits added without a picture, with the work each is in. */
export function newMediaBlocks(edits: readonly PortfolioEdit[]): Placed[] {
	return edits.flatMap((edit): Placed[] => {
		if (edit.op !== "add") return [];
		if (edit.list === "blocks" && edit.workId) {
			const block = mediaBlock(edit.item);
			return block ? [{ workId: edit.workId, block }] : [];
		}
		const workId = edit.item.id;
		if (edit.list !== "works" || typeof workId !== "string" || !Array.isArray(edit.item.blocks)) return [];
		return edit.item.blocks.flatMap((entry: unknown) => {
			const block = mediaBlock(entry);
			return block ? [{ workId, block }] : [];
		});
	});
}

/** The block as the editor has it now (it may have been changed or removed meanwhile). */
function currentBlock(workId: string, blockId: string): PortfolioBlock | undefined {
	return usePortfolioEditorStore
		.getState()
		.portfolio?.data.works.items.find((work) => work.id === workId)
		?.blocks.find((block) => block.id === blockId);
}

/** Notes data the fill-in changed, so the change's card still knows its step (`apply.ts`). */
type OnChange = (previous: PortfolioData, next: PortfolioData) => void;

/** Sets part of a block as part of the step that added it: no undo step of its own. */
function setBlock(workId: string, blockId: string, recipe: (block: Draft<PortfolioBlock>) => void, onChange: OnChange) {
	const previous = usePortfolioEditorStore.getState().portfolio?.data;
	editPortfolio(
		(draft) => {
			const block = draft.works.items.find((work) => work.id === workId)?.blocks.find((entry) => entry.id === blockId);
			if (block) recipe(block);
		},
		{ history: false },
	);
	const next = usePortfolioEditorStore.getState().portfolio?.data;
	if (previous && next && next !== previous) onChange(previous, next);
}

async function fillVideo(workId: string, block: PortfolioBlockOf<"video">, onChange: OnChange) {
	const thumbnail = await importVideoThumbnail(block);
	if (!thumbnail) return;
	if (!stillPlays(currentBlock(workId, block.id), block)) {
		void discardUploadedImages([thumbnail]);
		return;
	}
	setBlock(
		workId,
		block.id,
		(draft) => {
			if (draft.type === "video") draft.thumbnail = thumbnail;
		},
		onChange,
	);
}

async function fillEmbed(workId: string, block: PortfolioBlockOf<"embed">, onChange: OnChange) {
	const find = await embedFromUrl(embedPageUrl(block));
	if (!find?.thumbnailUrl) return;
	const image = await importEmbedThumbnail(find.thumbnailUrl, block.title ?? find.block.title ?? "");
	if (!image) return;
	if (!stillEmbeds(currentBlock(workId, block.id), block)) {
		void discardUploadedImages([image]);
		return;
	}
	setBlock(
		workId,
		block.id,
		(draft) => {
			if (draft.type === "embed") draft.thumbnail = image;
		},
		onChange,
	);
}

/** Fills in the pictures of the blocks the edits added, one after another. */
export async function fillInMedia(edits: readonly PortfolioEdit[], onChange: OnChange = () => {}): Promise<void> {
	for (const { workId, block } of newMediaBlocks(edits)) {
		try {
			if (block.type === "video") await fillVideo(workId, block, onChange);
			else await fillEmbed(workId, block, onChange);
		} catch {
			// The block works without its picture; the person can add one.
		}
	}
}
