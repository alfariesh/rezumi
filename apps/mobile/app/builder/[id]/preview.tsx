import { View } from "react-native";
import PageScreen from "./page";
import { useWindowSafeAreaInsets } from "@/ui";

/** The pages full screen, over the editor (Page → Full screen). Pinch to zoom; the bar's button or Back closes it. */
export default function PreviewScreen() {
	// The window's insets: the editor frame hands its screens side-less (and on a tablet top-less) insets.
	const insets = useWindowSafeAreaInsets();
	const safe = {
		paddingTop: insets.top,
		paddingBottom: insets.bottom,
		paddingLeft: insets.left,
		paddingRight: insets.right,
	};
	return (
		<View className="flex-1 bg-surface" style={safe}>
			<PageScreen fullScreen />
		</View>
	);
}
