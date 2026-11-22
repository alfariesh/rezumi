// The follow-up: a day and what to do, shown as the next step until done, with an optional reminder on this device
// (09:00 that day on the user's clock). Clear removes it and its reminder.
import type { Application } from "../types";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { followUpDay } from "@rezumi/career/calendar";
import { useUserTime } from "../date";
import { followUpReminder, useApplicationMutations } from "../queries";
import { FormField } from "./form-field";
import { followUpStart, useReminders } from "@/features/reminders";
import { Button, DatePicker, ListRow, ListSection, Sheet, Switch, Text, showToast } from "@/ui";

type FollowUpSheetProps = { application: Application; isOpen: boolean; onOpenChange: (open: boolean) => void };

export function FollowUpSheet({ application, isOpen, onOpenChange }: FollowUpSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t`Follow-up`} closeLabel={t`Close`}>
			{isOpen ? <FollowUpForm application={application} onDone={() => onOpenChange(false)} /> : null}
		</Sheet>
	);
}

type FollowUpFormProps = { application: Application; onDone: () => void };

export function FollowUpForm({ application, onDone }: FollowUpFormProps) {
	const { t, i18n } = useLingui();
	const { timeZone } = useUserTime();
	const { update } = useApplicationMutations();
	const reminders = useReminders(application.id);
	const existing = reminders.leadFor({ kind: "follow-up", applicationId: application.id });
	// The web stores the bare day at UTC midnight; read it as that day, not the evening before west of UTC.
	const [date, setDate] = useState<string | null>(() =>
		application.followUpAt ? followUpDay(application.followUpAt, timeZone) : null,
	);
	const [note, setNote] = useState(application.followUpNote ?? "");
	const [remind, setRemind] = useState<boolean | null>(null);
	const reminderOn = remind ?? existing !== null;

	const save = (followUpAt: Date | null) =>
		update.mutate(
			{ id: application.id, followUpAt, followUpNote: followUpAt ? note.trim() || null : null },
			{
				onSuccess: async (saved) => {
					onDone();
					const target = followUpReminder(saved);
					if (target && reminderOn) {
						if ((await reminders.turnOn(target, 0)) === "denied")
							showToast({
								title: t`The follow-up is saved. To get a reminder, allow notifications in Settings.`,
							});
					} else if (existing !== null) {
						await reminders.turnOff({ kind: "follow-up", applicationId: application.id });
					}
				},
				onError: () => showToast({ title: t`Couldn't save the follow-up. Try again.`, variant: "danger" }),
			},
		);

	return (
		<View className="gap-4 pb-2">
			<Text tone="muted">{t`A reminder to check in, shown as the next step until you do.`}</Text>
			<DatePicker
				label={t`Date`}
				value={date}
				onChange={setDate}
				placeholder={t`Choose a day`}
				locale={i18n.locale}
				variant="secondary"
				testID="follow-up-date"
			/>
			<FormField label={t`What to do`} value={note} placeholder={t`Email the recruiter`} onChangeText={setNote} />
			<ListSection>
				<ListRow
					title={t`Remind me on this device`}
					description={t`At 09:00 that day (${timeZone}).`}
					trailing={
						<Switch
							isSelected={reminderOn}
							onSelectedChange={setRemind}
							accessibilityLabel={t`Remind me on this device`}
						/>
					}
				/>
			</ListSection>
			<Button
				variant="primary"
				isDisabled={!date || update.isPending}
				onPress={() => {
					const at = date ? followUpStart(date, timeZone) : null;
					if (at) save(at);
				}}
				testID="follow-up-save"
			>
				<Button.Label>{t`Save`}</Button.Label>
			</Button>
			{application.followUpAt ? (
				<Button variant="ghost" isDisabled={update.isPending} onPress={() => save(null)} testID="follow-up-clear">
					<Button.Label>{t`Clear the follow-up`}</Button.Label>
				</Button>
			) : null}
		</View>
	);
}
