import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageScreen from "./page";

/** The pages full screen, over the editor (Page → Full screen). Pinch to zoom; the bar's button or Back closes it. */
export default function PreviewScreen() {
	const insets = useSafeAreaInsets();
	const safe = { paddingTop: insets.top, paddingBottom: insets.bottom };
	return (
		<View className="flex-1 bg-surface" style={safe}>
			<PageScreen fullScreen />
		</View>
	);
}
