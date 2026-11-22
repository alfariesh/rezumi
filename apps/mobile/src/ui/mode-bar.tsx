// The editor's mode bar at the foot of the screen (plans/mobile Phase 07 step 8): Write · Page · Design · Check ·
// Share, each an icon over its name like the web's mode rail, the picked one in accent on a soft accent pill with its
// duotone glyph, and a count (Check's open issues) at the icon's corner. It pads the bottom safe area itself.
import type { IconName } from "./icon";
import { Badge } from "heroui-native-pro/badge";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cx } from "./cx";
import { Icon } from "./icon";
import { haptics } from "./motion";
import { Text } from "./text";
import { size } from "./tokens";

export type ModeBarItem<T extends string> = {
	value: T;
	label: string;
	icon: IconName;
	/** A count at the icon's corner, read with the label ("Check, 3"). */
	badge?: number | string | undefined;
};

export type ModeBarProps<T extends string> = {
	items: readonly ModeBarItem<T>[];
	value: T;
	onValueChange: (value: T) => void;
	/** Names the bar for screen readers ("Editor mode"). */
	accessibilityLabel: string;
	/** Pads the bottom safe area (default). Off when something under it already does. */
	safeBottom?: boolean | undefined;
	/** Called with the bar's height whenever it lays out, so toasts can sit above it. */
	onHeight?: ((height: number) => void) | undefined;
};

export function ModeBar<T extends string>({
	items,
	value,
	onValueChange,
	accessibilityLabel,
	safeBottom = true,
	onHeight,
}: ModeBarProps<T>) {
	const insets = useSafeAreaInsets();
	return (
		<View
			accessibilityRole="tablist"
			accessibilityLabel={accessibilityLabel}
			onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}
			className="flex-row border-t border-separator bg-surface px-2 pt-1.5"
			style={{
				paddingBottom: Math.max(safeBottom ? insets.bottom : 0, 6),
				paddingLeft: insets.left + 8,
				paddingRight: insets.right + 8,
			}}
		>
			{items.map((item) => (
				<ModeBarCell
					key={item.value}
					item={item}
					selected={item.value === value}
					onPress={() => {
						if (item.value === value) return;
						haptics.selection();
						onValueChange(item.value);
					}}
				/>
			))}
		</View>
	);
}

type ModeBarCellProps<T extends string> = { item: ModeBarItem<T>; selected: boolean; onPress: () => void };

function ModeBarCell<T extends string>({ item, selected, onPress }: ModeBarCellProps<T>) {
	const hasBadge = item.badge !== undefined && item.badge !== 0;
	return (
		<Pressable
			accessibilityRole="tab"
			accessibilityState={{ selected }}
			accessibilityLabel={hasBadge ? `${item.label}, ${item.badge}` : item.label}
			testID={`mode-${item.value}`}
			onPress={onPress}
			className="min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl active:opacity-70"
		>
			<View className={cx("h-8 w-14 items-center justify-center rounded-full", selected && "bg-accent-soft")}>
				<Badge.Anchor>
					<Icon
						name={item.icon}
						size={size.icon.lg}
						variant={selected ? "duotone" : "stroke"}
						tone={selected ? "accent" : "muted"}
					/>
					{hasBadge ? (
						<Badge color="warning" variant="soft" size="sm" placement="top-right">
							{String(item.badge)}
						</Badge>
					) : null}
				</Badge.Anchor>
			</View>
			<Text
				size="xs"
				weight={selected ? "semibold" : "medium"}
				tone={selected ? "accent" : "muted"}
				numberOfLines={1}
				maxFontSizeMultiplier={1.3}
			>
				{item.label}
			</Text>
		</Pressable>
	);
}
