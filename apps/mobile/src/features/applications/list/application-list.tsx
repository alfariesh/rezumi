// The List's virtualized rows (Legend List, recycled): stage group headers and applications in one flat list, so 300
// applications scroll without rendering them all. Pull to refresh; rows coming into view load their details ahead.
import type { RowHandlers } from "./list-row";
import type { ListItem } from "./use-list-state";
import type { LegendListProps } from "@legendapp/list/react-native";
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import type { ReactElement } from "react";
import { LegendList } from "@legendapp/list/react-native";
import { useCallback } from "react";
import { RefreshControl, View } from "react-native";
import { ApplicationRow, GroupHeader } from "./list-row";
import { space, usePullRefresh, useThemeColor } from "@/ui";

type ApplicationListProps = {
	items: ListItem[];
	header: ReactElement;
	/** Shown instead of rows: loading, empty and failed states. */
	empty: ReactElement | null;
	handlers: RowHandlers;
	selecting: boolean;
	selectedIds: readonly string[];
	currentId: string | null;
	timeZone: string;
	now: Date;
	onToggleGroup: (status: ApplicationStatus) => void;
	onRefresh: () => Promise<unknown>;
	onVisible: (ids: string[]) => void;
};

const viewabilityConfig = { itemVisiblePercentThreshold: 30 };
const content = { paddingHorizontal: space[4], paddingBottom: space[16] };
const fill = { flex: 1 };
const separator = () => <View className="h-2" />;

export function ApplicationList(props: ApplicationListProps) {
	const { items, header, empty, handlers, selecting, selectedIds, currentId, timeZone, now } = props;
	const { onToggleGroup, onRefresh, onVisible } = props;
	const accent = useThemeColor("accent");
	const pull = usePullRefresh(onRefresh);
	const onViewableItemsChanged = useCallback<NonNullable<LegendListProps<ListItem>["onViewableItemsChanged"]>>(
		({ viewableItems }) =>
			onVisible(
				viewableItems.flatMap((token) =>
					token.isViewable && token.item?.type === "row" ? [token.item.application.id] : [],
				),
			),
		[onVisible],
	);
	return (
		<LegendList
			data={empty ? [] : items}
			keyExtractor={(item) => item.key}
			getItemType={(item) => item.type}
			estimatedItemSize={96}
			recycleItems
			extraData={{ selecting, selectedIds, currentId, timeZone, now }}
			viewabilityConfig={viewabilityConfig}
			onViewableItemsChanged={onViewableItemsChanged}
			ListHeaderComponent={header}
			{...(empty ? { ListEmptyComponent: empty } : {})}
			ItemSeparatorComponent={separator}
			contentContainerStyle={content}
			keyboardShouldPersistTaps="handled"
			keyboardDismissMode="on-drag"
			refreshControl={<RefreshControl {...pull} tintColor={accent} colors={[accent]} />}
			style={fill}
			testID="application-list"
			renderItem={({ item }) =>
				item.type === "header" ? (
					<GroupHeader status={item.status} count={item.count} collapsed={item.collapsed} onToggle={onToggleGroup} />
				) : (
					<ApplicationRow
						application={item.application}
						handlers={handlers}
						selecting={selecting}
						selected={selectedIds.includes(item.application.id)}
						current={currentId === item.application.id}
						timeZone={timeZone}
						now={now}
					/>
				)
			}
		/>
	);
}
