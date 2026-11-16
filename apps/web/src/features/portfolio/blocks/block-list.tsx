import type { SlashItem } from "../editor/rich-text-editor";
import type { BlockPlace } from "./blocks";
import type { StoryTemplateId } from "./story-templates";
import type { PortfolioBlock, PortfolioBlockOf, PortfolioBlockType } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { IconName } from "@rezumi/ui/components/icon";
import type { Draft } from "immer";
import { Button, Dropdown, Label } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMemo, useRef } from "react";
import { PORTFOLIO_BLOCK_TYPES } from "@rezumi/schema/portfolio/blocks";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { moveItem, RichTextField } from "../editor/fields";
import { editPortfolio, usePortfolioEditorStore } from "../editor/store";
import { pictureFiles } from "../images/compress";
import { leftOutMessage, UploadStatus, useFilePicker, useImageUploads } from "../images/image-field";
import { discardUnplacedImages } from "../images/upload";
import { pdfLimitText } from "../media/pdf";
import { MetricsEditor } from "../metrics/metric-form";
import { dropMissingHighlight } from "../metrics/metrics";
import { focusTextBlock } from "../works/doc-focus";
import { pdfFiles, useAddMediaBlock } from "./add-media-block";
import {
	blockPlace,
	blockRoom,
	insertBlocksAt,
	newImagesBlock,
	newMetricsBlock,
	newTextBlock,
	removeBlock,
	restoreBlock,
} from "./blocks";
import { EmbedBlockEditor } from "./embed-block";
import { ImagesBlockEditor } from "./images-block";
import { LinkBlockEditor } from "./link-block";
import { useRemovalFocus } from "./list-focus";
import { PdfBlockEditor } from "./pdf-block";
import { StoryTemplateMenu } from "./story-template-menu";
import { addStoryTemplate, normalizeHeading, storyHints } from "./story-templates";
import { VideoBlockEditor } from "./video-block";
import { SortableEdge, SortableHandle, SortableProvider, useSortableItem } from "@/components/input/sortable";
import { openAssistantFrom } from "@/features/assistant/open";

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
		case "embed":
			return {
				icon: "plugs-connected",
				title: t`Embed`,
				description: t`Figma, Loom, Spotify, SoundCloud or Google Slides`,
				keywords: ["embed", "sematan", "figma", "loom", "spotify", "soundcloud", "slides"],
			};
	}
}

/** The words for a block that arrived when its work had no room left. */
const fullWorkMessage = () =>
	t`This work already holds ${PORTFOLIO_LIMITS.blocksPerWork} blocks, so the new block wasn't added.`;

/**
 * Adds a block at a place in a work: text and metrics at once, pictures after they're chosen and uploaded (a Pictures
 * block always holds one), a video or link once its address is given, a PDF once it's uploaded. A block that arrives
 * late still lands next to the block it was added after. Returns the action, whether something is still uploading,
 * and the pickers and progress the actions show.
 */
function useAddBlock(work: PortfolioWork, index: number, last = false) {
	const uploads = useImageUploads();
	// The place is read when the action starts; the block may only arrive after an upload.
	const inserter =
		(place: BlockPlace) =>
		(block: PortfolioBlock): boolean => {
			let added = 0;
			editWork(work.id, (draft) => {
				added = insertBlocksAt(draft as PortfolioWork, place, [block], index);
			});
			// The work filled up while the block was on its way (another upload, another tab).
			if (!added) toast.add({ type: "warning", description: fullWorkMessage() });
			return added > 0;
		};
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
		const left = files.length - PORTFOLIO_LIMITS.imagesPerBlock;
		if (left > 0) uploads.addError(leftOutMessage(left, PORTFOLIO_LIMITS.imagesPerBlock));
		inserter(place)(newImagesBlock(images));
		discardUnplacedImages(images);
	}

	const picker = useFilePicker((files) => void addPictures(files, picturePlace.current), { multiple: true });

	const add = (type: PortfolioBlockType) => {
		const place = blockPlace(work, index, last);
		picturePlace.current = place;
		if (type === "images") picker.open();
		else if (type === "video" || type === "embed" || type === "pdf" || type === "link")
			media.add(type, inserter(place));
		else if (type === "text") {
			const block = newTextBlock();
			// A new paragraph is for typing in: the caret goes there.
			if (inserter(place)(block)) focusTextBlock(block.id);
		} else inserter(place)(newMetricsBlock());
	};

	const status = (
		<>
			{picker.element}
			<UploadStatus progress={uploads.progress} errors={uploads.errors} onDismiss={uploads.clearErrors} />
			{media.status}
		</>
	);

	/**
	 * Files pasted or dropped into a text block: pictures become a Pictures block after it, a PDF a PDF block. False
	 * for anything else, which the text handles as it would.
	 */
	const addFiles = (files: File[]): boolean => {
		const pictures = pictureFiles(files);
		const pdf = pdfFiles(files)[0];
		if (!pictures.length && !pdf) return false;
		if (blockRoom(work) === 0) {
			toast.add({ type: "warning", description: fullWorkMessage() });
			return true;
		}
		const place = blockPlace(work, index, last);
		if (pictures.length) void addPictures(pictures, place);
		else if (pdf) media.addPdfFile(pdf, inserter(place));
		return true;
	};

	/** A YouTube, Vimeo or embeddable address pasted on an empty line becomes its block after this one. */
	const addUrl = (url: string): boolean => {
		if (blockRoom(work) === 0) return false;
		return media.addFromUrl(url, inserter(blockPlace(work, index, last)));
	};

	return { add, addFiles, addUrl, busy: uploads.busy || media.busy, status };
}

/**
 * `panel`: framed cards in a narrow panel (a phone's sheet). `document`: Work's writing surface, text as part of the
 * page, each block's controls beside it while it's hovered or focused.
 */
type BlockListAppearance = "panel" | "document";

type AddBlockMenuProps = {
	work: PortfolioWork;
	index: number;
	appearance?: BlockListAppearance;
	/** The last one, under every block: a full button. */ last?: boolean;
	/** No button, only the progress and messages of what it started (it's after the last block now). */
	quiet?: boolean;
};

/** "+ Add block" between blocks: Text, Pictures, Metrics, Video, PDF, Link. */
function AddBlockMenu({ work, index, last = false, quiet = false, appearance = "panel" }: AddBlockMenuProps) {
	const { add, busy, status } = useAddBlock(work, index, last);
	const full = blockRoom(work) === 0;

	if (quiet) return status;
	return (
		<div
			className={cn(
				"grid gap-2",
				!last && "justify-items-center",
				// Between a document's blocks: shown while the gap is hovered or the button has focus.
				appearance === "document" &&
					!last &&
					"opacity-0 transition-opacity duration-quick focus-within:opacity-100 hover:opacity-100 pointer-coarse:opacity-100",
			)}
		>
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

type BlockListProps = { work: PortfolioWork; locale: string; appearance?: BlockListAppearance };

/**
 * A work's detail as blocks (`01-desain.md` section 15): add one anywhere with "+ Add block" (or "/" in a text block,
 * or by pasting pictures or a video link into one), drag to reorder, remove with Undo. An empty work can start from an
 * outline for its kind of work (`story-templates.ts`); on Work's writing surface also by writing, or with the
 * assistant's interview.
 */
export function BlockList({ work, locale, appearance = "panel" }: BlockListProps) {
	const blocks = work.blocks;
	const list = `blocks:${work.id}`;
	const { itemProps, fallbackRef, removed } = useRemovalFocus();

	const { i18n } = useLingui();
	const startOutline = (id: StoryTemplateId) => {
		let first: string | undefined;
		editWork(
			work.id,
			(draft) => {
				first = addStoryTemplate(draft as PortfolioWork, id, (descriptor) => i18n._(descriptor))[0]?.id;
			},
			{ structural: true },
		);
		// The caret under the first heading, to start writing.
		if (first) focusTextBlock(first);
	};

	const asDocument = appearance === "document";

	return (
		<div className="grid gap-2">
			{blocks.length === 0 &&
				(asDocument ? (
					<EmptyStory work={work} onOutline={startOutline} />
				) : (
					<StoryTemplateMenu work={work} onPick={startOutline}>
						<Button variant="secondary" className="w-fit">
							<Icon name="magic-wand" size={18} />
							<Trans>Start from an outline</Trans>
						</Button>
					</StoryTemplateMenu>
				))}
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
				<div className={asDocument ? "grid gap-0.5" : "grid gap-1"}>
					{blocks.map((block, index) => (
						// The menu after a block belongs to that block, so a block that arrives late (an upload) still has its
						// menu, and its progress, when the blocks around it move or go. After the last block it only shows
						// what it's doing: the full button below adds there.
						<div key={block.id} className="grid gap-1">
							<BlockCard
								work={work}
								block={block}
								index={index}
								list={list}
								locale={locale}
								itemProps={itemProps}
								onRemoved={removed}
								appearance={appearance}
							/>
							<AddBlockMenu work={work} index={index + 1} quiet={index === blocks.length - 1} appearance={appearance} />
						</div>
					))}
				</div>
			</SortableProvider>
			<div ref={fallbackRef} className="flex flex-wrap items-center gap-2 pt-1">
				<AddBlockMenu work={work} index={blocks.length} last appearance={appearance} />
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
	appearance: BlockListAppearance;
};

function BlockCard({ work, block, index, list, locale, itemProps, onRemoved, appearance }: BlockCardProps) {
	const info = blockTypeInfo(block.type);
	const sortable = useSortableItem({ id: block.id, list, index, label: info.title });
	const remove = () => {
		onRemoved(index);
		removeBlockWithUndo(work, block, index, info.title);
	};

	// A document: the handle and Remove in the start gutter while the block is hovered or focused; text without a frame.
	if (appearance === "document")
		return (
			<div
				{...itemProps}
				{...sortable.dropTargetProps}
				data-block-id={block.id}
				className={cn("group/block relative", sortable.isDragging && "opacity-50")}
			>
				<SortableEdge edge={sortable.edge} />
				<div className="absolute -start-16 top-0 flex items-center opacity-0 transition-opacity duration-quick group-focus-within/block:opacity-100 group-hover/block:opacity-100 pointer-coarse:opacity-100">
					<SortableHandle item={sortable} label={t`Reorder the ${info.title} block`} className="h-8 w-6" />
					<IconButton
						icon="trash"
						size="sm"
						label={t`Remove the ${info.title} block`}
						className="text-muted hover:text-danger"
						onPress={remove}
					/>
				</div>
				{block.type === "text" ? (
					<BlockBody
						work={work}
						block={block}
						index={index}
						locale={locale}
						onRemove={remove}
						appearance={appearance}
					/>
				) : (
					<div className="grid gap-3 rounded-2xl border border-separator p-3">
						<div className="flex items-center gap-2 text-sm font-medium text-muted">
							<Icon name={info.icon} size={16} />
							{info.title}
						</div>
						<BlockBody work={work} block={block} index={index} locale={locale} onRemove={remove} />
					</div>
				)}
			</div>
		);

	return (
		<div
			{...itemProps}
			{...sortable.dropTargetProps}
			data-block-id={block.id}
			className={cn("relative grid gap-3 rounded-xl border border-separator p-3", sortable.isDragging && "opacity-50")}
		>
			<SortableEdge edge={sortable.edge} />
			<div className="flex items-center gap-1">
				<SortableHandle item={sortable} label={t`Reorder the ${info.title} block`} className="h-8 w-6" />
				<Icon name={info.icon} size={16} className="text-muted" />
				<span className="flex-1 text-sm font-medium">{info.title}</span>
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
	appearance?: BlockListAppearance;
};

function BlockBody({ work, block, index, locale, onRemove, appearance = "panel" }: BlockBodyProps) {
	switch (block.type) {
		case "text":
			return <TextBlockEditor work={work} block={block} index={index} appearance={appearance} />;
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
					onReplace={(next) =>
						editWork(
							work.id,
							(draft) => {
								const at = draft.blocks.findIndex((entry) => entry.id === block.id);
								if (at !== -1) draft.blocks[at] = next;
							},
							{ structural: true },
						)
					}
				/>
			);
		case "embed":
			return (
				<EmbedBlockEditor
					work={work}
					block={block}
					edit={(recipe, options) => editBlock(work.id, block.id, "embed", recipe, options)}
				/>
			);
	}
}

type TextBlockEditorProps = {
	work: PortfolioWork;
	block: PortfolioBlockOf<"text">;
	index: number;
	appearance: BlockListAppearance;
};

/** Rich text; typing "/" adds a block after this one. */
function TextBlockEditor({ work, block, index, appearance }: TextBlockEditorProps) {
	const { add, addFiles, addUrl, busy, status } = useAddBlock(work, index + 1);
	const { i18n } = useLingui();
	// The questions under a story outline's headings, in the app's language.
	const hints = useMemo(() => storyHints((descriptor) => i18n._(descriptor)), [i18n]);
	const slashItems: SlashItem[] = PORTFOLIO_BLOCK_TYPES.map((type) => {
		const info = blockTypeInfo(type);
		return { ...info, onSelect: () => add(type) };
	});

	return (
		<>
			<RichTextField
				// One add at a time, as for "/".
				onFiles={busy ? undefined : addFiles}
				onUrl={busy ? undefined : addUrl}
				headingHint={(heading) => hints.get(normalizeHeading(heading))}
				hideLabel
				rewrite="blockText"
				label={t`Text block of ${work.title.trim() || t`this work`}`}
				value={block.html}
				maxLength={max.blockText}
				appearance={appearance === "document" ? "document" : "field"}
				placeholder={
					appearance === "document"
						? t`Write, or type “/” for headings, lists, pictures and more…`
						: t`Write here. Type “/” to add a block after this one.`
				}
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

type EmptyStoryProps = { work: PortfolioWork; onOutline: (id: StoryTemplateId) => void };

/**
 * A work with no detail yet, on Work's writing surface: three ways to start the story. Writing it alone adds a text
 * block with the caret in it; an outline (picked for the kind of work) adds its headings; AI interviews the person about this work
 * (a few questions with likely answers to pick, `portfolioFocusNote` on the server) and writes the blocks.
 */
function EmptyStory({ work, onOutline }: EmptyStoryProps) {
	const startWriting = () => {
		const block = newTextBlock();
		editWork(work.id, (draft) => void insertBlocksAt(draft as PortfolioWork, "end", [block], 0), {
			structural: true,
		});
		focusTextBlock(block.id);
	};
	// Sent at once: the assistant opens on this work (its chip) and starts with its first question.
	const askAi = () => openAssistantFrom({ ask: t`Interview me about this work, then write its story.` });
	const cardClass =
		"grid cursor-(--cursor-interactive) content-start gap-1 rounded-xl bg-default/60 p-3 text-start transition-colors duration-quick outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus";
	const card = (icon: IconName, title: string, description: string) => (
		<>
			<Icon name={icon} size={18} className="text-accent" />
			<span className="text-sm font-medium">{title}</span>
			<span className="text-xs text-muted">{description}</span>
		</>
	);

	return (
		<div className="grid gap-3 rounded-2xl border border-dashed border-separator p-4">
			<p className="text-sm text-muted">
				<Trans>Tell the story behind this work: the problem, what you did, and what changed.</Trans>
			</p>
			<div className="grid gap-2 @md:grid-cols-3">
				<button type="button" onClick={askAi} className={cardClass}>
					{card("sparkle", t`Write it with AI`, t`Answer a few questions; it writes the story`)}
				</button>
				<StoryTemplateMenu work={work} onPick={onOutline} asTrigger={{ className: cardClass }}>
					{card("list-numbers", t`Start from an outline`, t`Headings for your kind of work: design, code, marketing…`)}
				</StoryTemplateMenu>
				<button type="button" onClick={startWriting} className={cardClass}>
					{card("text-t", t`Write it myself`, t`Start with an empty paragraph`)}
				</button>
			</div>
		</div>
	);
}
