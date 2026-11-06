import type { SlashItem } from "../editor/rich-text-editor";
import type { EditorBlockType } from "./blocks";
import type { PortfolioBlock, PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { IconName } from "@rezumi/ui/components/icon";
import type { Draft } from "immer";
import { Button, Dropdown, Label } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { moveItem, RichTextField } from "../editor/fields";
import { editPortfolio, usePortfolioEditorStore } from "../editor/store";
import { UploadStatus, useFilePicker, useImageUploads } from "../images/image-field";
import { MetricsEditor } from "../metrics/metric-form";
import { dropMissingHighlight } from "../metrics/metrics";
import {
	addCaseStudy,
	blockRoom,
	EDITOR_BLOCK_TYPES,
	insertBlocks,
	newImagesBlock,
	newMetricsBlock,
	newTextBlock,
	removeBlock,
} from "./blocks";
import { ImagesBlockEditor } from "./images-block";
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

const undoToast = (description: string) =>
	toast.add({
		description,
		actionProps: { children: t`Undo`, onPress: () => usePortfolioEditorStore.getState().undo() },
	});

type BlockTypeInfo = { icon: IconName; title: string; description: string; keywords: string[] };

function blockTypeInfo(type: PortfolioBlock["type"]): BlockTypeInfo {
	switch (type) {
		case "text":
			return {
				icon: "text-t",
				title: t`Text`,
				description: t`Paragraphs, headings, lists and links`,
				keywords: ["text", "teks", "paragraph"],
			};
		case "images":
			return {
				icon: "image",
				title: t`Pictures`,
				description: t`1 to 12 pictures with captions`,
				keywords: ["image", "picture", "gambar", "foto", "gallery"],
			};
		case "metrics":
			return {
				icon: "chart-line-up",
				title: t`Metrics`,
				description: t`Results as numbers, such as +35% conversion`,
				keywords: ["metric", "metrik", "number", "angka", "result"],
			};
		case "video":
			return { icon: "play", title: t`Video`, description: t`YouTube or Vimeo`, keywords: ["video"] };
		case "pdf":
			return { icon: "file-pdf", title: t`PDF`, description: t`A document to open`, keywords: ["pdf"] };
		case "link":
			return { icon: "link-simple-horizontal", title: t`Link`, description: t`A link card`, keywords: ["link"] };
	}
}

/**
 * Adds a block at a place in a work: text and metrics at once, pictures after they're chosen and uploaded (a Pictures
 * block always holds one). Returns the actions for a menu and the hidden file picker they need.
 */
function useAddBlock(work: PortfolioWork, index: number) {
	const uploads = useImageUploads();

	async function addPictures(files: File[]) {
		const images = await uploads.upload(files.slice(0, PORTFOLIO_LIMITS.imagesPerBlock), {
			alt: () => work.title.trim(),
		});
		if (!images.length) return;
		editWork(work.id, (draft) => insertBlocks(draft as PortfolioWork, index, [newImagesBlock(images)]), {
			structural: true,
		});
	}

	const picker = useFilePicker((files) => void addPictures(files));

	const add = (type: EditorBlockType) => {
		if (type === "images") {
			picker.open();
			return;
		}
		editWork(
			work.id,
			(draft) => insertBlocks(draft as PortfolioWork, index, [type === "text" ? newTextBlock() : newMetricsBlock()]),
			{ structural: true },
		);
	};

	return { add, uploads, picker: picker.element };
}

type AddBlockMenuProps = {
	work: PortfolioWork;
	index: number;
	/** The last one, under every block: a full button. */ last?: boolean;
};

/** "+ Add block" between blocks: Text, Pictures, Metrics (video, PDF and link blocks arrive later). */
function AddBlockMenu({ work, index, last = false }: AddBlockMenuProps) {
	const { add, uploads, picker } = useAddBlock(work, index);
	const full = blockRoom(work) === 0;

	return (
		<div className={cn("grid gap-2", !last && "justify-items-center")}>
			<Dropdown>
				{last ? (
					<Button variant="secondary" className="w-fit" isDisabled={full || uploads.busy}>
						<Icon name="plus" size={18} />
						<Trans>Add a block</Trans>
					</Button>
				) : (
					<Button
						size="sm"
						variant="ghost"
						className="h-7 text-xs text-muted"
						isDisabled={full || uploads.busy}
						aria-label={t`Add a block here`}
					>
						<Icon name="plus" size={14} />
						<Trans>Add block</Trans>
					</Button>
				)}
				<Dropdown.Popover placement="bottom" className="w-72">
					<Dropdown.Menu onAction={(key) => add(key as EditorBlockType)}>
						{[...EDITOR_BLOCK_TYPES, "video" as const, "pdf" as const, "link" as const].map((type) => {
							const info = blockTypeInfo(type);
							const soon = !(EDITOR_BLOCK_TYPES as readonly string[]).includes(type);
							return (
								<Dropdown.Item key={type} id={type} textValue={info.title} isDisabled={soon}>
									<Icon name={info.icon} className="text-muted" />
									<div className="grid">
										<Label>{info.title}</Label>
										<span className="text-xs text-muted">{soon ? t`Coming soon` : info.description}</span>
									</div>
								</Dropdown.Item>
							);
						})}
					</Dropdown.Menu>
				</Dropdown.Popover>
			</Dropdown>
			{picker}
			<UploadStatus progress={uploads.progress} errors={uploads.errors} />
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
							<BlockCard work={work} block={block} index={index} list={list} locale={locale} />
						</div>
					))}
				</div>
			</SortableProvider>
			<div className="flex flex-wrap items-center gap-2 pt-1">
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

type BlockCardProps = { work: PortfolioWork; block: PortfolioBlock; index: number; list: string; locale: string };

function BlockCard({ work, block, index, list, locale }: BlockCardProps) {
	const info = blockTypeInfo(block.type);
	const sortable = useSortableItem({ id: block.id, list, index, label: info.title });
	const count = work.blocks.length;

	const move = (to: number) => editWork(work.id, (draft) => moveItem(draft.blocks, index, to), { structural: true });
	const remove = () => {
		editWork(work.id, (draft) => removeBlock(draft as PortfolioWork, block.id), { structural: true });
		undoToast(t`${info.title} block removed`);
	};

	return (
		<div
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
		default:
			// Video, PDF and link blocks (from a resume import, or a newer editor) are edited from Phase 05 on.
			return (
				<p className="text-sm text-muted">
					<Trans>This kind of block can be edited soon. It shows on the page as it is.</Trans>
				</p>
			);
	}
}

type TextBlockEditorProps = { work: PortfolioWork; block: PortfolioBlockOf<"text">; index: number };

/** Rich text; typing "/" adds a block after this one. */
function TextBlockEditor({ work, block, index }: TextBlockEditorProps) {
	const { add, uploads, picker } = useAddBlock(work, index + 1);
	const slashItems: SlashItem[] = EDITOR_BLOCK_TYPES.map((type) => {
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
				slashItems={blockRoom(work) > 0 ? slashItems : undefined}
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
			{picker}
			<UploadStatus progress={uploads.progress} errors={uploads.errors} />
		</>
	);
}
