// One interview or follow-up in the day list and Coming up. An interview opens its sheet (edit, reschedule, delete);
// a follow-up opens its application. View application is always there.
import type { AppEvent, AppTimedEvent } from "./use-calendar";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { useUserTime } from "@/features/applications/date";
import { getInterviewKindLabel } from "@/features/applications/stages";
import { Card, LinkButton, Text, cx } from "@/ui";

type EventCardProps = {
	event: AppEvent;
	onEditInterview: (event: AppTimedEvent) => void;
	onOpenApplication: (id: string) => void;
};

export function EventCard({ event, onEditInterview, onOpenApplication }: EventCardProps) {
	const { t } = useLingui();
	const userTime = useUserTime();
	const { application } = event;
	const interview = event.kind === "interview" ? event.interview : null;
	const otherZone = interview?.timezone && interview.timezone !== userTime.timeZone ? interview.timezone : null;
	const when = event.kind === "interview" ? `${userTime.time(event.start)} – ${userTime.time(event.end)}` : null;
	const title =
		event.kind === "interview"
			? t`${getInterviewKindLabel(event.interview.kind)} interview · ${event.interview.durationMinutes} min`
			: application.followUpNote || t`Follow up`;
	const press = () => (event.kind === "interview" ? onEditInterview(event) : onOpenApplication(application.id));
	return (
		<Card className={cx("gap-1 border-s-4 p-3", interview ? "border-accent" : "border-warning")}>
			<Pressable
				onPress={press}
				accessibilityRole="button"
				accessibilityHint={interview ? t`Edits the interview` : t`Opens the application`}
				className="gap-0.5"
				testID={`event-card-${event.id}`}
			>
				{when ? (
					<Text weight="semibold" tabular>
						{when}
					</Text>
				) : null}
				{otherZone && interview ? (
					<Text size="xs" tone="muted">
						{t`${userTime.time(interview.at, otherZone)} in ${otherZone}`}
					</Text>
				) : null}
				<Text weight="medium" numberOfLines={1}>
					{application.company}
				</Text>
				<Text size="xs" tone="muted" numberOfLines={2}>
					{title} · {application.role}
				</Text>
				{interview?.location ? (
					<Text size="xs" tone="muted" numberOfLines={1}>
						{interview.location}
					</Text>
				) : null}
			</Pressable>
			<View className="flex-row flex-wrap gap-3">
				{event.kind === "interview" ? (
					<LinkButton size="sm" onPress={() => onEditInterview(event)}>
						<LinkButton.Label>{t`Reschedule…`}</LinkButton.Label>
					</LinkButton>
				) : null}
				<LinkButton size="sm" onPress={() => onOpenApplication(application.id)}>
					<LinkButton.Label>{t`View application`}</LinkButton.Label>
				</LinkButton>
			</View>
		</Card>
	);
}
