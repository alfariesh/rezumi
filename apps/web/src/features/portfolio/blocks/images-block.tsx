import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { IMAGE_BLOCK_LAYOUTS } from "@rezumi/schema/portfolio/blocks";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { ChoiceSelect, moveItem, SortableCard, SortableList, TextInput } from "../editor/fields";
import {
	AltTextInput,
	ImageDrop,
	leftOutMessage,
	portfolioImageSrc,
	UploadStatus,
	useImageUploads,
} from "../images/image-field";
import { discardUnplacedImages } from "../images/upload";
import { pictureKeys } from "./blocks";
import { useRemovalFocus } from "./list-focus";

const layoutLabel = (layout: (typeof IMAGE_BLOCK_LAYOUTS)[number]) =>
	({ full: t`Full width, one under another`, grid: t`Grid`, carousel: t`Swipe sideways` })[layout];

type ImagesBlockEditorProps = {
	work: PortfolioWork;
	block: PortfolioBlockOf<"images">;
	edit: (
		recipe: (block: Draft<PortfolioBlockOf<"images">>) => void,
		options?: { key?: string; structural?: boolean },
	) => void;
	/** Removing the last picture removes the block. */
	onRemove: () => void;
};

/** A Pictures block: 1 to 12 pictures, each described and with an optional caption, laid out one of three ways. */
export function ImagesBlockEditor({ work, block, edit, onRemove }: ImagesBlockEditorProps) {
	const uploads = useImageUploads();
	const { itemProps, fallbackRef, removed } = useRemovalFocus();
	const images = block.images;
	const most = PORTFOLIO_LIMITS.imagesPerBlock;
	const room = most - images.length;
	const keys = pictureKeys(images);

	const add = async (files: File[]) => {
		const added = await uploads.upload(files.slice(0, room), { alt: () => work.title.trim() });
		const left = files.length - Math.max(0, room);
		if (left > 0 && added.length) uploads.addError(leftOutMessage(left, most));
		if (!added.length) return;
		edit((draft) => {
			draft.images.push(...added.slice(0, most - draft.images.length));
		});
		// Pictures there was no more room for when they arrived (another upload filled the block) aren't kept.
		discardUnplacedImages(added);
	};

	return (
		<div className="grid gap-3">
			<ChoiceSelect
				label={t`Layout`}
				value={block.layout}
				options={IMAGE_BLOCK_LAYOUTS.map((id) => ({ id, label: layoutLabel(id) }))}
				onChange={(layout) =>
					edit((draft) => {
						draft.layout = layout;
					})
				}
			/>
			<SortableList
				ids={keys}
				onMove={(from, to) => edit((draft) => moveItem(draft.images, from, to), { structural: true })}
			>
				{images.map((image, index) => {
					const name = image.alt.trim() || t`Picture ${index + 1}`;
					return (
						<SortableCard
							key={keys[index]}
							id={keys[index] ?? String(index)}
							list="images"
							index={index}
							name={name}
							onRemove={() => {
								if (images.length === 1) {
									onRemove();
									return;
								}
								removed(index);
								edit(
									(draft) => {
										draft.images.splice(index, 1);
									},
									{ structural: true },
								);
							}}
							itemProps={itemProps}
						>
							<div className="flex gap-3">
								<img
									src={portfolioImageSrc(image)}
									alt=""
									width={image.width}
									height={image.height}
									className="size-20 shrink-0 rounded-lg bg-surface object-cover"
								/>
								<div className="grid min-w-0 flex-1 gap-3">
									<AltTextInput
										value={image.alt}
										fallback={work.title.trim()}
										onChange={(alt) =>
											edit(
												(draft) => {
													const target = draft.images[index];
													if (target) target.alt = alt;
												},
												{ key: `blocks.${block.id}.${index}.alt` },
											)
										}
									/>
								</div>
							</div>
							<TextInput
								label={t`Caption (optional)`}
								value={image.caption ?? ""}
								maxLength={PORTFOLIO_LIMITS.text.caption}
								onChange={(caption) =>
									edit(
										(draft) => {
											const target = draft.images[index];
											if (!target) return;
											if (caption) target.caption = caption;
											else delete target.caption;
										},
										{ key: `blocks.${block.id}.${index}.caption` },
									)
								}
							/>
						</SortableCard>
					);
				})}
			</SortableList>
			<div ref={fallbackRef} className="contents">
				{room > 0 ? (
					<ImageDrop
						compact
						multiple
						label={t`Add pictures`}
						isDisabled={uploads.busy}
						onFiles={(files) => void add(files)}
					/>
				) : (
					<p className="text-body-xs text-muted">
						<Trans>A Pictures block holds up to {most} pictures. Add another block for more.</Trans>
					</p>
				)}
			</div>
			<UploadStatus progress={uploads.progress} errors={uploads.errors} onDismiss={uploads.clearErrors} />
		</div>
	);
}
