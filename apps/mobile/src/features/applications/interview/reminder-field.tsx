// "Remind me on this device": a local notification before the interview, at one of the lead times. Turning it on asks
// for notifications (the primer first); only this device schedules it.
import type { InterviewEditor } from "./use-interview-editor";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Choices } from "./choices";
import { leadLabel } from "@/features/applications/date";
import { REMINDER_LEADS } from "@/features/reminders";
import { ListRow, ListSection, Switch } from "@/ui";

type ReminderFieldProps = { editor: InterviewEditor };

export function ReminderField({ editor }: ReminderFieldProps) {
	const { t } = useLingui();
	const { reminder, pending } = editor;
	return (
		<View className="gap-3">
			<ListSection>
				<ListRow
					title={t`Remind me on this device`}
					description={t`Only this device schedules the notification.`}
					icon="bell"
					trailing={
						<Switch
							isSelected={reminder.on}
							isDisabled={pending}
							onSelectedChange={(on) => void editor.setReminderOn(on)}
							accessibilityLabel={t`Remind me on this device`}
							testID="interview-reminder"
						/>
					}
				/>
			</ListSection>
			{reminder.on ? (
				<Choices
					label={t`Before the interview`}
					options={REMINDER_LEADS.map((lead) => ({ value: lead, label: leadLabel(lead) }))}
					value={reminder.lead}
					onChange={editor.setLead}
					isDisabled={pending}
				/>
			) : null}
		</View>
	);
}
