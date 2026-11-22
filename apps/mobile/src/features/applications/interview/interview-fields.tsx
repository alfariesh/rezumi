// The interview sheet's body: kind, when, where, who, what to prepare, the device reminder, and for a saved interview
// Add to calendar and Delete. The time zone list replaces the form inside the same sheet.
import type { InterviewEditor } from "./use-interview-editor";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Choices } from "./choices";
import { INTERVIEW_KIND_ORDER } from "./draft";
import { PeopleField } from "./people-field";
import { ReminderField } from "./reminder-field";
import { WhenFields } from "./when-fields";
import { ZoneList } from "./zone-list";
import { getInterviewKindLabel } from "@/features/applications/stages";
import { Button, Icon, Input, Label, Text, TextArea, TextField } from "@/ui";

type InterviewFieldsProps = { editor: InterviewEditor; onDelete: () => void };

export function InterviewFields({ editor, onDelete }: InterviewFieldsProps) {
	const { t } = useLingui();
	const { application, interview, draft, set, pending } = editor;
	if (editor.view === "zone") return <ZoneList editor={editor} />;
	return (
		<View className="gap-5 pb-2">
			<Text tone="muted" numberOfLines={2}>
				{application.role} · {application.company}
			</Text>
			<Choices
				label={t`Type`}
				options={INTERVIEW_KIND_ORDER.map((kind) => ({ value: kind, label: getInterviewKindLabel(kind) }))}
				value={draft.kind}
				onChange={(kind) => set("kind", kind)}
				isDisabled={pending}
			/>
			<WhenFields editor={editor} />
			<TextField>
				<Label>{t`Location`}</Label>
				<Input
					variant="secondary"
					value={draft.location}
					maxLength={500}
					editable={!pending}
					autoCapitalize="none"
					placeholder={t`Video link, office address or phone number`}
					accessibilityLabel={t`Location`}
					onChangeText={(location) => set("location", location)}
				/>
			</TextField>
			<PeopleField editor={editor} />
			<TextField>
				<Label>{t`What they asked you to prepare`}</Label>
				<TextArea
					variant="secondary"
					value={draft.notes}
					maxLength={5000}
					editable={!pending}
					accessibilityLabel={t`What they asked you to prepare`}
					onChangeText={(notes) => set("notes", notes)}
				/>
			</TextField>
			<ReminderField editor={editor} />
			{interview ? (
				<View className="gap-2">
					<Button variant="secondary" isDisabled={pending} onPress={() => void editor.share()}>
						<Icon name="calendar-plus" size={16} />
						<Button.Label>{t`Add to calendar`}</Button.Label>
					</Button>
					<Button variant="danger-soft" isDisabled={pending} onPress={onDelete} testID="interview-delete">
						<Icon name="trash" size={16} />
						<Button.Label>{t`Delete interview`}</Button.Label>
					</Button>
				</View>
			) : null}
		</View>
	);
}
