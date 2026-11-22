import { useLocalSearchParams } from "expo-router";
import { Basics } from "@/features/write/basics-screen";
import { EntryScreen, ResumeScreen, SummaryScreen } from "@/features/write/entry-screen";
import { PictureSettings } from "@/features/write/picture-screen";

/**
 * An entry of a section, full screen. Basics and the summary have no entry ids: `basics/basics`, `basics/picture`
 * and `summary/summary` open their screens. The builder layout owns the draft; these screens only edit it.
 */
export default function EntryRoute() {
	const { id, section, item, field } = useLocalSearchParams<{
		id: string;
		section: string;
		item: string;
		field?: string;
	}>();
	if (section === "basics")
		return (
			<ResumeScreen id={id}>
				{item === "picture" ? <PictureSettings /> : <Basics key={field} id={id} focusField={field} />}
			</ResumeScreen>
		);
	if (section === "summary") return <SummaryScreen key={field} id={id} />;
	return <EntryScreen key={field} id={id} sectionId={section} entryId={item} focusField={field} />;
}
