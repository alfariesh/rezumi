import type { KeyboardAvoidingViewProps } from "react-native-keyboard-controller";
import type { SharedValue } from "react-native-reanimated";
import { createContext, use, useState } from "react";
import { useWindowDimensions } from "react-native";
import {
	KeyboardAvoidingView,
	useKeyboardState,
	useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Animated, {
	measure,
	useAnimatedReaction,
	useAnimatedRef,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const ResizedKeyboard = createContext(false);
// The live top edge of a native sheet that rises with the keyboard on its own, so a chat inside pads only for the part
// still covered. Only the chat frame reads this; fields in scrolling sheets keep the sheet's own insets.
const LiftedSheet = createContext<SharedValue<number> | null>(null);

export function useKeyboardVisible() {
	const { height } = useReanimatedKeyboardAnimation();
	const [visible, setVisible] = useState(false);
	// Android activity recreation resets native height but can leave keyboard-event caches visible.
	useAnimatedReaction(
		() => height.get() !== 0,
		(next, previous) => {
			if (next !== previous) scheduleOnRN(setVisible, next);
		},
		[height],
	);
	return visible;
}

export function KeyboardFrame(props: KeyboardAvoidingViewProps) {
	// Native modals outside this resized viewport must not inherit its keyboard-space cancellation.
	return (
		<ResizedKeyboard value>
			<KeyboardAvoidingView {...props} />
		</ResizedKeyboard>
	);
}

export function useKeyboardScrollSpace() {
	const resized = use(ResizedKeyboard);
	const height = useKeyboardState((keyboard) => keyboard.height);
	// A resized viewport already clears the keyboard; keep focus scrolling without adding its height twice.
	return resized ? -height : 0;
}

const fill = { flex: 1 };

/** Chat in a native sheet or editor owns its keyboard frame. An inline panel shares the tab shell's frame. */
export function ChatFrame({ children }: { children: KeyboardAvoidingViewProps["children"] }) {
	const resized = use(ResizedKeyboard);
	const lifted = use(LiftedSheet);
	if (resized) return children;
	if (lifted) return <LiftedChatFrame top={lifted}>{children}</LiftedChatFrame>;
	return (
		<KeyboardFrame behavior="padding" automaticOffset style={fill}>
			{children}
		</KeyboardFrame>
	);
}

type LiftedChatFrameProps = {
	children: KeyboardAvoidingViewProps["children"];
	/** The sheet's top edge on screen, as it moves. */
	top: SharedValue<number>;
};

/**
 * A sheet that rises with the keyboard (TrueSheet on Android) moves only until it reaches its top stop, so part of its
 * content can still sit behind the keyboard. Inside the sheet, `measure` reports positions from the sheet's top edge,
 * so the frame adds the sheet's live position to find its bottom on screen and pads by the part the keyboard covers.
 * `automaticOffset` measures once, before the sheet rises, and pads too much.
 */
function LiftedChatFrame({ children, top }: LiftedChatFrameProps) {
	const ref = useAnimatedRef<Animated.View>();
	const { height: keyboard } = useReanimatedKeyboardAnimation();
	const { height: window } = useWindowDimensions();
	const padding = useSharedValue(0);
	// Runs as the keyboard and the sheet move; both report on the same frames.
	useAnimatedReaction(
		() => [keyboard.get(), top.get()] as const,
		([offset, sheetTop]) => {
			const frame = offset === 0 ? null : measure(ref);
			padding.set(frame ? Math.max(0, sheetTop + frame.pageY + frame.height - (window + offset)) : 0);
		},
		[keyboard, top, window],
	);
	const style = useAnimatedStyle(() => ({ paddingBottom: padding.get() }));
	return (
		<Animated.View ref={ref} style={[fill, style]}>
			{children}
		</Animated.View>
	);
}

type NativeKeyboardBoundaryProps = {
	children: KeyboardAvoidingViewProps["children"];
	/** The live top edge of a sheet that moves above the keyboard itself (TrueSheet on Android). */
	liftedTop?: SharedValue<number> | undefined;
};

/** A native sheet sits in its own viewport even when opened inside a resized tab or editor. */
export function NativeKeyboardBoundary({ children, liftedTop }: NativeKeyboardBoundaryProps) {
	return (
		<ResizedKeyboard value={false}>
			<LiftedSheet value={liftedTop ?? null}>{children}</LiftedSheet>
		</ResizedKeyboard>
	);
}
