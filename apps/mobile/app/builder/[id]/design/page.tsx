import { useLocalSearchParams } from "expo-router";
import { ExactPageScreen } from "@/features/design/page-screen";

export default function DesignExactPageScreenRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <ExactPageScreen id={id} />;
}
