import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Coach, offerIdsFrom } from "@/features/assistant/coach";
import { routes } from "@/routes";

const fill = { flex: 1 };

export default function CoachRoute() {
	const { offers, thread, question } = useLocalSearchParams<{
		offers?: string | string[];
		thread?: string;
		question?: string;
	}>();
	const router = useRouter();
	return (
		<SafeAreaView style={fill}>
			<Coach
				key={thread ?? question}
				initialThread={thread}
				initialQuestion={question}
				offerIds={offerIdsFrom(offers)}
				onClose={() => (router.canGoBack() ? router.back() : router.replace(routes.home()))}
			/>
		</SafeAreaView>
	);
}
