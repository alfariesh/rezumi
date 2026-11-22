// One document in the library: a row (small page, name, "Resume · Edited 2 hours ago", badges, ⋯) with swipe actions,
// or a grid card (the real first page, name, meta, ⋯). A tap opens the editor (a trashed document's menu instead),
// a long press opens the menu. Every swipe action also lives in the menu.
import type { DocumentSummary } from "./filter";
import type { SwipeAction } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import { memo } from "react";
import { Pressable, View } from "react-native";
import { documentMeta } from "./meta";
import { Thumbnail } from "./thumbnail";
import { Chip, Icon, IconButton, SwipeableRow, Text, cx, haptics } from "@/ui";

export type DocumentItemHandlers = {
	onOpen: (document: DocumentSummary) => void;
	onMenu: (document: DocumentSummary) => void;
	onTrash: (document: DocumentSummary) => void;
	onDuplicate: (document: DocumentSummary) => void;
	onRestore: (document: DocumentSummary) => void;
	onPurge: (document: DocumentSummary) => void;
};

type DocumentItemProps = {
	document: DocumentSummary;
	layout: "list" | "grid";
	/** On screen: only visible items draw their first page. */
	visible: boolean;
	isNew: boolean;
	/** Edits on this device not yet saved to the server. */
	unsynced: boolean;
	busy: boolean;
	handlers: DocumentItemHandlers;
};

export const DocumentItem = memo(function DocumentItem(props: DocumentItemProps) {
	return props.layout === "grid" ? <DocumentCard {...props} /> : <DocumentRow {...props} />;
});

function useItem({ document, handlers }: DocumentItemProps) {
	const { t, i18n } = useLingui();
	return {
		meta: documentMeta(document, i18n.locale),
		press: () => (document.trashedAt ? handlers.onMenu(document) : handlers.onOpen(document)),
		longPress: () => {
			haptics.light();
			handlers.onMenu(document);
		},
		menuLabel: t`Options for ${document.name}`,
		hint: document.trashedAt ? t`Opens Restore and Delete forever` : t`Opens the document. Long press for options.`,
	};
}

type BadgesProps = Pick<DocumentItemProps, "document" | "isNew" | "unsynced">;

function Badges({ document, isNew, unsynced }: BadgesProps) {
	const { t } = useLingui();
	if (!isNew && !unsynced && !document.isPublic && !document.isLocked && !document.application) return null;
	return (
		<View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
			{isNew && !document.trashedAt ? (
				<Chip size="sm" color="accent" variant="primary">
					<Chip.Label>{t`New`}</Chip.Label>
				</Chip>
			) : null}
			{unsynced ? <Text size="xs" tone="warning">{t`Unsynced on this device`}</Text> : null}
			{document.isPublic ? <Badge icon="globe" label={t`Public`} /> : null}
			{document.isLocked ? <Badge icon="lock" label={t`Locked`} /> : null}
			{document.application ? <Badge icon="briefcase" label={document.application.company} /> : null}
		</View>
	);
}

type BadgeProps = { icon: "globe" | "lock" | "briefcase"; label: string };

function Badge({ icon, label }: BadgeProps) {
	return (
		<View className="max-w-full flex-row items-center gap-1">
			<Icon name={icon} size={14} tone="muted" />
			<Text size="xs" tone="muted" numberOfLines={1} className="shrink">
				{label}
			</Text>
		</View>
	);
}

function DocumentRow(props: DocumentItemProps) {
	const { document, visible, busy, handlers } = props;
	const { t } = useLingui();
	const item = useItem(props);
	const actions: SwipeAction[] = document.trashedAt
		? [
				{
					key: "restore",
					label: t`Restore`,
					icon: "arrow-counter-clockwise",
					variant: "accent",
					onPress: () => handlers.onRestore(document),
				},
				{ key: "purge", label: t`Delete`, icon: "trash", variant: "danger", onPress: () => handlers.onPurge(document) },
			]
		: [
				...(document.isLocked
					? []
					: [
							{
								key: "trash",
								label: t`Trash`,
								icon: "trash",
								variant: "danger",
								onPress: () => handlers.onTrash(document),
							} satisfies SwipeAction,
						]),
				{ key: "duplicate", label: t`Duplicate`, icon: "copy", onPress: () => handlers.onDuplicate(document) },
			];
	return (
		<SwipeableRow
			variant="inline"
			actions={actions}
			fullSwipe={!document.isLocked}
			isDisabled={busy}
			openActionsLabel={t`Show actions`}
			closeActionsLabel={t`Hide actions`}
			testID={`document-row-${document.id}`}
		>
			<View className={cx("flex-row items-center gap-1 bg-surface pe-2", document.trashedAt && "opacity-80")}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${document.name}, ${item.meta}`}
					accessibilityHint={item.hint}
					onPress={item.press}
					onLongPress={item.longPress}
					className="min-h-18 flex-1 flex-row items-center gap-3 py-3 ps-4"
					testID={`document-${document.id}`}
				>
					<Thumbnail document={document} visible={visible} compact />
					<View className="min-w-0 flex-1 gap-0.5">
						<Text weight="medium" numberOfLines={1}>
							{document.name}
						</Text>
						<Text size="xs" tone="muted" numberOfLines={1}>
							{item.meta}
						</Text>
						<Badges {...props} />
					</View>
				</Pressable>
				<IconButton icon="dots-three" label={item.menuLabel} onPress={() => handlers.onMenu(document)} />
			</View>
		</SwipeableRow>
	);
}

function DocumentCard(props: DocumentItemProps) {
	const { document, visible, handlers } = props;
	const item = useItem(props);
	return (
		<View className={cx("gap-2", document.trashedAt && "opacity-80")} testID={`document-card-${document.id}`}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${document.name}, ${item.meta}`}
				accessibilityHint={item.hint}
				onPress={item.press}
				onLongPress={item.longPress}
				className="active:opacity-80"
				testID={`document-${document.id}`}
			>
				<Thumbnail document={document} visible={visible} />
			</Pressable>
			<View className="flex-row items-start gap-1">
				<View className="min-w-0 flex-1 gap-0.5 ps-1">
					<Text weight="medium" numberOfLines={1}>
						{document.name}
					</Text>
					<Text size="xs" tone="muted" numberOfLines={1}>
						{item.meta}
					</Text>
					<Badges {...props} />
				</View>
				<IconButton icon="dots-three" label={item.menuLabel} onPress={() => handlers.onMenu(document)} />
			</View>
		</View>
	);
}
