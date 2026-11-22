import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LetterPage } from "@/features/letters/page";

/** The letter full screen, over the editor (Page → Full screen). The bar's button or Back closes it. */
export default function LetterPreviewScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { id } = useLocalSearchParams<{ id: string }>();
	const safe = { paddingTop: insets.top, paddingBottom: insets.bottom };
	return (
		<View className="flex-1 bg-surface" style={safe}>
			<LetterPage id={id} fullScreen onFullScreen={() => router.back()} />
		</View>
	);
}
