import type { WriteSection } from "./model";
import type { WriteSource } from "./source";
import { useEditorStore } from "../store";
import { createEntry, getEntries } from "./model";

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
