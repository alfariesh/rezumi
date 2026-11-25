import type { EditBlock } from "./video-block";
import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { ParsedEmbed } from "@rezumi/schema/portfolio/embed";
import { Button, Chip, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { embedPageUrl, parseEmbedUrl } from "@rezumi/schema/portfolio/embed";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { TextInput } from "../editor/fields";
import { runPortfolioTask, usePortfolioTask } from "../editor/tasks";
import { ImageField } from "../images/image-field";
import { discardUploadedImages } from "../images/upload";
import {
	embedFromUrl,
	embedProviderName,
	embedSharingHint,
	importEmbedThumbnail,
	isNoRoomError,
	stillEmbeds,
} from "../media/embeds";
import { remotePictureErrorMessage } from "../media/remote";
import { useDraftText } from "../metrics/use-draft-text";
import { currentBlock, ErrorNote } from "./add-media-block";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";

const { text: max } = PORTFOLIO_LIMITS;

/** A pause in typing a link before its title and picture are read. */
const DETAILS_DELAY_MS = 600;

type EmbedBlockEditorProps = { work: PortfolioWork; block: PortfolioBlockOf<"embed">; edit: EditBlock<"embed"> };

/**
 * Something another service shows on the page (Phase 13 3.5): a Figma file, a Loom video, a Spotify or SoundCloud
 * track, Google Slides. The page shows only its picture and a button; the service loads after a visitor presses it.
 * A new link shows at once; its title and picture are read after a pause in typing, kept only while the block still
 * shows that content. Reading and copying run in the background (`runPortfolioTask`), so they still land when the
 * work is closed meanwhile.
 */
export function EmbedBlockEditor({ work, block, edit }: EmbedBlockEditorProps) {
	const [text, setText] = useDraftText(embedPageUrl(block));
	const taskKey = `works.${work.id}.blocks.${block.id}.details`;
	const task = usePortfolioTask(taskKey);
	const reading = task.running;
	const parsed = parseEmbedUrl(text);
	const provider = embedProviderName(block.provider);
	const hint = embedSharingHint(block.provider);
	const titleKey = `works.${work.id}.blocks.${block.id}.title`;

	/** The title and picture of the content `url` names, once typing paused; quiet unless storage is full. */
	const fetchDetails = (url: string, embed: ParsedEmbed) =>
		runPortfolioTask(
			taskKey,
			async ({ signal, fail }) => {
				const find = await embedFromUrl(url, signal);
				if (!find || !stillEmbeds(currentBlock(work.id, block.id), embed)) return;
				const title = find.block.title;
				if (title)
					edit(
						(draft) => {
							if (!draft.title?.trim()) draft.title = title;
						},
						{ key: titleKey },
					);
				if (!find.thumbnailUrl) return;
				// Quiet, like a video's thumbnail, unless the portfolio has no room left.
				const image = await importEmbedThumbnail(find.thumbnailUrl, title ?? "", signal, (failure) => {
					if (!isNoRoomError(failure)) return;
					openPlanDialogForError(failure);
					fail(remotePictureErrorMessage(failure));
				});
				if (!image) return;
				const now = currentBlock(work.id, block.id);
				// Another link meanwhile, or a picture of the person's own: this one isn't used.
				if (!stillEmbeds(now, embed) || (now?.type === "embed" && now.thumbnail)) {
					void discardUploadedImages([image]);
					return;
				}
				edit((draft) => {
					draft.thumbnail = image;
				});
			},
			{ delayMs: DETAILS_DELAY_MS },
		);

	const changeLink = (value: string) => {
		setText(value);
		const next = parseEmbedUrl(value);
		if (!next || (next.provider === block.provider && next.ref === block.ref)) return;
		// The block shows the new content at once; its old picture belonged to the old one.
		edit(
			(draft) => {
				draft.provider = next.provider;
				draft.ref = next.ref;
				delete draft.thumbnail;
			},
			{ key: `works.${work.id}.blocks.${block.id}.link` },
		);
		// The pause starts over with every new link, cancelling what was on its way for the one before.
		void fetchDetails(value, next);
	};

	return (
		<div className="grid gap-3">
			<div className="flex items-center gap-2">
				<Chip size="sm" variant="soft">
					<Icon name="plugs-connected" size={14} />
					{provider}
				</Chip>
				{reading && (
					<span className="flex items-center gap-1.5 text-xs text-muted" role="status">
						<Spinner size="sm" />
						<Trans>Reading the link…</Trans>
					</span>
				)}
			</div>
			<TextInput
				label={t`Link`}
				value={text}
				maxLength={max.url}
				icon="link-simple-horizontal"
				placeholder="https://www.figma.com/design/…"
				errorMessage={
					parsed || !text.trim() ? undefined : t`This link isn't from a service we can embed. Use a Link block instead.`
				}
				onChange={changeLink}
			/>
			{hint && <p className="-mt-1 px-1 text-body-xs text-warning">{hint}</p>}
			<TextInput
				label={t`Title`}
				icon="text-t"
				value={block.title ?? ""}
				maxLength={max.mediaTitle}
				placeholder={provider}
				onChange={(value) =>
					edit(
						(draft) => {
							if (value) draft.title = value;
							else delete draft.title;
						},
						{ key: titleKey },
					)
				}
			/>
			<ImageField
				label={t`Picture (optional)`}
				uploadKey={`works.${work.id}.blocks.${block.id}.thumbnail`}
				value={block.thumbnail}
				altSuggestion={block.title?.trim() || provider}
				onChange={(image, typing) =>
					edit(
						(draft) => {
							if (image) draft.thumbnail = image;
							else delete draft.thumbnail;
						},
						typing ? { key: `works.${work.id}.blocks.${block.id}.thumbnail.alt` } : { structural: true },
					)
				}
			/>
			{!block.thumbnail && !reading && (
				<p className="px-1 text-body-xs text-muted">
					<Trans>Without a picture, the page shows a plain button with the service's name.</Trans>
				</p>
			)}
			<p className="flex items-start gap-1.5 px-1 text-body-xs text-muted">
				<Icon name="shield-check" size={14} className="mt-0.5 shrink-0" />
				<Trans>Visitors load it from {provider} only when they press it.</Trans>
			</p>
			{task.errors.map((message, index) => (
				<ErrorNote key={`${index}:${message}`} message={message} />
			))}
			<a
				href={embedPageUrl(block)}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex w-fit items-center gap-1 text-xs underline"
			>
				<Trans>Open it on {provider}</Trans>
				<Icon name="arrow-square-out" size={12} />
				<span className="sr-only">
					<Trans>(opens in a new tab)</Trans>
				</span>
			</a>
		</div>
	);
}

type EmbedInsteadProps = {
	/** The content the link card's address leads to. */
	embed: ParsedEmbed;
	/** Puts an Embed block in the link card's place. */
	onEmbed: () => void;
	busy: boolean;
};

/** Under a link card whose address another service lets pages embed: "Embed it instead". */
export function EmbedInstead({ embed, onEmbed, busy }: EmbedInsteadProps) {
	const provider = embedProviderName(embed.provider);
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-secondary p-3 text-sm">
			<span className="min-w-0 flex-1">
				<Trans>This is a {provider} link: it can show on your page itself, after a visitor presses it.</Trans>
			</span>
			<Button size="sm" variant="secondary" isPending={busy} onPress={onEmbed}>
				<Icon name="plugs-connected" size={16} />
				<Trans>Embed it instead</Trans>
			</Button>
		</div>
	);
}
