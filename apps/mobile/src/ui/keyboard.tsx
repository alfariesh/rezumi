import type { KeyboardAvoidingViewProps } from "react-native-keyboard-controller";
import { createContext, use, useState } from "react";
import {
	KeyboardAvoidingView,
	useKeyboardState,
	useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import { useAnimatedReaction } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const ResizedKeyboard = createContext(false);

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
	return resized ? (
		children
	) : (
		<KeyboardFrame behavior="padding" automaticOffset style={fill}>
			{children}
		</KeyboardFrame>
	);
}

/** A native sheet sits in its own viewport even when opened inside a resized tab or editor. */
export function NativeKeyboardBoundary({ children }: { children: KeyboardAvoidingViewProps["children"] }) {
	return <ResizedKeyboard value={false}>{children}</ResizedKeyboard>;
}
