// Files: the PDFs actually sent (up to 10 MB each), apart from linked Rezumi documents. A tap opens one in the
// browser; Attach picks a PDF; Remove asks first (the file is deleted).
import type { AttachmentKind } from "../queries";
import type { Application } from "../types";
import { useLingui } from "@lingui/react/macro";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { useDetailMutations } from "../queries";
import { attachmentProblem } from "./attachment";
import { DetailSection } from "./section";
import { getServer } from "@/auth/session";
import { Button, ConfirmDialog, Icon, IconButton, ListRow, ListSection, Text, showToast } from "@/ui";

/** Stored attachment URLs are same-origin uploads, often relative. */
const absoluteUrl = (url: string) => (url.startsWith("/") ? `${getServer()}${url}` : url);

type AttachmentsProps = { application: Application };

export function Attachments({ application }: AttachmentsProps) {
	const { t } = useLingui();
	const { attach, removeDocument } = useDetailMutations(application.id);
	const [removing, setRemoving] = useState<AttachmentKind | null>(null);
	const busy = attach.isPending || removeDocument.isPending;
	const files = [
		{ kind: "resume" as const, url: application.resumeFileUrl, name: application.resumeFileName || t`Resume file` },
		{
			kind: "cover-letter" as const,
			url: application.coverLetterUrl,
			name: application.coverLetterName || t`Cover letter file`,
		},
	];
	const problems = {
		"not-pdf": t`Choose a PDF file. The selected file was not uploaded.`,
		"too-large": t`Choose a PDF smaller than 10 MB. The selected file was not uploaded.`,
		"unknown-size": t`This file's size couldn't be read. Choose another PDF.`,
	};

	const pick = async (kind: AttachmentKind) => {
		const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
		const asset = result.canceled ? null : result.assets[0];
		if (!asset) return;
		const copy = new File(asset.uri);
		try {
			const problem = attachmentProblem({ name: asset.name, size: asset.size ?? copy.size, mimeType: asset.mimeType });
			if (problem) return showToast({ title: problems[problem], variant: "danger" });
			await attach.mutateAsync({ kind, uri: asset.uri });
			showToast({ title: t`File attached`, variant: "success" });
		} catch {
			showToast({ title: t`Couldn't upload the file. Try again.`, variant: "danger" });
		} finally {
			if (copy.exists) copy.delete();
		}
	};
	const attached = files.filter((file) => file.url);

	return (
		<DetailSection title={t`Files`} testID="attachments">
			{attached.length > 0 ? (
				<ListSection>
					{attached.map((file) => (
						<ListRow
							key={file.kind}
							icon="file-pdf"
							title={file.name}
							description={t`PDF · opens in the browser`}
							onPress={() => void openBrowserAsync(absoluteUrl(file.url ?? ""))}
							trailing={
								<IconButton
									icon="x"
									size="sm"
									label={t`Remove ${file.name}`}
									isDisabled={busy}
									onPress={() => setRemoving(file.kind)}
								/>
							}
						/>
					))}
				</ListSection>
			) : null}
			<View className="flex-row flex-wrap gap-2">
				{files
					.filter((file) => !file.url)
					.map((file) => (
						<Button
							key={file.kind}
							size="sm"
							variant="secondary"
							isDisabled={busy}
							onPress={() => void pick(file.kind)}
						>
							<Icon name="upload-simple" size={16} />
							<Button.Label>
								{file.kind === "resume" ? t`Attach a resume (PDF)` : t`Attach a letter (PDF)`}
							</Button.Label>
						</Button>
					))}
			</View>
			<Text size="xs" tone="muted">
				{t`PDF only, up to 10 MB each.`}
			</Text>
			<ConfirmDialog
				isOpen={removing !== null}
				onOpenChange={(open) => !open && setRemoving(null)}
				title={t`Remove this file?`}
				message={t`The file is deleted. The application keeps its other details.`}
				confirmLabel={t`Remove file`}
				cancelLabel={t`Keep file`}
				destructive
				onConfirm={() => {
					if (removing)
						removeDocument.mutate(
							{ id: application.id, kind: removing },
							{ onError: () => showToast({ title: t`Couldn't remove the file. Try again.`, variant: "danger" }) },
						);
				}}
			/>
		</DetailSection>
	);
}
