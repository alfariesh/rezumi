import { useLocalSearchParams } from "expo-router";
import { EntryEditor } from "@/features/entries/entry-editor";
import { WriteSourceProvider } from "@/features/entries/source";
import { profileWriteSource } from "@/features/profile/source";
import { ProfileGate } from "@/features/profile/states";

/** One Profile entry (Profile → Career), full screen. */
export default function ProfileEntryRoute() {
	const { section, item, field } = useLocalSearchParams<{ section: string; item: string; field?: string }>();
	return (
		<WriteSourceProvider source={profileWriteSource}>
			<ProfileGate>
				<EntryEditor key={field} sectionId={section} entryId={item} focusField={field} />
			</ProfileGate>
		</WriteSourceProvider>
	);
}
