// One entry, full screen: its fields saved as you type, then Move and Delete. Deleting is immediate, with Undo in the
// toast. Also the summary editor. Both read and write through the open source (the Profile or a resume); the CV
// builder adds its Profile marker (`top`) and its entry options (`extra`).
import type { WriteSection } from "@/features/entries/model";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { EntryFields } from "./entry-fields";
import { consumeFocus, useDeleteEntry, useEntry, useEntryWriter, useMoveEntry, useSectionTitle } from "./hooks";
import { RichTextField, RichTextToolbar } from "./rich-text-field";
import { useWriteData, useWriteSource } from "./source";
import { DRAFT_HINTS } from "@/features/entries/fields";
import {
	describeEntry,
	getEntries,
	getSectionKind,
	getSectionType,
	isDraftEntry,
	getPrimaryField,
} from "@/features/entries/model";
import { Alert, Card, EmptyState, ListRow, ListSection, Screen, Text } from "@/ui";

type EditorFrameProps = { title: string; children: ReactNode };

/** A full-screen editor: scrolls above the keyboard and docks the formatting toolbar. */
export function EditorFrame({ title, children }: EditorFrameProps) {
	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ title }} />
			<Screen>{children}</Screen>
			<RichTextToolbar />
		</View>
	);
}

type EntryEditorProps = {
	sectionId: string;
	entryId: string;
	focusField?: string | undefined;
	/** Above the fields (the resume's Profile marker). */
	top?: ReactNode;
	/** Between the fields and Move / Delete (the resume's entry options). */
	extra?: ReactNode;
};

export function EntryEditor({ sectionId, entryId, focusField, top, extra }: EntryEditorProps) {
	const { t, i18n } = useLingui();
	const router = useRouter();
	const source = useWriteSource();
	const locked = source.useLocked();
	const page = source.usePage();
	const type = useWriteData((data) => getSectionType(data, sectionId) ?? null, null);
	const section = useMemo<WriteSection | null>(
		() => (type ? { id: sectionId, kind: getSectionKind(sectionId), type } : null),
		[sectionId, type],
	);
	const sectionTitle = useSectionTitle(section);
	const entry = useEntry(sectionId, entryId);
	const write = useEntryWriter(sectionId, entryId);
	const position = useWriteData((data) => {
		if (!section) return "-1/0";
		const entries = getEntries(data, section);
		return `${entries.findIndex((item) => item.id === entryId)}/${entries.length}`;
	}, "-1/0");
	const [index = -1, count = 0] = position.split("/").map(Number);
	const deleteEntry = useDeleteEntry();
	const moveEntry = useMoveEntry();
	const [autoFocus] = useState(() => consumeFocus(entryId));

	if (!section || !entry)
		return (
			<EditorFrame title={sectionTitle || t`Entry`}>
				<EmptyState
					kind="page"
					icon="info"
					title={t`This entry was deleted`}
					description={t`It may have been removed on another device.`}
					action={{ label: t`Back`, onPress: router.back }}
				/>
			</EditorFrame>
		);

	const { title } = describeEntry(section.type, entry);
	const primary = getPrimaryField(section.type);
	const hint = isDraftEntry(section.type, entry) && primary ? DRAFT_HINTS[primary] : undefined;

	return (
		<EditorFrame title={title || sectionTitle}>
			{locked ? <LockedNote /> : null}
			{top}
			{hint ? (
				<Text size="xs" tone="muted">
					{i18n._(hint)}
				</Text>
			) : null}
			<Card>
				<Card.Body>
					<EntryFields
						type={section.type}
						entry={entry}
						write={write}
						page={page}
						disabled={locked}
						autoFocus={autoFocus}
						focusField={focusField}
					/>
				</Card.Body>
			</Card>
			{!locked ? extra : null}
			{!locked ? (
				<ListSection>
					<ListRow
						title={t`Move up`}
						icon="arrow-up"
						chevron={false}
						isDisabled={index <= 0}
						onPress={() => moveEntry(section, entryId, -1)}
					/>
					<ListRow
						title={t`Move down`}
						icon="arrow-down"
						chevron={false}
						isDisabled={index < 0 || index >= count - 1}
						onPress={() => moveEntry(section, entryId, 1)}
					/>
					<ListRow
						title={t`Delete entry`}
						icon="trash"
						tone="danger"
						onPress={() => {
							router.back();
							deleteEntry(section, entryId);
						}}
						testID="entry-delete"
					/>
				</ListSection>
			) : null}
		</EditorFrame>
	);
}

function LockedNote() {
	const { t } = useLingui();
	return (
		<Alert status="default">
			<Alert.Content>
				<Alert.Title>{t`Locked. Unlock to edit.`}</Alert.Title>
			</Alert.Content>
		</Alert>
	);
}

type SummaryEditorProps = {
	title: string;
	hint: string;
	/** Beside the field's label (the resume's Profile marker). */
	labelAction?: ReactNode;
};

/** The summary: one rich text, with the web's guidance. */
export function SummaryEditor({ title, hint, labelAction }: SummaryEditorProps) {
	const { t } = useLingui();
	const source = useWriteSource();
	const locked = source.useLocked();
	const content = useWriteData((data) => data.summary.content, "");
	const [autoFocus] = useState(() => !content);

	return (
		<EditorFrame title={title}>
			{locked ? <LockedNote /> : null}
			<Card>
				<Card.Body>
					<RichTextField
						label={t`Summary`}
						value={content}
						disabled={locked}
						hint={hint}
						labelAction={labelAction}
						autoFocus={!locked && autoFocus}
						testID="summary-field"
						onChange={(html) =>
							source.update(
								(draft) => {
									draft.summary.content = html;
								},
								{ coalesceKey: "summary.content" },
							)
						}
					/>
				</Card.Body>
			</Card>
		</EditorFrame>
	);
}
