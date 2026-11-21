import type { WriteSource } from "./source";
import type { WriteSection } from "@rezumi/resume/write";
import { createEntry, getEntries } from "@rezumi/resume/write";
import { useEditorStore } from "../store";

/** Opens an entry: expands its section, selects it (outlining it on the page) and focuses a new draft. */
export function openEntry(sectionId: string, entryId: string, options: { focus?: boolean } = {}) {
	useEditorStore.getState().setSectionOpen(sectionId, true);
	useEditorStore.setState({ selection: { kind: "item", sectionId, itemId: entryId } });
	if (options.focus) useEditorStore.setState({ focusEntryId: entryId });
}

/** "+ Add {type}": a draft entry at the end of the section, open and focused. */
export function addEntryTo(source: WriteSource, section: WriteSection) {
	const entry = createEntry(section.type);
	source.update(
		(draft) => {
			getEntries(draft, section).push(entry);
		},
		{ newStep: true },
	);
	openEntry(section.id, entry.id, { focus: true });
}
