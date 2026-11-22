// Above the List: search (role, company, contact), the stage chips with counts, then Sort, Tag and Show closed, as the
// web's list toolbar. Each chip row scrolls sideways.
import type { ListState } from "./use-list-state";
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { ScrollView, View } from "react-native";
import { LIST_ORDER } from "@rezumi/career/applications";
import { getStageLabel } from "../stages";
import { SortMenu, TagMenu } from "./list-menus";
import { Chip, Icon, SearchField, StageDot } from "@/ui";

type ListToolbarProps = { state: ListState };

export function ListToolbar({ state }: ListToolbarProps) {
	const { t } = useLingui();
	return (
		<View className="gap-3">
			<SearchField value={state.search} onChange={state.setSearch}>
				<SearchField.Group>
					<SearchField.SearchIcon />
					<SearchField.Input
						placeholder={t`Search role, company or contact`}
						accessibilityLabel={t`Search applications`}
						autoCorrect={false}
						testID="applications-search"
					/>
					<SearchField.ClearButton accessibilityLabel={t`Clear search`} />
				</SearchField.Group>
			</SearchField>
			<ChipRow label={t`Filter by stage`}>
				<FilterChip
					label={t`All · ${state.allCount}`}
					selected={state.stage === null}
					onPress={() => state.setStage(null)}
				/>
				{LIST_ORDER.map((status) => (
					<FilterChip
						key={status}
						label={`${getStageLabel(status)} · ${state.counts[status]}`}
						stage={status}
						selected={state.stage === status}
						onPress={() => state.setStage(state.stage === status ? null : status)}
					/>
				))}
			</ChipRow>
			<ChipRow label={t`Sort and filter`}>
				<SortMenu
					sort={state.sort}
					direction={state.direction}
					onSort={state.setSort}
					onDirection={state.setDirection}
				/>
				{state.tags.length > 0 ? <TagMenu tags={state.tags} tag={state.tag} onTag={state.setTag} /> : null}
				<FilterChip
					label={t`Show closed`}
					selected={state.showClosed}
					kind="switch"
					onPress={() => state.setShowClosed(!state.showClosed)}
				/>
			</ChipRow>
		</View>
	);
}

type ChipRowProps = { label: string; children: ReactNode };

function ChipRow({ label, children }: ChipRowProps) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			keyboardShouldPersistTaps="handled"
			className="-mx-4"
			contentContainerClassName="items-center gap-2 px-4"
			accessibilityLabel={label}
		>
			{children}
		</ScrollView>
	);
}

type FilterChipProps = {
	label: string;
	selected: boolean;
	onPress: () => void;
	stage?: ApplicationStatus | undefined;
	/** `switch` for an on/off filter (Show closed). */
	kind?: "button" | "switch" | undefined;
};

function FilterChip({ label, selected, onPress, stage, kind = "button" }: FilterChipProps) {
	return (
		<Chip
			variant={selected ? "primary" : "secondary"}
			color={selected ? "accent" : "default"}
			onPress={onPress}
			accessibilityRole={kind}
			accessibilityState={kind === "switch" ? { checked: selected } : { selected }}
			hitSlop={6}
		>
			{selected ? <Icon name="check" size={14} tone="accent-foreground" /> : stage ? <StageDot stage={stage} /> : null}
			<Chip.Label>{label}</Chip.Label>
		</Chip>
	);
}
