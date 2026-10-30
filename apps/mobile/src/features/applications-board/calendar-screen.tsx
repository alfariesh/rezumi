import type { CalendarEvent, CalendarView, TimedEvent } from "./calendar";
import type { RescheduleTarget } from "./reschedule-sheet";
import type { InterviewSlot } from "@/features/application-detail/interview-sheet";
import type { ApplicationSummary as Application } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { RefreshControl, Pressable, ScrollView, View } from "react-native";
import { LegacyScrollView } from "react-native-gesture-handler";
import { fromZonedDateTime } from "@rezumi/utils/timezone";
import {
	addDays,
	collectEvents,
	dateOfKey,
	dayKeyOf,
	groupByDay,
	minutesOf,
	monthGrid,
	shiftMonth,
	upcomingEvents,
	visibleDays,
	weekStartsOn,
	zonedTime,
} from "./calendar";
import { RescheduleSheet } from "./reschedule-sheet";
import { useApplicationSearch } from "./search";
import { TimeGrid } from "./time-grid";
import { useRescheduleInterview } from "./use-reschedule-interview";
import { ApplicationsViewFrame } from "./views";
import { interviewTypeLabel, useNow, useUserTime } from "@/features/application-detail/hooks";
import { InterviewSheet } from "@/features/application-detail/interview-sheet";
import { FollowUpSheet } from "@/features/application-detail/sheets";
import { applicationError } from "@/features/applications/error";
import { filterApplications } from "@/features/applications/list";
import { useApplications } from "@/features/applications/queries";
import { routes } from "@/routes";
import { useIsTablet } from "@/shell/use-is-tablet";
import {
	Banner,
	Button,
	Card,
	EmptyState,
	IconButton,
	Segmented,
	SelectSheet,
	Sheet,
	Skeleton,
	Text,
	useTheme,
} from "@/ui";
import { usePullRefresh } from "@/ui/use-pull-refresh";

// Chips per day cell on tablet before "+N more"; phone cells show up to this many dots.
const MAX_PER_DAY = 3;
// Week and day views open scrolled to the earliest interview, or this hour on an empty stretch.
const FIRST_HOUR = 8;
// A slot tapped on the week or day grid starts an interview this long, as the editor's default.
const SLOT_MINUTES = 60;

type Editing =
	| {
			kind: "interview";
			application: Application;
			interview: InterviewTimelineEntry | null;
			slot?: InterviewSlot | null | undefined;
	  }
	| { kind: "follow-up"; application: Application };

export function CalendarScreen() {
	return (
		<ApplicationsViewFrame current="calendar">
			<ApplicationCalendar />
		</ApplicationsViewFrame>
	);
}

/**
 * Interviews and follow-ups by day on the user's clock (profile timezone), a day's agenda and what's coming up.
 * Month, week and day views, as web; week and day place interviews on a time grid where a long press drags one to a
 * new time. Tablet puts the agenda beside the calendar; phone stacks it below.
 */
function ApplicationCalendar() {
	const { t, i18n } = useLingui();
	const { colors, radius, size, space } = useTheme();
	const tablet = useIsTablet();
	const [width, setWidth] = useState(0);
	const query = useApplications();
	const pull = usePullRefresh(query.refetch);
	const { search } = useApplicationSearch();
	const userTime = useUserTime();
	const now = useNow();
	const timeZone = userTime.timeZone;
	const today = dayKeyOf(now, timeZone);
	const [month, setMonth] = useState(() => ({
		year: Number(today.slice(0, 4)),
		month: Number(today.slice(5, 7)) - 1,
	}));
	const [selected, setSelected] = useState(today);
	const [picking, setPicking] = useState(false);
	const [pickedId, setPickedId] = useState<string | null>(null);
	const [editing, setEditing] = useState<Editing | null>(null);
	const [editorOpen, setEditorOpen] = useState(false);
	const [view, setView] = useState<CalendarView>("month");
	const [slot, setSlot] = useState<InterviewSlot | null>(null);
	const [dragging, setDragging] = useState(false);
	const [rescheduling, setRescheduling] = useState<RescheduleTarget | null>(null);
	const [rescheduleOpen, setRescheduleOpen] = useState(false);
	const scrollRef = useRef<LegacyScrollView>(null);
	const reschedule = useRescheduleInterview();

	const applications = filterApplications(query.data ?? [], { search, tag: "", showClosed: true });
	const open = applications.filter((application) => application.status !== "closed");
	const events = collectEvents(applications, timeZone);
	const byDay = groupByDay(events);
	const upcoming = [...groupByDay(upcomingEvents(events, now, today))];
	const weekStart = weekStartsOn(i18n.locale);
	const days = monthGrid(month.year, month.month, weekStart);
	// Phones fit three days to a week, as web's Agenda on narrow screens.
	const spanOf = (next: CalendarView) => (next === "day" ? 1 : tablet ? 7 : 3);
	const shown = visibleDays(selected, spanOf(view), weekStart);
	const shownInterviews = events.filter((event) => event.kind === "interview" && shown.includes(event.day)).length;
	const monthPrefix = `${month.year}-${String(month.month + 1).padStart(2, "0")}`;
	const monthInterviews = events.filter(
		(event) => event.kind === "interview" && event.day.startsWith(monthPrefix),
	).length;
	const isThisMonth = today.startsWith(monthPrefix);

	const utc = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(i18n.locale, { timeZone: "UTC", ...options });
	const monthTitle = utc({ month: "long", year: "numeric" }).format(Date.UTC(month.year, month.month, 1));
	const weekday = utc({ weekday: "narrow" });
	const fullDay = utc({ weekday: "long", day: "numeric", month: "long" });
	const tomorrow = new Date(dateOfKey(today).getTime() + 86_400_000).toISOString().slice(0, 10);
	const dayHeading = (key: string) =>
		key === today ? t`Today` : key === tomorrow ? t`Tomorrow` : fullDay.format(dateOfKey(key));
	const shortDay = utc({ day: "numeric", month: "short" });
	const shortDayYear = utc({ day: "numeric", month: "short", year: "numeric" });
	const firstShown = shown[0] ?? selected;
	const lastShown = shown.at(-1) ?? selected;
	const title =
		view === "month"
			? monthTitle
			: view === "day"
				? fullDay.format(dateOfKey(selected))
				: `${shortDay.format(dateOfKey(firstShown))} – ${shortDayYear.format(dateOfKey(lastShown))}`;
	const hourHeight = space.s12;

	// Week and day views open on the morning, or earlier when an interview starts before it; month opens at the top.
	const scrollToHours = (next: CalendarView, anchor: string) => {
		const range = next === "month" ? [] : visibleDays(anchor, spanOf(next), weekStart);
		const starts = events
			.filter((event) => event.kind === "interview" && range.includes(event.day))
			.map((event) => Math.floor(minutesOf(zonedTime(event.start, timeZone)) / 60));
		const hour = next === "month" ? 0 : Math.max(0, Math.min(FIRST_HOUR, ...starts) - 1);
		requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: hour * hourHeight, animated: false }));
	};
	const show = (next: CalendarView, anchor = selected) => {
		setView(next);
		setSelected(anchor);
		setMonth({ year: Number(anchor.slice(0, 4)), month: Number(anchor.slice(5, 7)) - 1 });
		scrollToHours(next, anchor);
	};
	const step = (direction: 1 | -1) => {
		if (view === "month") return setMonth(shiftMonth(month.year, month.month, direction));
		show(view, addDays(selected, direction * spanOf(view)));
	};
	const previousLabel = { day: t`Previous day`, week: t`Previous week`, month: t`Previous month` }[view];
	const nextLabel = { day: t`Next day`, week: t`Next week`, month: t`Next month` }[view];

	const edit = (next: Editing) => {
		setEditing(next);
		setEditorOpen(true);
	};
	const schedule = (at: InterviewSlot | null = null) => {
		setSlot(at);
		setPickedId(open[0]?.id ?? null);
		setPicking(true);
	};
	const pickSlot = (day: string, time: string) => {
		const start = fromZonedDateTime(day, time, timeZone);
		if (start) schedule({ start, durationMinutes: SLOT_MINUTES });
	};
	const editInterview = (event: TimedEvent) =>
		edit({ kind: "interview", application: event.application, interview: event.interview });
	const openReschedule = (target: RescheduleTarget) => {
		setRescheduling(target);
		setRescheduleOpen(true);
	};

	if (query.isError) {
		return (
			<View style={{ padding: space.s4, gap: space.s3 }}>
				<Banner tone="warn" message={applicationError(query.error)} />
				<Button label={t`Retry loading applications`} onPress={() => void query.refetch()} />
			</View>
		);
	}
	if (query.isPending) {
		return (
			<View style={{ padding: space.s4, gap: space.s3 }}>
				<Skeleton height={space.s12} />
				<Skeleton height={space.s12 * 4} />
			</View>
		);
	}

	const selectedEvents = byDay.get(selected) ?? [];
	const agenda = (
		<View style={{ gap: space.s4 }}>
			<View style={{ gap: space.s2 }}>
				<Text variant="title" accessibilityRole="header">
					{dayHeading(selected)}
				</Text>
				{selectedEvents.length === 0 ? (
					<Text color="ink3">{t`Nothing on this day.`}</Text>
				) : (
					selectedEvents.map((event) => (
						<EventCard key={event.id} event={event} onEdit={edit} onReschedule={openReschedule} />
					))
				)}
			</View>
			<View style={{ gap: space.s2 }}>
				<Text variant="title" accessibilityRole="header">
					{t`Coming up`}
				</Text>
				{upcoming.length === 0 ? (
					<EmptyState
						icon="calendar-blank"
						title={t`Nothing scheduled yet`}
						message={t`Add screening calls and technical interviews to see them here and on the calendar.`}
						action={open.length ? { label: t`Schedule interview`, onPress: () => schedule() } : undefined}
					/>
				) : (
					upcoming.map(([day, items]) => (
						<View key={day} style={{ gap: space.s2 }}>
							<Text variant="caption" color="ink3">
								{dayHeading(day)}
							</Text>
							{items.map((event) => (
								<EventCard key={event.id} event={event} onEdit={edit} onReschedule={openReschedule} />
							))}
						</View>
					))
				)}
			</View>
		</View>
	);

	const interviewCount = view === "month" ? monthInterviews : shownInterviews;
	const toolbar = (
		<View style={{ gap: space.s3 }}>
			<View style={{ flexDirection: "row", alignItems: "center", gap: space.s1 }}>
				<View style={{ flex: 1 }}>
					<Text variant="heading" accessibilityRole="header">
						{title}
					</Text>
					<Text variant="callout" color="ink3">
						{plural(interviewCount, { 0: "No interviews", one: "# interview", other: "# interviews" })}
					</Text>
				</View>
				<IconButton icon="caret-left" label={previousLabel} onPress={() => step(-1)} />
				<IconButton icon="caret-right" label={nextLabel} onPress={() => step(1)} />
			</View>
			<Segmented
				label={t`Calendar view`}
				value={view}
				options={[
					{ value: "day", label: t`Day` },
					{ value: "week", label: t`Week` },
					{ value: "month", label: t`Month` },
				]}
				onChange={(next) => show(next as CalendarView)}
			/>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s2 }}>
				{view === "month" ? (
					<Button
						variant="secondary"
						size="sm"
						label={t`This month`}
						disabled={isThisMonth}
						onPress={() => show("month", today)}
					/>
				) : (
					<Button
						variant="secondary"
						size="sm"
						label={t`Today`}
						disabled={shown.includes(today)}
						onPress={() => show(view, today)}
					/>
				)}
				<Button
					size="sm"
					icon="calendar-plus"
					label={t`Schedule interview`}
					disabled={!open.length}
					onPress={() => schedule()}
				/>
			</View>
		</View>
	);

	const timeGrid = (
		<View style={{ gap: space.s2 }}>
			<Text variant="caption" color="ink3">
				{open.length
					? t`Tap empty time to schedule. Long press an interview to drag it, or hold its bottom edge to change its length.`
					: t`Long press an interview to drag it, or hold its bottom edge to change its length.`}
			</Text>
			<TimeGrid
				days={shown}
				events={events}
				timeZone={timeZone}
				today={today}
				now={now}
				hourHeight={hourHeight}
				onEdit={editInterview}
				onEditFollowUp={(application) => edit({ kind: "follow-up", application })}
				onRescheduleSheet={openReschedule}
				onReschedule={reschedule}
				onPickSlot={open.length ? pickSlot : undefined}
				onOpenDay={(day) => show("day", day)}
				onDragChange={setDragging}
			/>
		</View>
	);

	const monthView = (
		<View style={{ gap: space.s3 }}>
			<View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.rLg, overflow: "hidden" }}>
				<View style={{ flexDirection: "row" }} importantForAccessibility="no-hide-descendants">
					{days.slice(0, 7).map((day) => (
						<Text
							key={day.key}
							variant="micro"
							color="ink3"
							align="center"
							accessibilityElementsHidden
							style={{ flex: 1, paddingVertical: space.s2 }}
						>
							{weekday.format(dateOfKey(day.key))}
						</Text>
					))}
				</View>
				{Array.from({ length: 6 }, (_, week) => (
					<View key={week} style={{ flexDirection: "row" }}>
						{days.slice(week * 7, week * 7 + 7).map((day) => {
							const items = byDay.get(day.key) ?? [];
							const interviews = items.filter((event) => event.kind === "interview").length;
							const followUps = items.length - interviews;
							const isToday = day.key === today;
							const isSelected = day.key === selected;
							const summary = [
								interviews ? plural(interviews, { one: "# interview", other: "# interviews" }) : "",
								followUps ? plural(followUps, { one: "# follow-up", other: "# follow-ups" }) : "",
							]
								.filter(Boolean)
								.join(", ");
							return (
								<Pressable
									key={day.key}
									accessibilityRole="button"
									accessibilityState={{ selected: isSelected }}
									accessibilityLabel={`${fullDay.format(dateOfKey(day.key))}${summary ? `: ${summary}` : ""}`}
									onPress={() => setSelected(day.key)}
									style={{
										flex: 1,
										minHeight: tablet ? size.hit * 2 : size.hit,
										padding: space.s1,
										gap: space.s0,
										alignItems: tablet ? "stretch" : "center",
										borderTopWidth: 1,
										borderColor: colors.line,
										backgroundColor: isSelected
											? colors.selectedFill
											: items.length
												? colors.accentSoft
												: day.inMonth
													? colors.surface
													: colors.sunken,
									}}
								>
									<View
										style={{
											alignSelf: tablet ? "flex-end" : "center",
											minWidth: space.s6,
											minHeight: space.s6,
											borderRadius: radius.rLg,
											alignItems: "center",
											justifyContent: "center",
											backgroundColor: isToday ? colors.accent : "transparent",
										}}
									>
										<Text
											variant={items.length ? "label" : "callout"}
											color={isToday ? "onAccent" : day.inMonth ? (items.length ? "accentText" : "ink") : "ink3"}
										>
											{day.day}
										</Text>
									</View>
									{tablet ? (
										<>
											{items.slice(0, MAX_PER_DAY).map((event) => (
												<Text key={event.id} variant="micro" numberOfLines={1} color="ink2">
													{event.kind === "interview" ? `${userTime.time(event.start)} ` : ""}
													{event.application.company}
												</Text>
											))}
											{items.length > MAX_PER_DAY ? (
												<Text variant="micro" color="ink3">
													{t`+${items.length - MAX_PER_DAY} more`}
												</Text>
											) : null}
										</>
									) : (
										<View style={{ flexDirection: "row", gap: space.s0 }}>
											{items.slice(0, MAX_PER_DAY).map((event) => (
												<View
													key={event.id}
													style={{
														width: space.s1,
														height: space.s1,
														borderRadius: radius.rLg,
														backgroundColor: event.kind === "interview" ? colors.accent : colors.warn,
													}}
												/>
											))}
										</View>
									)}
								</Pressable>
							);
						})}
					</View>
				))}
			</View>
			<View style={{ flexDirection: "row", gap: space.s4 }} accessibilityElementsHidden>
				<Legend color={colors.accent} label={t`Interview`} />
				<Legend color={colors.warn} label={t`Follow-up`} />
			</View>
		</View>
	);

	const body = view === "month" ? monthView : timeGrid;

	return (
		<View style={{ flex: 1 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
			{tablet && width >= size.panel * 2 + space.s6 + space.s4 * 2 ? (
				<View style={{ flex: 1, flexDirection: "row", gap: space.s6, paddingHorizontal: space.s4 }}>
					<View style={{ flex: 1 }}>
						<View style={{ paddingTop: space.s4, paddingBottom: space.s3 }}>{toolbar}</View>
						<LegacyScrollView
							ref={scrollRef}
							alwaysBounceVertical
							scrollEnabled={!dragging}
							refreshControl={<RefreshControl {...pull} tintColor={colors.accent} colors={[colors.accent]} />}
							style={{ flex: 1 }}
							contentContainerStyle={{ paddingBottom: space.s4 }}
						>
							{body}
						</LegacyScrollView>
					</View>
					<ScrollView
						alwaysBounceVertical
						refreshControl={<RefreshControl {...pull} tintColor={colors.accent} colors={[colors.accent]} />}
						style={{ width: size.panel, flexGrow: 0 }}
						contentContainerStyle={{ paddingVertical: space.s4 }}
					>
						{agenda}
					</ScrollView>
				</View>
			) : (
				<>
					<View style={{ paddingHorizontal: space.s4, paddingTop: space.s4, paddingBottom: space.s3 }}>{toolbar}</View>
					<LegacyScrollView
						ref={scrollRef}
						alwaysBounceVertical
						scrollEnabled={!dragging}
						refreshControl={<RefreshControl {...pull} tintColor={colors.accent} colors={[colors.accent]} />}
						contentContainerStyle={{ paddingHorizontal: space.s4, paddingBottom: space.s4, gap: space.s6 }}
					>
						{body}
						{agenda}
					</LegacyScrollView>
				</>
			)}
			<Sheet open={picking} onClose={() => setPicking(false)} title={t`Schedule an interview`}>
				<View style={{ padding: space.s4, gap: space.s3 }}>
					{slot ? <Text color="ink2">{userTime.when(slot.start)}</Text> : null}
					<SelectSheet
						label={t`Application`}
						value={pickedId}
						placeholder={t`Choose an application`}
						options={open.map((application) => ({
							value: application.id,
							label: `${application.company} · ${application.role}`,
						}))}
						onChange={setPickedId}
					/>
					<Button
						fullWidth
						label={t`Continue`}
						disabled={!pickedId}
						onPress={() => {
							const application = open.find((item) => item.id === pickedId);
							setPicking(false);
							// The picker leaves before the interview editor takes its place.
							if (application) setTimeout(() => edit({ kind: "interview", application, interview: null, slot }), 0);
						}}
					/>
				</View>
			</Sheet>
			{editing?.kind === "interview" ? (
				<InterviewSheet
					application={editing.application}
					interview={editing.interview}
					slot={editing.slot}
					open={editorOpen}
					onClose={() => setEditorOpen(false)}
				/>
			) : null}
			{editing?.kind === "follow-up" ? (
				<FollowUpSheet application={editing.application} open={editorOpen} onClose={() => setEditorOpen(false)} />
			) : null}
			<RescheduleSheet
				target={rescheduling}
				open={rescheduleOpen}
				onClose={() => setRescheduleOpen(false)}
				onReschedule={reschedule}
			/>
		</View>
	);
}

type LegendProps = { color: string; label: string };

function Legend({ color, label }: LegendProps) {
	const { radius, space } = useTheme();
	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: space.s1 }}>
			<View style={{ width: space.s2, height: space.s2, borderRadius: radius.rLg, backgroundColor: color }} />
			<Text variant="caption" color="ink3">
				{label}
			</Text>
		</View>
	);
}

type EventCardProps = {
	event: CalendarEvent;
	onEdit: (editing: Editing) => void;
	onReschedule: (target: RescheduleTarget) => void;
};

/** One interview or follow-up: tap to edit it, reschedule an interview, or open its application. */
function EventCard({ event, onEdit, onReschedule }: EventCardProps) {
	const router = useRouter();
	const { t } = useLingui();
	const { colors, space } = useTheme();
	const userTime = useUserTime();
	const { application } = event;
	const interview = event.kind === "interview" ? event.interview : null;
	const otherZone = interview && interview.timezone !== userTime.timeZone ? interview.timezone : null;
	const when = event.kind === "interview" ? `${userTime.time(event.start)} – ${userTime.time(event.end)}` : "";
	const title =
		event.kind === "interview"
			? t`${interviewTypeLabel(event.interview.kind)} interview · ${event.interview.durationMinutes} min`
			: application.followUpNote || t`Follow up`;

	return (
		<Card style={{ borderStartWidth: space.s1, borderStartColor: interview ? colors.accent : colors.warn }}>
			<Pressable
				accessibilityRole="button"
				accessibilityHint={interview ? t`Edit interview` : t`Change the follow-up`}
				onPress={() =>
					onEdit(
						event.kind === "interview"
							? { kind: "interview", application, interview: event.interview }
							: { kind: "follow-up", application },
					)
				}
				style={{ gap: space.s0 }}
			>
				{when ? <Text variant="label">{when}</Text> : null}
				{otherZone && interview ? (
					<Text variant="caption" color="ink3">
						{t`${userTime.time(interview.at, otherZone)} in ${otherZone}`}
					</Text>
				) : null}
				<Text variant="label" numberOfLines={1}>
					{application.company}
				</Text>
				<Text variant="callout" color="ink2" numberOfLines={2}>
					{title} · {application.role}
				</Text>
				{interview?.location ? (
					<Text variant="caption" color="ink3" numberOfLines={1}>
						{interview.location}
					</Text>
				) : null}
			</Pressable>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s3 }}>
				{event.kind === "interview" ? (
					<Button
						variant="link"
						size="sm"
						label={t`Reschedule`}
						onPress={() => onReschedule({ application, interview: event.interview })}
					/>
				) : null}
				<Button
					variant="link"
					size="sm"
					label={t`View application`}
					onPress={() => router.push(routes.applicationDetails(application.id))}
				/>
			</View>
		</Card>
	);
}
