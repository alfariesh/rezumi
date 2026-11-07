import type { SlashItem } from "../editor/rich-text-editor";
import type { BlockPlace } from "./blocks";
import type { PortfolioBlock, PortfolioBlockOf, PortfolioBlockType } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { IconName } from "@rezumi/ui/components/icon";
import type { Draft } from "immer";
import { Button, Dropdown, Label } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useRef } from "react";
import { PORTFOLIO_BLOCK_TYPES } from "@rezumi/schema/portfolio/blocks";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { moveItem, RichTextField } from "../editor/fields";
import { editPortfolio, usePortfolioEditorStore } from "../editor/store";
import { UploadStatus, useFilePicker, useImageUploads } from "../images/image-field";
import { discardUnplacedImages } from "../images/upload";
import { pdfLimitText } from "../media/pdf";
import { MetricsEditor } from "../metrics/metric-form";
import { dropMissingHighlight } from "../metrics/metrics";
import { useAddMediaBlock } from "./add-media-block";
import {
	addCaseStudy,
	blockPlace,
	blockRoom,
	insertBlocksAt,
	newImagesBlock,
	newMetricsBlock,
	newTextBlock,
	removeBlock,
	restoreBlock,
} from "./blocks";
import { ImagesBlockEditor } from "./images-block";
import { LinkBlockEditor } from "./link-block";
import { useRemovalFocus } from "./list-focus";
import { PdfBlockEditor } from "./pdf-block";
import { VideoBlockEditor } from "./video-block";
import { SortableEdge, SortableHandle, SortableProvider, useSortableItem } from "@/components/input/sortable";

const { text: max } = PORTFOLIO_LIMITS;

/** Changes one work in the draft. */
export function editWork(
	workId: string,
	recipe: (work: Draft<PortfolioWork>) => void,
	options?: { key?: string; structural?: boolean },
) {
	editPortfolio((draft) => {
		const work = draft.works.items.find((entry) => entry.id === workId);
		if (work) recipe(work);
	}, options);
}

/** Changes one block of a work in the draft. */
function editBlock<T extends PortfolioBlock["type"]>(
	workId: string,
	blockId: string,
	type: T,
	recipe: (block: Draft<PortfolioBlockOf<T>>, work: Draft<PortfolioWork>) => void,
	options?: { key?: string; structural?: boolean },
) {
	editWork(
		workId,
		(work) => {
			const block = work.blocks.find((entry) => entry.id === blockId);
			if (block?.type === type) recipe(block as Draft<PortfolioBlockOf<T>>, work);
		},
		options,
	);
}

/**
 * Removes a block and offers it back in a toast. Its Undo puts back that block: Undo itself while nothing else changed
 * since, else the block alone at its old place, so it never takes back a later edit instead.
 */
function removeBlockWithUndo(work: PortfolioWork, block: PortfolioBlock, index: number, name: string) {
	const highlight = work.highlightMetricId;
	editWork(work.id, (draft) => removeBlock(draft as PortfolioWork, block.id), { structural: true });
	const removed = usePortfolioEditorStore.getState().portfolio?.data;
	toast.add({
		description: t`${name} block removed`,
		actionProps: {
			children: t`Undo`,
			onPress: () => {
				const store = usePortfolioEditorStore.getState();
				if (removed && store.portfolio?.data === removed) store.undo();
				else editWork(work.id, (draft) => restoreBlock(draft as PortfolioWork, block, index, highlight));
			},
		},
	});
}

type BlockTypeInfo = { icon: IconName; title: string; description: string; keywords: string[] };

function blockTypeInfo(type: PortfolioBlockType): BlockTypeInfo {
	switch (type) {
		case "text":
			return {
				icon: "text-t",
				title: t`Text`,
				description: t`Paragraphs, headings, lists and links`,
				keywords: ["text", "teks", "paragraph"],
			};
		case "images": {
			const most = PORTFOLIO_LIMITS.imagesPerBlock;
			return {
				icon: "image",
				title: t`Pictures`,
				description: t`1 to ${most} pictures with captions`,
				keywords: ["image", "picture", "gambar", "foto", "gallery"],
			};
		}
		case "metrics":
			return {
				icon: "chart-line-up",
				title: t`Metrics`,
				description: t`Results as numbers, such as +35% conversion`,
				keywords: ["metric", "metrik", "number", "angka", "result"],
			};
		case "video":
			return {
				icon: "play",
				title: t`Video`,
				description: t`YouTube or Vimeo, loaded when played`,
				keywords: ["video", "youtube", "vimeo"],
			};
		case "pdf": {
			const limit = pdfLimitText();
			return {
				icon: "file-pdf",
				title: t`PDF`,
				description: t`A document up to ${limit}`,
				keywords: ["pdf", "document", "dokumen"],
			};
		}
		case "link":
			return {
				icon: "link-simple-horizontal",
				title: t`Link`,
				description: t`A card that fills itself in`,
				keywords: ["link", "tautan", "url", "behance", "github"],
			};
	}
}

/**
 * Adds a block at a place in a work: text and metrics at once, pictures after they're chosen and uploaded (a Pictures
 * block always holds one), a video or link once its address is given, a PDF once it's uploaded. A block that arrives
 * late still lands next to the block it was added after. Returns the action, whether something is still uploading,
 * and the pickers and progress the actions show.
 */
function useAddBlock(work: PortfolioWork, index: number, last = false) {
	const uploads = useImageUploads();
	// The place is read when the action starts; the block may only arrive after an upload.
	const inserter = (place: BlockPlace) => (block: PortfolioBlock) =>
		editWork(work.id, (draft) => insertBlocksAt(draft as PortfolioWork, place, [block], index));
	const media = useAddMediaBlock(work.id, (workId, blockId, recipe) =>
		editWork(workId, (draft) => {
			const block = draft.blocks.find((entry) => entry.id === blockId);
			if (block) recipe(block);
		}),
	);
	// Where chosen pictures go, read when the picker opened.
	const picturePlace = useRef<BlockPlace>("end");

	async function addPictures(files: File[], place: BlockPlace) {
		const images = await uploads.upload(files.slice(0, PORTFOLIO_LIMITS.imagesPerBlock), {
			alt: () => work.title.trim(),
		});
		if (!images.length) return;
		inserter(place)(newImagesBlock(images));
		discardUnplacedImages(images);
	}

	const picker = useFilePicker((files) => void addPictures(files, picturePlace.current), { multiple: true });

	const add = (type: PortfolioBlockType) => {
		const place = blockPlace(work, index, last);
		picturePlace.current = place;
		if (type === "images") picker.open();
		else if (type === "video" || type === "pdf" || type === "link") media.add(type, inserter(place));
		else inserter(place)(type === "text" ? newTextBlock() : newMetricsBlock());
	};

	const status = (
		<>
			{picker.element}
			<UploadStatus progress={uploads.progress} errors={uploads.errors} />
			{media.status}
		</>
	);

	return { add, busy: uploads.busy || media.busy, status };
}

type AddBlockMenuProps = {
	work: PortfolioWork;
	index: number;
	/** The last one, under every block: a full button. */ last?: boolean;
};

/** "+ Add block" between blocks: Text, Pictures, Metrics, Video, PDF, Link. */
function AddBlockMenu({ work, index, last = false }: AddBlockMenuProps) {
	const { add, busy, status } = useAddBlock(work, index, last);
	const full = blockRoom(work) === 0;

	return (
		<div className={cn("grid gap-2", !last && "justify-items-center")}>
			<Dropdown>
				{last ? (
					<Button variant="secondary" className="w-fit" isDisabled={full || busy}>
						<Icon name="plus" size={18} />
						<Trans>Add a block</Trans>
					</Button>
				) : (
					<Button
						size="sm"
						variant="ghost"
						className="h-7 text-xs text-muted"
						isDisabled={full || busy}
						aria-label={t`Add a block here`}
					>
						<Icon name="plus" size={14} />
						<Trans>Add block</Trans>
					</Button>
				)}
				<Dropdown.Popover placement="bottom" className="w-72">
					<Dropdown.Menu onAction={(key) => add(key as PortfolioBlockType)}>
						{PORTFOLIO_BLOCK_TYPES.map((type) => {
							const info = blockTypeInfo(type);
							return (
								<Dropdown.Item key={type} id={type} textValue={info.title}>
									<Icon name={info.icon} className="text-muted" />
									<div className="grid">
										<Label>{info.title}</Label>
										<span className="text-xs text-muted">{info.description}</span>
									</div>
								</Dropdown.Item>
							);
						})}
					</Dropdown.Menu>
				</Dropdown.Popover>
			</Dropdown>
			{status}
		</div>
	);
}

type BlockListProps = { work: PortfolioWork; locale: string };

/**
 * A work's detail as blocks (`01-desain.md` section 15): add one anywhere with "+ Add block" (or "/" in a text block),
 * drag or use the arrows to reorder, remove with Undo. An empty work can start from a case study outline.
 */
export function BlockList({ work, locale }: BlockListProps) {
	const blocks = work.blocks;
	const list = `blocks:${work.id}`;
	const { itemProps, fallbackRef, removed } = useRemovalFocus();

	const startCaseStudy = () =>
		editWork(
			work.id,
			(draft) =>
				addCaseStudy(draft as PortfolioWork, {
					problem: t`The problem`,
					role: t`My role`,
					process: t`The process`,
					result: t`The result`,
				}),
			{ structural: true },
		);

	return (
		<div className="grid gap-2">
			{blocks.length === 0 && (
				<div className="grid gap-3 rounded-2xl border border-dashed border-border p-4 text-sm">
					<p className="text-muted">
						<Trans>
							The detail opens when a visitor taps this work. Build it from blocks: text, pictures and results as
							numbers.
						</Trans>
					</p>
					<Button variant="secondary" className="w-fit" onPress={startCaseStudy}>
						<Icon name="magic-wand" size={18} />
						<Trans>Start from a case study outline</Trans>
					</Button>
				</div>
			)}
			<SortableProvider
				onMove={(id, target) =>
					editWork(
						work.id,
						(draft) => {
							const from = draft.blocks.findIndex((block) => block.id === id);
							if (from !== -1) moveItem(draft.blocks, from, target.index);
						},
						{ structural: true },
					)
				}
			>
				<div className="grid gap-1">
					{blocks.map((block, index) => (
						<div key={block.id} className="grid gap-1">
							{index > 0 && <AddBlockMenu work={work} index={index} />}
							<BlockCard
								work={work}
								block={block}
								index={index}
								list={list}
								locale={locale}
								itemProps={itemProps}
								onRemoved={removed}
							/>
						</div>
					))}
				</div>
			</SortableProvider>
			<div ref={fallbackRef} className="flex flex-wrap items-center gap-2 pt-1">
				<AddBlockMenu work={work} index={blocks.length} last />
				{blocks.length > 0 && (
					<span className="text-xs text-muted">
						{blocks.length}/{PORTFOLIO_LIMITS.blocksPerWork}
					</span>
				)}
			</div>
		</div>
	);
}

type BlockCardProps = {
	work: PortfolioWork;
	block: PortfolioBlock;
	index: number;
	list: string;
	locale: string;
	/** Marks the card for `useRemovalFocus`. */
	itemProps: Record<string, string>;
	/** Called as the card is removed, so focus moves to the next one. */
	onRemoved: (index: number) => void;
};

function BlockCard({ work, block, index, list, locale, itemProps, onRemoved }: BlockCardProps) {
	const info = blockTypeInfo(block.type);
	const sortable = useSortableItem({ id: block.id, list, index, label: info.title });
	const count = work.blocks.length;

	const move = (to: number) => editWork(work.id, (draft) => moveItem(draft.blocks, index, to), { structural: true });
	const remove = () => {
		onRemoved(index);
		removeBlockWithUndo(work, block, index, info.title);
	};

	return (
		<div
			{...itemProps}
			{...sortable.dropTargetProps}
			className={cn("relative grid gap-3 rounded-2xl bg-surface-secondary p-3", sortable.isDragging && "opacity-50")}
		>
			<SortableEdge edge={sortable.edge} />
			<div className="flex items-center gap-1">
				<SortableHandle item={sortable} label={t`Reorder the ${info.title} block`} className="h-8 w-6" />
				<Icon name={info.icon} size={16} className="text-muted" />
				<span className="flex-1 text-sm font-medium">{info.title}</span>
				<IconButton
					icon="arrow-up"
					size="sm"
					label={t`Move the ${info.title} block up`}
					isDisabled={index === 0}
					onPress={() => move(index - 1)}
				/>
				<IconButton
					icon="arrow-down"
					size="sm"
					label={t`Move the ${info.title} block down`}
					isDisabled={index === count - 1}
					onPress={() => move(index + 1)}
				/>
				<IconButton
					icon="trash"
					size="sm"
					label={t`Remove the ${info.title} block`}
					className="text-danger"
					onPress={remove}
				/>
			</div>
			<BlockBody work={work} block={block} index={index} locale={locale} onRemove={remove} />
		</div>
	);
}

type BlockBodyProps = {
	work: PortfolioWork;
	block: PortfolioBlock;
	index: number;
	locale: string;
	onRemove: () => void;
};

function BlockBody({ work, block, index, locale, onRemove }: BlockBodyProps) {
	switch (block.type) {
		case "text":
			return <TextBlockEditor work={work} block={block} index={index} />;
		case "images":
			return (
				<ImagesBlockEditor
					work={work}
					block={block}
					edit={(recipe, options) => editBlock(work.id, block.id, "images", recipe, options)}
					onRemove={onRemove}
				/>
			);
		case "metrics":
			return (
				<MetricsEditor
					metrics={block.items}
					keyPrefix={`works.${work.id}.blocks.${block.id}`}
					locale={locale}
					maxItems={PORTFOLIO_LIMITS.metricsPerBlock}
					minItems={1}
					onRemoveLast={onRemove}
					addLabel={<Trans>Add a metric</Trans>}
					edit={(recipe, options) =>
						editBlock(
							work.id,
							block.id,
							"metrics",
							(draft, draftWork) => {
								recipe(draft.items);
								dropMissingHighlight(draftWork as PortfolioWork);
							},
							options,
						)
					}
				/>
			);
		case "video":
			return (
				<VideoBlockEditor
					work={work}
					block={block}
					edit={(recipe, options) => editBlock(work.id, block.id, "video", recipe, options)}
				/>
			);
		case "pdf":
			return (
				<PdfBlockEditor
					work={work}
					block={block}
					edit={(recipe, options) => editBlock(work.id, block.id, "pdf", recipe, options)}
				/>
			);
		case "link":
			return (
				<LinkBlockEditor
					work={work}
					block={block}
					edit={(recipe, options) => editBlock(work.id, block.id, "link", recipe, options)}
				/>
			);
	}
}

type TextBlockEditorProps = { work: PortfolioWork; block: PortfolioBlockOf<"text">; index: number };

/** Rich text; typing "/" adds a block after this one. */
function TextBlockEditor({ work, block, index }: TextBlockEditorProps) {
	const { add, busy, status } = useAddBlock(work, index + 1);
	const slashItems: SlashItem[] = PORTFOLIO_BLOCK_TYPES.map((type) => {
		const info = blockTypeInfo(type);
		return { ...info, onSelect: () => add(type) };
	});

	return (
		<>
			<RichTextField
				hideLabel
				label={t`Text block of ${work.title.trim() || t`this work`}`}
				value={block.html}
				maxLength={max.blockText}
				placeholder={t`Write here. Type “/” to add a block after this one.`}
				// One add at a time: a second one would cancel the upload or link reading still going.
				slashItems={blockRoom(work) > 0 && !busy ? slashItems : undefined}
				onChange={(html) =>
					editBlock(
						work.id,
						block.id,
						"text",
						(draft) => {
							draft.html = html;
						},
						{ key: `works.${work.id}.blocks.${block.id}` },
					)
				}
			/>
			{status}
		</>
	);
}
