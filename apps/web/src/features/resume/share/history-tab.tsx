import type { VersionSummary } from "./format";
import type { Resume } from "@/features/resume/builder/draft";
import { Timeline } from "@heroui-pro/react";
import { Button, Dropdown, Input, Label } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { formatVersionMoment, formatVersionTime, getVersionDetail, getVersionTitle } from "./format";
import { savePendingChanges, useCurrentResume, useResumeStore } from "@/features/resume/builder/draft";
import { useEditorStore } from "@/features/resume/editor/store";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { getResumeErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

/** A version as History lists it; resumes and letters share it. */
type HistoryVersion = Pick<VersionSummary, "id" | "kind" | "name" | "createdAt">;

/** What History shows and does for one document: its versions, and saving, restoring, renaming and deleting them. */
export type HistorySource = {
	versions: HistoryVersion[] | undefined;
	loading: boolean;
	/** Locked documents can't be restored over. */
	locked: boolean;
	/** "The resume as it is", under Now. */
	nowDetail: string;
	/** Saves the current state as a named version. Throws what the request throws. */
	save: (name: string) => Promise<void>;
	/** Restores a version (the current state is kept as "Before restore" first). Throws what the request throws. */
	restore: (versionId: string) => Promise<void>;
	rename: (versionId: string, name: string) => Promise<void>;
	remove: (versionId: string) => Promise<void>;
	/** How a failure reads. */
	errorMessage: (error: unknown) => string;
};

/** History for the resume in the editor. */
export function HistoryTab() {
	return <HistoryTimeline source={useResumeHistory()} />;
}

function useResumeHistory(): HistorySource {
	const resume = useCurrentResume();
	const queryClient = useQueryClient();
	const listKey = orpc.resume.listVersions.queryKey({ input: { resumeId: resume.id } });
	const { data: versions, isPending: loading } = useQuery(
		orpc.resume.listVersions.queryOptions({ input: { resumeId: resume.id } }),
	);
	const refresh = () => queryClient.invalidateQueries({ queryKey: listKey });

	return {
		versions,
		loading,
		locked: resume.isLocked,
		nowDetail: t`The resume as it is`,
		errorMessage: getResumeErrorMessage,
		save: async (name) => {
			if (!(await savePendingChanges(resume.id)))
				throw new Error(t`Couldn't save your changes. Try again before continuing.`);
			await orpc.resume.createVersion.call({ resumeId: resume.id, name });
			void refresh();
		},
		restore: async (versionId) => {
			if (!(await savePendingChanges(resume.id)))
				throw new Error(t`Couldn't save your changes. Try again before continuing.`);
			const restored = await orpc.resume.restoreVersion.call({ resumeId: resume.id, versionId });
			useResumeStore.getState().replaceResumeFromServer(restored as Resume);
			queryClient.setQueryData(orpc.resume.getById.queryKey({ input: { id: resume.id } }), {
				...restored,
				applicationId: resume.applicationId ?? null,
			});
			void refresh();
		},
		rename: async (versionId, name) => {
			await orpc.resume.renameVersion.call({ resumeId: resume.id, versionId, name });
			void refresh();
		},
		remove: async (versionId) => {
			await orpc.resume.deleteVersion.call({ resumeId: resume.id, versionId });
			void refresh();
		},
	};
}

/**
 * History: name the current state, or pick any version to see it on the page, read-only, then restore it or
 * go back to now. Restoring saves the current state as "Before restore" first, so it can be undone.
 */
export function HistoryTimeline({ source }: { source: HistorySource }) {
	const { i18n } = useLingui();
	const selectedId = useEditorStore((state) => state.historyVersionId);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const { versions, loading } = source;

	const selected = versions?.find((version) => version.id === selectedId) ?? null;
	const when = (version: HistoryVersion) => formatVersionTime(version.createdAt, i18n.locale);

	const run = async (action: () => Promise<void>) => {
		setBusy(true);
		try {
			await action();
		} catch (error) {
			toast.add({ type: "error", description: source.errorMessage(error) });
		}
		setBusy(false);
	};

	const save = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		void run(async () => {
			await source.save(trimmed);
			setName("");
			toast.add({ description: t`Saved “${trimmed}”` });
		});
	};

	const restore = (version: HistoryVersion) =>
		void run(async () => {
			await source.restore(version.id);
			useEditorStore.setState({ historyVersionId: null });
			toast.add({
				description: t`Restored the version from ${formatVersionMoment(version.createdAt, i18n.locale)}. Your previous state is saved as “Before restore”.`,
			});
		});

	return (
		<div className="grid gap-4">
			<form
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					save();
				}}
			>
				<Input
					variant="secondary"
					fullWidth
					value={name}
					maxLength={80}
					aria-label={t`Name this version`}
					placeholder={t`Sent to Lumen`}
					onChange={(event) => setName(event.target.value)}
				/>
				<Button type="submit" variant="secondary" isDisabled={!name.trim() || busy}>
					<Trans>Save</Trans>
				</Button>
			</form>

			{selected && (
				<div role="status" className="grid gap-3 rounded-xl bg-accent-soft p-3 text-sm text-accent-soft-foreground">
					<span className="flex items-center gap-2 font-medium tabular-nums">
						<Icon name="clock-counter-clockwise" size={18} className="shrink-0" />
						<Trans>
							Viewing {when(selected)} · {getVersionTitle(selected)} · read-only
						</Trans>
					</span>
					<span className="flex flex-wrap gap-2">
						<Button size="sm" variant="secondary" isDisabled={source.locked || busy} onPress={() => restore(selected)}>
							<Trans>Restore this version</Trans>
						</Button>
						<Button size="sm" variant="ghost" onPress={() => useEditorStore.setState({ historyVersionId: null })}>
							<Trans>Back to now</Trans>
						</Button>
					</span>
				</div>
			)}

			<Timeline size="sm" density="compact" aria-label={t`Versions`}>
				<TimelineItem
					title={t`Now`}
					detail={source.nowDetail}
					selected={!selected}
					current
					onSelect={() => useEditorStore.setState({ historyVersionId: null })}
				/>
				{versions?.map((version) => (
					<TimelineItem
						key={version.id}
						title={getVersionTitle(version)}
						detail={`${when(version)} · ${getVersionDetail(version)}`}
						named={version.kind === "named"}
						selected={version.id === selectedId}
						onSelect={() => useEditorStore.setState({ historyVersionId: version.id })}
						menu={version.kind === "named" ? <NamedVersionMenu version={version} source={source} /> : null}
					/>
				))}
			</Timeline>

			{!loading && (versions?.length ?? 0) <= 1 && (
				<p className="text-sm text-muted">
					<Trans>Only one version so far. Every editing session adds one automatically.</Trans>
				</p>
			)}

			<p className="text-xs text-muted">
				<Trans>
					Autosaves are grouped by session and kept for 90 days. Named versions are kept until you delete them.
					Restoring saves the current state first.
				</Trans>
			</p>
		</div>
	);
}

type TimelineItemProps = {
	title: string;
	detail: string;
	selected: boolean;
	onSelect: () => void;
	current?: boolean;
	named?: boolean;
	menu?: React.ReactNode;
};

/** Now is the accent marker; the version on the page gets a full marker, the rest are muted. */
function TimelineItem({ title, detail, selected, onSelect, current, named, menu }: TimelineItemProps) {
	return (
		<Timeline.Item status={current ? "current" : selected ? "default" : "muted"}>
			<Timeline.Marker />
			<Timeline.Content>
				{/* Pulled up so the title lines up with the marker. */}
				<span
					className={cn(
						"group/version -mt-1 flex items-start rounded-xl transition-colors duration-quick",
						selected ? "bg-accent-soft text-accent-soft-foreground" : "hover:bg-default",
					)}
				>
					{/* A plain toggle row: HeroUI Button centres and clips its content, this row wraps a title and a detail. */}
					<button
						type="button"
						aria-pressed={selected}
						onClick={onSelect}
						className="flex min-w-0 flex-1 cursor-(--cursor-interactive) flex-col items-start gap-0.5 rounded-xl px-2.5 py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-focus"
					>
						<span className="flex max-w-full items-center gap-2">
							<span className="truncate text-sm font-semibold">{title}</span>
							{named && <Icon name="bookmark-simple" size={14} className="shrink-0 text-accent" />}
						</span>
						<span className="text-xs text-muted tabular-nums">{detail}</span>
					</button>
					{menu && <span className="p-1">{menu}</span>}
				</span>
			</Timeline.Content>
		</Timeline.Item>
	);
}

/** Named versions are the user's own: they can be renamed or deleted. The rest expire on their own. */
function NamedVersionMenu({ version, source }: { version: HistoryVersion; source: HistorySource }) {
	const prompt = usePrompt();
	const confirm = useConfirm();
	const selectedId = useEditorStore((state) => state.historyVersionId);
	const title = getVersionTitle(version);
	const failed = (error: unknown) => toast.add({ type: "error", description: source.errorMessage(error) });

	const rename = async () => {
		const name = (await prompt(t`Rename version`, { defaultValue: version.name ?? "" }))?.trim();
		if (!name || name === version.name) return;
		await source.rename(version.id, name).catch(failed);
	};

	const remove = async () => {
		const confirmed = await confirm(t`Delete “${title}”?`, {
			description: t`Named versions are kept until you delete them. This can't be undone.`,
			confirmText: t`Delete version`,
		});
		if (!confirmed) return;
		try {
			await source.remove(version.id);
			if (selectedId === version.id) useEditorStore.setState({ historyVersionId: null });
			toast.add({ description: t`Deleted “${title}”` });
		} catch (error) {
			failed(error);
		}
	};

	return (
		<Dropdown>
			<IconButton
				icon="dots-three"
				label={t`Options for ${title}`}
				size="sm"
				className="opacity-0 group-hover/version:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
			/>
			<Dropdown.Popover placement="bottom end" className="w-44">
				<Dropdown.Menu>
					<Dropdown.Item id="rename" textValue={t`Rename…`} onAction={() => void rename()}>
						<Icon name="pencil-simple" className="text-muted" />
						<Label>
							<Trans>Rename…</Trans>
						</Label>
					</Dropdown.Item>
					<Dropdown.Item id="delete" textValue={t`Delete`} variant="danger" onAction={() => void remove()}>
						<Icon name="trash" />
						<Label>
							<Trans>Delete</Trans>
						</Label>
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}
