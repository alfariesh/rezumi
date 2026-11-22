// One day on the time grid: hour lines, a tap on empty time to schedule there, the line for now, and the day's
// interviews side by side where they overlap.
import type { GridEventProps } from "./grid-event";
import type { AppEvent } from "./use-calendar";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { placeDay, tappedSlot } from "@rezumi/career/calendar";
import { GridEvent } from "./grid-event";

export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** A line's place on the column, computed from the hour height. */
export const at = (top: number, height?: number) => (height === undefined ? { top } : { top, height });

type DayColumnProps = Omit<GridEventProps, "placed"> & {
	events: readonly AppEvent[];
	hourHeight: number;
	/** Minutes since midnight now, on today's column only. */
	nowMinutes: number | null;
	/** A tap on empty time, or undefined when nothing can be scheduled. */
	onPickSlot?: ((day: string, time: string) => void) | undefined;
};

export function DayColumn({ events, hourHeight, nowMinutes, onPickSlot, ...event }: DayColumnProps) {
	const { day, timeZone, perMinute } = event;
	const placed = useMemo(() => placeDay(events, day, timeZone), [events, day, timeZone]);
	return (
		<View className="flex-1 border-s border-border" testID={`day-column-${day}`}>
			{HOURS.map((hour) => (
				<View
					key={hour}
					className={hour ? "absolute inset-x-0 border-t border-border" : "absolute inset-x-0"}
					style={at(hour * hourHeight, hourHeight)}
				/>
			))}
			{/* Taps on empty time pick a slot; screen readers schedule with the Schedule interview button instead. */}
			{onPickSlot ? (
				<Pressable
					accessible={false}
					importantForAccessibility="no"
					className="absolute inset-0"
					onPress={(press) => onPickSlot(day, tappedSlot(press.nativeEvent.locationY / perMinute))}
					testID={`day-slots-${day}`}
				/>
			) : null}
			{nowMinutes !== null ? (
				<View
					pointerEvents="none"
					accessibilityElementsHidden
					className="absolute inset-x-0 h-0.5 bg-danger"
					style={at(nowMinutes * perMinute - 1)}
				/>
			) : null}
			{placed.map((item) => (
				<GridEvent key={item.event.id} placed={item} {...event} />
			))}
		</View>
	);
}
