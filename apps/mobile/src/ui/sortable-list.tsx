// A vertical list whose rows reorder by dragging a handle (react-native-reorderable-list on Reanimated). The lifted
// row scales a little and floats on the overlay shadow; the others slide with `motion.standard`. Reduced motion: no
// scale, rows jump. Dragging is not available to screen readers: each row offers its own Move up / Move down actions.
import type { ReactElement } from "react";
import { Pressable, View } from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";
import ReorderableList, { reorderItems, useIsActive, useReorderableDrag } from "react-native-reorderable-list";
import { cx } from "./cx";
import { Icon } from "./icon";
import { haptics, useReducedMotion } from "./motion";
import { motion, size } from "./tokens";

export type SortableItemInfo<T> = {
	item: T;
	index: number;
	/** Starts dragging this row; `SortableHandle` calls it on a long press. */
	drag: () => void;
	/** This row is being dragged. */
	isActive: boolean;
};

export type SortableListProps<T> = {
	data: readonly T[];
	keyExtractor: (item: T) => string;
	renderItem: (info: SortableItemInfo<T>) => ReactElement;
	/** Receives the rows in their new order after a drop, and where the dragged row went. */
	onReorder: (data: T[], move: { from: number; to: number }) => void;
	ListHeaderComponent?: ReactElement | undefined;
	ListFooterComponent?: ReactElement | undefined;
	testID?: string | undefined;
};

type CellProps<T> = { item: T; index: number; renderItem: SortableListProps<T>["renderItem"] };

function Cell<T>({ item, index, renderItem }: CellProps<T>) {
	const drag = useReorderableDrag();
	const isActive = useIsActive();
	return (
		<View className={cx(isActive && "rounded-xl bg-overlay shadow-overlay")}>
			{renderItem({
				item,
				index,
				isActive,
				drag: () => {
					haptics.medium();
					drag();
				},
			})}
		</View>
	);
}

export function SortableList<T>({ data, keyExtractor, renderItem, onReorder, ...props }: SortableListProps<T>) {
	const reduced = useReducedMotion();
	const scale = useSharedValue(1);
	const lifted = reduced ? 1 : 1.02;

	return (
		<ReorderableList
			// The list never changes the rows; the library types them as mutable.
			data={data as T[]}
			keyExtractor={keyExtractor}
			renderItem={({ item, index }) => <Cell item={item} index={index} renderItem={renderItem} />}
			onReorder={({ from, to }) => onReorder(reorderItems([...data], from, to), { from, to })}
			shouldUpdateActiveItem
			keyboardShouldPersistTaps="handled"
			animationDuration={reduced ? 0 : motion.standard}
			cellAnimations={{ opacity: 1, transform: [{ scale }] }}
			onDragStart={() => {
				"worklet";
				scale.set(withTiming(lifted, { duration: motion.quick }));
			}}
			onDragEnd={() => {
				"worklet";
				scale.set(withTiming(1, { duration: motion.standard }));
			}}
			{...props}
		/>
	);
}

export type SortableHandleProps = {
	/** "Reorder Experience": read by screen readers, which move rows with the row's own actions instead. */
	label: string;
	onDrag: () => void;
	isDisabled?: boolean | undefined;
};

/** ⋮⋮ beside a row: hold to lift it. A 44 pt target. */
export function SortableHandle({ label, onDrag, isDisabled = false }: SortableHandleProps) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: isDisabled }}
			disabled={isDisabled}
			delayLongPress={250}
			onLongPress={onDrag}
			hitSlop={{ left: 4, right: 4 }}
			className={cx("h-11 w-8 items-center justify-center", isDisabled && "opacity-40")}
		>
			<Icon name="dots-six-vertical" size={size.icon.md} tone="muted" />
		</Pressable>
	);
}
