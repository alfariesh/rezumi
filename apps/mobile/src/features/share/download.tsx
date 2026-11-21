// Download for a resume: PDF rendered on this device (works offline), Word, OpenDocument, Markdown or JSON from the
// server, print, and the linked application's cover letter as a second file. Every file goes through the system share
// sheet, where the person saves it to Files or Downloads or sends it to another app.
import type { FormatOption } from "./export-options";
import type { ExportFormat } from "./files";
import type { ResumeDocument } from "@/draft/types";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { lintResumeForAts } from "@rezumi/resume/ats";
import { composeCoverLetter, createCoverLetterResumeData } from "@rezumi/resume/cover-letter";
import { flushResume } from "./document";
import { FileNameField, FormatList, Notice } from "./export-options";
import { exportDirectory, exportFile, printResume, shareExport } from "./files";
import { letterWords } from "./letter";
import { safeFileName } from "./model";
import { client } from "@/api/client";
import { useLetterStore, useResumeStore } from "@/draft";
import { useApplications } from "@/features/applications/queries";
import { canShowPlans, hasPlanFeature, showPlanAlert, usePlan } from "@/features/billing/plan";
import { routes } from "@/routes";
import { Button, ListRow, ListSection, Switch, Text } from "@/ui";

type DownloadProps = { resume: ResumeDocument; offline: boolean };

export function DownloadTab({ resume, offline }: DownloadProps) {
	const router = useRouter();
	const { t } = useLingui();
	const issues = lintResumeForAts(resume.data).findings.length;
	const applications = useApplications();
	const linked = applications.data?.find(
		(item) => item.coverLetterId && (item.id === resume.applicationId || item.resumeId === resume.id),
	);
	const [withLetter, setWithLetter] = useState(false);
	const [format, setFormat] = useState<ExportFormat>("pdf");
	const [name, setName] = useState(safeFileName(t`${resume.data.basics.name || resume.name}-Resume`));
	const [busy, setBusy] = useState<"file" | "print" | null>(null);
	const active = useRef(false);
	const [error, setError] = useState<string | null>(null);
	const plan = usePlan();
	// Word and ODT need the plan's feature: Android shows them locked, iOS lists only what the account can use.
	const wordLocked = !hasPlanFeature(plan, "wordOdtExport");
	const isWord = (id: ExportFormat) => id === "docx" || id === "odt";
	const allFormats: FormatOption<ExportFormat>[] = [
		{
			id: "pdf",
			label: t`PDF · Best for applying`,
			description: t`Looks exactly like the page. Use it for applications and email.`,
			extension: ".pdf",
			icon: "file-pdf",
		},
		{
			id: "docx",
			label: t`Word`,
			description: t`For portals or recruiters who ask for Word. Layout is simplified.`,
			extension: ".docx",
			icon: "file-text",
		},
		{
			id: "odt",
			label: t`OpenDocument`,
			description: t`For LibreOffice and other open-source editors. Layout is simplified.`,
			extension: ".odt",
			icon: "file-text",
		},
		{
			id: "md",
			label: t`Markdown`,
			description: t`Plain text with headings. Paste into application forms and notes.`,
			extension: ".md",
			icon: "file-text",
		},
		{
			id: "json",
			label: t`JSON`,
			description: t`Complete data backup. Imports back into Rezumi or JSON Resume tools.`,
			extension: ".json",
			icon: "file-text",
		},
	];
	const formats = (wordLocked && !canShowPlans() ? allFormats.filter((item) => !isWord(item.id)) : allFormats).map(
		(item) => ({ ...item, locked: wordLocked && isWord(item.id), unavailable: offline && item.id !== "pdf" }),
	);

	const download = async (chosen: ExportFormat, print = false, includeLetter = withLetter) => {
		if (active.current) return;
		active.current = true;
		setBusy(print ? "print" : "file");
		setError(null);
		try {
			if (chosen !== "pdf" || !offline) await flushResume(resume.id);
			const current = useResumeStore.getState().document;
			if (current?.id !== resume.id) throw new Error(t`Couldn't load the resume.`);
			if (print) {
				await printResume(current.data, name);
				return;
			}
			const directory = exportDirectory();
			const file = await exportFile({ directory, id: resume.id, name, format: chosen, data: current.data });
			// Generate both files before handing either to another app, so failures leave a clear retry path.
			let letterFile;
			if (includeLetter && linked?.coverLetterId) {
				const letter = useLetterStore.getState();
				if (letter.document?.id === linked.coverLetterId) {
					await letter.flush();
					const latest = useLetterStore.getState();
					if (latest.conflict || !["saved", "idle"].includes(latest.status))
						throw new Error(t`Save the cover letter before exporting it.`);
				}
				const savedLetter = chosen === "pdf" ? await client.coverLetters.getById({ id: linked.coverLetterId }) : null;
				const composed = savedLetter
					? composeCoverLetter(savedLetter, await letterWords(savedLetter.style.metadata.page.locale))
					: null;
				letterFile = await exportFile({
					directory,
					id: linked.coverLetterId,
					name: t`${name}-Cover-Letter`,
					format: chosen,
					letter: true,
					...(savedLetter && composed ? { data: createCoverLetterResumeData({ ...savedLetter, ...composed }) } : {}),
				});
			}
			await shareExport(file, chosen);
			if (letterFile) await shareExport(letterFile, chosen);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t`Couldn't export. Try again.`);
		} finally {
			active.current = false;
			setBusy(null);
		}
	};

	const needsServer = offline && (format !== "pdf" || withLetter);
	const extension = `.${format}`;

	return (
		<View className="gap-4">
			{offline ? (
				<Notice
					status="accent"
					message={t`You're offline. Download PDF uses this device. Other formats and linked letters need a connection. Fonts and images must already be cached.`}
				/>
			) : null}
			<FormatList
				title={t`File format`}
				options={formats}
				value={format}
				disabled={!!busy}
				onChange={(value) => {
					if (wordLocked && isWord(value)) return showPlanAlert({ kind: "feature", feature: "wordOdtExport" });
					setFormat(value);
					setError(null);
				}}
			/>
			<FileNameField
				value={name}
				extension={extension}
				disabled={!!busy}
				description={t`Recruiters see this name. Your name plus “Resume” works well.`}
				onChange={(value) => setName(safeFileName(value))}
			/>
			{linked?.coverLetterId ? (
				<ListSection>
					<ListRow
						title={t`Also download the ${linked.company} cover letter`}
						description={t`It opens as a second file.`}
						trailing={
							<Switch
								isSelected={withLetter}
								isDisabled={!!busy || (offline && !withLetter)}
								onSelectedChange={setWithLetter}
								accessibilityLabel={t`Also download the cover letter`}
							/>
						}
					/>
				</ListSection>
			) : null}
			{applications.isError ? (
				<View className="gap-2">
					<Notice status="warning" message={t`Couldn't check for a linked cover letter.`} />
					<Button size="sm" variant="secondary" className="self-start" onPress={() => void applications.refetch()}>
						<Button.Label>{t`Retry`}</Button.Label>
					</Button>
				</View>
			) : null}
			{error ? <Notice status="danger" message={error} /> : null}
			<Button
				isDisabled={!!busy || !name.trim() || needsServer}
				onPress={() => void download(format)}
				testID="export-download"
			>
				<Button.Label>
					{busy === "file" ? t`Preparing file…` : format === "pdf" ? t`Share PDF` : t`Download ${format.toUpperCase()}`}
				</Button.Label>
			</Button>
			{(error && format !== "pdf") || needsServer ? (
				<Button
					variant="secondary"
					isDisabled={!!busy || !name.trim()}
					onPress={() => {
						setWithLetter(false);
						setFormat("pdf");
						void download("pdf", false, false);
					}}
				>
					<Button.Label>{t`Share PDF instead`}</Button.Label>
				</Button>
			) : null}
			<Button variant="secondary" isDisabled={!!busy} onPress={() => void download("pdf", true)}>
				<Button.Label>{busy === "print" ? t`Preparing file…` : t`Print`}</Button.Label>
			</Button>
			{issues > 0 ? (
				<View className="gap-1">
					<Text tone="muted">
						{plural(issues, {
							one: "Check has # thing to review. You can still download.",
							other: "Check has # things to review. You can still download.",
						})}
					</Text>
					<Button
						variant="ghost"
						size="sm"
						className="self-start"
						isDisabled={!!busy}
						onPress={() => router.push(routes.builder(resume.id, "check"))}
					>
						<Button.Label>{t`Review Check`}</Button.Label>
					</Button>
				</View>
			) : null}
			<Text size="xs" tone="muted" className="leading-5">
				{t`Download opens the system share sheet. Choose Save to Files or a storage app to keep the file.`}
			</Text>
		</View>
	);
}
