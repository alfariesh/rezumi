import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Coach, offerIdsFrom } from "@/features/assistant/coach";
import { routes } from "@/routes";

const fill = { flex: 1 };

export default function CoachRoute() {
	const { offers, thread } = useLocalSearchParams<{ offers?: string | string[]; thread?: string }>();
	const router = useRouter();
	return (
		<SafeAreaView style={fill}>
			<Coach
				key={thread}
				initialThread={thread}
				offerIds={offerIdsFrom(offers)}
				onClose={() => (router.canGoBack() ? router.back() : router.replace(routes.home()))}
			/>
		</SafeAreaView>
	);
}
