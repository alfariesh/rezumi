import { useLocalSearchParams } from "expo-router";
import { TypographyScreen } from "@/features/design/typography-screen";

export default function DesignTypographyScreenRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <TypographyScreen id={id} />;
}
