import type { PortfolioBlock, PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { Alert, Button, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { parseVideoUrl, youtubeThumbnailUrl } from "@rezumi/schema/portfolio/video";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { generateId } from "@rezumi/utils/string";
import { normalizePortfolioUrl, TextInput, UrlInput } from "../editor/fields";
import { usePortfolioEditorStore } from "../editor/store";
import { ImageField, portfolioImageSrc } from "../images/image-field";
import { linkBlockFromUnfurl, useLinkSuggestions, videoBlockFromUnfurl } from "../media/link-blocks";
import { newPdfBlock, pdfErrorMessage, uploadPortfolioPdf } from "../media/pdf";
import {
	importRemotePicture,
	importVideoThumbnail,
	remotePictureErrorMessage,
	unfurlErrorMessage,
	unfurlLink,
	videoBlockFromUrl,
} from "../media/remote";
import { usePrompt } from "@/hooks/use-confirm";

const { text: max } = PORTFOLIO_LIMITS;

type EditBlock<T extends PortfolioBlock["type"]> = (
	recipe: (block: Draft<PortfolioBlockOf<T>>) => void,
	options?: { key?: string; structural?: boolean },
) => void;

type FindBlock = (workId: string, blockId: string) => PortfolioBlock | undefined;

/** The block as it is in the editor now (after edits made while a request ran). */
const currentBlock: FindBlock = (workId, blockId) =>
	usePortfolioEditorStore
		.getState()
		.portfolio?.data.works.items.find((work) => work.id === workId)
		?.blocks.find((block) => block.id === blockId);

/** A hidden PDF picker opened by code. */
function usePdfPicker(onFile: (file: File) => void) {
	const input = useRef<HTMLInputElement>(null);
	const element = (
		<input
			ref={input}
			type="file"
			accept="application/pdf,.pdf"
			hidden
			onChange={(event) => {
				const file = event.currentTarget.files?.[0];
				event.currentTarget.value = "";
				if (file) onFile(file);
			}}
		/>
	);
	return { open: () => input.current?.click(), element };
}

type InsertBlock = (block: PortfolioBlock) => void;
type SetBlock = (workId: string, blockId: string, recipe: (block: Draft<PortfolioBlock>) => void) => void;

/**
 * Adding a Video, PDF or Link block: a video or link is asked for first (a block needs one), a PDF is chosen and
 * uploaded first. A video's thumbnail and a link's suggested picture follow once the block is in.
 */
export function useAddMediaBlock(work: PortfolioWork, insert: InsertBlock, setBlock: SetBlock) {
	const prompt = usePrompt();
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const copyThumbnail = async (block: PortfolioBlockOf<"video">) => {
		const thumbnail = await importVideoThumbnail(block);
		if (thumbnail)
			setBlock(work.id, block.id, (draft) => {
				if (draft.type === "video") draft.thumbnail = thumbnail;
			});
	};

	const addVideo = async () => {
		const text = await prompt(t`Add a video`, {
			description: t`Paste a YouTube or Vimeo link. The player loads only when a visitor presses play.`,
			confirmText: t`Add video`,
		});
		if (!text?.trim()) return;
		setError(null);
		setBusy(t`Reading the video…`);
		try {
			const block = await videoBlockFromUrl(text.trim());
			if (!block) {
				setError(t`That isn't a YouTube or Vimeo video link. Copy the address from the video's page.`);
				return;
			}
			insert(block);
			setBusy(t`Copying the thumbnail…`);
			await copyThumbnail(block);
		} finally {
			setBusy(null);
		}
	};

	const addLink = async () => {
		const text = await prompt(t`Add a link`, {
			description: t`Paste a link to Behance, Dribbble, GitHub, Figma, Medium or any site. The card fills itself in.`,
			confirmText: t`Add link`,
		});
		const url = text ? normalizePortfolioUrl(text.trim()) : "";
		if (!url) return;
		setError(null);
		setBusy(t`Reading the link…`);
		try {
			const result = await unfurlLink(url);
			if (result.kind === "video") {
				const block = videoBlockFromUnfurl(result);
				insert(block);
				toast.add({ description: t`That's a video, so it was added as a Video block.` });
				setBusy(t`Copying the thumbnail…`);
				await copyThumbnail(block);
				return;
			}
			const block = linkBlockFromUnfurl(result);
			insert(block);
			if (result.imageUrl) useLinkSuggestions.getState().suggest(block.id, result.imageUrl);
		} catch (failure) {
			if (!/^https?:\/\//i.test(url)) return;
			insert({ id: generateId(), type: "link", url, title: "" });
			setError(unfurlErrorMessage(failure));
		} finally {
			setBusy(null);
		}
	};

	const picker = usePdfPicker(async (file) => {
		setError(null);
		setBusy(t`Reading and uploading the PDF…`);
		try {
			insert(await newPdfBlock(file));
		} catch (failure) {
			setError(pdfErrorMessage(failure));
		} finally {
			setBusy(null);
		}
	});

	const add = (type: "video" | "pdf" | "link") => {
		if (type === "video") void addVideo();
		else if (type === "link") void addLink();
		else picker.open();
	};

	const status = (
		<>
			{picker.element}
			{busy && (
				<p className="flex items-center gap-2 text-xs text-muted" role="status">
					<Spinner size="sm" />
					{busy}
				</p>
			)}
			{error && <ErrorNote message={error} />}
		</>
	);

	return { add, busy: busy !== null, status };
}

function ErrorNote({ message }: { message: string }) {
	return (
		<Alert status="danger">
			<Alert.Indicator>
				<Icon name="warning-circle" />
			</Alert.Indicator>
			<Alert.Content>
				<Alert.Description>{message}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}

type VideoBlockEditorProps = { work: PortfolioWork; block: PortfolioBlockOf<"video">; edit: EditBlock<"video"> };

/** A video: its thumbnail (copied into the portfolio), the link it plays, and an optional title. */
export function VideoBlockEditor({ work, block, edit }: VideoBlockEditorProps) {
	const revision = usePortfolioEditorStore((state) => state.revision);
	const address =
		block.provider === "youtube"
			? `https://www.youtube.com/watch?v=${block.videoId}`
			: `https://vimeo.com/${block.videoId}${block.hash ? `/${block.hash}` : ""}`;
	const [text, setText] = useState(address);
	const [seen, setSeen] = useState({ revision, address });
	if (seen.revision !== revision || seen.address !== address) {
		setSeen({ revision, address });
		setText(address);
	}
	const [copying, setCopying] = useState(false);
	const parsed = parseVideoUrl(text);
	const thumbnail = block.thumbnail
		? portfolioImageSrc(block.thumbnail)
		: (block.thumbnailUrl ?? (block.provider === "youtube" ? youtubeThumbnailUrl(block.videoId) : null));

	const copyThumbnail = async (next: PortfolioBlockOf<"video">) => {
		setCopying(true);
		try {
			const image = await importVideoThumbnail(next);
			const now = currentBlock(work.id, block.id);
			if (image && now?.type === "video" && now.videoId === next.videoId)
				edit((draft) => {
					draft.thumbnail = image;
				});
		} finally {
			setCopying(false);
		}
	};

	const changeVideo = async (value: string) => {
		setText(value);
		const next = parseVideoUrl(value);
		if (!next || (next.provider === block.provider && next.videoId === block.videoId)) return;
		const fresh = await videoBlockFromUrl(value);
		if (!fresh) return;
		edit(
			(draft) => {
				draft.provider = fresh.provider;
				draft.videoId = fresh.videoId;
				if (fresh.hash) draft.hash = fresh.hash;
				else delete draft.hash;
				if (fresh.thumbnailUrl) draft.thumbnailUrl = fresh.thumbnailUrl;
				else delete draft.thumbnailUrl;
				delete draft.thumbnail;
				if (!draft.title?.trim() && fresh.title) draft.title = fresh.title;
			},
			{ structural: true },
		);
		await copyThumbnail({ ...fresh, id: block.id });
	};

	return (
		<div className="grid gap-3">
			<div className="relative aspect-video overflow-hidden rounded-xl bg-black">
				{thumbnail && <img src={thumbnail} alt="" className="size-full object-cover opacity-80" />}
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
				placeholder="https://www.youtube.com/watch?v=…"
				description={
					parsed || !text.trim()
						? t`YouTube or Vimeo. Visitors see this thumbnail; the player loads only when they press play.`
						: t`That isn't a YouTube or Vimeo video link.`
				}
				onChange={(value) => void changeVideo(value)}
			/>
			<TextInput
				label={t`Video title (optional)`}
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
			{copying ? (
				<p className="flex items-center gap-2 text-xs text-muted" role="status">
					<Spinner size="sm" />
					<Trans>Copying the thumbnail into your portfolio…</Trans>
				</p>
			) : (
				!block.thumbnail && (
					<div className="flex flex-wrap items-center gap-2 text-xs text-muted">
						<Trans>The page shows a plain play button until the thumbnail is copied.</Trans>
						<Button size="sm" variant="secondary" onPress={() => void copyThumbnail(block)}>
							<Trans>Copy the thumbnail</Trans>
						</Button>
					</div>
				)
			)}
		</div>
	);
}

/** A file size as people read it in the app's language. */
function fileSize(bytes: number): string {
	const megabytes = bytes / 1_000_000;
	return new Intl.NumberFormat(undefined, {
		style: "unit",
		unit: megabytes >= 1 ? "megabyte" : "kilobyte",
		maximumFractionDigits: 1,
	}).format(megabytes >= 1 ? megabytes : Math.max(1, Math.round(bytes / 1000)));
}

type PdfBlockEditorProps = { work: PortfolioWork; block: PortfolioBlockOf<"pdf">; edit: EditBlock<"pdf"> };

/** A PDF: its first page, title, pages and size, and a way to replace the file. */
export function PdfBlockEditor({ work, block, edit }: PdfBlockEditorProps) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const picker = usePdfPicker(async (file) => {
		setBusy(true);
		setError(null);
		try {
			const uploaded = await uploadPortfolioPdf(file, block.title);
			edit(
				(draft) => {
					draft.file = uploaded.file;
					draft.pages = uploaded.pages;
					if (uploaded.bytes) draft.bytes = uploaded.bytes;
					if (uploaded.preview) draft.preview = uploaded.preview;
				},
				{ structural: true },
			);
		} catch (failure) {
			setError(pdfErrorMessage(failure));
		} finally {
			setBusy(false);
		}
	});
	const count = block.pages;
	const details = [count === 1 ? t`1 page` : t`${count} pages`, block.bytes ? fileSize(block.bytes) : ""].filter(
		Boolean,
	);

	return (
		<div className="grid gap-3">
			<div className="flex items-start gap-3">
				<div className="grid aspect-[800/1131] w-20 shrink-0 place-items-center overflow-hidden rounded bg-white shadow-sm">
					{block.preview ? (
						<img src={portfolioImageSrc(block.preview)} alt="" className="size-full object-cover object-top" />
					) : (
						<Icon name="file-pdf" size={28} className="text-muted" />
					)}
				</div>
				<div className="grid gap-1 text-sm">
					<span className="text-muted">PDF · {details.join(" · ")}</span>
					<a className="text-xs underline" href={`/${block.file}`} target="_blank" rel="noopener">
						<Trans>Open the PDF</Trans>
					</a>
				</div>
			</div>
			<TextInput
				label={t`PDF title`}
				value={block.title}
				maxLength={max.mediaTitle}
				placeholder={t`Case study (public version)`}
				onChange={(value) =>
					edit(
						(draft) => {
							draft.title = value;
						},
						{ key: `works.${work.id}.blocks.${block.id}.title` },
					)
				}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<Button size="sm" variant="secondary" isDisabled={busy} onPress={picker.open}>
					<Icon name="arrows-clockwise" size={16} />
					<Trans>Replace the PDF</Trans>
				</Button>
				<span className="text-xs text-muted">
					<Trans>Up to 10 MB, without a password. Visitors open it in a new tab.</Trans>
				</span>
			</div>
			{picker.element}
			{busy && (
				<p className="flex items-center gap-2 text-xs text-muted" role="status">
					<Spinner size="sm" />
					<Trans>Reading and uploading the PDF…</Trans>
				</p>
			)}
			{error && <ErrorNote message={error} />}
		</div>
	);
}

type LinkBlockEditorProps = { work: PortfolioWork; block: PortfolioBlockOf<"link">; edit: EditBlock<"link"> };

/**
 * A link card: the address, what the page said about itself (all editable), and a picture: one the person uploads,
 * or the page's own once they agree to copy it.
 */
export function LinkBlockEditor({ work, block, edit }: LinkBlockEditorProps) {
	const suggestion = useLinkSuggestions((state) => state.pictures[block.id]);
	const [reading, setReading] = useState(false);
	const [copying, setCopying] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const key = (field: string) => ({ key: `works.${work.id}.blocks.${block.id}.${field}` });

	const readAgain = async () => {
		setReading(true);
		setError(null);
		try {
			const result = await unfurlLink(block.url);
			if (result.kind === "video") {
				setError(t`This is a video. Add it as a Video block to play it on the page.`);
				return;
			}
			const fresh = linkBlockFromUnfurl(result);
			edit(
				(draft) => {
					draft.url = fresh.url;
					draft.title = fresh.title;
					if (fresh.description) draft.description = fresh.description;
					if (fresh.siteName) draft.siteName = fresh.siteName;
					if (fresh.brandIcon) draft.brandIcon = fresh.brandIcon;
					else delete draft.brandIcon;
				},
				{ structural: true },
			);
			if (result.imageUrl) useLinkSuggestions.getState().suggest(block.id, result.imageUrl);
		} catch (failure) {
			setError(unfurlErrorMessage(failure));
		} finally {
			setReading(false);
		}
	};

	const copyPicture = async (url: string) => {
		setCopying(true);
		setError(null);
		try {
			const image = await importRemotePicture(url, block.title);
			edit(
				(draft) => {
					draft.image = image;
				},
				{ structural: true },
			);
			useLinkSuggestions.getState().dismiss(block.id);
		} catch (failure) {
			setError(remotePictureErrorMessage(failure));
		} finally {
			setCopying(false);
		}
	};

	return (
		<div className="grid gap-3">
			<UrlInput
				label={t`Link`}
				webOnly
				value={block.url}
				onChange={(url) => {
					if (url)
						edit((draft) => {
							draft.url = url;
							delete draft.brandIcon;
						}, key("url"));
				}}
			/>
			<Button size="sm" variant="secondary" className="w-fit" isDisabled={reading} onPress={() => void readAgain()}>
				{reading ? <Spinner size="sm" /> : <Icon name="arrows-clockwise" size={16} />}
				<Trans>Fill in from the link</Trans>
			</Button>
			<TextInput
				label={t`Title`}
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
				<div className="grid gap-2 rounded-xl border border-border p-3">
					<span className="text-sm font-medium">
						<Trans>Use the page's picture?</Trans>
					</span>
					<img src={suggestion} alt="" className="max-h-40 w-auto max-w-full justify-self-start rounded-lg" />
					<span className="text-xs text-muted">
						<Trans>
							It's copied into your portfolio, so your page never loads pictures from other sites. Use it only if you
							may show it.
						</Trans>
					</span>
					<div className="flex flex-wrap gap-2">
						<Button size="sm" isDisabled={copying} onPress={() => void copyPicture(suggestion)}>
							{copying && <Spinner size="sm" />}
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
				value={block.image}
				altSuggestion={block.title}
				onChange={(image) =>
					edit(
						(draft) => {
							if (image) draft.image = image;
							else delete draft.image;
						},
						{ structural: true },
					)
				}
			/>
			{error && <ErrorNote message={error} />}
		</div>
	);
}
