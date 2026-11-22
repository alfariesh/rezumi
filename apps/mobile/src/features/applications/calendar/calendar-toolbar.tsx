// Above the calendar: what range it shows and how many interviews are in it, previous/next, Today, the Day · Week ·
// Month switch, and Schedule interview.
import type { Calendar } from "./use-calendar";
import type { CalendarView } from "@rezumi/career/calendar";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { dateOfKey } from "@rezumi/career/calendar";
import { Button, IconButton, Segment, Text, Typography } from "@/ui";

type CalendarToolbarProps = { calendar: Calendar; onSchedule: () => void };

export function CalendarToolbar({ calendar, onSchedule }: CalendarToolbarProps) {
	const { t, i18n } = useLingui();
	const { view, days, month, anchor } = calendar;
	const utc = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(i18n.locale, { timeZone: "UTC", ...options });
	const first = days[0] ?? anchor;
	const last = days.at(-1) ?? anchor;
	const title =
		view === "month"
			? utc({ month: "long", year: "numeric" }).format(Date.UTC(month.year, month.month, 1))
			: view === "day"
				? utc({ weekday: "long", day: "numeric", month: "long" }).format(dateOfKey(anchor))
				: `${utc({ day: "numeric", month: "short" }).format(dateOfKey(first))} – ${utc({ day: "numeric", month: "short", year: "numeric" }).format(dateOfKey(last))}`;
	const previous = { day: t`Previous day`, week: t`Previous days`, month: t`Previous month` }[view];
	const next = { day: t`Next day`, week: t`Next days`, month: t`Next month` }[view];
	return (
		<View className="gap-3 px-4 pt-2">
			<View className="flex-row items-center gap-1">
				<View className="flex-1">
					<Typography.Heading type="h6" accessibilityRole="header" numberOfLines={1}>
						{title}
					</Typography.Heading>
					<Text size="xs" tone="muted">
						{plural(calendar.interviewCount, { 0: "No interviews", one: "# interview", other: "# interviews" })}
					</Text>
				</View>
				<IconButton icon="caret-left" variant="ghost" label={previous} onPress={() => calendar.step(-1)} />
				<IconButton icon="caret-right" variant="ghost" label={next} onPress={() => calendar.step(1)} />
			</View>
			<View className="flex-row items-center gap-2">
				<Segment<CalendarView>
					className="flex-1"
					size="sm"
					accessibilityLabel={t`Calendar view`}
					value={view}
					onValueChange={(value) => calendar.show(value)}
					options={[
						{ value: "day", label: t`Day` },
						{ value: "week", label: t({ message: "Week", context: "Calendar view of several days" }) },
						{ value: "month", label: t`Month` },
					]}
				/>
				<Button size="sm" variant="tertiary" isDisabled={calendar.showsToday} onPress={calendar.goToday}>
					<Button.Label>{t`Today`}</Button.Label>
				</Button>
				<IconButton
					icon="calendar-plus"
					variant="secondary"
					label={t`Schedule interview`}
					isDisabled={calendar.open.length === 0}
					onPress={onSchedule}
					testID="calendar-schedule"
				/>
			</View>
		</View>
	);
}
