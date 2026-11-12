import type { EmbedFind } from "../media/embeds";
import type { PortfolioBlock, PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { Draft } from "immer";
import { Alert, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { generateId } from "@rezumi/utils/string";
import { usePortfolioEditorStore } from "../editor/store";
import { useFilePicker } from "../images/image-field";
import { discardUploadedImages, isAbort } from "../images/upload";
import { useRequestSignals } from "../images/use-request-signals";
import {
	embedFromUnfurl,
	embedFromUrl,
	embedProviderName,
	importEmbedThumbnail,
	isNoRoomError,
	stillEmbeds,
} from "../media/embeds";
import {
	linkBlockFromUnfurl,
	readLinkAddress,
	stillPlays,
	useLinkSuggestions,
	videoBlockFromUnfurl,
} from "../media/link-blocks";
import { newPdfBlock, pdfErrorMessage } from "../media/pdf";
import { importVideoThumbnail, unfurlErrorMessage, unfurlLink, videoBlockFromUrl } from "../media/remote";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
import { usePrompt } from "@/hooks/use-confirm";

/** The block as it is in the editor now (after edits made while a request ran). */
export function currentBlock(workId: string, blockId: string): PortfolioBlock | undefined {
	return usePortfolioEditorStore
		.getState()
		.portfolio?.data.works.items.find((work) => work.id === workId)
		?.blocks.find((block) => block.id === blockId);
}

/** PDFs only, by type or name, from a picker. */
const pdfFiles = (files: readonly File[]) =>
	files.filter((file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name)).slice(0, 1);

/** A hidden PDF picker opened by code. */
export function usePdfPicker(onFile: (file: File) => void) {
	return useFilePicker(([file]) => file && onFile(file), { accept: "application/pdf,.pdf", filter: pdfFiles });
}

/** Puts a block in at the chosen place; false when the work had no room left for it (the person was told). */
export type InsertBlock = (block: PortfolioBlock) => boolean;
type SetBlock = (workId: string, blockId: string, recipe: (block: Draft<PortfolioBlock>) => void) => void;

/**
 * Adding a Video, PDF or Link block: a video or link is asked for first (a block needs one), a PDF is chosen and
 * uploaded first. A video's thumbnail and a link's suggested picture follow once the block is in. `insert` is bound to
 * the place chosen, so a block that arrives late still lands there. Requests stop when the menu goes away.
 */
export function useAddMediaBlock(workId: string, setBlock: SetBlock) {
	const prompt = usePrompt();
	const requests = useRequestSignals();
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	/** Copies a new video's thumbnail in, if its block still plays that video by then. */
	const copyThumbnail = async (block: PortfolioBlockOf<"video">, signal: AbortSignal) => {
		const thumbnail = await importVideoThumbnail(block, signal);
		if (!thumbnail) return;
		if (!stillPlays(currentBlock(workId, block.id), block)) {
			void discardUploadedImages([thumbnail]);
			return;
		}
		setBlock(workId, block.id, (draft) => {
			if (draft.type === "video") draft.thumbnail = thumbnail;
		});
	};

	/** Copies a new Embed block's picture in, quietly unless storage is full, if the block still shows that content. */
	const copyEmbedPicture = async (find: EmbedFind, signal: AbortSignal) => {
		if (!find.thumbnailUrl) return;
		setBusy(t`Copying the picture…`);
		const { block } = find;
		const image = await importEmbedThumbnail(find.thumbnailUrl, block.title ?? "", signal, (failure) => {
			if (isNoRoomError(failure)) openPlanDialogForError(failure);
		});
		if (!image) return;
		if (!stillEmbeds(currentBlock(workId, block.id), block)) {
			void discardUploadedImages([image]);
			return;
		}
		setBlock(workId, block.id, (draft) => {
			if (draft.type === "embed") draft.thumbnail = image;
		});
	};

	const run = async (label: string, task: (signal: AbortSignal) => Promise<void>) => {
		const signal = requests.next();
		setError(null);
		setBusy(label);
		try {
			await task(signal);
		} catch (failure) {
			if (!isAbort(failure, signal)) throw failure;
		} finally {
			if (!signal.aborted) setBusy(null);
		}
	};

	const addVideo = async (insert: InsertBlock) => {
		const text = await prompt(t`Add a video`, {
			description: t`Paste a YouTube or Vimeo link. The player loads only when a visitor presses play.`,
			confirmText: t`Add video`,
		});
		if (!text?.trim()) return;
		await run(t`Reading the video…`, async (signal) => {
			const block = await videoBlockFromUrl(text.trim(), signal);
			if (!block) {
				setError(t`That isn't a YouTube or Vimeo video link. Copy the address from the video's page.`);
				return;
			}
			if (!insert(block)) return;
			setBusy(t`Copying the thumbnail…`);
			await copyThumbnail(block, signal);
		});
	};

	const addLink = async (insert: InsertBlock) => {
		const text = await prompt(t`Add a link`, {
			description: t`Paste a link to Behance, Dribbble, GitHub, Figma, Medium or any site. The card fills itself in.`,
			confirmText: t`Add link`,
		});
		if (text === null) return;
		const address = readLinkAddress(text);
		if (!address.ok) {
			if (address.problem === "email")
				setError(t`A Link block opens a web page, not an email address. Visitors find your email in Contact.`);
			else if (address.problem === "invalid") setError(t`Enter a full web address, such as https://example.com.`);
			return;
		}
		const { url } = address;
		await run(t`Reading the link…`, async (signal) => {
			try {
				const result = await unfurlLink(url, signal);
				if (result.kind === "embed") {
					const find = embedFromUnfurl(result);
					if (!insert(find.block)) return;
					const provider = embedProviderName(result.provider);
					toast.add({ description: t`That's a ${provider} link, so it was added as an Embed block.` });
					await copyEmbedPicture(find, signal);
					return;
				}
				if (result.kind === "video") {
					const block = videoBlockFromUnfurl(result);
					if (!insert(block)) return;
					toast.add({ description: t`That's a video, so it was added as a Video block.` });
					setBusy(t`Copying the thumbnail…`);
					await copyThumbnail(block, signal);
					return;
				}
				const block = linkBlockFromUnfurl(result, url);
				if (!insert(block)) return;
				if (result.imageUrl) useLinkSuggestions.getState().suggest(block.id, result.imageUrl);
			} catch (failure) {
				if (isAbort(failure, signal)) throw failure;
				// The card is made anyway; the person fills it in.
				insert({ id: generateId(), type: "link", url, title: "" });
				setError(unfurlErrorMessage(failure));
			}
		});
	};

	const addEmbed = async (insert: InsertBlock) => {
		const text = await prompt(t`Add an embed`, {
			description: t`Paste a link to Figma, Loom, Spotify, SoundCloud or Google Slides. Visitors load it only when they press it.`,
			confirmText: t`Add embed`,
		});
		if (!text?.trim()) return;
		const address = readLinkAddress(text);
		if (!address.ok) {
			setError(t`This link isn't from a service we can embed. Use a Link block instead.`);
			return;
		}
		const { url } = address;
		await run(t`Reading the link…`, async (signal) => {
			const find = await embedFromUrl(url, signal);
			if (!find) {
				setError(t`This link isn't from a service we can embed. Use a Link block instead.`);
				return;
			}
			if (!insert(find.block)) return;
			await copyEmbedPicture(find, signal);
		});
	};

	const addPdf = async (file: File, insert: InsertBlock) => {
		await run(t`Reading and uploading the PDF…`, async (signal) => {
			try {
				const block = await newPdfBlock(file, signal);
				// No room for it any more (the work filled up meanwhile): its files aren't kept.
				if (!insert(block))
					void discardUploadedImages(block.preview ? [block.preview, { key: block.file }] : [{ key: block.file }]);
			} catch (failure) {
				if (isAbort(failure, signal)) throw failure;
				setError(pdfErrorMessage(failure));
			}
		});
	};

	// Where the PDF goes, from when the picker opened until a file is chosen.
	const pdfInsert = useRef<InsertBlock | null>(null);
	const picker = usePdfPicker((file) => {
		const insert = pdfInsert.current;
		pdfInsert.current = null;
		if (insert) void addPdf(file, insert);
	});

	const add = (type: "video" | "embed" | "pdf" | "link", insert: InsertBlock) => {
		if (type === "video") void addVideo(insert);
		else if (type === "embed") void addEmbed(insert);
		else if (type === "link") void addLink(insert);
		else {
			pdfInsert.current = insert;
			picker.open();
		}
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

type ErrorNoteProps = { message: string };

export function ErrorNote({ message }: ErrorNoteProps) {
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
