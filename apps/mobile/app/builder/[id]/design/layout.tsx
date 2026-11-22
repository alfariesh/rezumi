import { useLocalSearchParams } from "expo-router";
import { LayoutScreen } from "@/features/design/layout-screen";

export default function DesignLayoutScreenRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <LayoutScreen id={id} />;
}
