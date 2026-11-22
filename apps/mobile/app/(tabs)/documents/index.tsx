import { useLocalSearchParams } from "expo-router";
import { DocumentsScreen } from "@/features/documents/documents-screen";
import { isLibrarySegment } from "@/features/documents/segment-header";

/** `?segment=resume|letter|trash` picks the library's section (Trash links land here too). */
export default function DocumentsRoute() {
	const { segment } = useLocalSearchParams<{ segment?: string }>();
	return <DocumentsScreen segment={isLibrarySegment(segment) ? segment : "all"} />;
}
