import { DocumentsLibrary } from "@/features/documents/library";
import { NewFab } from "@/shell/tab-chrome";

export default function DocumentsScreen() {
	return (
		<>
			<DocumentsLibrary />
			<NewFab />
		</>
	);
}
