// A library document's menu, opened from its ⋯ button or a long press, as a sheet: Open, Copy public link, Rename,
// Duplicate, Copy for a job (resumes) or Link to application (letters), Tags, History (resumes), Lock or Unlock, then
// Move to Trash; in Trash, Restore and Delete forever. Rename, Tags and Link open as a step inside the same sheet.
// Every swipe action is here too.
import type { DocumentActions } from "./document-actions";
import type { DocumentSummary } from "./filter";
import type { IconName } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { View } from "react-native";
import { LinkPanel, RenamePanel, TagsPanel } from "./menu-panels";
import { usePublicLink } from "./public-link";
import { Button, ListRow, ListSection, Sheet, haptics, showToast } from "@/ui";

type Step = "menu" | "rename" | "tags" | "link";

type MenuEntry = {
	key: string;
	icon: IconName;
	label: string;
	onPress: () => void;
	disabled?: boolean;
	danger?: boolean;
};

type LibraryMenuProps = {
	document: DocumentSummary | null;
	actions: DocumentActions;
	onClose: () => void;
	/** Delete forever: the screen asks first. */
	onPurge: (document: DocumentSummary) => void;
};

export function LibraryMenu({ document, actions, onClose, onPurge }: LibraryMenuProps) {
	const { t } = useLingui();
	const [step, setStep] = useState<Step>("menu");
	const [shown, setShown] = useState(document);
	const [requested, setRequested] = useState(document);
	const url = usePublicLink(shown);
	// The sheet keeps the last document while it slides away, and opens on the menu each time.
	if (document !== requested) {
		setRequested(document);
		if (document) {
			setShown(document);
			setStep("menu");
		}
	}
	const close = () => {
		if (!actions.busy) onClose();
	};
	const closeThen = (run: () => unknown) => () => {
		onClose();
		void run();
	};
	const after = (task: Promise<boolean>) =>
		void task.then((done) => {
			if (done) onClose();
		});

	const titles: Record<Step, string> = {
		menu: shown?.name ?? "",
		rename: t`Rename`,
		tags: t`Tags`,
		link: t`Link to application`,
	};
	const locked = shown?.isLocked ?? false;
	const unlockFirst = locked ? t`Unlock it first` : undefined;
	const entries = (item: DocumentSummary): MenuEntry[] =>
		item.trashedAt
			? [
					{
						key: "restore",
						icon: "arrow-counter-clockwise",
						label: t`Restore`,
						onPress: () => after(actions.restore(item)),
					},
					{
						key: "purge",
						icon: "trash",
						label: t`Delete forever…`,
						danger: true,
						onPress: closeThen(() => onPurge(item)),
					},
				]
			: [
					{ key: "open", icon: "arrow-square-out", label: t`Open`, onPress: closeThen(() => actions.open(item)) },
					...(url
						? [
								{
									key: "copy-link",
									icon: "link-simple-horizontal",
									label: t`Copy public link`,
									onPress: () =>
										void Clipboard.setStringAsync(url).then(() => {
											haptics.light();
											showToast({ title: t`Link copied` });
											onClose();
										}),
								} satisfies MenuEntry,
							]
						: []),
					{
						key: "rename",
						icon: "pencil-simple",
						label: t`Rename…`,
						disabled: locked,
						onPress: () => setStep("rename"),
					},
					{ key: "duplicate", icon: "copy", label: t`Duplicate`, onPress: () => after(actions.duplicate(item)) },
					item.type === "resume"
						? {
								key: "copy-for-job",
								icon: "briefcase",
								label: t`Copy for a job…`,
								onPress: closeThen(() => actions.copyForJob(item)),
							}
						: {
								key: "link",
								icon: "briefcase",
								label: t`Link to application…`,
								disabled: locked,
								onPress: () => setStep("link"),
							},
					{ key: "tags", icon: "tag", label: t`Tags…`, disabled: locked, onPress: () => setStep("tags") },
					...(item.type === "resume"
						? [
								{
									key: "history",
									icon: "clock-counter-clockwise",
									label: t`History`,
									onPress: closeThen(() => actions.history(item)),
								} satisfies MenuEntry,
							]
						: []),
					locked
						? {
								key: "lock",
								icon: "lock-open",
								label: t`Unlock`,
								onPress: () => after(actions.setLocked(item, false)),
							}
						: {
								key: "lock",
								icon: "lock",
								label: t`Lock editing`,
								onPress: () => after(actions.setLocked(item, true)),
							},
					{
						key: "trash",
						icon: "trash",
						label: t`Move to Trash`,
						danger: true,
						disabled: locked,
						onPress: closeThen(() => actions.trash(item)),
					},
				];

	const list = shown ? entries(shown) : [];
	const dangerAt = list.findIndex((entry) => entry.danger);
	const groups = dangerAt < 0 ? [list] : [list.slice(0, dangerAt), list.slice(dangerAt)];

	return (
		<Sheet
			isOpen={document !== null}
			onOpenChange={(open) => {
				if (!open) close();
			}}
			title={titles[step]}
			closeLabel={t`Close`}
			canDismiss={!actions.busy}
			testID="document-menu"
		>
			{shown && step === "menu" ? (
				<View className="gap-4">
					{groups.map((group, index) =>
						group.length ? (
							<ListSection key={index}>
								{group.map((entry) => (
									<ListRow
										key={entry.key}
										icon={entry.icon}
										title={entry.label}
										tone={entry.danger ? "danger" : "default"}
										description={entry.disabled ? unlockFirst : undefined}
										isDisabled={actions.busy || entry.disabled}
										chevron={entry.key === "rename" || entry.key === "tags" || entry.key === "link"}
										onPress={entry.onPress}
										testID={`document-menu-${entry.key}`}
									/>
								))}
							</ListSection>
						) : null,
					)}
				</View>
			) : null}
			{shown && step !== "menu" ? (
				<View className="gap-2">
					{step === "rename" ? (
						<RenamePanel name={shown.name} busy={actions.busy} onSave={(name) => after(actions.rename(shown, name))} />
					) : null}
					{step === "tags" ? (
						<TagsPanel
							documents={[shown]}
							busy={actions.busy}
							onSave={(tags) => after(actions.setTags([shown], tags))}
						/>
					) : null}
					{step === "link" ? (
						<LinkPanel document={shown} busy={actions.busy} onLink={(id) => after(actions.link(shown, id))} />
					) : null}
					<Button variant="ghost" isDisabled={actions.busy} onPress={() => setStep("menu")}>
						<Button.Label>{t`Back`}</Button.Label>
					</Button>
				</View>
			) : null}
		</Sheet>
	);
}
