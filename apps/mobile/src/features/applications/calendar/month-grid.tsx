// The month overview: six weeks, each day with a dot per interview (accent) or follow-up (warning), up to three.
// Tapping a day shows it in the list underneath; the day view is one tap away there.
import type { Calendar } from "./use-calendar";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { dateOfKey } from "@rezumi/career/calendar";
import { Text, cx } from "@/ui";

const MAX_DOTS = 3;

type MonthGridProps = { calendar: Calendar };

export function MonthGrid({ calendar }: MonthGridProps) {
	const { t, i18n } = useLingui();
	const { grid, byDay, today, anchor } = calendar;
	const utc = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(i18n.locale, { timeZone: "UTC", ...options });
	const weekday = utc({ weekday: "narrow" });
	const fullDay = utc({ weekday: "long", day: "numeric", month: "long" });
	return (
		<View className="gap-2">
			<View className="overflow-hidden rounded-2xl border border-border bg-surface" testID="month-grid">
				<View className="flex-row" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
					{grid.slice(0, 7).map((day) => (
						<View key={day.key} className="flex-1 items-center py-2">
							<Text size="xs" tone="muted">
								{weekday.format(dateOfKey(day.key))}
							</Text>
						</View>
					))}
				</View>
				{Array.from({ length: 6 }, (_, week) => (
					<View key={week} className="flex-row border-t border-border">
						{grid.slice(week * 7, week * 7 + 7).map((day) => {
							const items = byDay.get(day.key) ?? [];
							const interviews = items.filter((event) => event.kind === "interview").length;
							const followUps = items.length - interviews;
							const summary = [
								interviews ? plural(interviews, { one: "# interview", other: "# interviews" }) : "",
								followUps ? plural(followUps, { one: "# follow-up", other: "# follow-ups" }) : "",
							]
								.filter(Boolean)
								.join(", ");
							const selected = day.key === anchor;
							return (
								<Pressable
									key={day.key}
									accessibilityRole="button"
									accessibilityState={{ selected }}
									accessibilityLabel={`${fullDay.format(dateOfKey(day.key))}${summary ? `: ${summary}` : ""}`}
									accessibilityHint={t`Shows this day's events below`}
									onPress={() => calendar.select(day.key)}
									className={cx(
										"min-h-12 flex-1 items-center gap-1 py-1.5",
										selected ? "bg-accent-soft" : day.inMonth ? "bg-surface" : "bg-surface-secondary",
									)}
								>
									<View
										className={cx("size-7 items-center justify-center rounded-full", day.key === today && "bg-accent")}
									>
										<Text
											weight={items.length ? "semibold" : "normal"}
											tone={day.inMonth ? "default" : "muted"}
											className={cx(day.key === today && "text-accent-foreground")}
										>
											{day.day}
										</Text>
									</View>
									<View className="h-1.5 flex-row gap-0.5">
										{items.slice(0, MAX_DOTS).map((event) => (
											<View
												key={event.id}
												className={cx("size-1.5 rounded-full", event.kind === "interview" ? "bg-accent" : "bg-warning")}
											/>
										))}
									</View>
								</Pressable>
							);
						})}
					</View>
				))}
			</View>
			<View className="flex-row gap-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
				<Legend dot="bg-accent" label={t`Interview`} />
				<Legend dot="bg-warning" label={t`Follow-up`} />
			</View>
		</View>
	);
}

type LegendProps = { dot: string; label: string };

function Legend({ dot, label }: LegendProps) {
	return (
		<View className="flex-row items-center gap-1.5">
			<View className={cx("size-2 rounded-full", dot)} />
			<Text size="xs" tone="muted">
				{label}
			</Text>
		</View>
	);
}
