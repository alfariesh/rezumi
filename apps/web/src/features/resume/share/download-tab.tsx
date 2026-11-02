import type { Resume } from "@/features/resume/builder/draft";
import type { ExportFormat } from "@/features/resume/export/use-resume-export";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { RadioButtonGroup } from "@heroui-pro/react";
import { Button, Checkbox, Chip, Description, InputGroup, Label, Spinner, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { downloadWithAnchor } from "@rezumi/utils/file";
import { applicationsListQueryOptions } from "@/features/applications/queries";
import { createLetterFile, letterFileName } from "@/features/letters/export";
import { useCurrentResume } from "@/features/resume/builder/draft";
import { useOpenIssueCount } from "@/features/resume/editor/check/use-check";
import {
	createExportFile,
	getDefaultFileName,
	preloadDocumentExport,
	sanitizeFileName,
} from "@/features/resume/export/use-resume-export";
import { getReadableErrorMessage } from "@/libs/error-message";
import { client } from "@/libs/orpc/client";

export type DownloadFormat<Id extends string = ExportFormat> = {
	id: Id;
	label: string;
	/** ".pdf", or what's made ("2 files"). */
	extension: string;
	icon: IconName;
	description: string;
	disabled?: boolean;
};

export const getExportFormats = (): DownloadFormat[] => [
	{
		id: "pdf",
		label: "PDF",
		extension: ".pdf",
		icon: "file-pdf",
		description: t`Looks exactly like the page. Use it for applications and email.`,
	},
	{
		id: "docx",
		label: "Word",
		extension: ".docx",
		icon: "file-text",
		description: t`For portals or recruiters who ask for Word. Layout is simplified.`,
	},
	{
		id: "odt",
		label: "OpenDocument",
		extension: ".odt",
		icon: "file-doc",
		description: t`For LibreOffice and other open-source editors. Layout is simplified.`,
	},
	{
		id: "md",
		label: "Markdown",
		extension: ".md",
		icon: "text-align-left",
		description: t`Plain text with headings. Paste into application forms and notes.`,
	},
	{
		id: "json",
		label: "JSON",
		extension: ".json",
		icon: "brackets-curly",
		description: t`Complete data backup. Imports back into Rezumi or JSON Resume tools.`,
	},
];

type FormatRadioGroupProps<Id extends string> = {
	formats: DownloadFormat<Id>[];
	value: Id;
	onChange: (value: Id) => void;
};

/** Format rows: icon, name, extension and when to use it. PDF is marked "Best for applying". */
export function FormatRadioGroup<Id extends string>({ formats, value, onChange }: FormatRadioGroupProps<Id>) {
	return (
		<RadioButtonGroup
			variant="secondary"
			aria-label={t`Format`}
			value={value}
			onChange={(next) => onChange(next as Id)}
			// Picking a format usually comes next: start loading the DOCX and ODT builders.
			onPointerEnter={preloadDocumentExport}
			onFocus={preloadDocumentExport}
			className="flex-col gap-2"
		>
			{formats.map((option) => (
				<RadioButtonGroup.Item
					key={option.id}
					value={option.id}
					isDisabled={Boolean(option.disabled)}
					className="flex-row items-start gap-3 px-4 py-3"
				>
					<RadioButtonGroup.ItemIcon className="grid size-9 place-items-center rounded-xl bg-default text-muted">
						<Icon name={option.icon} size={20} />
					</RadioButtonGroup.ItemIcon>
					<RadioButtonGroup.ItemContent className="flex-1 gap-0.5 pe-6">
						<span className="flex flex-wrap items-center gap-2">
							<Label className="text-sm font-semibold">{option.label}</Label>
							<span className="font-mono text-xs text-muted">{option.extension}</span>
							{option.id === "pdf" && (
								<Chip size="sm" color="accent" variant="soft">
									<Trans>Best for applying</Trans>
								</Chip>
							)}
						</span>
						<Description>{option.description}</Description>
					</RadioButtonGroup.ItemContent>
					<RadioButtonGroup.Indicator />
				</RadioButtonGroup.Item>
			))}
		</RadioButtonGroup>
	);
}

type FileNameFieldProps = { value: string; extension: string; hint: ReactNode; onChange: (value: string) => void };

/** The file name recruiters see, with the extension shown after it. Characters file systems reject are dropped. */
export function FileNameField({ value, extension, hint, onChange }: FileNameFieldProps) {
	return (
		<TextField
			variant="secondary"
			value={value}
			onChange={(next) => onChange(sanitizeFileName(next))}
			className="gap-1.5"
		>
			<Label>
				<Trans>File name</Trans>
			</Label>
			<InputGroup variant="secondary" fullWidth>
				<InputGroup.Input spellCheck={false} className="font-mono text-sm" />
				<InputGroup.Suffix className="font-mono text-sm text-muted">{extension}</InputGroup.Suffix>
			</InputGroup>
			<Description>{hint}</Description>
		</TextField>
	);
}

/** "done" follows a successful download, until the format changes or another download starts. */
export type DownloadState = "idle" | "busy" | "error" | "done";

type DownloadActionsProps = {
	state: DownloadState;
	label: string;
	onDownload: () => void;
	/** Offered when a file other than a PDF fails. */
	onDownloadPdf?: (() => void) | undefined;
};

/**
 * The failure alert (with PDF as the fallback) and the 44px button that shows its progress.
 */
export function DownloadActions({ state, label, onDownload, onDownloadPdf }: DownloadActionsProps) {
	return (
		<>
			{state === "error" && (
				<div
					role="alert"
					className="flex flex-wrap items-start gap-2.5 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger"
				>
					<Icon name="warning-circle" size={20} />
					<span className="min-w-0 flex-1">
						<Trans>The {label} file couldn't be generated. Try again, or download PDF instead.</Trans>
					</span>
					{onDownloadPdf && (
						<Button size="sm" variant="secondary" onPress={onDownloadPdf}>
							<Trans>Download PDF instead</Trans>
						</Button>
					)}
				</div>
			)}

			<Button size="lg" fullWidth aria-busy={state === "busy"} isDisabled={state === "busy"} onPress={onDownload}>
				{state === "busy" ? (
					<>
						<Spinner size="sm" color="current" aria-hidden />
						<Trans>Preparing {label} file…</Trans>
					</>
				) : state === "error" ? (
					<>
						<Icon name="arrow-clockwise" />
						<Trans>Try again</Trans>
					</>
				) : (
					<>
						<Icon name="download-simple" />
						<Trans>Download {label}</Trans>
					</>
				)}
			</Button>
		</>
	);
}

/** The letter written for this resume's application, which can be downloaded along with it. */
function useLinkedLetter(resume: Resume) {
	const { data: applications } = useQuery(applicationsListQueryOptions());
	const application = applications?.find(
		(item) => item.coverLetterId && (item.id === resume.applicationId || item.resumeId === resume.id),
	);
	return application?.coverLetterId ? { id: application.coverLetterId, company: application.company } : null;
}

type DownloadTabProps = {
	/** Opens Check; the note about open issues links there. */
	onReview: () => void;
};

/**
 * Download: every format explained by when to use it, the file name recruiters see, and a button that shows
 * its progress. Open Check issues are mentioned but never block. A failed file offers PDF instead. With a letter
 * written for the resume's application, that letter can come along as a second file.
 */
export function DownloadTab({ onReview }: DownloadTabProps) {
	const resume = useCurrentResume();
	const issues = useOpenIssueCount();
	const linkedLetter = useLinkedLetter(resume);
	const [format, setFormat] = useState<ExportFormat>("pdf");
	const [withLetter, setWithLetter] = useState(false);
	const [fileName, setFileName] = useState<string | null>(null);
	const [state, setState] = useState<DownloadState>("idle");

	const formats = getExportFormats();
	const selected = formats.find((option) => option.id === format) ?? (formats[0] as DownloadFormat);
	const name = fileName ?? getDefaultFileName(resume);

	const download = async (as: ExportFormat) => {
		const extension = formats.find((option) => option.id === as)?.extension ?? ".pdf";
		const file = `${sanitizeFileName(name) || getDefaultFileName(resume)}${extension}`;
		const letterId = withLetter ? linkedLetter?.id : undefined;
		setState("busy");
		try {
			const blob = await createExportFile(resume, as);
			downloadWithAnchor(blob, file);
			if (letterId) {
				const letter = await client.coverLetters.getById({ id: letterId });
				downloadWithAnchor(await createLetterFile(letter, as), `${letterFileName(letter)}${extension}`);
				toast.add({ description: t`Downloaded ${file} and the cover letter` });
			} else {
				toast.add({ description: t`Downloaded ${file}` });
			}
			setState("done");
		} catch (error) {
			setState("error");
			toast.add({ type: "error", description: getReadableErrorMessage(error, t`Download failed. Try again.`) });
		}
	};

	return (
		<div className="grid gap-4">
			<FormatRadioGroup
				formats={formats}
				value={format}
				onChange={(value) => {
					setFormat(value);
					setState("idle");
				}}
			/>

			<FileNameField
				value={name}
				extension={selected.extension}
				hint={<Trans>Recruiters see this name. Your name plus “Resume” works well.</Trans>}
				onChange={setFileName}
			/>

			{linkedLetter && (
				<div className="text-sm">
					<Checkbox isSelected={withLetter} onChange={setWithLetter}>
						<Checkbox.Content>
							<Checkbox.Control>
								<Checkbox.Indicator />
							</Checkbox.Control>
							<Trans>Also download the {linkedLetter.company} cover letter</Trans>
						</Checkbox.Content>
					</Checkbox>
				</div>
			)}

			{issues > 0 && (
				<div className="flex gap-2.5 rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning-soft-foreground">
					<Icon name="list-checks" size={20} className="shrink-0 text-warning" />
					<span>
						<Plural
							value={issues}
							one="Check has # thing to review. You can still download."
							other="Check has # things to review. You can still download."
						/>{" "}
						{/* An inline action inside the sentence: a HeroUI Button would break the line. */}
						<button
							type="button"
							className="cursor-(--cursor-interactive) font-medium underline underline-offset-2"
							onClick={onReview}
						>
							<Trans>Review</Trans>
						</button>
					</span>
				</div>
			)}

			<DownloadActions
				state={state}
				label={selected.label}
				onDownload={() => void download(format)}
				onDownloadPdf={format === "pdf" ? undefined : () => void download("pdf")}
			/>
		</div>
	);
}
