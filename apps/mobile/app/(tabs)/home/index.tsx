import { useLocalSearchParams } from "expo-router";
import { HomeScreen } from "@/features/home/home-screen";

/** `?schedule=` (a schedule id or "new") opens the schedule sheet: links from notifications and the web's Home. */
export default function HomeRoute() {
	const { schedule } = useLocalSearchParams<{ schedule?: string }>();
	return <HomeScreen schedule={typeof schedule === "string" ? schedule : undefined} />;
}
