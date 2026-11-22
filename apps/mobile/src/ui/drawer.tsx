// A menu that sits behind the screen: the screen slides aside, rounded and dimmed, to show it (01-desain 2). Opened
// by a button or, on top-level screens, a swipe from the leading edge; closed by a tap or swipe on the screen, the
// Android back button, or the screen reader's escape gesture. Right-to-left languages open it from the right.
import type { ReactNode } from "react";
import { useEffect } from "react";
import {
	BackHandler,
	I18nManager,
	Keyboard,
	Platform,
	Pressable,
	StyleSheet,
	View,
	useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	Extrapolation,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { haptics, useReducedMotion } from "./motion";
import { motion } from "./tokens";

/** The menu's width: most of a phone, never wider than a comfortable column. */
const MAX_WIDTH = 320;
const WIDTH_RATIO = 0.82;
/** How far from the leading edge a swipe may start on a top-level screen. */
const EDGE_WIDTH = 24;
/** A fling this fast (pt/s) decides the direction, whatever the distance. */
const FLING_VELOCITY = 500;
/** The menu starts this share of its width behind its resting place and moves in with the screen. */
const PARALLAX = 0.3;

export type PushDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The menu behind the screen. */
	drawer: ReactNode;
	children: ReactNode;
	/**
	 * Whether a swipe from the leading edge opens it. Only where no back gesture competes: a section's top screen, not a
	 * screen pushed on top of it.
	 */
	edgeSwipe?: boolean | undefined;
	/** The screen reader's name for the dimmed screen that closes the menu ("Close menu"), translated by the caller. */
	closeLabel: string;
	testID?: string | undefined;
};

/** Screens with rounded display corners (iPhones without a home button) get the same curve on the sliding screen. */
function useCornerRadius() {
	const insets = useSafeAreaInsets();
	if (Platform.OS === "ios") return insets.top > 20 ? 48 : 12;
	return 24;
}

export function PushDrawer({
	open,
	onOpenChange,
	drawer,
	children,
	edgeSwipe = false,
	closeLabel,
	testID,
}: PushDrawerProps) {
	const { width: screenWidth } = useWindowDimensions();
	const width = Math.min(MAX_WIDTH, Math.round(screenWidth * WIDTH_RATIO));
	const radius = useCornerRadius();
	const reduced = useReducedMotion();
	const rtl = I18nManager.isRTL;
	const direction = rtl ? -1 : 1;
	const progress = useSharedValue(open ? 1 : 0);
	const start = useSharedValue(0);

	// Moves to the state `open` asks for, taking only as long as the distance left: after a swipe the screen is nearly
	// there already, so it settles without a second slide.
	useEffect(() => {
		if (open) Keyboard.dismiss();
		const target = open ? 1 : 0;
		const remaining = Math.abs(target - progress.get());
		const full = open ? motion.emphasized : Math.round(motion.emphasized * motion.exit);
		const duration = reduced ? 0 : Math.round(full * remaining);
		progress.set(withTiming(target, { duration, easing: motion.easeDrawer }));
	}, [open, progress, reduced]);

	useEffect(() => {
		if (!open) return;
		const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
			onOpenChange(false);
			return true;
		});
		return () => subscription.remove();
	}, [open, onOpenChange]);

	const pan = Gesture.Pan()
		.enabled(open || edgeSwipe)
		// Closed, only a swipe toward the menu's side counts; open, either way (back to close, or a little further).
		.activeOffsetX(open ? [-12, 12] : 12 * direction)
		.failOffsetY([-12, 12])
		.onBegin(() => {
			start.set(progress.get());
		})
		.onUpdate((event) => {
			const moved = (event.translationX * direction) / width;
			progress.set(Math.min(1, Math.max(0, start.get() + moved)));
		})
		.onEnd((event) => {
			const velocity = event.velocityX * direction;
			const next = Math.abs(velocity) > FLING_VELOCITY ? velocity > 0 : progress.get() > 0.5;
			const remaining = next ? 1 - progress.get() : progress.get();
			const duration = reduced ? 0 : Math.max(motion.quick, Math.round(motion.emphasized * remaining));
			progress.set(withTiming(next ? 1 : 0, { duration, easing: motion.easeDrawer }));
			// A swipe that opens it from closed taps once, like pulling a sheet into place.
			if (next && start.get() < 0.5) scheduleOnRN(haptics.selection);
			scheduleOnRN(onOpenChange, next);
		});
	// Closed: only the strip at the leading edge starts a swipe, so the screen's own scrolling and taps still work.
	if (!open) pan.hitSlop(rtl ? { right: 0, width: EDGE_WIDTH } : { left: 0, width: EDGE_WIDTH });

	const screenStyle = useAnimatedStyle(() => {
		const value = progress.get();
		return {
			transform: [{ translateX: value * width * direction }],
			borderRadius: interpolate(value, [0, 0.1], [0, radius], Extrapolation.CLAMP),
			borderWidth: interpolate(value, [0, 0.1], [0, StyleSheet.hairlineWidth], Extrapolation.CLAMP),
		};
	});
	const dimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
	const menuStyle = useAnimatedStyle(() => {
		const value = progress.get();
		return {
			opacity: reduced ? 1 : interpolate(value, [0, 1], [0.4, 1]),
			transform: [{ translateX: reduced ? 0 : (value - 1) * width * PARALLAX * direction }],
		};
	});

	return (
		<View className="flex-1 bg-surface" testID={testID}>
			<Animated.View
				className="absolute top-0 bottom-0"
				style={[rtl ? { right: 0 } : { left: 0 }, { width }, menuStyle]}
				pointerEvents={open ? "auto" : "none"}
			>
				<View
					className="flex-1"
					accessibilityViewIsModal={open}
					accessibilityElementsHidden={!open}
					importantForAccessibility={open ? "yes" : "no-hide-descendants"}
					onAccessibilityEscape={() => onOpenChange(false)}
					testID={testID ? `${testID}-menu` : undefined}
				>
					{drawer}
				</View>
			</Animated.View>
			<GestureDetector gesture={pan}>
				<Animated.View className="flex-1 overflow-hidden border-separator bg-background" style={screenStyle}>
					<View
						className="flex-1"
						accessibilityElementsHidden={open}
						importantForAccessibility={open ? "no-hide-descendants" : "auto"}
						testID={testID ? `${testID}-screen` : undefined}
					>
						{children}
					</View>
					<Animated.View
						className="absolute inset-0 bg-backdrop"
						style={dimStyle}
						pointerEvents={open ? "auto" : "none"}
					>
						<Pressable
							className="flex-1"
							accessibilityRole="button"
							accessibilityLabel={closeLabel}
							accessibilityElementsHidden={!open}
							importantForAccessibility={open ? "yes" : "no-hide-descendants"}
							onPress={() => onOpenChange(false)}
							testID={testID ? `${testID}-close` : undefined}
						/>
					</Animated.View>
				</Animated.View>
			</GestureDetector>
		</View>
	);
}
