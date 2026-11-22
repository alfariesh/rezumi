import { useLocalSearchParams } from "expo-router";
import { DesignPane } from "@/features/design/design-pane";

/** The Design pane: content only; the editor chrome draws the bars. */
export default function DesignScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <DesignPane id={id} />;
}
