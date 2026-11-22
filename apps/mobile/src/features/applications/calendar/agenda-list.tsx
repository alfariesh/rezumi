// Under (phones) or beside (tablets) the calendar: the chosen day's events, then everything coming up by day.
import type { AppEvent, AppTimedEvent, Calendar } from "./use-calendar";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { addDays, dateOfKey, groupByDay, upcomingEvents } from "@rezumi/career/calendar";
import { EventCard } from "./event-card";
import { EmptyState, LinkButton, Text, Typography } from "@/ui";

type AgendaListProps = {
	calendar: Calendar;
	onEditInterview: (event: AppTimedEvent) => void;
	onOpenApplication: (id: string) => void;
	onSchedule: () => void;
};

export function AgendaList({ calendar, onEditInterview, onOpenApplication, onSchedule }: AgendaListProps) {
	const { t, i18n } = useLingui();
	const { today, anchor, byDay, view } = calendar;
	const fullDay = new Intl.DateTimeFormat(i18n.locale, {
		timeZone: "UTC",
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const tomorrow = addDays(today, 1);
	const heading = (key: string) =>
		key === today ? t`Today` : key === tomorrow ? t`Tomorrow` : fullDay.format(dateOfKey(key));
	const upcoming = [...groupByDay(upcomingEvents(calendar.events, calendar.now, today))];
	const selected = byDay.get(anchor) ?? [];
	const card = (event: AppEvent) => (
		<EventCard key={event.id} event={event} onEditInterview={onEditInterview} onOpenApplication={onOpenApplication} />
	);
	return (
		<View className="gap-6">
			{view === "month" ? (
				<View className="gap-2">
					<View className="flex-row items-center justify-between gap-2">
						<Typography.Heading type="h6" accessibilityRole="header">
							{heading(anchor)}
						</Typography.Heading>
						<LinkButton size="sm" onPress={() => calendar.show("day", anchor)}>
							<LinkButton.Label>{t`Open day`}</LinkButton.Label>
						</LinkButton>
					</View>
					{selected.length ? selected.map(card) : <Text tone="muted">{t`Nothing on this day.`}</Text>}
				</View>
			) : null}
			<View className="gap-3">
				<Typography.Heading type="h6" accessibilityRole="header">
					{t`Coming up`}
				</Typography.Heading>
				{upcoming.length === 0 ? (
					<EmptyState
						kind="inline"
						title={t`Nothing scheduled yet`}
						description={t`Add screening calls and interviews to see them here and on the calendar.`}
						action={calendar.open.length ? { label: t`Schedule interview`, onPress: onSchedule } : undefined}
					/>
				) : (
					upcoming.map(([day, items]) => (
						<View key={day} className="gap-2">
							<Text size="xs" weight="medium" tone="muted">
								{heading(day)}
							</Text>
							{items.map(card)}
						</View>
					))
				)}
			</View>
		</View>
	);
}
