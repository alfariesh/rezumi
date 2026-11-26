import type { PortfolioBlock, PortfolioBlockType } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { View } from "react-native";
import {
	blockRoom,
	dropMissingHighlight,
	insertBlocks,
	newImagesBlock,
	newMetric,
	newMetricsBlock,
	newTextBlock,
	removeBlock,
} from "@rezumi/portfolio/editing";
import { IMAGE_BLOCK_LAYOUTS } from "@rezumi/schema/portfolio/blocks";
import { PORTFOLIO_LIMITS as limits } from "@rezumi/schema/portfolio/limits";
import { AiField } from "./ai";
import { Field, Group, Order } from "./fields";
import { blockFromLink, MediaError, pickPdf } from "./media";
import { Metric } from "./metric";
import { AddPictures, PicturePreview } from "./pictures";
import { useEditor, useWorkEdit } from "./store";
import { useOnline } from "@/api/online";
import { Button, ListGroup, ListRow, Segment, Sheet, Text, showToast } from "@/ui";

const { text: max } = limits;
type BlocksProps = { work: PortfolioWork };
type LinkKind = "video" | "embed" | "link";

function useBlockLabels() {
	const { t } = useLingui();
	return {
		text: t`Text`,
		images: t`Pictures`,
		metrics: t`Metrics`,
		video: t`Video`,
		link: t`Link`,
		embed: t`Embed`,
		pdf: t`PDF`,
	} satisfies Record<PortfolioBlockType, string>;
}

export function Blocks({ work }: BlocksProps) {
	const { t } = useLingui();
	const online = useOnline();
	const labels = useBlockLabels();
	const { scope } = useEditor();
	const change = useWorkEdit(work.id);
	const [menu, setMenu] = useState(false);
	const [link, setLink] = useState<LinkKind | null>(null);
	const [showPictures, setShowPictures] = useState(false);
	const [url, setUrl] = useState("");
	const [busy, setBusy] = useState(false);
	const next = useRef<(() => void) | null>(null);

	const append = (block: PortfolioBlock) =>
		change(
			(draft) => {
				insertBlocks(draft, draft.blocks.length, [block]);
			},
			{ structural: true },
		);

	const run = async (read: () => Promise<PortfolioBlock | null>) => {
		setBusy(true);
		try {
			const block = await read();
			if (block) append(block);
			setLink(null);
		} catch (error) {
			showToast({
				title: error instanceof MediaError ? error.message : t`Couldn't add the block. Try again.`,
				variant: "danger",
			});
		} finally {
			setBusy(false);
		}
	};
	const move = (id: string, shift: number) =>
		change(
			(draft) => {
				const from = draft.blocks.findIndex((item) => item.id === id);
				if (from < 0 || !draft.blocks[from + shift]) return;
				const [item] = draft.blocks.splice(from, 1);
				if (item) draft.blocks.splice(from + shift, 0, item);
			},
			{ structural: true },
		);
	const choose = (kind: PortfolioBlockType) => {
		next.current = () => {
			if (kind === "text") append(newTextBlock());
			else if (kind === "metrics") append(newMetricsBlock());
			else if (kind === "images") setShowPictures(true);
			else if (kind === "pdf") void run(() => pickPdf(scope));
			else {
				setUrl("");
				setLink(kind);
			}
		};
		setMenu(false);
	};
	const room = blockRoom(work);
	return (
		<>
			<Group
				title={t`Blocks`}
				action={
					<Button
						size="sm"
						variant="secondary"
						testID="portfolio-add-block"
						isDisabled={busy || room === 0}
						onPress={() => setMenu(true)}
					>
						{busy ? t`Adding block…` : t`Add block`}
					</Button>
				}
			>
				{showPictures && room > 0 ? (
					<AddPictures
						label={t`Add pictures to this work`}
						limit={limits.imagesPerBlock}
						onPictures={(images) => {
							append(newImagesBlock(images));
							setShowPictures(false);
						}}
					/>
				) : null}
				{work.blocks.length === 0 ? (
					<Text tone="muted">{t`Add blocks to show what you did and what changed.`}</Text>
				) : null}
				{work.blocks.map((block, index) => (
					<View key={block.id} className="gap-3 rounded-lg border border-border p-3">
						<View className="flex-row flex-wrap items-center justify-between gap-2">
							<Text weight="semibold">{labels[block.type]}</Text>
							<Order
								up={index > 0 ? () => move(block.id, -1) : undefined}
								down={index < work.blocks.length - 1 ? () => move(block.id, 1) : undefined}
								remove={() => change((draft) => removeBlock(draft, block.id), { structural: true })}
							/>
						</View>
						<BlockFields workId={work.id} block={block} />
					</View>
				))}
			</Group>
			<Sheet
				isOpen={menu}
				onOpenChange={setMenu}
				title={t`Add block`}
				closeLabel={t`Close`}
				onDidDismiss={() => {
					const action = next.current;
					next.current = null;
					action?.();
				}}
			>
				<ListGroup>
					{(Object.keys(labels) as PortfolioBlockType[]).map((type) => (
						<ListRow
							key={type}
							title={labels[type]}
							isDisabled={!online && type !== "text" && type !== "metrics"}
							onPress={() => choose(type)}
						/>
					))}
				</ListGroup>
			</Sheet>
			<Sheet
				isOpen={link !== null}
				onOpenChange={(open) => {
					if (!open && !busy) setLink(null);
				}}
				title={link ? labels[link] : t`Add block`}
				closeLabel={t`Close`}
			>
				<View className="gap-3">
					<Field label={t`URL`} value={url} onChange={setUrl} max={max.url} keyboard="url" />
					<Button
						testID="portfolio-submit-block-link"
						isDisabled={!online || !url.trim() || busy}
						onPress={() => {
							if (link) void run(async () => (await blockFromLink(url.trim(), scope, link)).block);
						}}
					>{t`Add block`}</Button>
				</View>
			</Sheet>
		</>
	);
}

type BlockProps = { workId: string; block: PortfolioBlock };

function BlockFields({ workId, block }: BlockProps) {
	const { t } = useLingui();
	const editWork = useWorkEdit(workId);
	const { scope } = useEditor();
	const online = useOnline();
	const [replacement, setReplacement] = useState("");
	const [busy, setBusy] = useState(false);
	const update = (change: (target: Draft<PortfolioBlock>, work: Draft<PortfolioWork>) => void, key?: string) =>
		editWork(
			(work) => {
				const target = work.blocks.find((item) => item.id === block.id);
				if (target) change(target, work);
			},
			key ? { key: `${block.id}:${key}` } : { structural: true },
		);
	const lookup = (work: PortfolioWork | undefined) => work?.blocks.find((item) => item.id === block.id);
	if (block.type === "text")
		return (
			<AiField
				label={t`Block text`}
				field="blockText"
				rich
				value={block.html}
				read={(data) => {
					const target = lookup(data.works.items.find(({ id }) => id === workId));
					return target?.type === "text" ? target.html : undefined;
				}}
				write={(data, html) => {
					const target = lookup(data.works.items.find(({ id }) => id === workId));
					if (target?.type === "text") target.html = html;
				}}
			/>
		);
	if (block.type === "images")
		return (
			<>
				<Segment
					value={block.layout}
					accessibilityLabel={t`Picture layout`}
					onValueChange={(layout) =>
						update((target) => {
							if (target.type === "images") target.layout = layout;
						})
					}
					options={IMAGE_BLOCK_LAYOUTS.map((value) => ({
						value,
						label: { full: t`Full width`, grid: t`Grid`, carousel: t`Carousel` }[value],
					}))}
				/>
				{block.images.map((picture, index) => (
					<View key={`${picture.key}:${index}`} className="gap-2">
						<PicturePreview picture={picture} />
						<Field
							label={t`Alternative text`}
							value={picture.alt}
							max={max.alt}
							onChange={(text) =>
								update((target) => {
									const image = target.type === "images" ? target.images[index] : undefined;
									if (image) image.alt = text;
								}, `alt:${index}`)
							}
						/>
						<Field
							label={t`Caption`}
							value={picture.caption ?? ""}
							max={max.caption}
							onChange={(caption) =>
								update((target) => {
									const image = target.type === "images" ? target.images[index] : undefined;
									if (image) image.caption = caption;
								}, `caption:${index}`)
							}
						/>
						<Order
							remove={
								block.images.length > 1
									? () =>
											update((target) => {
												if (target.type === "images") target.images.splice(index, 1);
											})
									: undefined
							}
						/>
					</View>
				))}
				{block.images.length < limits.imagesPerBlock ? (
					<AddPictures
						label={t`Add pictures`}
						limit={limits.imagesPerBlock - block.images.length}
						onPictures={(images) =>
							update((target) => {
								if (target.type === "images")
									target.images.push(...images.slice(0, limits.imagesPerBlock - target.images.length));
							})
						}
					/>
				) : null}
			</>
		);
	if (block.type === "metrics")
		return (
			<>
				{block.items.map((metric) => (
					<Metric
						key={metric.id}
						metric={metric}
						change={(change, key) =>
							update((target) => {
								const item = target.type === "metrics" ? target.items.find(({ id }) => id === metric.id) : undefined;
								if (item) change(item);
							}, key)
						}
						remove={
							block.items.length > 1
								? () =>
										update((target, work) => {
											if (target.type === "metrics") {
												target.items = target.items.filter(({ id }) => id !== metric.id);
												dropMissingHighlight(work);
											}
										})
								: undefined
						}
					/>
				))}
				<Button
					variant="secondary"
					isDisabled={block.items.length >= limits.metricsPerBlock}
					onPress={() =>
						update((target) => {
							if (target.type === "metrics") target.items.push(newMetric());
						})
					}
				>{t`Add metric`}</Button>
			</>
		);
	const picture = block.type === "pdf" ? block.preview : block.type === "link" ? block.image : block.thumbnail;
	const replace = async () => {
		setBusy(true);
		try {
			const next =
				block.type === "pdf"
					? await pickPdf(scope)
					: (await blockFromLink(replacement.trim(), scope, block.type)).block;
			if (next)
				editWork(
					(work) => {
						const index = work.blocks.findIndex(({ id }) => id === block.id);
						if (index >= 0) work.blocks[index] = { ...next, id: block.id };
					},
					{ structural: true },
				);
			setReplacement("");
		} catch (error) {
			showToast({
				title: error instanceof MediaError ? error.message : t`Couldn't replace this block.`,
				variant: "danger",
			});
		} finally {
			setBusy(false);
		}
	};
	return (
		<>
			{picture ? <PicturePreview picture={picture} /> : null}
			<Field
				label={t`Title`}
				value={block.title ?? ""}
				max={block.type === "link" ? max.linkTitle : max.mediaTitle}
				onChange={(title) =>
					update((target) => {
						if ("title" in target) target.title = title;
					}, "title")
				}
			/>
			{block.type === "link" ? (
				<>
					<Text selectable tone="muted">
						{block.url}
					</Text>
					<Field
						label={t`Description`}
						value={block.description ?? ""}
						max={max.linkDescription}
						onChange={(text) =>
							update((target) => {
								if (target.type === "link") target.description = text;
							}, "description")
						}
					/>
				</>
			) : block.type === "pdf" ? (
				<Text tone="muted">{t`Pages: ${block.pages}`}</Text>
			) : (
				<Text tone="muted">{block.provider}</Text>
			)}
			{block.type !== "pdf" ? (
				<Field label={t`Replacement URL`} value={replacement} keyboard="url" max={max.url} onChange={setReplacement} />
			) : null}
			<Button
				variant="secondary"
				isDisabled={!online || busy || (block.type !== "pdf" && !replacement.trim())}
				onPress={() => void replace()}
			>
				{block.type === "pdf" ? t`Replace PDF` : t`Replace link`}
			</Button>
			{block.type !== "pdf" ? (
				<AddPictures
					label={t`Choose preview picture`}
					onPictures={([image]) => {
						if (!image) return;
						update((target) => {
							if (target.type === "link") target.image = image;
							else if (target.type === "embed" || target.type === "video") target.thumbnail = image;
						});
					}}
				/>
			) : null}
		</>
	);
}
