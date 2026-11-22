import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Icon, IconButton, Text, cx, size } from "@/ui";

export type Measurable = {
	measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

type SectionRowProps = {
	id: string;
	title: string;
	lifted: boolean;
	/** How far the lifted row has moved, in points. */
	offset: number;
	disabled: boolean;
	register: (view: Measurable | null) => void;
	onLift: () => void;
	/** Window y of the finger and its distance from where the drag started. */
	onMove: (y: number, dy: number) => void;
	/** `commit` is false when the drag was cancelled. */
	onDrop: (commit: boolean) => void;
	onMenu: () => void;
};

/** A section in a column: hold ⋮⋮ to lift and drag it; ⋮ moves it without dragging (and serves screen readers). */
export function SectionRow(props: SectionRowProps) {
	const { title, lifted, offset, disabled, register, onLift, onMove, onDrop, onMenu } = props;
	const { t } = useLingui();
	const gesture = Gesture.Pan()
		.enabled(!disabled)
		.runOnJS(true)
		.activateAfterLongPress(300)
		.onStart(onLift)
		.onUpdate((event) => onMove(event.absoluteY, event.translationY))
		.onEnd(() => onDrop(true))
		.onFinalize(() => onDrop(false));
	return (
		<View
			ref={register}
			className={cx(
				"min-h-11 flex-row items-center rounded-lg border bg-surface",
				lifted ? "z-10 scale-[1.02] border-accent shadow-overlay" : "border-border",
			)}
			// Follows the finger: computed while dragging, so a style.
			style={lifted ? [{ transform: [{ translateY: offset }] }] : undefined}
		>
			<GestureDetector gesture={gesture}>
				<View
					accessible
					accessibilityRole="button"
					accessibilityLabel={t`Reorder ${title}`}
					accessibilityHint={t`Press and hold, then drag to another column or page.`}
					className="h-11 w-11 items-center justify-center"
				>
					<Icon name="dots-six-vertical" size={size.icon.md} tone="muted" />
				</View>
			</GestureDetector>
			<Text numberOfLines={1} className="flex-1">
				{title}
			</Text>
			<IconButton
				icon="dots-three-vertical"
				variant="ghost"
				label={t`Move ${title} to another column or page`}
				isDisabled={disabled}
				onPress={onMenu}
			/>
		</View>
	);
}

type LayoutColumnProps = {
	label: string;
	/** Where the accent marker goes among `rows` while a section is dragged over this column; null otherwise. */
	marker: number | null;
	/** The visible sections, in order, already rendered. */
	rows: ReactNode[];
	register: (view: Measurable | null) => void;
};

/** Main or Sidebar on a page: its rows, the accent marker where a dragged section would land, and an empty hint. */
export function LayoutColumn({ label, marker, rows, register }: LayoutColumnProps) {
	const { t } = useLingui();
	const items = [...rows];
	if (marker !== null) items.splice(marker, 0, <View key="marker" className="h-0.5 rounded-full bg-accent" />);
	return (
		<View className="gap-1">
			<Text size="xs" tone="muted">
				{label}
			</Text>
			<View
				ref={register}
				className={cx(
					"gap-2 rounded-xl border border-dashed p-2 pb-6",
					marker !== null ? "border-accent bg-accent-soft" : "border-border bg-background",
				)}
			>
				{items}
				{rows.length === 0 ? (
					<Text size="xs" tone="muted" className="text-center">
						{t`Drag and drop sections here to move them between columns`}
					</Text>
				) : null}
			</View>
		</View>
	);
}
