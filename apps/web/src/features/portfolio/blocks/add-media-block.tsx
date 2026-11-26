import type { PortfolioTask, TaskControls } from "../editor/tasks";
import type { EmbedFind } from "../media/embeds";
import type { PortfolioBlock, PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { Draft } from "immer";
import { Alert, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useRef } from "react";
import { linkBlockFromUnfurl, readLinkAddress, stillPlays, videoBlockFromUnfurl } from "@rezumi/portfolio/editing";
import { parseEmbedUrl } from "@rezumi/schema/portfolio/embed";
import { parseVideoUrl } from "@rezumi/schema/portfolio/video";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { generateId } from "@rezumi/utils/string";
import { usePortfolioEditorStore } from "../editor/store";
import { runPortfolioTask, showPortfolioTaskError, usePortfolioTask } from "../editor/tasks";
import { useFilePicker } from "../images/image-field";
import { discardUploadedImages, isAbort } from "../images/upload";
import {
	embedFromUnfurl,
	embedFromUrl,
	embedProviderName,
	importEmbedThumbnail,
	isNoRoomError,
	stillEmbeds,
} from "../media/embeds";
import { useLinkSuggestions } from "../media/link-blocks";
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
export const pdfFiles = (files: readonly File[]) =>
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
 * the place chosen, so a block that arrives late still lands there. The work runs as the background task `key`
 * (`runPortfolioTask`): it carries on when the menu goes away, and the menu shows it again when it's back.
 */
export function useAddMediaBlock(key: string, workId: string, setBlock: SetBlock) {
	const prompt = usePrompt();
	const task = usePortfolioTask(key);

	/** Copies a new video's thumbnail in, if its block still plays that video by then. */
	const copyThumbnail = async (block: PortfolioBlockOf<"video">, { signal }: TaskControls) => {
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
	const copyEmbedPicture = async (find: EmbedFind, controls: TaskControls) => {
		if (!find.thumbnailUrl) return;
		controls.say(t`Copying the picture…`);
		const { block } = find;
		const image = await importEmbedThumbnail(find.thumbnailUrl, block.title ?? "", controls.signal, (failure) => {
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

	const run = async (label: string, work: (controls: TaskControls) => Promise<void>) => {
		await runPortfolioTask(key, async (controls) => {
			controls.say(label);
			await work(controls);
		});
	};

	const addVideo = async (insert: InsertBlock) => {
		const text = await prompt(t`Add a video`, {
			description: t`Paste a YouTube or Vimeo link. The player loads only when a visitor presses play.`,
			confirmText: t`Add video`,
		});
		if (!text?.trim()) return;
		await addVideoUrl(text.trim(), insert);
	};

	const addVideoUrl = async (url: string, insert: InsertBlock) => {
		await run(t`Reading the video…`, async (controls) => {
			const block = await videoBlockFromUrl(url, controls.signal);
			if (!block) {
				controls.fail(t`That isn't a YouTube or Vimeo video link. Copy the address from the video's page.`);
				return;
			}
			if (!insert(block)) return;
			controls.say(t`Copying the thumbnail…`);
			await copyThumbnail(block, controls);
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
				showPortfolioTaskError(
					key,
					t`A Link block opens a web page, not an email address. Visitors find your email in Contact.`,
				);
			else if (address.problem === "invalid")
				showPortfolioTaskError(key, t`Enter a full web address, such as https://example.com.`);
			return;
		}
		const { url } = address;
		await run(t`Reading the link…`, async (controls) => {
			try {
				const result = await unfurlLink(url, controls.signal);
				if (result.kind === "embed") {
					const find = embedFromUnfurl(result);
					if (!insert(find.block)) return;
					const provider = embedProviderName(result.provider);
					toast.add({ description: t`That's a ${provider} link, so it was added as an Embed block.` });
					await copyEmbedPicture(find, controls);
					return;
				}
				if (result.kind === "video") {
					const block = videoBlockFromUnfurl(result);
					if (!insert(block)) return;
					toast.add({ description: t`That's a video, so it was added as a Video block.` });
					controls.say(t`Copying the thumbnail…`);
					await copyThumbnail(block, controls);
					return;
				}
				const block = linkBlockFromUnfurl(result, url);
				if (!insert(block)) return;
				if (result.imageUrl) useLinkSuggestions.getState().suggest(block.id, result.imageUrl);
			} catch (failure) {
				if (isAbort(failure, controls.signal)) throw failure;
				// The card is made anyway; the person fills it in.
				insert({ id: generateId(), type: "link", url, title: "" });
				controls.fail(unfurlErrorMessage(failure));
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
			showPortfolioTaskError(key, t`This link isn't from a service we can embed. Use a Link block instead.`);
			return;
		}
		await addEmbedUrl(address.url, insert);
	};

	const addEmbedUrl = async (url: string, insert: InsertBlock) => {
		await run(t`Reading the link…`, async (controls) => {
			const find = await embedFromUrl(url, controls.signal);
			if (!find) {
				controls.fail(t`This link isn't from a service we can embed. Use a Link block instead.`);
				return;
			}
			if (!insert(find.block)) return;
			await copyEmbedPicture(find, controls);
		});
	};

	const addPdf = async (file: File, insert: InsertBlock) => {
		await run(t`Reading and uploading the PDF…`, async (controls) => {
			try {
				const block = await newPdfBlock(file, controls.signal);
				// No room for it any more (the work filled up meanwhile): its files aren't kept.
				if (!insert(block))
					void discardUploadedImages(block.preview ? [block.preview, { key: block.file }] : [{ key: block.file }]);
			} catch (failure) {
				if (isAbort(failure, controls.signal)) throw failure;
				controls.fail(pdfErrorMessage(failure));
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

	/**
	 * A YouTube or Vimeo address becomes a Video block, a Figma, Loom, Spotify, SoundCloud or Google Slides one an
	 * Embed block (a pasted address, say). False for any other address, which stays where it was pasted.
	 */
	const addFromUrl = (url: string, insert: InsertBlock): boolean => {
		if (parseVideoUrl(url)) {
			void addVideoUrl(url, insert);
			return true;
		}
		if (parseEmbedUrl(url)) {
			void addEmbedUrl(url, insert);
			return true;
		}
		return false;
	};

	const status = (
		<>
			{picker.element}
			<TaskStatus task={task} />
		</>
	);

	return {
		add,
		addFromUrl,
		/** A PDF dropped or pasted: uploaded and put in like one chosen from the menu. */
		addPdfFile: (file: File, insert: InsertBlock) => void addPdf(file, insert),
		busy: task.running,
		status,
	};
}

type TaskStatusProps = { task: PortfolioTask };

/** What a block's background task is doing (a spinner and its words), then what went wrong with it. */
export function TaskStatus({ task }: TaskStatusProps) {
	return (
		<>
			{task.running && task.label && (
				<p className="flex items-center gap-2 text-xs text-muted" role="status">
					<Spinner size="sm" />
					{task.label}
				</p>
			)}
			{task.errors.map((message, index) => (
				// Two steps can fail the same way: the place keeps each message apart.
				<ErrorNote key={`${index}:${message}`} message={message} />
			))}
		</>
	);
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
