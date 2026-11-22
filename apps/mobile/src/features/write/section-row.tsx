// An outline row (the web's section-row.tsx): the handle, the title with its entry count (opens the section), the eye
// (hidden sections keep their content and place but aren't printed) and ⋯ for the section's options.
import type { OutlineRow } from "@/features/entries/model";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { useEditSection, useWriteSection } from "./hooks";
import { useSectionTitle } from "@/features/entries/hooks";
import { countEntriesToCheck, getEntries } from "@/features/entries/model";
import { useWriteData } from "@/features/entries/source";
import { Chip, Icon, IconButton, SortableHandle, Text, cx } from "@/ui";

type SectionRowProps = {
	row: OutlineRow;
	open: boolean;
	locked: boolean;
	onDrag: () => void;
	onToggle: () => void;
	/** Move up / Move down for screen readers (and the options sheet); none at the ends. */
	onMove: (direction: "up" | "down") => void;
	onOptions: () => void;
};

export function SectionRow({ row, open, locked, onDrag, onToggle, onMove, onOptions }: SectionRowProps) {
	const { t } = useLingui();
	const section = useWriteSection(row.id);
	const title = useSectionTitle(section);
	const count = useWriteData((data) => (section ? getEntries(data, section).length : 0), 0);
	// Dates read from text that wasn't exact ask for a look (they print as typed until then).
	const toCheck = useWriteData((data) => (section ? countEntriesToCheck(getEntries(data, section)) : 0), 0);
	const editSection = useEditSection();
	if (!section) return null;
	const hidden = row.hidden;
	const summary = section.kind === "summary";
	const countLabel = plural(count, { one: "# entry", other: "# entries" });

	return (
		<View
			className="mx-2 min-h-12 flex-row items-center rounded-xl"
			accessibilityActions={
				locked
					? undefined
					: [
							{ name: "up", label: t`Move up` },
							{ name: "down", label: t`Move down` },
						]
			}
			onAccessibilityAction={({ nativeEvent }) => {
				if (nativeEvent.actionName === "up" || nativeEvent.actionName === "down") onMove(nativeEvent.actionName);
			}}
			testID={`section-${row.id}`}
		>
			<SortableHandle label={t`Reorder ${title}`} isDisabled={locked} onDrag={onDrag} />
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={summary ? title : `${title}, ${countLabel}`}
				accessibilityState={summary ? undefined : { expanded: open }}
				onPress={onToggle}
				className="min-h-11 flex-1 flex-row items-center gap-2"
			>
				<Text
					weight="medium"
					numberOfLines={2}
					tone={hidden ? "muted" : "default"}
					className={cx("shrink", hidden && "line-through")}
				>
					{title}
				</Text>
				{summary ? null : (
					<Chip size="sm" variant="soft">
						<Chip.Label>{String(count)}</Chip.Label>
					</Chip>
				)}
				{toCheck > 0 ? (
					<Chip size="sm" variant="soft" color="warning">
						<Chip.Label>{plural(toCheck, { one: "# to check", other: "# to check" })}</Chip.Label>
					</Chip>
				) : null}
				{summary ? null : <Icon name={open ? "caret-down" : "caret-right"} size={16} tone="muted" />}
			</Pressable>
			<IconButton
				icon={hidden ? "eye-slash" : "eye"}
				label={hidden ? t`Show ${title} on the page` : t`Hide ${title} from the page`}
				isSelected={hidden}
				isDisabled={locked}
				onPress={() =>
					editSection(section, (target) => {
						target.hidden = !target.hidden;
					})
				}
			/>
			{locked ? null : <IconButton icon="dots-three" label={t`Options for ${title}`} onPress={onOptions} />}
		</View>
	);
}
