// Tablets: the job at a glance beside every part (web ContextColumn): the next step with the interview's time, place
// and people, Add to calendar, the posting link and the contacts.
import type { Application } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Linking, ScrollView, View } from "react-native";
import { buildIcs, icsFileName, interviewEvent } from "@rezumi/career/ics";
import { getInitials } from "@rezumi/utils/string";
import { shareText } from "./share";
import { useUserTime } from "@/features/applications/date";
import { describeNextStep, getNextStep } from "@/features/applications/next-step";
import { getInterviewKindLabel } from "@/features/applications/stages";
import { Avatar, Button, Icon, Text, Typography, showToast } from "@/ui";

type ContextColumnProps = {
	application: Application;
	interview: InterviewTimelineEntry | undefined;
	now: Date;
	onInterview: () => void;
};

export function ContextColumn({ application, interview, now, onInterview }: ContextColumnProps) {
	const { t } = useLingui();
	const { day, time, locale, timeZone } = useUserTime();
	const step = getNextStep(application, now);
	const text = describeNextStep(step, application, locale, timeZone);
	const upcoming = step.kind === "interview" ? step.interview : interview;
	const kind = upcoming ? getInterviewKindLabel(upcoming.kind) : "";
	const people = [
		...(upcoming?.participants ?? []).map((person) => ({ name: person.name, role: person.role ?? "" })),
		...application.contacts.map((contact) => ({ name: contact.name, role: contact.role ?? "" })),
	].filter((person, index, all) => all.findIndex((other) => other.name === person.name) === index);

	const addToCalendar = async () => {
		if (!upcoming) return;
		const ics = buildIcs(interviewEvent(upcoming, t`${kind} interview · ${application.role}, ${application.company}`));
		try {
			await shareText(icsFileName(application.company, "interview"), ics, "text/calendar", "com.apple.ical.ics");
		} catch {
			showToast({ title: t`Couldn't share the calendar file. Try again.`, variant: "danger" });
		}
	};

	return (
		<ScrollView
			className="w-72 border-e border-separator"
			contentContainerClassName="gap-6 p-5"
			testID="workspace-context"
		>
			<View className="gap-2">
				<Text size="xs" weight="semibold" tone="muted">{t`Next step`}</Text>
				<View className="flex-row items-start gap-2">
					<Icon name={upcoming ? "calendar-dot" : text.icon} size={18} tone="muted" />
					<View className="flex-1 gap-0.5">
						<Text weight="semibold">{upcoming ? t`${kind} interview` : text.title}</Text>
						{upcoming ? (
							<Typography type="body-xs" color="muted">
								{`${day(upcoming.at)} · ${time(upcoming.at)} · ${plural(upcoming.durationMinutes, { one: "# min", other: "# min" })}`}
							</Typography>
						) : text.sub ? (
							<Typography type="body-xs" color="muted">
								{text.sub}
							</Typography>
						) : null}
						{upcoming?.location ? (
							<Typography type="body-xs" color="muted">
								{upcoming.location}
							</Typography>
						) : null}
					</View>
				</View>
				{upcoming ? (
					<Button size="sm" variant="secondary" onPress={() => void addToCalendar()}>
						<Icon name="calendar-plus" size={16} />
						<Button.Label>{t`Add to calendar`}</Button.Label>
					</Button>
				) : (
					<Button size="sm" variant="secondary" onPress={onInterview}>
						<Button.Label>{t`Add an interview`}</Button.Label>
					</Button>
				)}
				{upcoming?.notes ? (
					<Typography type="body-xs" color="muted" className="rounded-xl bg-surface-secondary px-3 py-2">
						{upcoming.notes}
					</Typography>
				) : null}
			</View>
			{people.length > 0 ? (
				<View className="gap-2">
					<Text size="xs" weight="semibold" tone="muted">{t`People`}</Text>
					{people.map((person) => (
						<View key={person.name} className="flex-row items-center gap-2.5">
							<Avatar size="sm" alt={person.name}>
								<Avatar.Fallback>{getInitials(person.name)}</Avatar.Fallback>
							</Avatar>
							<View className="min-w-0 flex-1">
								<Text weight="medium" numberOfLines={1}>
									{person.name}
								</Text>
								{person.role ? (
									<Text size="xs" tone="muted" numberOfLines={1}>
										{person.role}
									</Text>
								) : null}
							</View>
						</View>
					))}
				</View>
			) : null}
			{application.sourceUrl ? (
				<Button
					size="sm"
					variant="ghost"
					className="self-start"
					onPress={() => void Linking.openURL(application.sourceUrl ?? "")}
				>
					<Icon name="arrow-square-out" size={16} />
					<Button.Label>{t`Open the posting`}</Button.Label>
				</Button>
			) : null}
		</ScrollView>
	);
}
