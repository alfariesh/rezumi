// An entry under an open section (the web's entry-card.tsx, closed): the handle, its title with Draft / Hidden /
// To check, "company · location · dates" and ⋯. Tapping it opens the entry full screen.
import type { FlatRow } from "@/features/entries/model";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { profileSectionOf } from "@rezumi/resume/profile-link";
import { useWriteSection } from "./hooks";
import { ProfileMarker } from "./profile-link";
import { useEntry } from "@/features/entries/hooks";
import { countEntriesToCheck, describeEntry, isDraftEntry } from "@/features/entries/model";
import { Chip, IconButton, SortableHandle, Text, cx } from "@/ui";

type EntryRowProps = {
	row: Extract<FlatRow, { kind: "entry" }>;
	locked: boolean;
	onDrag: () => void;
	onOpen: () => void;
	onMove: (to: number) => void;
	onOptions: () => void;
};

export function EntryRow({ row, locked, onDrag, onOpen, onMove, onOptions }: EntryRowProps) {
	const { t } = useLingui();
	const section = useWriteSection(row.sectionId);
	const entry = useEntry(row.sectionId, row.entryId);
	if (!section || !entry) return null;
	const { title, meta } = describeEntry(section.type, entry);
	const name = title || t`Untitled`;
	const toCheck = countEntriesToCheck([entry]) > 0;
	const linked = profileSectionOf(section);

	return (
		<View
			className={cx(
				"ms-8 me-4 my-0.5 min-h-14 flex-row items-center rounded-xl border border-border bg-surface",
				entry.hidden && "opacity-60",
			)}
			accessibilityActions={
				locked
					? undefined
					: [
							...(row.index > 0 ? [{ name: "up", label: t`Move up` }] : []),
							...(row.index < row.count - 1 ? [{ name: "down", label: t`Move down` }] : []),
						]
			}
			onAccessibilityAction={({ nativeEvent }) => {
				if (nativeEvent.actionName === "up") onMove(row.index - 1);
				if (nativeEvent.actionName === "down") onMove(row.index + 1);
			}}
			testID={`entry-${row.entryId}`}
		>
			<SortableHandle label={t`Reorder ${name}`} isDisabled={locked} onDrag={onDrag} />
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t`${name}, entry ${row.index + 1} of ${row.count}`}
				onPress={onOpen}
				className="min-h-11 flex-1 justify-center gap-0.5 py-2"
			>
				<View className="flex-row flex-wrap items-center gap-1">
					<Text weight="medium" numberOfLines={1} tone={title ? "default" : "muted"} className="shrink">
						{name}
					</Text>
					{isDraftEntry(section.type, entry) ? (
						<Chip size="sm" variant="soft">
							<Chip.Label>{t`Draft`}</Chip.Label>
						</Chip>
					) : null}
					{entry.hidden ? (
						<Chip size="sm" variant="soft">
							<Chip.Label>{t`Hidden`}</Chip.Label>
						</Chip>
					) : null}
					{toCheck ? (
						<Chip size="sm" variant="soft" color="warning">
							<Chip.Label>{t`To check`}</Chip.Label>
						</Chip>
					) : null}
				</View>
				{meta ? (
					<Text size="xs" tone="muted" numberOfLines={1}>
						{meta}
					</Text>
				) : null}
			</Pressable>
			{linked ? <ProfileMarker part={{ kind: "item", section: linked, id: row.entryId }} /> : null}
			{locked ? null : <IconButton icon="dots-three" label={t`Options for ${name}`} onPress={onOptions} />}
		</View>
	);
}
