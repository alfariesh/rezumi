import { useLocalSearchParams } from "expo-router";
import { ColorsScreen } from "@/features/design/colors-screen";

export default function DesignColorsScreenRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <ColorsScreen id={id} />;
}
