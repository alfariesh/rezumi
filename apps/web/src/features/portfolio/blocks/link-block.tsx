import type { EditBlock } from "./video-block";
import type { PortfolioBlock, PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { ParsedEmbed } from "@rezumi/schema/portfolio/embed";
import { Button, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { linkBlockFromUnfurl, siteOf } from "@rezumi/portfolio/editing";
import { parseEmbedUrl } from "@rezumi/schema/portfolio/embed";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { TextInput, UrlInput } from "../editor/fields";
import { cancelPortfolioTask, clearPortfolioTaskErrors, runPortfolioTask, usePortfolioTask } from "../editor/tasks";
import { ImageField } from "../images/image-field";
import { discardUploadedImages, isAbort } from "../images/upload";
import { embedBlockFrom, embedFromUrl, importEmbedThumbnail } from "../media/embeds";
import { useLinkSuggestions } from "../media/link-blocks";
import { importRemotePicture, remotePictureErrorMessage, unfurlErrorMessage, unfurlLink } from "../media/remote";
import { currentBlock, ErrorNote } from "./add-media-block";
import { EmbedInstead } from "./embed-block";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";

const { text: max } = PORTFOLIO_LIMITS;

type LinkBlockEditorProps = {
	work: PortfolioWork;
	block: PortfolioBlockOf<"link">;
	edit: EditBlock<"link">;
	/** Puts another block in this one's place ("Embed it instead"). */
	onReplace?: (block: PortfolioBlock) => void;
};

/**
 * A link card: the address, what the page said about itself (all editable), and a picture: one the person uploads,
 * or the page's own once they agree to copy it. A new address drops the page's suggested picture, and the site name
 * and description when it's another site. Reading the page and copying pictures run in the background
 * (`runPortfolioTask`), so they still land when the work is closed meanwhile.
 */
export function LinkBlockEditor({ work, block, edit, onReplace }: LinkBlockEditorProps) {
	const suggestion = useLinkSuggestions((state) => state.pictures[block.id]);
	const key = (field: string) => ({ key: `works.${work.id}.blocks.${block.id}.${field}` });
	const tasks = {
		read: `works.${work.id}.blocks.${block.id}.read`,
		picture: `works.${work.id}.blocks.${block.id}.picture`,
		embed: `works.${work.id}.blocks.${block.id}.embed`,
	};
	const read = usePortfolioTask(tasks.read);
	const picture = usePortfolioTask(tasks.picture);
	const embed = usePortfolioTask(tasks.embed);
	const errors = [...read.errors, ...picture.errors, ...embed.errors];
	/** The card shows one problem at a time: a new try puts away what the earlier ones said. */
	const clearErrors = () => {
		for (const task of Object.values(tasks)) clearPortfolioTaskErrors(task);
	};
	// The site the card's text came from. While the address is typed it passes through other sites ("https://d" on the
	// way to dribbble.com), so the site name and description are only dropped once typing ends on another site.
	const cardSite = useRef(siteOf(block.url));
	// Content another service lets pages embed, by the address or by what reading it found (a short link).
	const [readEmbed, setReadEmbed] = useState<ParsedEmbed | null>(null);
	const embedOffer = parseEmbedUrl(block.url) ?? readEmbed;

	/** "Embed it instead": an Embed block in this card's place, with the card's title and picture, else the service's. */
	const embedInstead = (offer: ParsedEmbed, replace: (block: PortfolioBlock) => void) =>
		runPortfolioTask(tasks.embed, async ({ signal, fail }) => {
			try {
				let thumbnail = block.image;
				let title = block.title.trim();
				if (!thumbnail) {
					const find = await embedFromUrl(block.url, signal);
					if (!title && find?.block.title) title = find.block.title;
					if (find?.thumbnailUrl) thumbnail = await importEmbedThumbnail(find.thumbnailUrl, title, signal);
				}
				// Removed meanwhile: nothing to replace, and the copied picture isn't kept.
				if (currentBlock(work.id, block.id)?.type !== "link") {
					if (thumbnail && thumbnail !== block.image) void discardUploadedImages([thumbnail]);
					return;
				}
				replace({ ...embedBlockFrom(offer, title), id: block.id, ...(thumbnail ? { thumbnail } : {}) });
				useLinkSuggestions.getState().dismiss(block.id);
			} catch (failure) {
				if (isAbort(failure, signal)) throw failure;
				fail(unfurlErrorMessage(failure));
			}
		});

	const readAgain = () => {
		// Editing the address cancels the read (`changeUrl`); this also covers an Undo that brings back another one.
		const url = block.url;
		clearErrors();
		return runPortfolioTask(tasks.read, async ({ signal, fail }) => {
			try {
				const result = await unfurlLink(url, signal);
				if (result.kind === "video") {
					fail(t`This is a video. Add it as a Video block to play it on the page.`);
					return;
				}
				if (result.kind === "embed") {
					// The offer below shows; the card keeps what it has meanwhile.
					setReadEmbed({ provider: result.provider, ref: result.ref });
					return;
				}
				const fresh = linkBlockFromUnfurl(result, url);
				const now = currentBlock(work.id, block.id);
				if (now?.type !== "link" || now.url !== url) return;
				edit(
					(draft) => {
						draft.url = fresh.url;
						// A page without a title keeps the one typed here.
						if (fresh.title) draft.title = fresh.title;
						if (fresh.description) draft.description = fresh.description;
						if (fresh.siteName) draft.siteName = fresh.siteName;
						if (fresh.brandIcon) draft.brandIcon = fresh.brandIcon;
						else delete draft.brandIcon;
					},
					{ structural: true },
				);
				cardSite.current = siteOf(fresh.url);
				if (result.imageUrl) useLinkSuggestions.getState().suggest(block.id, result.imageUrl);
				else useLinkSuggestions.getState().dismiss(block.id);
			} catch (failure) {
				if (isAbort(failure, signal)) throw failure;
				fail(unfurlErrorMessage(failure));
			}
		});
	};

	const copyPicture = (url: string) => {
		clearErrors();
		return runPortfolioTask(tasks.picture, async ({ signal, fail }) => {
			try {
				const image = await importRemotePicture(url, block.title, signal);
				if (currentBlock(work.id, block.id)?.type !== "link") {
					void discardUploadedImages([image]);
					return;
				}
				edit(
					(draft) => {
						draft.image = image;
					},
					{ structural: true },
				);
				useLinkSuggestions.getState().dismiss(block.id);
			} catch (failure) {
				if (isAbort(failure, signal)) throw failure;
				openPlanDialogForError(failure);
				fail(remotePictureErrorMessage(failure));
			}
		});
	};

	const changeUrl = (url: string | undefined) => {
		if (!url) return;
		// The suggested picture belongs to the page the card pointed at.
		useLinkSuggestions.getState().dismiss(block.id);
		cancelPortfolioTask(tasks.picture);
		cancelPortfolioTask(tasks.read);
		setReadEmbed(null);
		edit((draft) => {
			draft.url = url;
			delete draft.brandIcon;
		}, key("url"));
	};

	/** Typing is over: what the page said goes when the address now leads to another site. */
	const leaveUrl = () => {
		const site = siteOf(block.url);
		if (site === cardSite.current) return;
		cardSite.current = site;
		if (block.siteName === undefined && block.description === undefined) return;
		edit((draft) => {
			delete draft.siteName;
			delete draft.description;
		}, key("url"));
	};

	return (
		<div className="grid gap-3">
			<UrlInput label={t`Link`} webOnly value={block.url} onChange={changeUrl} onBlur={leaveUrl} />
			<Button
				size="sm"
				variant="secondary"
				className="w-fit"
				isDisabled={read.running}
				onPress={() => void readAgain()}
			>
				{read.running ? <Spinner size="sm" /> : <Icon name="arrows-clockwise" size={16} />}
				<Trans>Fill in from the link</Trans>
			</Button>
			<TextInput
				label={t`Title`}
				icon="text-t"
				value={block.title}
				maxLength={max.linkTitle}
				placeholder={block.url}
				onChange={(value) =>
					edit((draft) => {
						draft.title = value;
					}, key("title"))
				}
			/>
			<TextInput
				label={t`Description (optional)`}
				multiline
				value={block.description ?? ""}
				maxLength={max.linkDescription}
				onChange={(value) =>
					edit((draft) => {
						draft.description = value;
					}, key("description"))
				}
			/>
			<TextInput
				label={t`Site name (optional)`}
				icon="globe"
				value={block.siteName ?? ""}
				maxLength={max.siteName}
				placeholder="Behance"
				onChange={(value) =>
					edit((draft) => {
						draft.siteName = value;
					}, key("siteName"))
				}
			/>
			{suggestion && !block.image && (
				<div className="grid gap-2 rounded-xl border border-separator p-3">
					<span className="text-sm font-medium">
						<Trans>Use the page's picture?</Trans>
					</span>
					{/* Loaded from the other site for this preview only, without telling it where it's shown. */}
					<img
						src={suggestion}
						alt=""
						referrerPolicy="no-referrer"
						className="max-h-40 w-auto max-w-full justify-self-start rounded-lg"
					/>
					<span className="text-body-xs text-muted">
						<Trans>
							It's copied into your portfolio, so your page never loads pictures from other sites. Use it only if you
							may show it.
						</Trans>
					</span>
					<div className="flex flex-wrap gap-2">
						<Button size="sm" isDisabled={picture.running} onPress={() => void copyPicture(suggestion)}>
							{picture.running && <Spinner size="sm" />}
							<Trans>Use this picture</Trans>
						</Button>
						<Button size="sm" variant="ghost" onPress={() => useLinkSuggestions.getState().dismiss(block.id)}>
							<Trans>No picture</Trans>
						</Button>
					</div>
				</div>
			)}
			<ImageField
				label={t`Picture (optional)`}
				uploadKey={`works.${work.id}.blocks.${block.id}.image`}
				value={block.image}
				altSuggestion={block.title}
				onChange={(image, typing) =>
					edit(
						(draft) => {
							if (image) draft.image = image;
							else delete draft.image;
						},
						typing ? key("image.alt") : { structural: true },
					)
				}
			/>
			{embedOffer && onReplace && (
				<EmbedInstead
					embed={embedOffer}
					busy={embed.running}
					onEmbed={() => void embedInstead(embedOffer, onReplace)}
				/>
			)}
			{errors.map((message, index) => (
				<ErrorNote key={`${index}:${message}`} message={message} />
			))}
		</div>
	);
}
