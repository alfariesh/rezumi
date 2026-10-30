import type { ReactNode, RefObject } from "react";
import type { DragPreviewRenderer } from "react-aria";
import { createContext, use, useCallback, useId, useRef, useState } from "react";
import { DragPreview, mergeProps, useButton, useDrag, useDrop } from "react-aria";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

/**
 * Reordering by drag, built on React Aria's drag and drop: pointer and touch drags, and the same drag from the
 * keyboard (Enter on a handle, then the arrow keys between targets, Enter to drop, Escape to cancel) with screen
 * reader announcements. Lists that also have ⌥↑ / ⌥↓ or a menu keep them; those are the shortcuts, this is the drag.
 *
 * A `SortableProvider` owns one kind of drag: items only drop on items of the same provider. Inside it, each item
 * calls `useSortableItem` with the list it is in and its position there; a container that can also take items when
 * it is empty calls `useSortableDropZone`.
 */

/** Where an item sits, or is going to: a list and an index in it. */
type Place = { list: string; index: number };
type Dragging = Place & { id: string };

/** The target of a move. `overId` is the item dropped on, or null when the drop was on the list itself. */
export type SortableTarget = Place & { overId: string | null };

type SortableContextValue = {
	type: string;
	dragging: Dragging | null;
	draggingRef: RefObject<Dragging | null>;
	setDragging: (value: Dragging | null) => void;
	onMove: (id: string, target: SortableTarget) => void;
	preview: RefObject<DragPreviewRenderer | null>;
};

const SortableContext = createContext<SortableContextValue | null>(null);

function useSortableContext() {
	const context = use(SortableContext);
	if (!context) throw new Error("Sortable items must be rendered inside a SortableProvider.");
	return context;
}

type SortableProviderProps = {
	/**
	 * Moves `id` to `target.index` of `target.list`: within the same list that is where the item ends up (like moving
	 * an array element), from another list it is the position it is inserted at. A drop on an empty list's zone is
	 * the list's length, with `overId` null.
	 */
	onMove: (id: string, target: SortableTarget) => void;
	/** What follows the pointer while dragging; the label by default. */
	renderPreview?: (label: string) => ReactNode;
	children: ReactNode;
};

export function SortableProvider({ onMove, renderPreview, children }: SortableProviderProps) {
	// Drag types are lower-cased by the browser, so keep the generated one to [a-z0-9].
	const type = `application/x-sortable-${useId()
		.replaceAll(/[^a-z0-9]/gi, "")
		.toLowerCase()}`;
	const [dragging, setDraggingState] = useState<Dragging | null>(null);
	// The drop reads who is being dragged in the same event turn the drag started in, before state has re-rendered.
	const draggingRef = useRef<Dragging | null>(null);
	const preview = useRef<DragPreviewRenderer>(null);

	const setDragging = (value: Dragging | null) => {
		draggingRef.current = value;
		setDraggingState(value);
	};

	return (
		<SortableContext value={{ type, dragging, draggingRef, setDragging, onMove, preview }}>
			{children}
			<DragPreview ref={preview}>
				{(items) => {
					const label = items[0]?.["text/plain"] ?? "";
					return renderPreview ? (
						<div>{renderPreview(label)}</div>
					) : (
						<div className="inline-flex max-w-64 items-center truncate rounded-xl bg-overlay px-3 py-2 text-sm font-medium shadow-overlay">
							{label}
						</div>
					);
				}}
			</DragPreview>
		</SortableContext>
	);
}

type SortableItemOptions = {
	id: string;
	/** The list the item is in, and its index there. */
	list: string;
	index: number;
	/** Names the item in the drag preview. */
	label: string;
	isDisabled?: boolean;
	/** True when a separate `SortableHandle` starts the drag; false when the whole item is the handle. */
	hasHandle?: boolean;
};

type SortableItem = ReturnType<typeof useSortableItem>;

/** The element that takes drops: a ref for `useDrop`, and a callback ref to hand the element to it. */
function useDropTarget() {
	const ref = useRef<HTMLDivElement | null>(null);
	const attach = useCallback((node: HTMLDivElement | null) => {
		ref.current = node;
	}, []);
	return { ref, attach };
}

/**
 * Makes an element a sortable item. Spread `dropTargetProps` on the element that takes drops (the whole row, so
 * hovering anywhere over it works), `<SortableHandle>` where the drag starts, and `<SortableEdge edge={edge}>` inside
 * the row (which must be `relative`) to show where a drop would land. With `hasHandle={false}`, spread `dragProps`
 * on the element instead; it must be focusable.
 */
export function useSortableItem({ id, list, index, label, isDisabled = false, hasHandle = true }: SortableItemOptions) {
	const sortable = useSortableContext();
	const { ref, attach } = useDropTarget();

	const { dragProps, dragButtonProps, isDragging } = useDrag({
		hasDragButton: hasHandle,
		isDisabled,
		preview: sortable.preview,
		getItems: () => [{ [sortable.type]: id, "text/plain": label }],
		onDragStart: () => sortable.setDragging({ id, list, index }),
		onDragEnd: () => sortable.setDragging(null),
	});

	const { dropProps, isDropTarget } = useDrop({
		ref,
		isDisabled,
		getDropOperation: (types) => (types.has(sortable.type) ? "move" : "cancel"),
		onDrop: () => {
			const dragged = sortable.draggingRef.current;
			if (dragged && dragged.id !== id) sortable.onMove(dragged.id, { list, index, overId: id });
		},
	});

	const { dragging } = sortable;
	// Moving down within a list lands after the item dropped on; every other move lands before it.
	const edge =
		isDropTarget && dragging && dragging.id !== id
			? dragging.list === list && dragging.index < index
				? "end"
				: "start"
			: null;

	return {
		dropTargetProps: { ref: attach, ...dropProps },
		dragProps,
		dragButtonProps,
		isDragging,
		isDisabled,
		edge,
	} as const;
}

type SortableHandleProps = {
	item: SortableItem;
	/** Translated name, e.g. "Reorder Experience". */
	label: string;
	iconSize?: number;
	/** False when the item's `dragProps` are on an ancestor (the whole row drags); the grip then only adds the keyboard drag. */
	dragSource?: boolean;
	className?: string;
};

/** The grip that starts a drag by pointer, and by keyboard on Enter or Space. */
export function SortableHandle({ item, label, iconSize = 18, dragSource = true, className }: SortableHandleProps) {
	const ref = useRef<HTMLDivElement>(null);
	const { buttonProps } = useButton({ ...item.dragButtonProps, elementType: "div", isDisabled: item.isDisabled }, ref);

	return (
		<div
			ref={ref}
			{...(dragSource ? mergeProps(buttonProps, item.dragProps) : buttonProps)}
			aria-label={label}
			className={cn(
				"flex shrink-0 cursor-grab items-center justify-center rounded-md text-muted outline-none focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing aria-disabled:cursor-default",
				className,
			)}
		>
			<Icon name="dots-six-vertical" size={iconSize} />
		</div>
	);
}

type SortableEdgeProps = {
	edge: SortableItem["edge"];
	orientation?: "vertical" | "horizontal";
};

/** The line at the edge of a row (or beside a chip) where the dragged item would land. */
export function SortableEdge({ edge, orientation = "vertical" }: SortableEdgeProps) {
	if (!edge) return null;
	return (
		<span
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute z-10 rounded-full bg-accent",
				orientation === "vertical"
					? cn("inset-x-1 h-0.5", edge === "start" ? "-top-px" : "-bottom-px")
					: cn("inset-y-0.5 w-0.5", edge === "start" ? "inset-s-[-3px]" : "inset-e-[-3px]"),
			)}
		/>
	);
}

type SortableDropZoneOptions = {
	list: string;
	/** How many items the list holds. */
	length: number;
	isDisabled?: boolean;
};

/** A list that takes drops on its empty space too (an empty page column, the gap under the last item). */
export function useSortableDropZone({ list, length, isDisabled = false }: SortableDropZoneOptions) {
	const sortable = useSortableContext();
	const { ref, attach } = useDropTarget();

	const { dropProps, isDropTarget } = useDrop({
		ref,
		isDisabled,
		getDropOperation: (types) => (types.has(sortable.type) ? "move" : "cancel"),
		onDrop: () => {
			const dragged = sortable.draggingRef.current;
			if (!dragged) return;
			const index = dragged.list === list ? Math.max(length - 1, 0) : length;
			sortable.onMove(dragged.id, { list, index, overId: null });
		},
	});

	return { dropTargetProps: { ref: attach, ...dropProps }, isOver: isDropTarget && sortable.dragging !== null };
}
