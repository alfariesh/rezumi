import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { Button } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { samePlayedVideo, stillPlays, videoAddress } from "@rezumi/portfolio/editing";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { parseVideoUrl, youtubeThumbnailUrl } from "@rezumi/schema/portfolio/video";
import { Icon } from "@rezumi/ui/components/icon";
import { TextInput } from "../editor/fields";
import { runPortfolioTask, usePortfolioTask } from "../editor/tasks";
import { portfolioImageSrc } from "../images/image-field";
import { discardUploadedImages } from "../images/upload";
import { importVideoThumbnail, remotePictureErrorMessage, videoBlockFromUrl } from "../media/remote";
import { useDraftText } from "../metrics/use-draft-text";
import { currentBlock, TaskStatus } from "./add-media-block";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";

const { text: max } = PORTFOLIO_LIMITS;

/** A pause in typing a video link before its title and thumbnail are fetched. */
const DETAILS_DELAY_MS = 600;

export type EditBlock<T extends PortfolioBlockOf<"video" | "embed" | "pdf" | "link">["type"]> = (
	recipe: (block: Draft<PortfolioBlockOf<T>>) => void,
	options?: { key?: string; structural?: boolean },
) => void;

type VideoBlockEditorProps = { work: PortfolioWork; block: PortfolioBlockOf<"video">; edit: EditBlock<"video"> };

/**
 * A video: its thumbnail (copied into the portfolio), the link it plays, and an optional title. A new link plays at
 * once; its title and thumbnail are fetched after a pause in typing, the latest link only, and are kept only while the
 * block still plays that video. Fetching and copying run in the background (`runPortfolioTask`), so they still land
 * when the work is closed meanwhile.
 */
export function VideoBlockEditor({ work, block, edit }: VideoBlockEditorProps) {
	const [text, setText] = useDraftText(videoAddress(block));
	const key = `works.${work.id}.blocks.${block.id}.video`;
	const taskKey = `works.${work.id}.blocks.${block.id}.details`;
	const task = usePortfolioTask(taskKey);
	const parsed = parseVideoUrl(text);
	const thumbnail = block.thumbnail
		? portfolioImageSrc(block.thumbnail)
		: (block.thumbnailUrl ?? (block.provider === "youtube" ? youtubeThumbnailUrl(block.videoId) : null));

	/** Copies the thumbnail of the video the block plays now; dropped when the block moved on to another one. */
	const copyThumbnail = async (
		video: PortfolioBlockOf<"video">,
		signal: AbortSignal,
		onFailure?: (error: unknown) => void,
	) => {
		const image = await importVideoThumbnail(video, signal, onFailure);
		if (!image) return;
		if (!stillPlays(currentBlock(work.id, block.id), video)) {
			void discardUploadedImages([image]);
			return;
		}
		edit((draft) => {
			draft.thumbnail = image;
		});
	};

	// Says why "Copy the thumbnail" didn't work, when the person pressed it.
	const copyNow = () =>
		runPortfolioTask(taskKey, async ({ signal, say, fail }) => {
			say(t`Copying the thumbnail into your portfolio…`);
			await copyThumbnail(block, signal, (failure) => {
				openPlanDialogForError(failure);
				fail(remotePictureErrorMessage(failure));
			});
		});

	/** The title and thumbnail of the video `url` names, once typing paused. */
	const fetchDetails = (url: string) =>
		runPortfolioTask(
			taskKey,
			async ({ signal, say }) => {
				say(t`Copying the thumbnail into your portfolio…`);
				const fresh = await videoBlockFromUrl(url, signal);
				if (!fresh || !stillPlays(currentBlock(work.id, block.id), fresh)) return;
				edit(
					(draft) => {
						if (fresh.thumbnailUrl) draft.thumbnailUrl = fresh.thumbnailUrl;
						if (!draft.title?.trim() && fresh.title) draft.title = fresh.title;
					},
					{ key },
				);
				await copyThumbnail({ ...fresh, id: block.id }, signal);
			},
			{ delayMs: DETAILS_DELAY_MS },
		);

	const changeVideo = (value: string) => {
		setText(value);
		const next = parseVideoUrl(value);
		if (!next || samePlayedVideo(block, next)) return;
		// The block plays the new video at once; a pause in typing fetches its title and thumbnail.
		edit(
			(draft) => {
				draft.provider = next.provider;
				draft.videoId = next.videoId;
				if (next.provider === "vimeo" && next.hash) draft.hash = next.hash;
				else delete draft.hash;
				if (next.provider === "youtube") draft.thumbnailUrl = youtubeThumbnailUrl(next.videoId);
				else delete draft.thumbnailUrl;
				delete draft.thumbnail;
			},
			{ key },
		);
		// The pause starts over with every new link, cancelling what was on its way for the one before.
		void fetchDetails(value);
	};

	return (
		<div className="grid gap-3">
			<div className="relative aspect-video overflow-hidden rounded-xl bg-black">
				{thumbnail && (
					<img src={thumbnail} alt="" referrerPolicy="no-referrer" className="size-full object-cover opacity-80" />
				)}
				<span className="absolute inset-0 grid place-items-center">
					<span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
						<Icon name="play" size={22} />
					</span>
				</span>
				<span className="absolute start-3 bottom-2 text-xs font-medium text-white">
					{block.provider === "youtube" ? "YouTube" : "Vimeo"}
				</span>
			</div>
			<TextInput
				label={t`Video link`}
				value={text}
				maxLength={max.url}
				icon="link-simple-horizontal"
				placeholder="https://www.youtube.com/watch?v=…"
				errorMessage={parsed || !text.trim() ? undefined : t`That isn't a YouTube or Vimeo video link.`}
				onChange={changeVideo}
			/>
			<TextInput
				label={t`Video title (optional)`}
				icon="text-t"
				value={block.title ?? ""}
				maxLength={max.mediaTitle}
				onChange={(value) =>
					edit(
						(draft) => {
							draft.title = value;
						},
						{ key: `works.${work.id}.blocks.${block.id}.title` },
					)
				}
			/>
			{!task.running && !block.thumbnail && (
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted">
					<Trans>The page shows a plain play button until the thumbnail is copied.</Trans>
					<Button size="sm" variant="secondary" onPress={() => void copyNow()}>
						<Trans>Copy the thumbnail</Trans>
					</Button>
				</div>
			)}
			<TaskStatus task={task} />
		</div>
	);
}
