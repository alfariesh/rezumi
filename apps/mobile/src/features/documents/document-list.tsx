import type { DocumentItemHandlers } from "./document-item";
// The library's virtualized list (Legend List, recycled rows): 300 documents scroll without rendering them all.
// Rows on phones by default, cards in columns in the grid. Only items on screen draw their first page.
import type { DocumentSummary } from "./filter";
import type { LibraryView } from "./library-toolbar";
import type { LegendListProps } from "@legendapp/list/react-native";
import type { ReactElement } from "react";
import { LegendList } from "@legendapp/list/react-native";
import { useCallback, useState } from "react";
import { RefreshControl, View } from "react-native";
import { DocumentItem } from "./document-item";
import { documentKey } from "./filter";
import { isNewDocument, useNewDocuments } from "./new-documents";
import { space, usePullRefresh, useThemeColor } from "@/ui";

type DocumentListProps = {
	documents: DocumentSummary[];
	view: LibraryView;
	columns: number;
	busy: boolean;
	unsynced: ReadonlySet<string>;
	handlers: DocumentItemHandlers;
	header: ReactElement;
	/** Shown instead of rows: loading, empty and failed states. */
	empty: ReactElement | null;
	onRefresh: () => Promise<unknown>;
};

const viewabilityConfig = { itemVisiblePercentThreshold: 1 };
const content = { paddingHorizontal: space[4], paddingBottom: space[16] + space[4] };
const gridGaps = { columnGap: space[3], rowGap: space[4] };
const fill = { flex: 1 };
const separator = () => <View className="h-2" />;

export function DocumentList({
	documents,
	view,
	columns,
	busy,
	unsynced,
	handlers,
	header,
	empty,
	onRefresh,
}: DocumentListProps) {
	const accent = useThemeColor("accent");
	const pull = usePullRefresh(onRefresh);
	const ids = useNewDocuments((state) => state.ids);
	const [visible, setVisible] = useState<ReadonlySet<string>>(() => new Set());
	const onViewableItemsChanged = useCallback<NonNullable<LegendListProps<DocumentSummary>["onViewableItemsChanged"]>>(
		({ viewableItems }) => {
			setVisible(new Set(viewableItems.filter((token) => token.isViewable).map((token) => token.key)));
		},
		[],
	);
	const grid = view === "grid";
	return (
		<LegendList
			key={grid ? `grid-${columns}` : "list"}
			data={empty ? [] : documents}
			keyExtractor={documentKey}
			numColumns={grid ? columns : 1}
			estimatedItemSize={grid ? 260 : 80}
			recycleItems
			extraData={visible}
			viewabilityConfig={viewabilityConfig}
			onViewableItemsChanged={onViewableItemsChanged}
			ListHeaderComponent={header}
			{...(empty ? { ListEmptyComponent: empty } : {})}
			{...(grid ? { columnWrapperStyle: gridGaps } : { ItemSeparatorComponent: separator })}
			contentContainerStyle={content}
			keyboardShouldPersistTaps="handled"
			keyboardDismissMode="on-drag"
			refreshControl={<RefreshControl {...pull} tintColor={accent} colors={[accent]} />}
			style={fill}
			testID="document-list"
			renderItem={({ item }) => (
				<DocumentItem
					document={item}
					layout={view}
					visible={visible.has(documentKey(item))}
					isNew={isNewDocument(ids, item)}
					unsynced={unsynced.has(documentKey(item))}
					busy={busy}
					handlers={handlers}
				/>
			)}
		/>
	);
}
