// Share & export for letters: Download and History. Letters have no public link. Opened from the letter chrome; the
// letter layout owns the draft, so this only subscribes. `version` opens History on that version, read-only.
import type { RouterOutput } from "@/api/client";
import type { LetterDocument } from "@/draft/types";
import type { FormatOption } from "@/features/share/export-options";
import type { ExportFormat } from "@/features/share/files";
import type { File } from "expo-file-system";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useNetworkState } from "expo-network";
import { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { getDefaultFileName } from "@rezumi/utils/file-name";
import { letterFileName, letterPageData, useLetterWords } from "./compose";
import { LetterPages } from "./page";
import { useResumes } from "./queries";
import { restoreLetterVersion, saveLetter } from "./save";
import { client, orpc } from "@/api/client";
import { useLetterStore } from "@/draft";
import { canShowPlans, hasPlanFeature, showPlanAlert, usePlan } from "@/features/billing/plan";
import { useDocumentOperations } from "@/features/documents/queries";
import { FileNameField, FormatList, Notice } from "@/features/share/export-options";
import { exportDirectory, exportFile, shareExport } from "@/features/share/files";
import { letterWords } from "@/features/share/letter";
import { safeFileName } from "@/features/share/model";
import {
	Button,
	ConfirmDialog,
	EmptyState,
	IconButton,
	Input,
	Label,
	ListRow,
	ListSection,
	Segment,
	Sheet,
	Skeleton,
	Text,
	TextField,
	showToast,
} from "@/ui";

type LetterFormat = ExportFormat | "both";

/** Saves what's typed before a server export or version; throws when the server doesn't have it. */
async function flushLetter(id: string) {
	if (!(await saveLetter(id))) throw new Error(t`Couldn't save your changes. Try again before continuing.`);
	const document = useLetterStore.getState().document;
	if (document?.id !== id) throw new Error(t`Couldn't load the cover letter.`);
	return document;
}

type LetterShareSheetProps = { id: string; open: boolean; onClose: () => void; version?: string | undefined };

export function LetterShareSheet({ id, open, onClose, version }: LetterShareSheetProps) {
	const { t } = useLingui();
	const letter = useLetterStore((state) => (state.document?.id === id ? state.document : null));
	const [tab, setTab] = useState<"download" | "history">(version ? "history" : "download");
	const network = useNetworkState();
	const offline = network.isConnected === false || network.isInternetReachable === false;

	return (
		<Sheet
			isOpen={open}
			onOpenChange={(next) => !next && onClose()}
			title={t`Share & export`}
			closeLabel={t`Close`}
			detents={[0.95]}
			testID="letter-share-sheet"
		>
			<View className="gap-4">
				<Segment
					accessibilityLabel={t`Share sections`}
					value={tab}
					onValueChange={setTab}
					options={[
						{ value: "download", label: t`Download` },
						{ value: "history", label: t`History` },
					]}
				/>
				{!letter ? (
					<Skeleton variant="none" className="h-40 rounded-2xl" />
				) : tab === "download" ? (
					<LetterDownload letter={letter} offline={offline} />
				) : (
					<LetterHistory letter={letter} offline={offline} version={version} />
				)}
			</View>
		</Sheet>
	);
}

/**
 * Download: the letter as PDF (rendered here, so it works offline), Word, OpenDocument, Markdown or JSON, or, for a
 * letter with a resume, both as two matching PDFs.
 */
function LetterDownload({ letter, offline }: { letter: LetterDocument; offline: boolean }) {
	const { t } = useLingui();
	const resumes = useResumes();
	const resumeId = letter.sourceResumeId;
	const resumeName = resumes.data?.find((item) => item.id === resumeId)?.name;
	const [picked, setFormat] = useState<LetterFormat>("pdf");
	// "Resume + letter" goes away when the letter lets go of its resume; the choice falls back to the PDF.
	const format = picked === "both" && !resumeId ? "pdf" : picked;
	const [name, setName] = useState(() => letterFileName(letter));
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const active = useRef(false);
	const plan = usePlan();
	// Word and ODT need the plan's feature: Android shows them locked, iOS lists only what the account can use.
	const wordLocked = !hasPlanFeature(plan, "wordOdtExport");
	const isWord = (id: LetterFormat) => id === "docx" || id === "odt";
	const local = (as: LetterFormat) => as === "pdf";

	const allFormats: FormatOption<LetterFormat>[] = [
		{
			id: "pdf",
			label: t`PDF · Best for applying`,
			extension: ".pdf",
			description: t`Looks exactly like the page. Use it for applications and email.`,
			icon: "file-pdf",
		},
		...(resumeId
			? [
					{
						id: "both" as const,
						label: t`Resume + letter`,
						extension: t`2 files`,
						description: resumeName
							? t`This letter and “${resumeName}” as two PDFs, named to match.`
							: t`This letter and your resume as two PDFs, named to match.`,
						icon: "file-plus" as const,
					},
				]
			: []),
		{
			id: "docx",
			label: t`Word`,
			extension: ".docx",
			description: t`For portals or recruiters who ask for Word. Layout is simplified.`,
			icon: "file-text",
		},
		{
			id: "odt",
			label: t`OpenDocument`,
			extension: ".odt",
			description: t`For LibreOffice and other open-source editors. Layout is simplified.`,
			icon: "file-text",
		},
		{
			id: "md",
			label: t`Markdown`,
			extension: ".md",
			description: t`Plain text with headings. Paste into application forms and notes.`,
			icon: "file-text",
		},
		{
			id: "json",
			label: t`JSON`,
			extension: ".json",
			description: t`A backup of this letter. Imports back into Rezumi as a letter.`,
			icon: "file-text",
		},
	];
	const formats = (wordLocked && !canShowPlans() ? allFormats.filter((item) => !isWord(item.id)) : allFormats).map(
		(item) => ({ ...item, locked: wordLocked && isWord(item.id), unavailable: offline && !local(item.id) }),
	);
	const selected = formats.find((item) => item.id === format) ?? formats[0];

	const download = async (as: LetterFormat) => {
		if (active.current) return;
		active.current = true;
		setBusy(true);
		setError(null);
		try {
			// Offline, the PDF renders from what's on this device; everything else needs the saved letter.
			const current = offline && local(as) ? useLetterStore.getState().document : await flushLetter(letter.id);
			if (current?.id !== letter.id) throw new Error(t`Couldn't load the cover letter.`);
			const directory = exportDirectory();
			const words = await letterWords(current.style.metadata.page.locale);
			const pdf = (fileName: string) =>
				exportFile({
					directory,
					id: current.id,
					name: fileName,
					format: "pdf",
					data: letterPageData(current, words),
					letter: true,
				});

			const files: [File, ExportFormat][] = [];
			if (as === "both") {
				if (!current.sourceResumeId) throw new Error(t`This letter has no resume anymore. Choose another format.`);
				// Both files are ready before either is handed off, so a failure leaves a clear retry. They're named to
				// match, from the person's name, as on the web.
				const resume = await client.resume.getById({ id: current.sourceResumeId });
				const resumeFile = await exportFile({
					directory,
					id: resume.id,
					name: getDefaultFileName(resume),
					format: "pdf",
					data: resume.data,
				});
				files.push([resumeFile, "pdf"], [await pdf(letterFileName(current)), "pdf"]);
			} else if (as === "pdf") {
				files.push([await pdf(name), "pdf"]);
			} else {
				files.push([await exportFile({ directory, id: current.id, name, format: as, letter: true, words }), as]);
			}
			for (const [file, type] of files) await shareExport(file, type);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t`Download failed. Try again.`);
		} finally {
			active.current = false;
			setBusy(false);
		}
	};

	return (
		<View className="gap-4">
			{offline ? (
				<Notice
					status="accent"
					message={t`You're offline. Download PDF uses this device. Other formats need a connection. Fonts and images must already be cached.`}
				/>
			) : null}
			<FormatList
				title={t`File format`}
				options={formats}
				value={format}
				disabled={busy}
				onChange={(id) => {
					if (wordLocked && isWord(id)) return showPlanAlert({ kind: "feature", feature: "wordOdtExport" });
					setFormat(id);
					setError(null);
				}}
			/>
			{format !== "both" ? (
				<FileNameField
					variant="secondary"
					value={name}
					extension={selected?.extension ?? ".pdf"}
					disabled={busy}
					description={t`Recruiters see this name. Your name plus “Cover Letter” works well.`}
					onChange={(value) => setName(safeFileName(value))}
				/>
			) : null}
			{error ? <Notice status="danger" message={error} /> : null}
			<Button
				isDisabled={busy || (format !== "both" && !name.trim()) || (offline && !local(format))}
				onPress={() => void download(format)}
				testID="letter-download"
			>
				{busy ? t`Preparing file…` : format === "both" ? t`Download both PDFs` : t`Download ${format.toUpperCase()}`}
			</Button>
			{error && format !== "pdf" ? (
				<Button variant="secondary" isDisabled={busy} onPress={() => void download("pdf")}>
					{t`Download PDF instead`}
				</Button>
			) : null}
			<Text size="xs" tone="muted" className="leading-5">
				{t`Download opens the system share sheet. Choose Save to Files or a storage app to keep the file.`}
			</Text>
		</View>
	);
}

type Version = RouterOutput["coverLetters"]["listVersions"][number];

function versionTitle(version: Version) {
	switch (version.kind) {
		case "named":
			return version.name || t`Named version`;
		case "created":
			return t`Created`;
		case "auto":
			return t`Editing session`;
		case "before-restore":
			return t`Before restore`;
		case "restored":
			return t`Restored a version`;
		case "sent":
			return version.name ? t`Sent to ${version.name}` : t`Sent`;
		default:
			return t`Version`;
	}
}

type LetterHistoryProps = { letter: LetterDocument; offline: boolean; version?: string | undefined };

/** History: sessions, named and sent versions, restore points; a version shows read-only before Restore. */
function LetterHistory({ letter, offline, version: openVersion }: LetterHistoryProps) {
	const { t, i18n } = useLingui();
	const operations = useDocumentOperations();
	const list = useQuery({
		...orpc.coverLetters.listVersions.queryOptions({ input: { id: letter.id } }),
		enabled: !offline,
	});
	// `version` (Applications' "What you sent") shows that version until the person picks another.
	const [picked, setSelected] = useState<Version | null | undefined>(undefined);
	const selected = picked === undefined ? (list.data?.find((item) => item.id === openVersion) ?? null) : picked;
	const [menu, setMenu] = useState<Version | null>(null);
	const [mode, setMode] = useState<"menu" | "rename" | "delete">("menu");
	const [name, setName] = useState("");
	const [rename, setRename] = useState("");
	const [restoring, setRestoring] = useState(false);
	const disabled = operations.busy || offline;

	const save = async () => {
		if (
			await operations.run(async () => {
				await flushLetter(letter.id);
				await client.coverLetters.createVersion({ id: letter.id, name: name.trim() });
			})
		) {
			setName("");
			void list.refetch();
			showToast({ title: t`Version saved`, variant: "success" });
		}
	};
	const restore = async () => {
		setRestoring(false);
		if (!selected || letter.isLocked) return;
		let current = false;
		if (
			await operations.run(async () => {
				current = await restoreLetterVersion(
					letter.id,
					selected.id,
					() => new Error(t`Couldn't save your changes. Try again before continuing.`),
				);
			})
		) {
			// Finished after the person left or switched letters: the server has it; this editor is gone.
			if (!current) return;
			setSelected(null);
			void list.refetch();
			showToast({ title: t`Version restored. Your previous state is saved as “Before restore”.`, variant: "success" });
		}
	};
	const mutateVersion = async (remove: boolean) => {
		if (!menu) return;
		const target = menu;
		if (remove) setMenu(null);
		if (
			await operations.run(async () => {
				if (remove) await client.coverLetters.deleteVersion({ id: letter.id, versionId: target.id });
				else await client.coverLetters.renameVersion({ id: letter.id, versionId: target.id, name: rename.trim() });
			})
		) {
			if (selected?.id === target.id) setSelected(remove ? null : { ...target, name: rename.trim() });
			setMenu(null);
			void list.refetch();
		}
	};

	if (selected) {
		return (
			<View className="gap-3">
				<Notice status="accent" message={t`Viewing ${versionTitle(selected)} · read-only`} />
				<VersionPage letter={letter} versionId={selected.id} />
				<View className="flex-row flex-wrap gap-2">
					<Button isDisabled={disabled || letter.isLocked} onPress={() => setRestoring(true)}>
						{t`Restore this version`}
					</Button>
					<Button variant="ghost" isDisabled={operations.busy} onPress={() => setSelected(null)}>
						{t`Back to now`}
					</Button>
				</View>
				{operations.error ? <Notice status="danger" message={operations.error} /> : null}
				<ConfirmDialog
					isOpen={restoring}
					onOpenChange={setRestoring}
					title={t`Restore this version?`}
					message={t`The current state will be saved as “Before restore” first.`}
					confirmLabel={t`Restore version`}
					cancelLabel={t`Keep the current letter`}
					onConfirm={() => void restore()}
				/>
			</View>
		);
	}

	return (
		<View className="gap-4">
			{offline ? <Notice status="accent" message={t`You're offline. History needs a connection.`} /> : null}
			{operations.error ? <Notice status="danger" message={operations.error} /> : null}
			<View className="gap-2">
				<TextField isDisabled={disabled}>
					<Label>{t`Name this version`}</Label>
					<Input
						variant="secondary"
						placeholder={t`For example, Sent to Lumen`}
						value={name}
						onChangeText={setName}
						maxLength={100}
						accessibilityLabel={t`Name this version`}
						onSubmitEditing={() => {
							if (name.trim() && !disabled) void save();
						}}
					/>
				</TextField>
				<Button variant="secondary" isDisabled={disabled || !name.trim()} onPress={() => void save()}>
					{t`Save`}
				</Button>
			</View>
			{list.isError ? (
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`Couldn't load versions`}
					description={t`Check your connection and try again.`}
					action={{ label: t`Retry`, onPress: () => void list.refetch() }}
				/>
			) : list.isPending && !offline ? (
				<Skeleton variant="none" className="h-40 rounded-2xl" />
			) : (
				<ListSection title={t`Versions`}>
					{[
						<ListRow key="now" icon="pencil-simple" title={t`Now`} description={t`The letter as it is`} />,
						...(list.data ?? []).map((version) => (
							<ListRow
								key={version.id}
								icon={version.kind === "named" ? "bookmark-simple" : "clock-counter-clockwise"}
								title={versionTitle(version)}
								description={version.createdAt.toLocaleString(i18n.locale)}
								isDisabled={disabled}
								onPress={() => setSelected(version)}
								trailing={
									version.kind === "named" ? (
										<IconButton
											icon="dots-three"
											variant="ghost"
											label={t`Options for ${versionTitle(version)}`}
											isDisabled={disabled}
											onPress={() => {
												setMenu(version);
												setRename(version.name ?? "");
												setMode("menu");
											}}
										/>
									) : undefined
								}
							/>
						)),
					]}
				</ListSection>
			)}
			<Text size="xs" tone="muted" className="leading-5">
				{t`Every editing session adds a version automatically. Named versions are kept until you delete them. Restoring saves the current state first.`}
			</Text>
			<Sheet
				isOpen={!!menu && mode !== "delete"}
				onOpenChange={(next) => {
					if (!next && !operations.busy) setMenu(null);
				}}
				title={mode === "rename" ? t`Rename version` : t`Version options`}
				closeLabel={t`Close`}
			>
				{mode === "menu" ? (
					<ListSection>
						<ListRow icon="pencil-simple" title={t`Rename…`} onPress={() => setMode("rename")} />
						<ListRow icon="trash" title={t`Delete`} tone="danger" onPress={() => setMode("delete")} />
					</ListSection>
				) : (
					<View className="gap-3">
						<TextField isDisabled={disabled}>
							<Label>{t`Name`}</Label>
							<Input
								variant="secondary"
								value={rename}
								onChangeText={setRename}
								maxLength={100}
								accessibilityLabel={t`Name`}
							/>
						</TextField>
						<Button isDisabled={disabled || !rename.trim()} onPress={() => void mutateVersion(false)}>
							{t`Save`}
						</Button>
					</View>
				)}
			</Sheet>
			<ConfirmDialog
				isOpen={!!menu && mode === "delete"}
				onOpenChange={(next) => !next && setMenu(null)}
				title={t`Delete “${menu ? versionTitle(menu) : ""}”?`}
				message={t`Named versions are kept until you delete them. This can't be undone.`}
				confirmLabel={t`Delete version`}
				cancelLabel={t`Keep version`}
				destructive
				onConfirm={() => void mutateVersion(true)}
			/>
		</View>
	);
}

/** A saved version as it printed, read-only. */
function VersionPage({ letter, versionId }: { letter: LetterDocument; versionId: string }) {
	const { t } = useLingui();
	const version = useQuery(orpc.coverLetters.getVersion.queryOptions({ input: { id: letter.id, versionId } }));
	const words = useLetterWords(version.data?.data.style.metadata.page.locale);
	const versionData = version.data?.data;
	// Memoised: a new object each render would restart the preview every time a render lands.
	const data = useMemo(
		() => (versionData && words ? letterPageData({ ...letter, ...versionData }, words) : null),
		[letter, versionData, words],
	);

	if (version.isError)
		return (
			<View className="gap-2">
				<Notice status="danger" message={t`Couldn't load this version's page.`} />
				<Button size="sm" variant="secondary" className="self-start" onPress={() => void version.refetch()}>
					{t`Retry`}
				</Button>
			</View>
		);
	return (
		<View className="h-120 overflow-hidden rounded-2xl">
			<LetterPages data={data} zoomBar={false} />
		</View>
	);
}
