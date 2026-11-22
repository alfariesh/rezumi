import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { LetterPage } from "@/features/letters/page";
import { useWindowSafeAreaInsets } from "@/ui";

/** The letter full screen, over the editor (Page → Full screen). The bar's button or Back closes it. */
export default function LetterPreviewScreen() {
	const router = useRouter();
	// The window's insets: the editor frame hands its screens side-less (and on a tablet top-less) insets.
	const insets = useWindowSafeAreaInsets();
	const { id } = useLocalSearchParams<{ id: string }>();
	const safe = {
		paddingTop: insets.top,
		paddingBottom: insets.bottom,
		paddingLeft: insets.left,
		paddingRight: insets.right,
	};
	return (
		<View className="flex-1 bg-surface" style={safe}>
			<LetterPage id={id} fullScreen onFullScreen={() => router.back()} />
		</View>
	);
}
