// The editor's top bar (plans/mobile Phase 07 step 8): Back, the document name that renames in place with the save
// state under it, undo and redo, the screen's actions, Download and the document menu. Tablets add the mode switch
// in the middle.
import type { SaveStatusSlot } from "./slots";
import type { IconName, ThemeColor } from "@/ui";
import type { SaveStatus } from "@rezumi/resume/draft";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { slot } from "./slots";
import { Alert, EditableTitle, Icon, IconButton, Spinner, Text } from "@/ui";

type EditorTopBarProps = {
	/** Shown until a screen sets `title`. */
	fallbackTitle: string;
	onBack: () => void;
	/** Download unless a screen sets `onExport`; no button when neither is set. */
	onExport?: (() => void) | undefined;
	/** Tablets: the mode switch in the middle of the bar. */
	center?: ReactNode;
	/** Pads the status bar (phones: the bar is each pane's header; tablets: one bar over the split). */
	safeTop: boolean;
};

export function EditorTopBar({ fallbackTitle, onBack, onExport, center, safeTop }: EditorTopBarProps) {
	const { t } = useLingui();
	const insets = useSafeAreaInsets();
	const slots = slot.useSlot();
	const title = slots.title ?? fallbackTitle;
	const locked = slots.save?.locked ?? false;
	const exportDocument = slots.onExport ?? onExport;
	const barStyle = { paddingTop: safeTop ? insets.top : 0 };

	return (
		<View className="bg-background">
			<View className="min-h-14 flex-row items-center gap-1 px-2 pb-1" style={barStyle}>
				<IconButton icon="arrow-left" label={t`Back to Documents`} onPress={onBack} testID="editor-back" />
				{slots.onRename ? (
					<EditableTitle
						value={title}
						onSubmit={slots.onRename}
						isDisabled={locked}
						accessibilityLabel={t`Document name`}
						accessibilityHint={t`Renames the document`}
						subtitle={slots.save ? <SaveStatusLine {...slots.save} /> : null}
					/>
				) : (
					<View className="min-w-0 flex-1 justify-center">
						<Text weight="semibold" size="base" numberOfLines={1}>
							{title}
						</Text>
						{slots.save ? <SaveStatusLine {...slots.save} /> : null}
					</View>
				)}
				{center ? <View className="flex-1 items-center">{center}</View> : null}
				<View className="flex-row items-center">
					{slots.history ? (
						<>
							<IconButton
								icon="arrow-u-up-left"
								label={t`Undo`}
								size="sm"
								isDisabled={!slots.history.canUndo || locked}
								onPress={slots.history.onUndo}
								testID="editor-undo"
							/>
							<IconButton
								icon="arrow-u-up-right"
								label={t`Redo`}
								size="sm"
								isDisabled={!slots.history.canRedo || locked}
								onPress={slots.history.onRedo}
								testID="editor-redo"
							/>
						</>
					) : null}
					{slots.actions}
					{exportDocument ? (
						<IconButton icon="download-simple" label={t`Download & history`} size="sm" onPress={exportDocument} />
					) : null}
					{slots.onMenu ? (
						<IconButton
							icon="dots-three-vertical"
							label={t`Document menu`}
							size="sm"
							onPress={slots.onMenu}
							testID="editor-menu"
						/>
					) : null}
				</View>
			</View>
			{slots.save?.status === "offline" ? (
				<View className="px-4 pb-2">
					<Alert status="warning">
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Description>
								{t`You can keep editing. Changes sync when you're back online. PDF sharing works with cached fonts and images.`}
							</Alert.Description>
						</Alert.Content>
					</Alert>
				</View>
			) : null}
			{slots.banner}
		</View>
	);
}

const look = {
	saving: { icon: null, tone: "muted" },
	saved: { icon: "cloud-check", tone: "muted" },
	idle: { icon: "cloud-check", tone: "muted" },
	offline: { icon: "cloud-slash", tone: "warning" },
	error: { icon: "cloud-warning", tone: "danger" },
} as const satisfies Record<SaveStatus, { icon: IconName | null; tone: "muted" | "warning" | "danger" }>;

const iconTone = { muted: "muted", warning: "warning", danger: "danger" } as const satisfies Record<string, ThemeColor>;

/** The line under the document name, worded like the web's `save-status.tsx`. */
export function SaveStatusLine({ status, locked, onRetry }: SaveStatusSlot) {
	const { t } = useLingui();
	const shown = locked ? ({ icon: "lock", tone: "muted" } as const) : look[status];
	const label = locked
		? t`Locked`
		: {
				saving: t`Saving…`,
				saved: t`Saved`,
				idle: t`Saved`,
				offline: t`Offline · saved on this device`,
				error: t`Not saved`,
			}[status];

	return (
		<View accessibilityLiveRegion="polite" className="min-w-0 flex-row items-center gap-1" testID="save-status">
			{shown.icon ? (
				<Icon name={shown.icon} size={14} tone={iconTone[shown.tone]} />
			) : (
				<Spinner size="sm" color="default" />
			)}
			<Text size="xs" tone={shown.tone === "muted" ? "muted" : shown.tone} numberOfLines={1} className="shrink">
				{label}
			</Text>
			{!locked && status === "error" && onRetry ? (
				<Pressable accessibilityRole="button" accessibilityLabel={t`Retry saving`} hitSlop={12} onPress={onRetry}>
					<Text size="xs" weight="semibold" tone="accent">
						{t`Retry`}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}
