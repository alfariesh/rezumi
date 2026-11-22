// One saved item: its kind, when, what it used; tap to expand the summary; Open in the part that made it (read-only),
// or in Offers; delete with an Undo toast.
import type { SavedItem } from "../queries";
import type { WorkspaceTab } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { ActionButton, Block } from "../blocks";
import { useFacts } from "../queries";
import { partLabel, savedKindLabel } from "../working";
import { KINDS, sourcesOf, summaryOf } from "./summary";
import { useUserTime } from "@/features/applications/date";
import { routes } from "@/routes";
import { Icon, IconButton, Text, Typography } from "@/ui";

type SavedRowProps = {
	item: SavedItem;
	applicationId: string;
	expanded: boolean;
	onToggle: () => void;
	onOpen: (tab: WorkspaceTab) => void;
	onDelete: () => void;
};

export function SavedRow({ item, applicationId, expanded, onToggle, onOpen, onDelete }: SavedRowProps) {
	const { t } = useLingui();
	const router = useRouter();
	const { when, locale } = useUserTime();
	const facts = useFacts(applicationId);
	const meta = KINDS.find(({ kind }) => kind === item.data.kind) ?? KINDS[0];
	const used = sourcesOf(item);
	const usedFacts = item.evidence.factIds.flatMap((id) => facts.data?.find((fact) => fact.id === id)?.text ?? []);
	const tab = meta?.tab ?? null;
	const tabName = tab ? partLabel(tab) : "";
	const subtitle = [savedKindLabel(item.data.kind), when(item.createdAt), used ? t`used ${used}` : ""]
		.filter(Boolean)
		.join(" · ");

	return (
		<Block testID={`saved-item-${item.id}`}>
			<View className="flex-row items-start gap-3">
				<View className="size-10 items-center justify-center rounded-xl bg-surface-secondary">
					<Icon name={meta?.icon ?? "file-text"} tone="muted" />
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ expanded }}
					accessibilityLabel={`${item.title}, ${subtitle}`}
					onPress={onToggle}
					className="min-h-11 flex-1 gap-0.5"
				>
					<Text weight="semibold">{item.title}</Text>
					<Text size="xs" tone="muted">
						{subtitle}
					</Text>
				</Pressable>
				<IconButton icon="trash" size="sm" label={t`Delete ${item.title}`} onPress={onDelete} />
			</View>
			{expanded ? (
				<View className="gap-2">
					<Typography type="body-sm" color="muted">
						{summaryOf(item, locale)}
					</Typography>
					{usedFacts.map((text) => (
						<Text key={text} size="xs" tone="muted">{`· ${text}`}</Text>
					))}
				</View>
			) : null}
			{tab ? (
				<ActionButton label={t`Open in ${tabName}`} onPress={() => onOpen(tab)} />
			) : (
				<ActionButton label={t`Open in Offers`} onPress={() => router.push(routes.offers())} />
			)}
		</Block>
	);
}
