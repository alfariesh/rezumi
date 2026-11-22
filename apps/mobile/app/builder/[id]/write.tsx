import { useLocalSearchParams } from "expo-router";
import { WritePane } from "@/features/write/write-pane";

/** Write, inside the editor chrome. The builder layout owns the draft; the pane only reads it and sends edits. */
export default function WriteScreen() {
	const { id, imported, section } = useLocalSearchParams<{ id: string; imported?: string; section?: string }>();
	return <WritePane key={`${id}:${section ?? ""}`} id={id} imported={imported} section={section} />;
}
