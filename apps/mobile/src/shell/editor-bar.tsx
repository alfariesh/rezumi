// The editor's bottom bar (Write / Page / Design / Check): the cells and the stretching marker on its top rule. Kept
// from the old tab bar for the builder chrome until the builder is rebuilt (Phase 07).
import type { IconName } from "@/ui-legacy";
import type { ReactNode } from "react";
import { Children, useEffect, useState } from "react";
import { I18nManager, Platform, Pressable, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Text, haptics, useReducedMotion, useTheme } from "@/ui-legacy";
import { useKeyboardVisible } from "@/ui-legacy/keyboard";

// The active-tab marker on the bar's top rule; Android tab cells are 64 tall.
const railMarker = { width: 28, height: 3 };
// The edge moving toward the new tab arrives first; the other catches up with a little overshoot, so the marker stretches.
const leadingEdge = { duration: 260, dampingRatio: 0.8 };
const trailingEdge = { duration: 420, dampingRatio: 0.62 };
const androidTabHeight = 64;
const badgeMinWidth = 18;

/** `quiet`: a grey count. `accent`: unread. `warn`: open issues on Check. */
type BadgeTone = "quiet" | "accent" | "warn";

const badgeColors = {
	quiet: { background: "sunken", text: "ink2" },
	accent: { background: "accent", text: "onAccent" },
	warn: { background: "warnSoft", text: "warnText" },
} as const;

type BadgeProps = {
	value: string | number;
	tone: BadgeTone;
};

function TabBadge({ value, tone }: BadgeProps) {
	const { colors, radius, size, space } = useTheme();
	return (
		<View
			style={{
				position: "absolute",
				top: -space.s1,
				// Just past the middle of the icon cell (left 50% + 6px).
				start: size.icon.bar / 2 + space.s1,
				minWidth: badgeMinWidth,
				paddingHorizontal: space.s1,
				borderRadius: radius.rLg,
				borderWidth: space.s0,
				borderColor: colors.surface,
				backgroundColor: colors[badgeColors[tone].background],
				alignItems: "center",
			}}
		>
			<Text variant="micro" color={badgeColors[tone].text}>
				{value}
			</Text>
		</View>
	);
}

type BarItemProps = {
	label: string;
	/** Omitted for the raised "+" pill. */
	icon?: IconName | undefined;
	focused: boolean;
	onPress: () => void;
	badge?: string | number | undefined;
	badgeTone?: BadgeTone | undefined;
};

/** One cell of a bottom bar: the app tab bar and the editor's Write / Page / Design / Check bar share it. */
export function BarItem({ label, icon, focused, onPress, badge, badgeTone = "accent" }: BarItemProps) {
	const { colors, radius, size, space } = useTheme();
	const android = Platform.OS === "android";

	return (
		<Pressable
			accessibilityRole={icon ? "tab" : "button"}
			accessibilityState={icon ? { selected: focused } : {}}
			accessibilityLabel={badge === undefined ? label : `${label}, ${badge}`}
			onPress={() => {
				if (icon && !focused) haptics.selection();
				onPress();
			}}
			android_ripple={{ color: colors.press, borderless: false }}
			style={({ pressed }) => ({
				flex: 1,
				minHeight: android ? androidTabHeight : size.tabBar,
				alignItems: "center",
				justifyContent: "flex-start",
				gap: space.s0,
				paddingTop: space.s2,
				paddingBottom: space.s1,
				paddingHorizontal: space.s1,
				backgroundColor: pressed && !android ? colors.press : "transparent",
			})}
		>
			{icon ? (
				<View style={{ height: size.newPill.height, alignItems: "center", justifyContent: "center" }}>
					<Icon name={icon} filled={focused} color={focused ? colors.ink : colors.ink2} size={size.icon.bar} />
					{badge === undefined ? null : <TabBadge value={badge} tone={badgeTone} />}
				</View>
			) : (
				<View
					style={{
						...size.newPill,
						borderRadius: radius.rLg,
						backgroundColor: colors.accent,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Icon name="plus" color={colors.onAccent} size={size.icon.row} />
				</View>
			)}
			<Text
				variant="micro"
				color={focused ? "ink" : "ink2"}
				align="center"
				// Fit long words within a cell; translated phrases can still wrap at spaces.
				numberOfLines={label.split(" ").length}
				adjustsFontSizeToFit
				minimumFontScale={0.7}
				style={{ alignSelf: "stretch" }}
			>
				{label}
			</Text>
		</Pressable>
	);
}

type RailMarkerProps = {
	index: number;
	count: number;
	/** The width of the row of cells. */
	width: number;
};

/** The `accent` marker on the bar's top rule, over the focused cell. Its two edges spring separately, so it stretches. */
function RailMarker({ index, count, width }: RailMarkerProps) {
	const { colors, motion } = useTheme();
	const reduced = useReducedMotion();
	const cell = width / count;
	// Cells are equal `flex: 1`; in RTL the row runs right to left but translateX does not.
	const slot = I18nManager.isRTL ? count - 1 - index : index;
	const target = slot * cell + (cell - railMarker.width) / 2;
	const left = useSharedValue(target);
	const right = useSharedValue(target + railMarker.width);
	const opacity = useSharedValue(1);

	useEffect(() => {
		const end = target + railMarker.width;
		if (reduced) {
			// No stretch or travel: jump, then fade in.
			left.set(target);
			right.set(end);
			opacity.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: motion.d1 })));
			return;
		}
		// Springs start from where the marker is now, so a tap mid-flight retargets instead of restarting.
		const forward = target > left.get();
		left.set(withSpring(target, forward ? trailingEdge : leadingEdge));
		right.set(withSpring(end, forward ? leadingEdge : trailingEdge));
	}, [target, reduced, left, right, opacity, motion.d1]);

	const style = useAnimatedStyle(() => ({
		opacity: opacity.get(),
		// Absolute and childless, so animating width costs no sibling layout.
		width: Math.max(right.get() - left.get(), railMarker.height),
		transform: [{ translateX: left.get() }],
	}));

	return (
		<Animated.View
			pointerEvents="none"
			style={[
				{
					position: "absolute",
					// Sits on the bar's 1 pt top rule.
					top: -1,
					left: 0,
					height: railMarker.height,
					backgroundColor: colors.accent,
				},
				style,
			]}
		/>
	);
}

type BarProps = {
	children: ReactNode;
	/** The focused cell, marked on the top rule. Omit for no marker. */
	activeIndex?: number | undefined;
};

/** A bottom bar on `surface` with a top rule, padding the bottom and side safe areas. Hidden while the keyboard is up. */
export function Bar({ children, activeIndex }: BarProps) {
	const insets = useSafeAreaInsets();
	const { colors } = useTheme();
	const keyboardVisible = useKeyboardVisible();
	const [width, setWidth] = useState(0);
	const count = Children.count(children);

	if (keyboardVisible) return null;

	return (
		<View
			accessibilityRole="tablist"
			style={{
				flexDirection: "row",
				paddingBottom: insets.bottom,
				paddingLeft: insets.left,
				paddingRight: insets.right,
				backgroundColor: colors.surface,
				borderTopWidth: 1,
				borderTopColor: colors.line,
			}}
		>
			<View style={{ flex: 1, flexDirection: "row" }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
				{children}
				{activeIndex !== undefined && activeIndex >= 0 && width > 0 && count > 0 ? (
					<RailMarker index={activeIndex} count={count} width={width} />
				) : null}
			</View>
		</View>
	);
}
