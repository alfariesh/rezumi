// Next step (the web's next-step-card.tsx): what the application needs, on the user's clock, warn-toned when overdue.
// Edit schedules or edits an interview or sets the follow-up; dated steps get a device reminder and Add to calendar
// (an .ics file through the share sheet).
import type { Application } from "../types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { getNextStep, interviewEnd } from "@rezumi/career/applications";
import { followUpEvent, icsFileName, interviewEvent } from "@rezumi/career/ics";
import { zonedParts } from "@rezumi/career/time";
import { useNow, useUserTime } from "../date";
import { describeNextStep } from "../next-step";
import { followUpReminder, interviewReminder } from "../queries";
import { FollowUpSheet } from "./follow-up-sheet";
import { ReminderSheet } from "./reminder-sheet";
import { DetailSection } from "./section";
import { shareIcs } from "@/features/reminders";
import { Button, Icon, Menu, Text, cx, showToast } from "@/ui";

type NextStepCardProps = {
	application: Application;
	onInterview: (interview: InterviewTimelineEntry | null) => void;
};

export function NextStepCard({ application, onInterview }: NextStepCardProps) {
	const { t } = useLingui();
	const now = useNow();
	const { locale, timeZone, when, time, day } = useUserTime();
	const [followUpOpen, setFollowUpOpen] = useState(false);
	const [reminderOpen, setReminderOpen] = useState(false);
	const step = getNextStep(application, now);
	const text = describeNextStep(step, application, locale, timeZone);
	const warn = text.tone === "warn";
	const interview = step.kind === "interview" ? step.interview : null;
	const dated = step.kind === "interview" || step.kind === "follow-up";
	const zone = interview?.timezone && interview.timezone !== timeZone ? interview.timezone : null;
	const sub = interview
		? `${when(interview.at)}–${time(interviewEnd(interview))} · ${timeZone}`
		: step.kind === "follow-up"
			? day(step.at)
			: text.sub;
	const target = interview ? interviewReminder(application, interview) : followUpReminder(application);

	const addToCalendar = () => {
		if (step.kind !== "interview" && step.kind !== "follow-up") return;
		const title = `${text.title} · ${application.role}, ${application.company}`;
		void shareIcs(
			step.kind === "interview" ? interviewEvent(step.interview, title) : followUpEvent(application.id, step.at, title),
			icsFileName(application.company, zonedParts(step.at, timeZone).date),
		).catch(() => showToast({ title: t`Couldn't share the calendar event. Try again.`, variant: "danger" }));
	};

	const edit =
		step.kind === "closed" ? null : (
			<Menu>
				<Menu.Trigger asChild>
					<Button size="sm" variant="ghost" accessibilityLabel={t`Edit the next step`} testID="next-step-edit">
						<Icon name="pencil-simple" size={16} />
						<Button.Label>{t`Edit`}</Button.Label>
					</Button>
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Overlay />
					<Menu.Content presentation="popover" width={240}>
						{interview ? (
							<Menu.Item id="edit-interview" onPress={() => onInterview(interview)}>
								<Menu.ItemTitle>{t`Edit this interview…`}</Menu.ItemTitle>
							</Menu.Item>
						) : null}
						<Menu.Item id="schedule" onPress={() => onInterview(null)}>
							<Menu.ItemTitle>{t`Schedule an interview…`}</Menu.ItemTitle>
						</Menu.Item>
						<Menu.Item id="follow-up" onPress={() => setFollowUpOpen(true)}>
							<Menu.ItemTitle>{application.followUpAt ? t`Change the follow-up…` : t`Set a follow-up…`}</Menu.ItemTitle>
						</Menu.Item>
					</Menu.Content>
				</Menu.Portal>
			</Menu>
		);

	return (
		<DetailSection title={t`Next step`} action={edit} testID="next-step">
			<View className={cx("gap-3 rounded-2xl p-4", warn ? "bg-warning-soft" : "bg-surface-secondary")}>
				<View className="flex-row gap-3">
					<Icon name={text.icon} tone={warn ? "warning-soft-foreground" : "foreground"} />
					<View className="min-w-0 flex-1 gap-0.5">
						<Text weight="semibold" tone={warn ? "warning" : "default"}>
							{text.title}
						</Text>
						{sub ? <Text tone="muted">{sub}</Text> : null}
						{zone && interview ? (
							<Text size="xs" tone="muted">
								{`${time(interview.at, zone)} ${zone}`}
							</Text>
						) : null}
						{interview?.location ? (
							<Text size="xs" tone="muted">
								{interview.location}
							</Text>
						) : null}
					</View>
				</View>
				{dated ? (
					<View className="flex-row flex-wrap gap-2">
						<Button size="sm" variant="secondary" onPress={addToCalendar} testID="next-step-calendar">
							<Icon name="calendar-plus" size={16} />
							<Button.Label>{t`Add to calendar`}</Button.Label>
						</Button>
						<Button size="sm" variant="ghost" onPress={() => setReminderOpen(true)} testID="next-step-reminder">
							<Icon name="bell" size={16} />
							<Button.Label>{t`Reminder`}</Button.Label>
						</Button>
					</View>
				) : null}
			</View>
			<FollowUpSheet application={application} isOpen={followUpOpen} onOpenChange={setFollowUpOpen} />
			<ReminderSheet
				target={dated ? target : null}
				when={sub}
				isOpen={reminderOpen}
				onOpenChange={setReminderOpen}
				onShareIcs={addToCalendar}
			/>
		</DetailSection>
	);
}
