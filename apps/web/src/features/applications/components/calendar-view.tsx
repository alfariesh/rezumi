import type { ScheduledInterview } from "../interviews";
import type { ApplicationSummary } from "../types";
import type { InterviewSlot } from "./interview-dialog";
import type { AgendaEventType, AgendaView } from "@heroui-pro/react";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { Agenda, EmptyState, ItemCard, ItemCardGroup, Segment, useAgenda } from "@heroui-pro/react";
import { Button, Separator, Tooltip } from "@heroui/react";
import { fromDate, getLocalTimeZone, toCalendarDateTime } from "@internationalized/date";
import { plural, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { Fragment, useState, useSyncExternalStore } from "react";
import { INTERVIEW_KINDS } from "@rezumi/schema/applications/data";
import { Icon } from "@rezumi/ui/components/icon";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import {
	collectInterviews,
	dayKey,
	formatDuration,
	groupByDay,
	interviewKindOf,
	upcomingInterviews,
} from "../interviews";
import { useRescheduleInterview } from "../use-reschedule-interview";
import { InterviewDialog, interviewTypeLabel } from "./interview-dialog";

// Kind labels up to this length prefix an event's title ("Technical · Engineer · Acme").
const MAX_PREFIX_LENGTH = 12;

type DialogState =
	| { open: false }
	| {
			open: true;
			application: ApplicationSummary | null;
			interview: InterviewTimelineEntry | null;
			slot: InterviewSlot | null;
	  };

// ---- Dragging needs a mouse or trackpad; on touch screens the calendar only opens interviews. ----

const FINE_POINTER = "(pointer: fine)";

function subscribeFinePointer(onChange: () => void) {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
	const list = window.matchMedia(FINE_POINTER);
	list.addEventListener("change", onChange);
	return () => list.removeEventListener("change", onChange);
}

const readFinePointer = () =>
	typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(FINE_POINTER).matches;

const useFinePointer = () => useSyncExternalStore(subscribeFinePointer, readFinePointer, () => true);

const eventTitle = (item: ScheduledInterview) => {
	const kind = interviewTypeLabel(item.interview.kind);
	const title = `${item.application.role} · ${item.application.company}`;
	return kind.length <= MAX_PREFIX_LENGTH ? `${kind} · ${title}` : title;
};

type ApplicationCalendarProps = {
	// Applications matching the page filters; their interviews are shown.
	applications: ApplicationSummary[];
	// Every application, offered by the "schedule interview" picker.
	allApplications: ApplicationSummary[];
	onOpen: (application: ApplicationSummary) => void;
};

export function ApplicationCalendar({ applications, allApplications, onOpen }: ApplicationCalendarProps) {
	const { i18n } = useLingui();
	const locale = i18n.locale;
	const breakpoint = useBreakpoint();
	const finePointer = useFinePointer();
	const phone = breakpoint === "mobile";
	const canDrag = finePointer && !phone;
	const [dialog, setDialog] = useState<DialogState>({ open: false });
	const reschedule = useRescheduleInterview();

	// The calendar shows the viewer's local time, like the rest of the page.
	const timeZone = getLocalTimeZone();
	const toCalendar = (date: Date) => toCalendarDateTime(fromDate(date, timeZone));

	const interviews = collectInterviews(applications);
	const byId = new Map(interviews.map((item) => [item.interview.id, item]));
	const upcoming = upcomingInterviews(interviews);
	const upcomingByDay = [...groupByDay(upcoming).values()];
	const events = interviews.map((item): AgendaEventType => {
		const color = interviewKindOf(item.interview.kind)?.color;
		return {
			id: item.interview.id,
			title: eventTitle(item),
			start: toCalendar(item.start),
			end: toCalendar(item.end),
			...(color ? { color } : {}),
		};
	});

	const schedule = (slot: InterviewSlot | null = null) =>
		setDialog({ open: true, application: null, interview: null, slot });
	const edit = (item: ScheduledInterview) =>
		setDialog({ open: true, application: item.application, interview: item.interview, slot: null });
	const move = (id: string, start: AgendaEventType["start"], end: AgendaEventType["end"]) => {
		const item = byId.get(id);
		if (item) reschedule(item, start.toDate(timeZone), end.toDate(timeZone));
	};

	const agenda = useAgenda({
		events,
		defaultView: "month",
		weekDays: phone ? 3 : 7,
		// Always "nothing selected", so pressing the same interview again reopens it.
		selectedEventId: null,
		onEventSelect: (id) => {
			const item = id ? byId.get(id) : undefined;
			if (item) edit(item);
		},
		// Touch and phone widths get no drag callbacks, which turns dragging off (Agenda's own advice).
		...(canDrag
			? {
					onEventCreate: ({ start, end }: Pick<AgendaEventType, "start" | "end">) => {
						const from = start.toDate(timeZone);
						const durationMinutes = Math.round((end.toDate(timeZone).getTime() - from.getTime()) / 60_000);
						schedule({ start: from, durationMinutes });
					},
					onEventMove: move,
					onEventResize: move,
				}
			: {}),
	});

	// oxlint-disable-next-line react/purity -- Read today on each render so an open calendar updates after midnight when navigated.
	const today = new Date();
	const todayKey = dayKey(today);
	const tomorrowKey = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
	const monthCount = interviews.filter(
		(item) => item.start.getFullYear() === agenda.date.year && item.start.getMonth() + 1 === agenda.date.month,
	).length;

	const timeFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
	const dayHeadingFormat = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" });

	const dayHeading = (date: Date) => {
		const key = dayKey(date);
		if (key === todayKey) return t`Today`;
		if (key === tomorrowKey) return t`Tomorrow`;
		return dayHeadingFormat.format(date);
	};

	const previousLabel = { day: t`Previous day`, week: t`Previous week`, month: t`Previous month` }[agenda.view];
	const nextLabel = { day: t`Next day`, week: t`Next week`, month: t`Next month` }[agenda.view];
	const views: { id: AgendaView; label: string }[] = [
		{ id: "day", label: t`Day` },
		{ id: "week", label: t`Week` },
		{ id: "month", label: t`Month` },
	];

	const eventLabel = (event: AgendaEventType) => {
		const start = event.start.toDate(timeZone);
		const end = event.end.toDate(timeZone);
		const range = `${dayHeadingFormat.format(start)}, ${timeFormat.format(start)} – ${timeFormat.format(end)}`;
		return t`Edit interview: ${event.title}, ${range}`;
	};

	return (
		<div className="flex min-h-0 flex-1 gap-6 max-lg:flex-col max-lg:overflow-y-auto">
			<section className="flex min-h-0 flex-1 flex-col gap-3" data-testid="interview-calendar">
				<div className="relative min-h-[34rem] flex-1 overflow-hidden rounded-2xl border border-separator bg-surface">
					<Agenda {...agenda} className="absolute inset-0">
						{/* A plain row, not Agenda.Header: its narrow layout is a fixed grid for its own three parts. */}
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3 pb-1">
							<div className="flex flex-auto items-baseline gap-2 whitespace-nowrap">
								<Agenda.Heading className="flex-none capitalize" />
								<span className="text-sm text-muted">
									<Plural value={monthCount} _0="No interviews" one="# interview" other="# interviews" />
								</span>
							</div>
							<Segment
								size="sm"
								aria-label={t`Calendar view`}
								selectedKey={agenda.view}
								onSelectionChange={(key) => agenda.setView(key as AgendaView)}
							>
								{views.map((view) => (
									<Segment.Item key={view.id} id={view.id}>
										{view.label}
									</Segment.Item>
								))}
							</Segment>
							<Agenda.Navigation>
								<Button isIconOnly size="sm" variant="ghost" aria-label={previousLabel} onPress={agenda.goToPrevious}>
									<Icon name="caret-left" size={16} className="rtl:rotate-180" />
								</Button>
								<Agenda.TodayButton>
									<Trans>Today</Trans>
								</Agenda.TodayButton>
								<Button isIconOnly size="sm" variant="ghost" aria-label={nextLabel} onPress={agenda.goToNext}>
									<Icon name="caret-right" size={16} className="rtl:rotate-180" />
								</Button>
							</Agenda.Navigation>
							<Button size="sm" onPress={() => schedule()}>
								<Icon name="calendar-plus" size={16} />
								<Trans>Schedule interview</Trans>
							</Button>
						</div>

						<Agenda.Body>
							{agenda.view === "month" ? (
								<Agenda.MonthGrid>
									{agenda.visibleWeeks.map((week) => (
										<Agenda.MonthRow key={week[0]?.toString()}>
											{week.map((day) => (
												<Agenda.MonthCell
													key={day.toString()}
													date={day}
													maxEvents={phone ? 1 : 2}
													moreLabel={(count) => plural(count, { other: "# more" })}
												>
													{agenda.getPerCellEvents(day, week).map((event) => {
														const label = eventLabel(event);
														return (
															<Agenda.MonthEvent key={event.id} event={event}>
																<button
																	type="button"
																	title={label}
																	aria-label={label}
																	className="block w-full cursor-[inherit] truncate text-start outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus"
																>
																	{event.title}
																</button>
															</Agenda.MonthEvent>
														);
													})}
												</Agenda.MonthCell>
											))}
										</Agenda.MonthRow>
									))}
								</Agenda.MonthGrid>
							) : (
								<>
									<Agenda.WeekHeader />
									<Agenda.TimeGrid>
										<Agenda.CurrentTimeIndicator />
										{agenda.visibleDays.map((day) => (
											<Agenda.DayColumn key={day.toString()} date={day}>
												{agenda.getEventsForDay(day).map((event) => (
													<Agenda.Event key={event.id} event={event}>
														<button
															type="button"
															aria-label={eventLabel(event)}
															className="flex size-full min-w-0 cursor-[inherit] flex-col text-start outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus"
														>
															<Agenda.EventTitle>{event.title}</Agenda.EventTitle>
															<Agenda.EventTime event={event} />
														</button>
													</Agenda.Event>
												))}
											</Agenda.DayColumn>
										))}
									</Agenda.TimeGrid>
								</>
							)}
						</Agenda.Body>
					</Agenda>
				</div>

				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
					{INTERVIEW_KINDS.map((kind) => (
						<span key={kind.value} className="flex items-center gap-1.5">
							<span className="size-2 rounded-full" style={{ background: kind.color }} />
							{interviewTypeLabel(kind.value)}
						</span>
					))}
					{canDrag && (
						<span className="ms-auto">
							<Trans>Drag to move or resize an interview, or across empty hours to schedule one.</Trans>
						</span>
					)}
				</div>
			</section>

			<aside className="flex shrink-0 flex-col gap-4 lg:w-80 lg:overflow-y-auto">
				<h3 className="text-sm font-semibold">
					<Trans>Upcoming interviews</Trans>
				</h3>

				{upcoming.length === 0 ? (
					<EmptyState size="sm" className="rounded-2xl border border-dashed border-border">
						<EmptyState.Header>
							<EmptyState.Media variant="icon">
								<Icon name="calendar-blank" size={20} />
							</EmptyState.Media>
							<EmptyState.Title>
								<Trans>Nothing scheduled yet</Trans>
							</EmptyState.Title>
							<EmptyState.Description className="max-w-xs text-pretty">
								<Trans>Add screening calls and technical interviews to see them here and on the calendar.</Trans>
							</EmptyState.Description>
						</EmptyState.Header>
						<EmptyState.Content>
							<Button size="sm" variant="secondary" onPress={() => schedule()}>
								<Icon name="calendar-plus" size={16} />
								<Trans>Schedule interview</Trans>
							</Button>
						</EmptyState.Content>
					</EmptyState>
				) : (
					upcomingByDay.map((group) => {
						const first = group[0];
						if (!first) return null;
						return (
							<div key={dayKey(first.start)} className="flex flex-col gap-2">
								<h4 className="text-xs font-medium text-muted">{dayHeading(first.start)}</h4>
								<ItemCardGroup variant="outline">
									{group.map((item, index) => (
										<Fragment key={item.interview.id}>
											{index > 0 && <Separator />}
											<UpcomingCard
												item={item}
												timeRange={`${timeFormat.format(item.start)} – ${timeFormat.format(item.end)}`}
												locale={locale}
												onEdit={() => edit(item)}
												onOpenApplication={() => onOpen(item.application)}
											/>
										</Fragment>
									))}
								</ItemCardGroup>
							</div>
						);
					})
				)}
			</aside>

			<InterviewDialog
				open={dialog.open}
				onOpenChange={(open) => !open && setDialog({ open: false })}
				application={dialog.open ? dialog.application : null}
				applications={allApplications}
				interview={dialog.open ? dialog.interview : null}
				slot={dialog.open ? dialog.slot : null}
			/>
		</div>
	);
}

type UpcomingCardProps = {
	item: ScheduledInterview;
	timeRange: string;
	locale: string;
	onEdit: () => void;
	onOpenApplication: () => void;
};

function UpcomingCard({ item, timeRange, locale, onEdit, onOpenApplication }: UpcomingCardProps) {
	const color = interviewKindOf(item.interview.kind)?.color;
	const viewLabel = t`View application`;
	return (
		<ItemCard
			variant="transparent"
			className="relative items-start"
			data-upcoming-interview={item.interview.id}
			data-application-id={item.application.id}
		>
			<ItemCard.Icon
				aria-hidden
				style={color ? { color, backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)` } : undefined}
			>
				<Icon name="calendar-dots" size={16} />
			</ItemCard.Icon>
			<ItemCard.Content>
				<ItemCard.Title>
					{/* Covers the whole card, so pressing anywhere but "View application" edits the interview. */}
					<button
						type="button"
						className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-focus"
						onClick={onEdit}
					>
						{item.application.company}
					</button>
				</ItemCard.Title>
				<ItemCard.Description>
					{interviewTypeLabel(item.interview.kind)} · {item.application.role}
				</ItemCard.Description>
				<ItemCard.Description className="tabular-nums">
					{timeRange} · {formatDuration(item.interview.durationMinutes, locale)}
				</ItemCard.Description>
				{item.interview.location && (
					<ItemCard.Description className="flex items-center gap-1">
						<Icon name="map-pin" size={14} className="shrink-0" />
						<span className="truncate">{item.interview.location}</span>
					</ItemCard.Description>
				)}
			</ItemCard.Content>
			<ItemCard.Action className="relative">
				<Tooltip>
					<Button
						isIconOnly
						size="sm"
						variant="ghost"
						aria-label={viewLabel}
						data-application-open
						onPress={onOpenApplication}
					>
						<Icon name="arrow-square-out" size={16} />
					</Button>
					<Tooltip.Content>{viewLabel}</Tooltip.Content>
				</Tooltip>
			</ItemCard.Action>
		</ItemCard>
	);
}
