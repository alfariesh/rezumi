import type { useEntry } from "@/features/entries/hooks";
// What an entry can do besides its fields (the web's entry menu): Save to Profile when the Profile lacks it, hide or
// show it, duplicate it, move it to a section of the same type (or a new one), delete it with Undo.
import type { WriteSection } from "@/features/entries/model";
import type { MoveTarget } from "@rezumi/resume/move-item";
import { useLingui } from "@lingui/react/macro";
import { isLocalEntry, profileSectionOf } from "@rezumi/resume/profile-link";
import { useBuilderProfile, useSaveToProfile } from "./profile-link";
import { SECTION_TITLES } from "@/features/entries/fields";
import { useDeleteEntry, useEdit } from "@/features/entries/hooks";
import {
	createEntry,
	getCompatibleMoveTargets,
	getEntries,
	getSectionObject,
	moveItem,
	resolveSection,
} from "@/features/entries/model";
import { useWriteData, useWriteSource } from "@/features/entries/source";
import { ListRow, ListSection } from "@/ui";

export function useEntryActions(section: WriteSection, entryId: string) {
	const edit = useEdit();
	const deleteEntry = useDeleteEntry();
	const profile = useBuilderProfile();
	const { save } = useSaveToProfile();
	const linked = profileSectionOf(section);
	const local = useWriteData(
		(data) => (profile && linked ? isLocalEntry(data, profile, linked, entryId) : false),
		false,
	);
	return {
		toggleHidden: () =>
			edit((draft) => {
				const target = getEntries(draft, section).find((item) => item.id === entryId);
				if (target) target.hidden = !target.hidden;
			}),
		/** Returns the copy's id. */
		duplicate: (entry: NonNullable<ReturnType<typeof useEntry>>) => {
			const copy = { ...structuredClone(entry), id: createEntry(section.type).id };
			edit((draft) => {
				const entries = getEntries(draft, section);
				entries.splice(entries.findIndex((item) => item.id === entryId) + 1, 0, copy);
			});
			return copy.id;
		},
		moveTo: (target: MoveTarget) => edit((draft) => moveItem(draft, section, entryId, target)),
		saveToProfile: local && linked ? () => void save({ kind: "item", section: linked, id: entryId }) : null,
		remove: () => deleteEntry(section, entryId),
	};
}

type MoveTargetsProps = { section: WriteSection; onMove: (target: MoveTarget) => void };

/** Sections of the same type, page by page, then a new section there or a new page. */
export function MoveTargets({ section, onMove }: MoveTargetsProps) {
	const { t, i18n } = useLingui();
	const { getData } = useWriteSource();
	const data = getData();
	if (!data) return null;
	const titleOf = (id: string) => {
		const target = resolveSection(data, id);
		if (!target) return id;
		return getSectionObject(data, target)?.title.trim() || i18n._(SECTION_TITLES[target.type]);
	};
	const sourceTitle = titleOf(section.id);
	const targets = getCompatibleMoveTargets(data, section.type, section.id);

	return (
		<>
			{targets.map(({ pageIndex, sectionIds }) => (
				<ListSection key={pageIndex} title={t`Page ${pageIndex + 1}`}>
					{[
						...sectionIds.map((id) => (
							<ListRow
								key={id}
								title={titleOf(id)}
								icon="file-text"
								chevron={false}
								onPress={() => onMove({ type: "section", sectionId: id })}
							/>
						)),
						<ListRow
							key="new"
							title={t`New section`}
							icon="plus"
							chevron={false}
							onPress={() => onMove({ type: "new-section", pageIndex, title: sourceTitle })}
						/>,
					]}
				</ListSection>
			))}
			<ListSection>
				<ListRow
					title={t`New page`}
					icon="file-plus"
					chevron={false}
					onPress={() => onMove({ type: "new-page", title: sourceTitle })}
				/>
			</ListSection>
		</>
	);
}
