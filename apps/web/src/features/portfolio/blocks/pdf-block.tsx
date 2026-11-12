import type { EditBlock } from "./video-block";
import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import { Button, Spinner } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { TextInput } from "../editor/fields";
import { portfolioImageSrc } from "../images/image-field";
import { discardUnplacedImages, discardUploadedImages, isAbort } from "../images/upload";
import { useRequestSignals } from "../images/use-request-signals";
import { formatFileSize, pdfErrorMessage, pdfLimitText, uploadPortfolioPdf } from "../media/pdf";
import { currentBlock, ErrorNote, usePdfPicker } from "./add-media-block";

const { text: max } = PORTFOLIO_LIMITS;

type PdfBlockEditorProps = { work: PortfolioWork; block: PortfolioBlockOf<"pdf">; edit: EditBlock<"pdf"> };

/** A PDF: its first page, title, pages and size, and a way to replace the file. */
export function PdfBlockEditor({ work, block, edit }: PdfBlockEditorProps) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requests = useRequestSignals();
	const limit = pdfLimitText();

	const replace = async (file: File) => {
		const signal = requests.next();
		setBusy(true);
		setError(null);
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
			if (!isAbort(failure, signal)) setError(pdfErrorMessage(failure));
		} finally {
			if (!signal.aborted) setBusy(false);
		}
	};

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
				<span className="text-body-xs text-muted">
					<Trans>Up to {limit}, without a password. Visitors open it in a new tab.</Trans>{" "}
					<Trans>Details saved inside the file, such as the author's name, are published with it.</Trans>
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
