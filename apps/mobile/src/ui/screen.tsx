// A screen on the background desk: safe areas, scrolling that keeps the focused field above the keyboard, and pull to
// refresh. Content gets the 16 pt phone gutter and 16 pt between blocks.
import type { ReactNode, Ref } from "react";
import type { ViewProps } from "react-native";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { useThemeColor } from "heroui-native";
import { RefreshControl, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardScrollSpace } from "./keyboard";
import { space } from "./tokens";
import { usePullRefresh } from "./use-pull-refresh";

type Edge = "top" | "bottom";

export type ScreenProps = {
	children?: ReactNode;
	/** Scrolls its content (default). Lists that scroll themselves pass false. */
	scroll?: boolean | undefined;
	/** Vertical safe areas this screen pads itself; headers and the section frame usually own them. */
	edges?: Edge[] | undefined;
	/** Drops the gutter and gap, for full-bleed content (a list, a canvas). */
	bare?: boolean | undefined;
	onRefresh?: (() => Promise<unknown>) | undefined;
	onLayout?: ViewProps["onLayout"];
	/** The scroll view, for screens that scroll to a section ("Review" on Home). */
	scrollRef?: Ref<KeyboardAwareScrollViewRef> | undefined;
	testID?: string | undefined;
};

export function Screen({
	children,
	scroll = true,
	edges = [],
	bare = false,
	onRefresh,
	onLayout,
	scrollRef,
	testID,
}: ScreenProps) {
	const [background, accent] = useThemeColor(["background", "accent"]);
	const insets = useSafeAreaInsets();
	const keyboardSpace = useKeyboardScrollSpace();
	const pull = usePullRefresh(...(onRefresh ? [onRefresh] : []));
	const content = bare ? undefined : { padding: space[4], gap: space[4] };
	return (
		<View
			testID={testID}
			style={{
				flex: 1,
				backgroundColor: background,
				paddingLeft: insets.left,
				paddingRight: insets.right,
				paddingTop: edges.includes("top") ? insets.top : 0,
				paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
			}}
		>
			{scroll ? (
				<KeyboardAwareScrollView
					ref={scrollRef}
					onLayout={onLayout}
					extraKeyboardSpace={keyboardSpace}
					bottomOffset={space[4]}
					keyboardShouldPersistTaps="handled"
					contentInsetAdjustmentBehavior="automatic"
					contentContainerStyle={content}
					alwaysBounceVertical
					refreshControl={onRefresh ? <RefreshControl {...pull} tintColor={accent} colors={[accent]} /> : undefined}
				>
					{children}
				</KeyboardAwareScrollView>
			) : (
				<View onLayout={onLayout} style={[{ flex: 1 }, content]}>
					{children}
				</View>
			)}
		</View>
	);
}
