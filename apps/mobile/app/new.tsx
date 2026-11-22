import { SafeAreaProvider } from "react-native-safe-area-context";
import { NewDocumentScreen } from "@/features/documents/new-document-screen";

// A form sheet over the app (`app/_layout.tsx`); its own safe-area context measures the sheet, not the window.
export default function NewScreen() {
	return (
		<SafeAreaProvider>
			<NewDocumentScreen />
		</SafeAreaProvider>
	);
}
