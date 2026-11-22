import type { AppEvent, AppTimedEvent } from "./use-calendar";
// The day and week views: hours down the side, a column per day, interviews placed by their time on the user's clock
// and follow-ups in a row above the hours. Tapping a day's heading opens that day.
import type { ApplicationSummary } from "@/features/applications/types";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { dateOfKey, minutesOf, timeOf, zonedTime } from "@rezumi/career/calendar";
import { DayColumn, HOURS, at } from "./day-column";
import { Text, cx, size } from "@/ui";

export type TimeGridProps = {
	/** Day keys shown as columns, left to right. */
	days: readonly string[];
	events: readonly AppEvent[];
	timeZone: string;
	today: string;
	now: Date;
	/** Points per hour. */
	hourHeight: number;
	onEdit: (event: AppTimedEvent) => void;
	onFollowUp: (application: ApplicationSummary) => void;
	onReschedule: (event: AppTimedEvent, start: Date, durationMinutes: number) => void;
	onPickSlot?: ((day: string, time: string) => void) | undefined;
	onOpenDay: (day: string) => void;
	/** True while an interview is held, so the screen stops scrolling. */
	onDragChange: (dragging: boolean) => void;
};

export function TimeGrid(props: TimeGridProps) {
	const { days, events, timeZone, today, now, hourHeight } = props;
	const { t, i18n } = useLingui();
	const [width, setWidth] = useState(0);
	const gutter = size.hit;
	const columnWidth = days.length ? Math.max(0, (width - gutter) / days.length) : 0;
	const utc = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(i18n.locale, { timeZone: "UTC", ...options });
	const weekday = utc({ weekday: "short" });
	const fullDay = utc({ weekday: "long", day: "numeric", month: "long" });
	const followUps = events.filter(
		(event): event is Extract<AppEvent, { kind: "follow-up" }> =>
			event.kind === "follow-up" && days.includes(event.day),
	);
	const nowMinutes = minutesOf(zonedTime(now, timeZone));
	const body = { height: hourHeight * 24 };

	return (
		<View
			className="overflow-hidden rounded-2xl border border-border bg-surface"
			onLayout={(event) => setWidth(event.nativeEvent.layout.width - 2)}
			testID="time-grid"
		>
			{days.length > 1 ? (
				<View className="flex-row ps-11">
					{days.map((day) => {
						const count = events.filter((event) => event.kind === "interview" && event.day === day).length;
						const isToday = day === today;
						return (
							<Pressable
								key={day}
								accessibilityRole="button"
								accessibilityLabel={`${fullDay.format(dateOfKey(day))}${count ? `: ${plural(count, { one: "# interview", other: "# interviews" })}` : ""}`}
								accessibilityHint={t`Shows this day`}
								onPress={() => props.onOpenDay(day)}
								className="flex-1 items-center gap-0.5 py-2"
							>
								<Text size="xs" tone="muted">
									{weekday.format(dateOfKey(day))}
								</Text>
								<View className={cx("size-7 items-center justify-center rounded-full", isToday && "bg-accent")}>
									<Text weight="semibold" className={cx(isToday && "text-accent-foreground")}>
										{dateOfKey(day).getUTCDate()}
									</Text>
								</View>
							</Pressable>
						);
					})}
				</View>
			) : null}

			{followUps.length ? (
				<View className="flex-row border-t border-border ps-11">
					{days.map((day) => (
						<View key={day} className="flex-1 gap-0.5 p-0.5">
							{followUps
								.filter((event) => event.day === day)
								.map((event) => (
									<Pressable
										key={event.id}
										accessibilityRole="button"
										accessibilityLabel={t`Follow up: ${event.application.company}, ${fullDay.format(dateOfKey(day))}`}
										accessibilityHint={t`Opens the application`}
										onPress={() => props.onFollowUp(event.application)}
										className="rounded-md bg-warning-soft px-1 py-0.5"
									>
										<Text size="xs" tone="warning" numberOfLines={1}>
											{event.application.company}
										</Text>
									</Pressable>
								))}
						</View>
					))}
				</View>
			) : null}

			<View className="flex-row border-t border-border" style={body}>
				<View className="w-11" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
					{HOURS.map((hour) =>
						hour ? (
							<View key={hour} className="absolute w-full items-center" style={at(hour * hourHeight - 8)}>
								<Text size="xs" tone="muted" tabular>
									{timeOf(hour * 60)}
								</Text>
							</View>
						) : null,
					)}
				</View>
				{days.map((day, index) => (
					<DayColumn
						key={day}
						day={day}
						index={index}
						columns={days.length}
						columnWidth={columnWidth}
						perMinute={hourHeight / 60}
						timeZone={timeZone}
						events={events}
						hourHeight={hourHeight}
						nowMinutes={day === today ? nowMinutes : null}
						onPickSlot={props.onPickSlot}
						onEdit={props.onEdit}
						onReschedule={props.onReschedule}
						onDragChange={props.onDragChange}
					/>
				))}
			</View>
		</View>
	);
}
