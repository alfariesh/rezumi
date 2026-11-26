import { useLingui } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import { useState } from "react";
import { SettingsPage } from "./layout";
import { clearStoredThumbnails } from "@/features/documents/thumbnail-store";
import { PREVIEW_FONT_CACHE, clearPreviewFontCache } from "@/preview/resources";
import { ConfirmDialog, EmptyState, ListRow, ListSection, showToast } from "@/ui";

const previewCaches = new Set(["document-thumbnails-v1", "template-thumbnails-v1", PREVIEW_FONT_CACHE]);
const exportDirectories = /^(?:resume-export|portfolio-export)-\d+$/;
const exportFiles = /^(?:rezumi-\d+\.json|pipeline-flow-\d+\.png|rezumi-sample\.pdf)$/;

function cacheEntries() {
	return Paths.cache
		.list()
		.filter((entry) =>
			entry instanceof Directory
				? previewCaches.has(entry.name) || exportDirectories.test(entry.name)
				: exportFiles.test(entry.name),
		);
}

function bytesOf(entry: Directory | File): number {
	if (entry instanceof File) return entry.exists ? (entry.size ?? 0) : 0;
	return entry.exists ? entry.list().reduce((bytes, file) => bytes + bytesOf(file), 0) : 0;
}

export default function StorageScreen() {
	const { t, i18n } = useLingui();
	const [confirming, setConfirming] = useState(false);
	const bytes = useQuery({
		queryKey: ["offline-cache"],
		queryFn: () => Promise.resolve(cacheEntries().reduce((sum, entry) => sum + bytesOf(entry), 0)),
		staleTime: 0,
	});
	const clear = useMutation({
		mutationFn: async () => {
			await Promise.all([clearStoredThumbnails(), clearPreviewFontCache()]);
			for (const entry of cacheEntries()) {
				if (!previewCaches.has(entry.name) && entry.exists) entry.delete();
			}
		},
		onSettled: () => bytes.refetch(),
		onSuccess: () => showToast({ title: t`Cache cleared`, variant: "success" }),
		onError: () => showToast({ title: t`Couldn't clear the cache. Try again.`, variant: "danger" }),
	});
	const size =
		bytes.data === undefined ? undefined : t`${i18n.number(bytes.data / 1024, { maximumFractionDigits: 1 })} KB`;

	return (
		<SettingsPage title={t`Offline storage`} onRefresh={bytes.refetch}>
			<ListSection
				footer={t`Cached previews and temporary exports can be created again. Your offline drafts are kept.`}
			>
				<ListRow
					title={t`Cached files`}
					icon="file-text"
					value={size ?? (bytes.isPending ? t`Calculating…` : undefined)}
				/>
				<ListRow
					title={t`Clear cache`}
					icon="trash"
					tone="danger"
					isDisabled={!bytes.data || clear.isPending}
					onPress={() => setConfirming(true)}
				/>
			</ListSection>
			{bytes.isError ? (
				<EmptyState
					kind="inline"
					title={t`Couldn't measure the cache.`}
					action={{ label: t`Try again`, onPress: () => void bytes.refetch() }}
				/>
			) : null}
			<ConfirmDialog
				isOpen={confirming}
				onOpenChange={setConfirming}
				title={t`Clear cached files?`}
				message={t`Previews and temporary exports will be removed from this device. Your documents and unsynced edits are kept.`}
				confirmLabel={t`Clear cache`}
				cancelLabel={t`Keep cache`}
				destructive
				onConfirm={() => clear.mutate()}
			/>
		</SettingsPage>
	);
}
