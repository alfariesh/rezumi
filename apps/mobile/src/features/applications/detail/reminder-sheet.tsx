// A notification on this device for the next step; permission is asked when it's turned on, never before. Interviews
// pick how long before; a follow-up fires at 09:00 that day.
import type { ReminderTarget } from "@/features/reminders";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { Linking, View } from "react-native";
import { leadLabel } from "../date";
import { DEFAULT_LEAD, REMINDER_LEADS, useReminders } from "@/features/reminders";
import { Alert, Button, Icon, ListRow, ListSection, Segment, Sheet, Switch, Text, showToast } from "@/ui";

type ReminderSheetProps = {
	target: ReminderTarget | null;
	/** "Mon 19 Oct, 16:00 · Europe/Berlin" */
	when: string;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onShareIcs: () => void;
};

export function ReminderSheet({ target, when, isOpen, onOpenChange, onShareIcs }: ReminderSheetProps) {
	const { t } = useLingui();
	const reminders = useReminders(target?.applicationId ?? "");
	const [denied, setDenied] = useState(false);
	const [busy, setBusy] = useState(false);
	const lead = target ? reminders.leadFor(target) : null;
	const interview = target?.kind === "interview";

	const turnOn = async (minutes: number) => {
		if (!target) return;
		setBusy(true);
		try {
			const result = await reminders.turnOn(target, minutes);
			setDenied(result === "denied");
			if (result === "passed") showToast({ title: t`That reminder time has already passed.` });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Sheet isOpen={isOpen && target !== null} onOpenChange={onOpenChange} title={target?.title} closeLabel={t`Close`}>
			<View className="gap-4 pb-2">
				<Text tone="muted">{when}</Text>
				<ListSection>
					<ListRow
						title={t`Remind me on this device`}
						trailing={
							<Switch
								isSelected={lead !== null}
								isDisabled={busy}
								accessibilityLabel={t`Remind me on this device`}
								onSelectedChange={(on) =>
									void (on ? turnOn(interview ? DEFAULT_LEAD : 0) : target && reminders.turnOff(target))
								}
							/>
						}
					/>
				</ListSection>
				{interview && lead !== null ? (
					<Segment
						accessibilityLabel={t`Before the interview`}
						value={String(lead)}
						options={REMINDER_LEADS.map((minutes) => ({ value: String(minutes), label: leadLabel(minutes) }))}
						onValueChange={(minutes) => void turnOn(Number(minutes))}
					/>
				) : null}
				{denied ? (
					<Alert status="warning">
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>{t`Notifications are off`}</Alert.Title>
							<Alert.Description>{t`To get a reminder, allow notifications in your device settings.`}</Alert.Description>
						</Alert.Content>
						<Button size="sm" variant="secondary" onPress={() => void Linking.openSettings()}>
							<Button.Label>{t`Settings`}</Button.Label>
						</Button>
					</Alert>
				) : (
					<Text size="xs" tone="muted">
						{t`Only this device schedules the notification.`}
					</Text>
				)}
				<Button variant="secondary" onPress={onShareIcs}>
					<Icon name="calendar-plus" size={16} />
					<Button.Label>{t`Add to calendar`}</Button.Label>
				</Button>
			</View>
		</Sheet>
	);
}
