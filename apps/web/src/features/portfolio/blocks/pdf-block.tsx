import type { EditBlock } from "./video-block";
import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import { Button } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { TextInput } from "../editor/fields";
import { runPortfolioTask, usePortfolioTask } from "../editor/tasks";
import { portfolioImageSrc } from "../images/image-field";
import { discardUnplacedImages, discardUploadedImages, isAbort } from "../images/upload";
import { formatFileSize, pdfErrorMessage, uploadPortfolioPdf } from "../media/pdf";
import { currentBlock, TaskStatus, usePdfPicker } from "./add-media-block";

const { text: max } = PORTFOLIO_LIMITS;

type PdfBlockEditorProps = { work: PortfolioWork; block: PortfolioBlockOf<"pdf">; edit: EditBlock<"pdf"> };

/**
 * A PDF: its first page, title, pages and size, and a way to replace the file. A replacement uploads in the background
 * (`runPortfolioTask`): it carries on when the work is closed, and lands if the block is still there.
 */
export function PdfBlockEditor({ work, block, edit }: PdfBlockEditorProps) {
	const taskKey = `works.${work.id}.blocks.${block.id}.pdf`;
	const task = usePortfolioTask(taskKey);

	const replace = (file: File) =>
		runPortfolioTask(taskKey, async ({ signal, say, fail }) => {
			say(t`Reading and uploading the PDF…`);
			try {
				const uploaded = await uploadPortfolioPdf(file, block.title, signal);
				if (currentBlock(work.id, block.id)?.type !== "pdf") {
					// The block went away meanwhile: nothing uses the new file.
					void discardUploadedImages(
						uploaded.preview ? [uploaded.preview, { key: uploaded.file }] : [{ key: uploaded.file }],
					);
					return;
				}
				edit(
					(draft) => {
						draft.file = uploaded.file;
						draft.pages = uploaded.pages;
						if (uploaded.bytes) draft.bytes = uploaded.bytes;
						if (uploaded.preview) draft.preview = uploaded.preview;
						else delete draft.preview;
					},
					{ structural: true },
				);
				if (uploaded.preview) discardUnplacedImages([uploaded.preview]);
			} catch (failure) {
				if (isAbort(failure, signal)) throw failure;
				fail(pdfErrorMessage(failure));
			}
		});

	const picker = usePdfPicker((file) => void replace(file));
	const details = [
		plural(block.pages, { one: "# page", other: "# pages" }),
		block.bytes ? formatFileSize(block.bytes) : "",
	].filter(Boolean);

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
					<a
						className="inline-flex w-fit items-center gap-1 text-xs underline"
						href={`/${block.file}`}
						target="_blank"
						rel="noopener"
					>
						<Trans>Open the PDF</Trans>
						<Icon name="arrow-square-out" size={12} />
						<span className="sr-only">
							<Trans>(opens in a new tab)</Trans>
						</span>
					</a>
				</div>
			</div>
			<TextInput
				label={t`PDF title`}
				icon="text-t"
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
				<Button size="sm" variant="secondary" isDisabled={task.running} onPress={picker.open}>
					<Icon name="arrows-clockwise" size={16} />
					<Trans>Replace the PDF</Trans>
				</Button>
				<span className="text-body-xs text-muted">
					<Trans>Details saved inside the file, such as the author's name, are published with it.</Trans>
				</span>
			</div>
			{picker.element}
			<TaskStatus task={task} />
		</div>
	);
}
