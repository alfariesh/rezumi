// One interview on the time grid. Tap edits it; a long press lifts it (medium haptic) to drag to another time or day,
// and a long press on its bottom edge changes its length, both in 15-minute steps. Screen readers get Reschedule…,
// 15 minutes earlier/later and a day earlier/later instead of dragging.
import type { AppTimedEvent } from "./use-calendar";
import type { ApplicationSummary } from "@/features/applications/types";
import type { PlacedEvent } from "@rezumi/career/calendar";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { movedSlot, resizedLength, SNAP_MINUTES } from "@rezumi/career/calendar";
import { fromZonedDateTime } from "@rezumi/utils/timezone";
import { useUserTime } from "@/features/applications/date";
import { getInterviewKindLabel } from "@/features/applications/stages";
import { Text, cx, haptics, showToast } from "@/ui";

const LONG_PRESS_MS = 400;
/** A press this close to an interview's bottom edge resizes it instead of moving it. */
const RESIZE_ZONE = 14;
const MIN_HEIGHT = 20;
const DAY_MINUTES = 24 * 60;

type Drop = { mode: "move" | "resize"; days: number; minutes: number };

export type GridEventProps = {
	placed: PlacedEvent<ApplicationSummary>;
	day: string;
	/** This column's index and how many columns the grid shows: a drag stays inside them. */
	index: number;
	columns: number;
	columnWidth: number;
	perMinute: number;
	timeZone: string;
	onEdit: (event: AppTimedEvent) => void;
	onReschedule: (event: AppTimedEvent, start: Date, durationMinutes: number) => void;
	onDragChange: (dragging: boolean) => void;
};

export function GridEvent(props: GridEventProps) {
	const { placed, day, index, columns, columnWidth, perMinute, timeZone, onEdit, onReschedule, onDragChange } = props;
	const { t } = useLingui();
	const userTime = useUserTime();
	const { event, top, bottom, lane, lanes } = placed;
	const height = Math.max((bottom - top) * perMinute, MIN_HEIGHT);
	const resizable = height >= 32;
	const laneWidth = columnWidth / lanes;
	const dx = useSharedValue(0);
	const dy = useSharedValue(0);
	const resizing = useSharedValue(false);
	const active = useSharedValue(false);
	const startMs = event.start.getTime();
	const length = event.interview.durationMinutes;
	// A drop keeps showing where it landed until the calendar has the interview at its new time.
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

	const landing = (drop: Drop) => {
		if (drop.mode === "resize") return { start: event.start, durationMinutes: resizedLength(placed, drop.minutes) };
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
			return showToast({ title: t`That time doesn't exist on your clock. Choose another time.`, variant: "warning" });
		}
		if (target.start.getTime() === startMs && target.durationMinutes === length) return release();
		onReschedule(event, target.start, target.durationMinutes);
	};
	const nudge = (minutes: number) => onReschedule(event, new Date(startMs + minutes * 60_000), length);
	const shiftDay = (days: number) => {
		const slot = movedSlot(placed, day, days, 0);
		const start = fromZonedDateTime(slot.date, slot.time, timeZone);
		if (start) onReschedule(event, start, length);
	};

	const first = -index;
	const last = columns - 1 - index;
	const gesture = Gesture.Pan()
		.activateAfterLongPress(LONG_PRESS_MS)
		.withTestId(`grid-drag-${event.id}`)
		.onStart((gestureEvent) => {
			resizing.set(resizable && gestureEvent.y >= height - RESIZE_ZONE);
			active.set(true);
			scheduleOnRN(begin);
		})
		.onUpdate((gestureEvent) => {
			const step = SNAP_MINUTES * perMinute;
			const minutes = Math.round(gestureEvent.translationY / step) * SNAP_MINUTES;
			const days = resizing.get()
				? 0
				: Math.min(last, Math.max(first, Math.round(gestureEvent.translationX / (columnWidth || 1))));
			const shift = resizing.get() ? minutes : Math.min(DAY_MINUTES - bottom, Math.max(-top, minutes));
			if (days !== dx.get() || shift !== dy.get()) {
				dx.set(days);
				dy.set(shift);
				scheduleOnRN(setPreview, { mode: resizing.get() ? "resize" : "move", days, minutes: shift });
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
	const kind = getInterviewKindLabel(event.interview.kind);
	const label = t`${kind} interview, ${event.application.company}, ${event.application.role}, ${userTime.day(event.start)}, ${userTime.time(event.start)} – ${userTime.time(end)}`;
	const place = { top: top * perMinute, left: lane * laneWidth + 1, width: Math.max(0, laneWidth - 3) };

	return (
		<GestureDetector gesture={gesture}>
			<Animated.View
				className={cx(
					"absolute overflow-hidden rounded-md border-s-4 border-accent bg-accent-soft",
					preview && "shadow-overlay",
				)}
				style={[place, animated]}
				testID={`grid-event-${event.interview.id}`}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={label}
					accessibilityHint={t`Edits the interview. Actions move it.`}
					accessibilityActions={[
						{ name: "activate" },
						{ name: "reschedule", label: t`Reschedule…` },
						{ name: "earlier", label: t`Move 15 minutes earlier` },
						{ name: "later", label: t`Move 15 minutes later` },
						{ name: "previous-day", label: t`Move a day earlier` },
						{ name: "next-day", label: t`Move a day later` },
					]}
					onAccessibilityAction={({ nativeEvent }) => {
						const action = nativeEvent.actionName;
						if (action === "activate" || action === "reschedule") onEdit(event);
						else if (action === "earlier") nudge(-SNAP_MINUTES);
						else if (action === "later") nudge(SNAP_MINUTES);
						else if (action === "previous-day") shiftDay(-1);
						else if (action === "next-day") shiftDay(1);
					}}
					onPress={() => onEdit(event)}
					className="flex-1 px-1 py-0.5"
				>
					<Text size="xs" weight="medium" numberOfLines={height >= 40 ? 2 : 1}>
						{event.application.company}
					</Text>
					{resizable ? (
						<Text size="xs" tone="muted" tabular numberOfLines={1}>
							{range}
						</Text>
					) : null}
					{resizable ? (
						<View
							pointerEvents="none"
							className="absolute bottom-0.5 h-0.5 w-4 self-center rounded-full bg-accent opacity-60"
						/>
					) : null}
				</Pressable>
			</Animated.View>
		</GestureDetector>
	);
}
