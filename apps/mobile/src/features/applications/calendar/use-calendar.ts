// The calendar's state on the user's clock (profile time zone): which view (day, week, month), the day it is anchored
// on, the month shown, and the events of open applications by day. Phones show a 3-day week, tablets 7 (as web).
import type { ApplicationSummary } from "@/features/applications/types";
import type { CalendarEvent, CalendarView, TimedEvent } from "@rezumi/career/calendar";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import {
	addDays,
	collectEvents,
	dayKeyOf,
	groupByDay,
	monthGrid,
	shiftMonth,
	visibleDays,
	weekStartsOn,
} from "@rezumi/career/calendar";
import { useNow, useUserTime } from "@/features/applications/date";
import { useApplications } from "@/features/applications/queries";
import { useIsTablet } from "@/shell/use-is-tablet";

const monthOf = (key: string) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 });

export function useCalendar() {
	const { i18n } = useLingui();
	const query = useApplications();
	const userTime = useUserTime();
	const now = useNow();
	const tablet = useIsTablet();
	const timeZone = userTime.timeZone;
	const today = dayKeyOf(now, timeZone);
	const [view, setView] = useState<CalendarView>("week");
	const [anchor, setAnchor] = useState(today);
	const [month, setMonth] = useState(() => monthOf(today));

	const applications = query.data ?? [];
	const open = applications.filter((application) => application.status !== "closed");
	const events = collectEvents(applications, timeZone);
	const byDay = groupByDay(events);
	const weekStart = weekStartsOn(i18n.locale);
	const spanOf = (next: CalendarView) => (next === "day" ? 1 : tablet ? 7 : 3);
	const days = visibleDays(anchor, spanOf(view), weekStart);

	/** Shows `next` view around `day` (the month follows the day). */
	const show = (next: CalendarView, day = anchor) => {
		setView(next);
		setAnchor(day);
		setMonth(monthOf(day));
	};
	const step = (direction: 1 | -1) => {
		if (view === "month") return setMonth(shiftMonth(month.year, month.month, direction));
		show(view, addDays(anchor, direction * spanOf(view)));
	};
	const monthPrefix = `${month.year}-${String(month.month + 1).padStart(2, "0")}`;
	const inRange = (day: string) => (view === "month" ? day.startsWith(monthPrefix) : days.includes(day));

	return {
		query,
		userTime,
		now,
		today,
		timeZone,
		tablet,
		view,
		anchor,
		month,
		days,
		grid: monthGrid(month.year, month.month, weekStart),
		events,
		byDay,
		open,
		interviewCount: events.filter((event) => event.kind === "interview" && inRange(event.day)).length,
		showsToday: inRange(today),
		show,
		step,
		select: setAnchor,
		goToday: () => show(view, today),
	};
}

export type Calendar = ReturnType<typeof useCalendar>;

/** An interview or follow-up of one of the person's applications. */
export type AppEvent = CalendarEvent<ApplicationSummary>;
export type AppTimedEvent = TimedEvent<ApplicationSummary>;
