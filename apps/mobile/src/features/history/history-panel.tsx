// History (plans/mobile Phase 07 step 7; web: resume/share/history-tab.tsx): name the current state, or pick any
// version to see its pages, read-only, then restore it (with Undo) or go back to now.
import type { Version } from "./format";
import type { ResumeDocument } from "@/draft/types";
import { useLingui } from "@lingui/react/macro";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { formatVersionMoment, formatVersionTime, getVersionDetail, getVersionTitle } from "./format";
import { useHistory } from "./use-history";
import { VersionOptions } from "./version-options";
import { VersionPage } from "./version-page";
import {
	Alert,
	Button,
	EmptyState,
	Icon,
	IconButton,
	Input,
	ListRow,
	ListSection,
	Skeleton,
	Text,
	TextField,
	Typography,
	showToast,
} from "@/ui";

type HistoryPanelProps = { resume: Pick<ResumeDocument, "id" | "isLocked">; offline: boolean };

export function HistoryPanel({ resume, offline }: HistoryPanelProps) {
	const { t, i18n } = useLingui();
	const history = useHistory(resume.id, offline);
	const versions = history.list.data;
	// `?version=` (Applications' "What you sent") opens that version until another is picked.
	const { version: linked } = useLocalSearchParams<{ version?: string }>();
	const [picked, setPicked] = useState<string | null | undefined>(undefined);
	const selectedId = picked === undefined ? (linked ?? null) : picked;
	const selected = versions?.find((version) => version.id === selectedId) ?? null;
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [options, setOptions] = useState<Version | null>(null);
	const when = (version: Version) => formatVersionTime(version.createdAt, i18n.locale);

	const run = async (action: () => Promise<void>, failure = t`Something went wrong. Try again.`) => {
		setBusy(true);
		try {
			await action();
		} catch (error) {
			showToast({ title: error instanceof Error && error.message ? error.message : failure, variant: "danger" });
		}
		setBusy(false);
	};

	const save = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		void run(async () => {
			await history.save(trimmed);
			setName("");
			showToast({ title: t`Saved “${trimmed}”` });
		});
	};

	const restore = (version: Version) =>
		void run(async () => {
			const since = new Date(Date.now() - 60_000);
			await history.restore(version.id);
			setPicked(null);
			showToast({
				title: t`Restored the version from ${formatVersionMoment(version.createdAt, i18n.locale)}. Your previous state is saved as “Before restore”.`,
				undo: {
					label: t`Undo`,
					onUndo: () =>
						void run(async () => {
							await history.undoRestore(since);
							showToast({ title: t`Restore undone` });
						}),
				},
			});
		});

	return (
		<View className="gap-4" testID="history-panel">
			{offline ? (
				<Alert status="accent">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Description>{t`You're offline. History needs a connection.`}</Alert.Description>
					</Alert.Content>
				</Alert>
			) : null}
			{selected ? (
				<View
					className="gap-3 rounded-2xl bg-accent-soft p-3"
					accessibilityLiveRegion="polite"
					testID="history-viewing"
				>
					<View className="flex-row items-center gap-2">
						<Icon name="clock-counter-clockwise" size={20} tone="accent-soft-foreground" />
						<Text weight="medium" tabular className="shrink text-accent-soft-foreground">
							{t`Viewing ${when(selected)} · ${getVersionTitle(selected)} · read-only`}
						</Text>
					</View>
					<View className="flex-row flex-wrap gap-2">
						<Button
							variant="secondary"
							isDisabled={resume.isLocked || busy || offline}
							onPress={() => restore(selected)}
							testID="history-restore"
						>
							<Button.Label>{t`Restore this version`}</Button.Label>
						</Button>
						<Button variant="ghost" onPress={() => setPicked(null)}>
							<Button.Label>{t`Back to now`}</Button.Label>
						</Button>
					</View>
				</View>
			) : (
				<View className="flex-row items-end gap-2">
					<TextField className="flex-1">
						<Input
							accessibilityLabel={t`Name this version`}
							placeholder={t`Sent to Lumen`}
							value={name}
							onChangeText={setName}
							maxLength={80}
							returnKeyType="done"
							onSubmitEditing={save}
							editable={!offline}
						/>
					</TextField>
					<Button variant="secondary" isDisabled={!name.trim() || busy || offline} onPress={save} testID="history-save">
						<Button.Label>{t`Save`}</Button.Label>
					</Button>
				</View>
			)}
			{selected ? (
				<VersionPage key={selected.id} resumeId={resume.id} versionId={selected.id} offline={offline} />
			) : null}
			{history.list.isError ? (
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`Couldn't load versions.`}
					action={{ label: t`Retry`, onPress: () => void history.list.refetch() }}
				/>
			) : history.list.isPending && !offline ? (
				<Skeleton variant="none" className="h-64 w-full rounded-2xl" testID="history-loading" />
			) : (
				<ListSection title={t`Versions`}>
					<ListRow
						title={t`Now`}
						description={t`The resume as it is`}
						icon="file-text"
						isSelected={!selected}
						chevron={false}
						onPress={() => setPicked(null)}
					/>
					{(versions ?? []).map((version) => (
						<ListRow
							key={version.id}
							testID={`version-${version.id}`}
							title={getVersionTitle(version)}
							description={`${when(version)} · ${getVersionDetail(version)}`}
							icon={version.kind === "named" ? "bookmark-simple" : "clock-counter-clockwise"}
							isSelected={version.id === selected?.id}
							chevron={false}
							onPress={() => setPicked(version.id)}
							trailing={
								version.kind === "named" ? (
									<IconButton
										icon="dots-three"
										label={t`Options for ${getVersionTitle(version)}`}
										isDisabled={busy || offline}
										onPress={() => setOptions(version)}
									/>
								) : undefined
							}
						/>
					))}
				</ListSection>
			)}
			{history.list.isSuccess && history.list.data.length <= 1 ? (
				<Typography type="body-sm" className="text-muted">
					{t`Only one version so far. Every editing session adds one automatically.`}
				</Typography>
			) : null}
			<Typography type="body-xs" className="text-muted">
				{t`Autosaves are grouped by session and kept for 90 days. Named versions are kept until you delete them. Restoring saves the current state first.`}
			</Typography>
			<VersionOptions
				version={options}
				onClose={() => setOptions(null)}
				onRename={(version, next) => void run(() => history.rename(version.id, next))}
				onDelete={(version) =>
					void run(async () => {
						await history.remove(version.id);
						if (selectedId === version.id) setPicked(null);
						showToast({ title: t`Deleted “${getVersionTitle(version)}”` });
					})
				}
			/>
		</View>
	);
}
