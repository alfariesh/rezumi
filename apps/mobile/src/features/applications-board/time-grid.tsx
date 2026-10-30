import type { CalendarEvent, PlacedEvent, TimedEvent } from "./calendar";
import type { ApplicationSummary as Application } from "@/features/applications/types";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { fromZonedDateTime } from "@rezumi/utils/timezone";
import {
	dateOfKey,
	minutesOf,
	movedSlot,
	placeDay,
	resizedLength,
	SNAP_MINUTES,
	tappedSlot,
	timeOf,
	zonedTime,
} from "./calendar";
import { interviewTypeLabel, useUserTime } from "@/features/application-detail/hooks";
import { haptics, showToast, Text, useTheme } from "@/ui";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const LONG_PRESS_MS = 400;
// Holding this close to an interview's bottom edge resizes it instead of moving it.
const RESIZE_ZONE = 14;

type Drop = { mode: "move" | "resize"; days: number; minutes: number };

export type TimeGridProps = {
	/** Day keys shown as columns, left to right. */
	days: string[];
	events: CalendarEvent[];
	timeZone: string;
	today: string;
	now: Date;
	/** Pixels per hour. */
	hourHeight: number;
	onEdit: (event: TimedEvent) => void;
	onEditFollowUp: (application: Application) => void;
	/** The non-drag way to move one interview (the Reschedule sheet). */
	onRescheduleSheet: (event: TimedEvent) => void;
	onReschedule: (event: TimedEvent, start: Date, durationMinutes: number) => void;
	/** A tap on an empty part of a day, or undefined when nothing can be scheduled. */
	onPickSlot?: ((day: string, time: string) => void) | undefined;
	/** A tap on a day's heading (week view). */
	onOpenDay?: ((day: string) => void) | undefined;
	/** True while an interview is held, so the screen can stop scrolling. */
	onDragChange: (dragging: boolean) => void;
};

/**
 * The week and day views: hours down the side, a column per day, interviews placed by their time on the user's clock.
 * Tap an interview to edit it, or long press and drag it to another time or day; holding its bottom edge changes its
 * length. Screen readers get Reschedule and Move earlier/later actions instead of dragging.
 */
export function TimeGrid(props: TimeGridProps) {
	const { days, events, timeZone, today, now, hourHeight, onEditFollowUp, onPickSlot, onOpenDay } = props;
	const { t, i18n } = useLingui();
	const { colors, radius, size, space } = useTheme();
	const [width, setWidth] = useState(0);
	const gutter = size.hit;
	const columnWidth = days.length ? Math.max(0, (width - gutter) / days.length) : 0;
	const perMinute = hourHeight / 60;
	const utc = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(i18n.locale, { timeZone: "UTC", ...options });
	const weekday = utc({ weekday: "short" });
	const fullDay = utc({ weekday: "long", day: "numeric", month: "long" });
	const followUps = events.filter(
		(event): event is Extract<CalendarEvent, { kind: "follow-up" }> =>
			event.kind === "follow-up" && days.includes(event.day),
	);
	const nowMinutes = minutesOf(zonedTime(now, timeZone));

	return (
		<View
			style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.rLg, overflow: "hidden" }}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width - 2)}
		>
			{days.length > 1 ? (
				<View style={{ flexDirection: "row", paddingStart: gutter, backgroundColor: colors.surface }}>
					{days.map((day) => {
						const count = events.filter((event) => event.kind === "interview" && event.day === day).length;
						const isToday = day === today;
						return (
							<Pressable
								key={day}
								accessibilityRole="button"
								accessibilityLabel={`${fullDay.format(dateOfKey(day))}${count ? `: ${plural(count, { one: "# interview", other: "# interviews" })}` : ""}`}
								accessibilityHint={t`Show this day`}
								onPress={() => onOpenDay?.(day)}
								style={{ flex: 1, alignItems: "center", paddingVertical: space.s2, gap: space.s0 }}
							>
								<Text variant="micro" color="ink3">
									{weekday.format(dateOfKey(day))}
								</Text>
								<View
									style={{
										minWidth: space.s6,
										minHeight: space.s6,
										borderRadius: radius.rLg,
										alignItems: "center",
										justifyContent: "center",
										backgroundColor: isToday ? colors.accent : "transparent",
									}}
								>
									<Text variant="label" color={isToday ? "onAccent" : "ink"}>
										{dateOfKey(day).getUTCDate()}
									</Text>
								</View>
							</Pressable>
						);
					})}
				</View>
			) : null}

			{followUps.length ? (
				<View
					style={{
						flexDirection: "row",
						paddingStart: gutter,
						borderTopWidth: 1,
						borderColor: colors.line,
						backgroundColor: colors.surface,
					}}
				>
					{days.map((day) => (
						<View key={day} style={{ flex: 1, padding: space.s0, gap: space.s0 }}>
							{followUps
								.filter((event) => event.day === day)
								.map((event) => (
									<Pressable
										key={event.id}
										accessibilityRole="button"
										accessibilityLabel={t`Follow up: ${event.application.company}, ${fullDay.format(dateOfKey(day))}`}
										accessibilityHint={t`Change the follow-up`}
										onPress={() => onEditFollowUp(event.application)}
										style={{
											borderRadius: radius.rSm,
											paddingHorizontal: space.s1,
											paddingVertical: space.s0,
											backgroundColor: colors.warnSoft,
										}}
									>
										<Text variant="micro" color="warnText" numberOfLines={1}>
											{event.application.company}
										</Text>
									</Pressable>
								))}
						</View>
					))}
				</View>
			) : null}

			<View style={{ flexDirection: "row", height: hourHeight * 24, borderTopWidth: 1, borderColor: colors.line }}>
				<View style={{ width: gutter }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
					{HOURS.map((hour) => (
						<Text
							key={hour}
							variant="micro"
							color="ink3"
							align="center"
							style={{ position: "absolute", top: hour * hourHeight - (hour ? space.s2 : 0), width: gutter }}
						>
							{hour ? timeOf(hour * 60) : ""}
						</Text>
					))}
				</View>
				{days.map((day, index) => (
					<DayColumn
						key={day}
						{...props}
						day={day}
						index={index}
						columnWidth={columnWidth}
						perMinute={perMinute}
						nowMinutes={day === today ? nowMinutes : null}
						onPickSlot={onPickSlot}
					/>
				))}
			</View>
		</View>
	);
}

type DayColumnProps = TimeGridProps & {
	day: string;
	index: number;
	columnWidth: number;
	perMinute: number;
	nowMinutes: number | null;
};

function DayColumn(props: DayColumnProps) {
	const { day, events, timeZone, hourHeight, perMinute, nowMinutes, onPickSlot } = props;
	const { colors } = useTheme();
	const placed = useMemo(() => placeDay(events, day, timeZone), [events, day, timeZone]);

	return (
		<View style={{ flex: 1, borderStartWidth: 1, borderColor: colors.line }}>
			{HOURS.map((hour) => (
				<View
					key={hour}
					style={{
						position: "absolute",
						top: hour * hourHeight,
						left: 0,
						right: 0,
						height: hourHeight,
						borderTopWidth: hour ? 1 : 0,
						borderColor: colors.line,
					}}
				/>
			))}
			{/* Taps on empty time pick a slot; screen readers schedule with the Schedule interview button instead. */}
			{onPickSlot ? (
				<Pressable
					accessible={false}
					importantForAccessibility="no"
					style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
					onPress={(event) => onPickSlot(day, tappedSlot(event.nativeEvent.locationY / perMinute))}
				/>
			) : null}
			{nowMinutes !== null ? (
				<View
					pointerEvents="none"
					accessibilityElementsHidden
					style={{
						position: "absolute",
						top: nowMinutes * perMinute - 1,
						left: 0,
						right: 0,
						height: 2,
						backgroundColor: colors.danger,
					}}
				/>
			) : null}
			{placed.map((item) => (
				<GridEvent key={item.event.id} {...props} placed={item} />
			))}
		</View>
	);
}

type GridEventProps = DayColumnProps & { placed: PlacedEvent };

function GridEvent({
	placed,
	day,
	index,
	days,
	columnWidth,
	perMinute,
	timeZone,
	onEdit,
	onReschedule,
	onRescheduleSheet,
	onDragChange,
}: GridEventProps) {
	const { t } = useLingui();
	const { colors, radius, shadows, space } = useTheme();
	const userTime = useUserTime();
	const { event, top, bottom, lane, lanes } = placed;
	const height = Math.max((bottom - top) * perMinute, space.s5);
	const resizable = height >= space.s8;
	const laneWidth = columnWidth / lanes;
	const dx = useSharedValue(0);
	const dy = useSharedValue(0);
	const resizing = useSharedValue(false);
	const active = useSharedValue(false);
	const startMs = event.start.getTime();
	const length = event.interview.durationMinutes;
	// A drop keeps the interview where it was dropped until the calendar has it at its new time: the preview belongs to
	// the time it was dragged from, so it lapses once the interview has moved.
	const [held, setHeld] = useState<{ drop: Drop; start: number; length: number } | null>(null);
	const preview = held && held.start === startMs && held.length === length ? held.drop : null;
	const setPreview = (drop: Drop | null) => setHeld(drop && { drop, start: startMs, length });
	useEffect(() => {
		dx.set(0);
		dy.set(0);
	}, [startMs, length, dx, dy]);
	// A refresh can unmount an interview while it is held; the screen must scroll again.
	useEffect(
		() => () => {
			if (active.get()) onDragChange(false);
		},
		[active, onDragChange],
	);

	const firstDay = -index;
	const lastDay = days.length - 1 - index;
	const minMinutes = -top;
	const maxMinutes = 24 * 60 - bottom;

	const landing = (drop: Drop) => {
		if (drop.mode === "resize") {
			const minutes = resizedLength(placed, drop.minutes);
			return { start: event.start, durationMinutes: minutes };
		}
		const slot = movedSlot(placed, day, drop.days, drop.minutes);
		return { start: fromZonedDateTime(slot.date, slot.time, timeZone), durationMinutes: length };
	};

	const release = () => {
		dx.set(0);
		dy.set(0);
		setPreview(null);
	};
	const begin = () => {
		haptics.medium();
		onDragChange(true);
	};
	const finish = (drop: Drop | null) => {
		onDragChange(false);
		if (!drop) return release();
		const target = landing(drop);
		if (!target.start) {
			release();
			return showToast({ message: t`This time does not exist in your timezone. Choose another time.` });
		}
		if (target.start.getTime() === startMs && target.durationMinutes === length) return release();
		onReschedule(event, target.start, target.durationMinutes);
	};

	const gesture = Gesture.Pan()
		.activateAfterLongPress(LONG_PRESS_MS)
		.onStart((gestureEvent) => {
			resizing.set(resizable && gestureEvent.y >= height - RESIZE_ZONE);
			active.set(true);
			scheduleOnRN(begin);
		})
		.onUpdate((gestureEvent) => {
			const step = SNAP_MINUTES * perMinute;
			const minutes = Math.round(gestureEvent.translationY / step) * SNAP_MINUTES;
			const shiftDays = resizing.get()
				? 0
				: Math.min(lastDay, Math.max(firstDay, Math.round(gestureEvent.translationX / (columnWidth || 1))));
			const shiftMinutes = resizing.get() ? minutes : Math.min(maxMinutes, Math.max(minMinutes, minutes));
			if (shiftDays !== dx.get() || shiftMinutes !== dy.get()) {
				dx.set(shiftDays);
				dy.set(shiftMinutes);
				scheduleOnRN(setPreview, { mode: resizing.get() ? "resize" : "move", days: shiftDays, minutes: shiftMinutes });
			}
		})
		// `success` is true only for a drag that was active and ended normally (not cancelled).
		.onFinalize((_gestureEvent, success) => {
			const wasActive = active.get();
			active.set(false);
			if (!wasActive) return;
			scheduleOnRN(
				finish,
				success ? { mode: resizing.get() ? "resize" : "move", days: dx.get(), minutes: dy.get() } : null,
			);
		});

	const animated = useAnimatedStyle(() => ({
		height: resizing.get() ? Math.max(SNAP_MINUTES * perMinute, height + dy.get() * perMinute) : height,
		transform: resizing.get() ? [] : [{ translateX: dx.get() * columnWidth }, { translateY: dy.get() * perMinute }],
		zIndex: active.get() ? 2 : 1,
	}));

	const end = new Date(startMs + length * 60_000);
	const shown = preview ? landing(preview) : null;
	const range = shown?.start
		? `${userTime.time(shown.start)} – ${userTime.time(new Date(shown.start.getTime() + shown.durationMinutes * 60_000))}`
		: `${userTime.time(event.start)} – ${userTime.time(end)}`;
	const kind = interviewTypeLabel(event.interview.kind);
	const label = t`${kind} interview, ${event.application.company}, ${event.application.role}, ${userTime.day(event.start)}, ${userTime.time(event.start)} – ${userTime.time(end)}`;
	const nudge = (minutes: number) => {
		const start = new Date(startMs + minutes * 60_000);
		onReschedule(event, start, length);
	};

	return (
		<GestureDetector gesture={gesture}>
			<Animated.View
				style={[
					{
						position: "absolute",
						top: top * perMinute,
						left: lane * laneWidth + space.s0,
						width: Math.max(0, laneWidth - space.s1),
						borderRadius: radius.rSm,
						borderStartWidth: space.s1,
						borderColor: colors.accent,
						backgroundColor: colors.accentSoft,
						overflow: "hidden",
					},
					preview ? { boxShadow: shadows.e2.boxShadow, opacity: 0.95 } : null,
					animated,
				]}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={label}
					accessibilityHint={t`Edit interview`}
					accessibilityActions={[
						{ name: "activate" },
						{ name: "reschedule", label: t`Reschedule…` },
						{ name: "earlier", label: t`Move 15 minutes earlier` },
						{ name: "later", label: t`Move 15 minutes later` },
					]}
					onAccessibilityAction={({ nativeEvent }) => {
						if (nativeEvent.actionName === "activate") onEdit(event);
						if (nativeEvent.actionName === "reschedule") onRescheduleSheet(event);
						if (nativeEvent.actionName === "earlier") nudge(-SNAP_MINUTES);
						if (nativeEvent.actionName === "later") nudge(SNAP_MINUTES);
					}}
					onPress={() => onEdit(event)}
					style={{ flex: 1, paddingHorizontal: space.s1, paddingVertical: space.s0 }}
				>
					<Text variant="micro" numberOfLines={height >= space.s10 ? 2 : 1}>
						{event.application.company}
					</Text>
					{resizable ? (
						<Text variant="micro" color="ink2" numberOfLines={1}>
							{range}
						</Text>
					) : null}
					{resizable ? (
						<View
							pointerEvents="none"
							style={{
								position: "absolute",
								bottom: space.s0,
								alignSelf: "center",
								width: space.s4,
								height: space.s0,
								borderRadius: radius.rSm,
								backgroundColor: colors.accent,
								opacity: 0.6,
							}}
						/>
					) : null}
				</Pressable>
			</Animated.View>
		</GestureDetector>
	);
}
