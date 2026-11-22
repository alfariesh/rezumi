// Saved (web workspace/saved.tsx, W18): everything the coach wrote for this job, newest first, each opening read-only
// in the part that made it.
import type { WorkspacePartProps } from "../part";
import type { SavedItem } from "../queries";
import type { SavedItemKind } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { ActionButton, Caption, FirstRun } from "../blocks";
import { useSavedItems } from "../queries";
import { dispatchForOrigin } from "../state";
import { savedKindLabel } from "../working";
import { SavedRow } from "./saved-row";
import { KINDS } from "./summary";
import { client, orpc } from "@/api/client";
import { getDraftScope } from "@/draft";
import { withUndo } from "@/features/career/undo";
import { Chip, Skeleton, showToast } from "@/ui";

export function SavedPart({ application, go }: WorkspacePartProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const saved = useSavedItems(application.id);
	const [filter, setFilter] = useState<SavedItemKind | null>(null);
	const [hidden, setHidden] = useState<string[]>([]);
	const [expanded, setExpanded] = useState<string | null>(null);
	const company = application.company;

	if (saved.isPending) return <Skeleton variant="none" className="h-60 rounded-2xl" />;

	const items = (saved.data ?? []).filter((item) => !hidden.includes(item.id));
	const present = KINDS.filter(({ kind }) => items.some((item) => item.data.kind === kind));
	const shown = items.filter((item) => filter === null || item.data.kind === filter);

	if (items.length === 0)
		return (
			<FirstRun
				title={t`Nothing saved yet`}
				description={t`Fit checks, briefings, practice feedback, debriefs, answers and replies land here as the other parts create them.`}
				testID="saved-empty"
			>
				<ActionButton size="md" label={t`Check fit`} onPress={() => go("fit")} />
			</FirstRun>
		);

	const onDelete = (item: SavedItem) => {
		if (filter === item.data.kind && shown.length === 1) setFilter(null);
		setHidden((ids) => [...ids, item.id]);
		const origin = getDraftScope();
		withUndo({
			message: t`Deleted from Saved`,
			restore: () => setHidden((ids) => ids.filter((id) => id !== item.id)),
			failed: () => showToast({ title: t`Couldn't delete it. It's back in Saved.`, variant: "danger" }),
			// Dropped if another account is signed in when the Undo window ends.
			commit: () =>
				dispatchForOrigin(origin, getDraftScope, async () => {
					await client.career.deleteSavedItem({ id: item.id });
					await queryClient.invalidateQueries({ queryKey: orpc.career.savedItems.key() });
				}),
		});
	};
	const filters: { kind: SavedItemKind | null; label: string }[] = [
		{ kind: null, label: t`All` },
		...present.map(({ kind }) => ({ kind, label: savedKindLabel(kind) })),
	];

	return (
		<View className="gap-4">
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
				{filters.map((option) => {
					const selected = filter === option.kind;
					return (
						<Chip
							key={option.kind ?? "all"}
							variant={selected ? "primary" : "secondary"}
							color={selected ? "accent" : "default"}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							onPress={() => setFilter(option.kind)}
						>
							<Chip.Label>{option.label}</Chip.Label>
						</Chip>
					);
				})}
			</ScrollView>
			<Caption>{t`Everything the coach wrote for ${company}, newest first.`}</Caption>
			{shown.map((item) => (
				<SavedRow
					key={item.id}
					item={item}
					applicationId={application.id}
					expanded={expanded === item.id}
					onToggle={() => setExpanded((current) => (current === item.id ? null : item.id))}
					onOpen={(tab) => go(tab, { version: item.id })}
					onDelete={() => onDelete(item)}
				/>
			))}
		</View>
	);
}
