// Activity (the web's detail/activity.tsx): stage moves, notes and interviews, newest first, and a field to add a
// note. A tap edits an entry's day (and a note's text) or opens the interview; the entry that marks the current stage
// stays. Deleting an entry asks first.
import type { Application } from "../types";
import type { ApplicationTimelineEntry, InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { useUserTime } from "../date";
import { useDetailMutations } from "../queries";
import { getInterviewKindLabel, getStageLabel } from "../stages";
import { FormField } from "./form-field";
import { DetailSection } from "./section";
import { Button, ConfirmDialog, DatePicker, Icon, ListRow, ListSection, Sheet, StageDot, showToast } from "@/ui";

type DatedEntry = Exclude<ApplicationTimelineEntry, { type: "interview" }>;

type ActivityProps = { application: Application; onInterview: (interview: InterviewTimelineEntry) => void };

export function Activity({ application, onInterview }: ActivityProps) {
	const { t } = useLingui();
	const { when, utcDay } = useUserTime();
	const { addNote, updateEntry, deleteEntry } = useDetailMutations(application.id);
	const [note, setNote] = useState("");
	const [editing, setEditing] = useState<DatedEntry | null>(null);
	const [deleting, setDeleting] = useState<DatedEntry | null>(null);
	const sorted = application.activity.toSorted((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
	const anchorId = sorted.find((entry) => entry.type === "stage" && entry.stage === application.status)?.id;
	const failed = () => showToast({ title: t`Couldn't update the activity. Try again.`, variant: "danger" });
	const submit = () => {
		const text = note.trim();
		if (!text || addNote.isPending) return;
		addNote.mutate({ id: application.id, text }, { onSuccess: () => setNote(""), onError: failed });
	};
	const describe = (entry: ApplicationTimelineEntry) =>
		entry.type === "stage"
			? t`Moved to ${getStageLabel(entry.stage)}`
			: entry.type === "note"
				? entry.text
				: [t`${getInterviewKindLabel(entry.kind)} interview`, entry.location].filter(Boolean).join(" · ");

	return (
		<DetailSection title={t`Activity`} testID="activity">
			<View className="flex-row items-end gap-2">
				<View className="flex-1">
					<FormField
						label={t`Add a note`}
						value={note}
						placeholder={t`Called the recruiter…`}
						returnKeyType="send"
						onChangeText={setNote}
						onSubmitEditing={submit}
						isDisabled={addNote.isPending}
					/>
				</View>
				<Button
					variant="secondary"
					isDisabled={!note.trim() || addNote.isPending}
					onPress={submit}
					testID="activity-add"
				>
					<Button.Label>{t`Add`}</Button.Label>
				</Button>
			</View>
			<ListSection>
				{sorted.map((entry) => (
					<ListRow
						key={entry.id}
						leading={
							entry.type === "stage" ? (
								<StageDot stage={entry.stage} />
							) : (
								<Icon name={entry.type === "note" ? "note-pencil" : "calendar-dot"} size={16} tone="muted" />
							)
						}
						title={describe(entry)}
						description={entry.type === "interview" ? when(entry.at) : utcDay(entry.at)}
						accessibilityHint={entry.type === "interview" ? t`Edits the interview` : t`Edits the entry`}
						onPress={() => (entry.type === "interview" ? onInterview(entry) : setEditing(entry))}
					/>
				))}
			</ListSection>
			<Sheet
				isOpen={editing !== null}
				onOpenChange={(open) => !open && setEditing(null)}
				title={editing?.type === "note" ? t`Edit note` : t`Edit date`}
				closeLabel={t`Close`}
			>
				{editing ? (
					<EntryForm
						key={editing.id}
						entry={editing}
						busy={updateEntry.isPending}
						onSave={(patch) =>
							updateEntry.mutate(
								{ id: application.id, entryId: editing.id, ...patch },
								{ onSuccess: () => setEditing(null), onError: failed },
							)
						}
						onDelete={
							editing.id === anchorId
								? null
								: () => {
										setDeleting(editing);
										setEditing(null);
									}
						}
					/>
				) : null}
			</Sheet>
			<ConfirmDialog
				isOpen={deleting !== null}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={t`Delete this entry?`}
				message={t`It's removed from the activity for good.`}
				confirmLabel={t`Delete entry`}
				cancelLabel={t`Keep entry`}
				destructive
				onConfirm={() => {
					if (deleting) deleteEntry.mutate({ id: application.id, entryId: deleting.id }, { onError: failed });
				}}
			/>
		</DetailSection>
	);
}

type EntryFormProps = {
	entry: DatedEntry;
	busy: boolean;
	onSave: (patch: { date: string; text?: string }) => void;
	onDelete: (() => void) | null;
};

/** A stage or note entry's day (entries are whole days stored at noon UTC), and a note's text. */
function EntryForm({ entry, busy, onSave, onDelete }: EntryFormProps) {
	const { t, i18n } = useLingui();
	const [date, setDate] = useState<string | null>(new Date(entry.at).toISOString().slice(0, 10));
	const [text, setText] = useState(entry.type === "note" ? entry.text : "");
	return (
		<View className="gap-4 pb-2">
			{entry.type === "note" ? <FormField label={t`Note`} value={text} onChangeText={setText} multiline /> : null}
			<DatePicker
				label={t`Date`}
				value={date}
				onChange={setDate}
				placeholder={t`Choose a day`}
				locale={i18n.locale}
				variant="secondary"
			/>
			<Button
				variant="primary"
				isDisabled={!date || busy}
				onPress={() => date && onSave({ date, ...(entry.type === "note" && text.trim() ? { text: text.trim() } : {}) })}
			>
				<Button.Label>{t`Save`}</Button.Label>
			</Button>
			{onDelete ? (
				<Button variant="danger-soft" onPress={onDelete}>
					<Button.Label>{t`Delete entry…`}</Button.Label>
				</Button>
			) : null}
		</View>
	);
}
