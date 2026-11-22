// Applications → All → Calendar: interviews and follow-ups on the user's clock. Day and week views place interviews on
// a time grid where a long press drags one to a new time (or its bottom edge changes its length), with Undo; tapping
// empty time schedules there. The month overview marks busy days. Coming up lists what's next (beside the calendar on
// tablets, under it on phones). Interviews open the interview sheet; follow-ups open their application.
import type { AppTimedEvent, Calendar } from "./use-calendar";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import type { ComponentRef, ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { minutesOf, zonedTime } from "@rezumi/career/calendar";
import { fromZonedDateTime } from "@rezumi/utils/timezone";
import { AgendaList } from "./agenda-list";
import { ApplicationPickerSheet } from "./application-picker";
import { CalendarToolbar } from "./calendar-toolbar";
import { MonthGrid } from "./month-grid";
import { TimeGrid, TimeGridHeader } from "./time-grid";
import { useCalendar } from "./use-calendar";
import { useLoadState } from "@/features/applications/board/load-states";
import { ApplicationsFrame, useOpenApplication } from "@/features/applications/frame";
import { InterviewSheet } from "@/features/applications/interview-sheet";
import { useRescheduleInterview } from "@/features/applications/interview/use-reschedule";
import { Skeleton, Text, space, usePullRefresh, useThemeColor } from "@/ui";

const HOUR_HEIGHT = space[12];
/** Day and week open on the morning, or earlier when an interview starts before it. */
const FIRST_HOUR = 8;

type Slot = { date: string; time: string };
type Editing = { applicationId: string; interview: InterviewTimelineEntry | null; initial?: Slot | undefined };

export function CalendarScreen() {
	return (
		<ApplicationsFrame view="calendar">
			<CalendarBody />
		</ApplicationsFrame>
	);
}

export function CalendarBody() {
	const { t } = useLingui();
	const calendar = useCalendar();
	const openApplication = useOpenApplication();
	const reschedule = useRescheduleInterview();
	const [picking, setPicking] = useState<{ slot: Slot | null; picked: string | null } | null>(null);
	const [editing, setEditing] = useState<Editing | null>(null);
	const [editOpen, setEditOpen] = useState(false);
	const [dragging, setDragging] = useState(false);
	const state = useLoadState({
		query: calendar.query,
		skeleton: <CalendarSkeleton />,
		emptyDescription: t`Save a job, then schedule its interviews here. Reminders come on this device.`,
	});

	const edit = (next: Editing) => {
		setEditing(next);
		setEditOpen(true);
	};
	const editInterview = (event: AppTimedEvent) =>
		edit({ applicationId: event.application.id, interview: event.interview });
	const schedule = (slot: Slot | null = null) => setPicking({ slot, picked: null });
	const slotStart = picking?.slot ? fromZonedDateTime(picking.slot.date, picking.slot.time, calendar.timeZone) : null;

	return (
		<>
			{state ?? (
				<CalendarLayout
					calendar={calendar}
					dragging={dragging}
					grid={
						calendar.view === "month" ? (
							<MonthGrid calendar={calendar} />
						) : (
							<TimeGrid
								days={calendar.days}
								events={calendar.events}
								timeZone={calendar.timeZone}
								today={calendar.today}
								now={calendar.now}
								hourHeight={HOUR_HEIGHT}
								onEdit={editInterview}
								onFollowUp={(application) => openApplication(application.id)}
								onReschedule={(event, start, minutes) => reschedule(event, start, minutes)}
								onPickSlot={calendar.open.length ? (date, time) => schedule({ date, time }) : undefined}
								onOpenDay={(day) => calendar.show("day", day)}
								onDragChange={setDragging}
								part={calendar.tablet ? "all" : "body"}
							/>
						)
					}
					header={
						calendar.view === "month" || calendar.tablet ? null : (
							<TimeGridHeader
								days={calendar.days}
								events={calendar.events}
								today={calendar.today}
								onFollowUp={(application) => openApplication(application.id)}
								onOpenDay={(day) => calendar.show("day", day)}
							/>
						)
					}
					agenda={
						<AgendaList
							calendar={calendar}
							onEditInterview={editInterview}
							onOpenApplication={openApplication}
							onSchedule={() => schedule()}
						/>
					}
					onSchedule={() => schedule()}
				/>
			)}
			<ApplicationPickerSheet
				isOpen={picking !== null && picking.picked === null}
				onOpenChange={(open) => {
					if (!open && picking?.picked === null) setPicking(null);
				}}
				applications={calendar.open}
				when={slotStart ? calendar.userTime.when(slotStart) : null}
				onPick={(id) => setPicking((current) => current && { ...current, picked: id })}
				onDidDismiss={() => {
					if (picking?.picked)
						edit({ applicationId: picking.picked, interview: null, initial: picking.slot ?? undefined });
					setPicking(null);
				}}
			/>
			{editing ? (
				<InterviewSheet
					applicationId={editing.applicationId}
					interview={editing.interview}
					initial={editing.initial}
					isOpen={editOpen}
					onOpenChange={setEditOpen}
				/>
			) : null}
		</>
	);
}

function CalendarSkeleton() {
	return (
		<View className="gap-3 p-4">
			<Skeleton variant="none" className="h-10 rounded-xl" />
			<Skeleton variant="none" className="h-80 rounded-2xl" />
		</View>
	);
}

type CalendarLayoutProps = {
	calendar: Calendar;
	dragging: boolean;
	grid: ReactNode;
	/** Phones: the day names above the scrolling hours, so they stay in view. */
	header: ReactNode;
	agenda: ReactNode;
	onSchedule: () => void;
};

function CalendarLayout({ calendar, dragging, grid, header, agenda, onSchedule }: CalendarLayoutProps) {
	const { t } = useLingui();
	const accent = useThemeColor("accent");
	const pull = usePullRefresh(calendar.query.refetch);
	const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
	const { view, days, events, timeZone } = calendar;
	const range = view === "month" ? "" : days.join(",");
	const firstHour = Math.max(
		0,
		Math.min(
			FIRST_HOUR,
			...events
				.filter((event) => event.kind === "interview" && days.includes(event.day))
				.map((event) => Math.floor(minutesOf(zonedTime(event.start, timeZone)) / 60)),
		) - 1,
	);
	const latestHour = useRef(firstHour);
	useEffect(() => {
		latestHour.current = firstHour;
	});
	// Day and week open on the morning (or the hour before the earliest interview shown) when the range changes, not
	// on every refresh; month opens at the top.
	useEffect(() => {
		scroll.current?.scrollTo({ y: range ? latestHour.current * HOUR_HEIGHT : 0, animated: false });
	}, [range]);
	const hint =
		view === "month" ? null : (
			<Text size="xs" tone="muted">
				{calendar.open.length
					? t`Tap empty time to schedule. Long press an interview to drag it, or its bottom edge to change its length.`
					: t`Long press an interview to drag it, or its bottom edge to change its length.`}
			</Text>
		);
	const refresh = <RefreshControl {...pull} tintColor={accent} colors={[accent]} />;
	if (calendar.tablet)
		return (
			<View className="flex-1">
				<CalendarToolbar calendar={calendar} onSchedule={onSchedule} />
				<View className="flex-1 flex-row gap-6 px-4">
					<ScrollView
						ref={scroll}
						scrollEnabled={!dragging}
						refreshControl={refresh}
						contentContainerClassName="gap-2 py-3"
						className="flex-1"
					>
						{hint}
						{grid}
					</ScrollView>
					<ScrollView contentContainerClassName="py-3" className="w-100 grow-0">
						{agenda}
					</ScrollView>
				</View>
			</View>
		);
	return (
		<View className="flex-1">
			<CalendarToolbar calendar={calendar} onSchedule={onSchedule} />
			{header ? (
				<View className="gap-2 px-4 pt-3">
					{hint}
					{header}
				</View>
			) : null}
			<ScrollView
				ref={scroll}
				scrollEnabled={!dragging}
				refreshControl={refresh}
				contentContainerClassName={header ? "gap-6 px-4 pb-6" : "gap-6 px-4 pt-3 pb-6"}
			>
				{header ? (
					grid
				) : (
					<View className="gap-2">
						{hint}
						{grid}
					</View>
				)}
				{agenda}
			</ScrollView>
		</View>
	);
}
