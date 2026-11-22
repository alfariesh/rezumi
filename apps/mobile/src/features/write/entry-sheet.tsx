// An entry's options from the outline: Save to Profile, Hide / Show, Duplicate, Move to… (a page inside the sheet)
// and Delete with Undo.
import type { WriteSection } from "@/features/entries/model";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { MoveTargets, useEntryActions } from "./entry-actions";
import { useEntry } from "@/features/entries/hooks";
import { describeEntry } from "@/features/entries/model";
import { ListRow, ListSection, Sheet } from "@/ui";

type EntrySheetProps = {
	target: { section: WriteSection; entryId: string } | null;
	onClose: () => void;
	/** Opens an entry full screen (the copy after Duplicate). */
	onOpen: (sectionId: string, entryId: string) => void;
};

export function EntrySheet({ target, onClose, onOpen }: EntrySheetProps) {
	const { t } = useLingui();
	const [moving, setMoving] = useState(false);
	const close = () => {
		setMoving(false);
		onClose();
	};
	return (
		<Sheet
			isOpen={target !== null}
			onOpenChange={(open) => !open && close()}
			title={moving ? t`Move to…` : t`Entry options`}
			closeLabel={t`Close`}
			detents={moving ? [0.7] : ["auto"]}
			testID="entry-sheet"
		>
			{target ? (
				<EntryOptions
					key={target.entryId}
					section={target.section}
					entryId={target.entryId}
					moving={moving}
					onMoving={setMoving}
					onClose={close}
					onOpen={onOpen}
				/>
			) : null}
		</Sheet>
	);
}

type EntryOptionsProps = {
	section: WriteSection;
	entryId: string;
	moving: boolean;
	onMoving: (moving: boolean) => void;
	onClose: () => void;
	onOpen: (sectionId: string, entryId: string) => void;
};

function EntryOptions({ section, entryId, moving, onMoving, onClose, onOpen }: EntryOptionsProps) {
	const { t } = useLingui();
	const entry = useEntry(section.id, entryId);
	const actions = useEntryActions(section, entryId);
	if (!entry) return null;
	const act = (run: () => void) => () => {
		onClose();
		run();
	};

	if (moving)
		return (
			<>
				<ListSection>
					<ListRow
						title={describeEntry(section.type, entry).title || t`Untitled`}
						icon="caret-left"
						chevron={false}
						onPress={() => onMoving(false)}
					/>
				</ListSection>
				<MoveTargets section={section} onMove={(to) => act(() => actions.moveTo(to))()} />
			</>
		);

	return (
		<>
			<ListSection>
				{actions.saveToProfile ? (
					<ListRow
						title={t`Save to Profile`}
						icon="upload-simple"
						chevron={false}
						onPress={act(actions.saveToProfile)}
					/>
				) : null}
				<ListRow
					title={entry.hidden ? t`Show on page` : t`Hide from page`}
					icon={entry.hidden ? "eye" : "eye-slash"}
					chevron={false}
					onPress={act(actions.toggleHidden)}
				/>
				<ListRow
					title={t`Duplicate`}
					icon="copy"
					chevron={false}
					onPress={act(() => onOpen(section.id, actions.duplicate(entry)))}
				/>
				<ListRow title={t`Move to…`} icon="arrow-right" onPress={() => onMoving(true)} />
			</ListSection>
			<ListSection>
				<ListRow
					title={t`Delete`}
					icon="trash"
					tone="danger"
					onPress={act(actions.remove)}
					testID="entry-sheet-delete"
				/>
			</ListSection>
		</>
	);
}
