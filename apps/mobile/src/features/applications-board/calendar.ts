// Calendar maths for interviews and follow-ups. Days are calendar dates ("2026-10-19") on the user's clock (their
// profile timezone), not the device's, so an interview lands on the same day as the detail screen shows it.
// Pure: Node runs it in the M5-T3 scenarios.
import type { ApplicationSummary as Application } from "../applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { zonedParts } from "../reminders/schedule.ts";

const DAY_MS = 86_400_000;

export type CalendarEvent =
	| {
			kind: "interview";
			id: string;
			application: Application;
			interview: InterviewTimelineEntry;
			start: Date;
			end: Date;
			day: string;
	  }
	| { kind: "follow-up"; id: string; application: Application; start: Date; day: string };

export type GridDay = { key: string; day: number; inMonth: boolean };

/** The calendar date of an instant on a clock in `timeZone`. */
export const dayKeyOf = (instant: Date | string, timeZone: string) => zonedParts(instant, timeZone).date;

/**
 * A follow-up's day. The app stores 09:00 on the user's clock; web stores the bare date as UTC midnight. A UTC
 * midnight value is read as that UTC date (when 09:00 local is UTC midnight, the offset is +9 and the dates agree).
 */
export function followUpDay(followUpAt: Date | string, timeZone: string) {
	const date = new Date(followUpAt);
	return date.getTime() % DAY_MS === 0 ? date.toISOString().slice(0, 10) : dayKeyOf(date, timeZone);
}

/** Interviews and follow-ups of open applications, soonest first. Closed applications stay off the calendar. */
export function collectEvents(applications: readonly Application[], timeZone: string): CalendarEvent[] {
	const events: CalendarEvent[] = [];
	for (const application of applications) {
		if (application.status === "closed") continue;
		for (const entry of application.activity) {
			if (entry.type !== "interview") continue;
			const start = new Date(entry.at);
			events.push({
				kind: "interview",
				id: `interview:${entry.id}`,
				application,
				interview: entry,
				start,
				end: new Date(start.getTime() + entry.durationMinutes * 60_000),
				day: dayKeyOf(start, timeZone),
			});
		}
		if (application.followUpAt) {
			events.push({
				kind: "follow-up",
				id: `follow-up:${application.id}`,
				application,
				start: new Date(application.followUpAt),
				day: followUpDay(application.followUpAt, timeZone),
			});
		}
	}
	return events.sort((a, b) => a.day.localeCompare(b.day) || a.start.getTime() - b.start.getTime());
}

export function groupByDay(events: readonly CalendarEvent[]) {
	const map = new Map<string, CalendarEvent[]>();
	for (const event of events) map.set(event.day, [...(map.get(event.day) ?? []), event]);
	return map;
}

/** Interviews that haven't ended and follow-ups from today on. */
export const upcomingEvents = (events: readonly CalendarEvent[], now: Date, today: string) =>
	events.filter((event) => (event.kind === "interview" ? event.end.getTime() >= now.getTime() : event.day >= today));

const pad = (value: number) => String(value).padStart(2, "0");
const keyOf = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/** A calendar date as a UTC midnight Date, for date arithmetic and formatting with `timeZone: "UTC"`. */
export const dateOfKey = (key: string) => new Date(`${key}T00:00:00Z`);

/** Six weeks (42 days) covering the month (`month` 0–11), starting on `weekStartsOn` (0 = Sunday). */
export function monthGrid(year: number, month: number, weekStartsOn: number): GridDay[] {
	const first = Date.UTC(year, month, 1);
	const offset = (new Date(first).getUTCDay() - weekStartsOn + 7) % 7;
	return Array.from({ length: 42 }, (_, i) => {
		const date = new Date(first + (i - offset) * DAY_MS);
		return { key: keyOf(date), day: date.getUTCDate(), inMonth: date.getUTCMonth() === month };
	});
}

export const shiftMonth = (year: number, month: number, delta: number) => {
	const date = new Date(Date.UTC(year, month + delta, 1));
	return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
};

/** The locale's first day of the week (0 = Sunday) where Intl knows it; Monday otherwise, as the mockups. */
export function weekStartsOn(locale: string) {
	try {
		const info = new Intl.Locale(locale) as Intl.Locale & {
			getWeekInfo?: () => { firstDay: number };
			weekInfo?: { firstDay: number };
		};
		const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
		return firstDay ? firstDay % 7 : 1;
	} catch {
		return 1;
	}
}

// ---- Week and day views: a time grid of wall-clock minutes (0–1440) on the user's clock. ----

export type CalendarView = "month" | "week" | "day";

/** Drags and taps on the time grid land on this many minutes. */
export const SNAP_MINUTES = 15;
const DAY_MINUTES = 24 * 60;

/** The day `delta` days after `key`. */
export const addDays = (key: string, delta: number) => keyOf(new Date(dateOfKey(key).getTime() + delta * DAY_MS));

/**
 * The days the week or day view shows around `anchor`. A 7-day week starts on `weekStartsOn`; a shorter span (the
 * phone's 3-day week, or one day) starts on the anchor itself, as web's Agenda does.
 */
export function visibleDays(anchor: string, count: number, weekStart: number) {
	const offset = count === 7 ? (dateOfKey(anchor).getUTCDay() - weekStart + 7) % 7 : 0;
	return Array.from({ length: count }, (_, i) => addDays(anchor, i - offset));
}

/** The wall-clock time ("09:30") of an instant on a clock in `timeZone`. */
export const zonedTime = (instant: Date | string, timeZone: string) => zonedParts(instant, timeZone).time;

/** "09:30" → 570. */
export const minutesOf = (time: string) => {
	const [hours = 0, minutes = 0] = time.split(":").map(Number);
	return hours * 60 + minutes;
};

/** 570 → "09:30". Clamped to the day. */
export const timeOf = (minutes: number) => {
	const value = Math.min(DAY_MINUTES - 1, Math.max(0, Math.round(minutes)));
	return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
};

export const snapMinutes = (minutes: number, step = SNAP_MINUTES) => Math.round(minutes / step) * step;

export type TimedEvent = Extract<CalendarEvent, { kind: "interview" }>;

/** An interview placed on a day's column: where it starts and ends (minutes) and its lane among overlapping ones. */
export type PlacedEvent = { event: TimedEvent; top: number; bottom: number; lane: number; lanes: number };

/**
 * Lays out one day's interviews. Each starts at its wall-clock minute on `timeZone` and is cut at midnight; overlapping
 * interviews share the column side by side, as many lanes as the busiest moment needs.
 */
export function placeDay(events: readonly CalendarEvent[], day: string, timeZone: string): PlacedEvent[] {
	const timed = events
		.filter((event): event is TimedEvent => event.kind === "interview" && event.day === day)
		.map((event) => {
			const top = minutesOf(zonedTime(event.start, timeZone));
			const bottom = Math.min(DAY_MINUTES, top + Math.max(SNAP_MINUTES, event.interview.durationMinutes));
			return { event, top, bottom, lane: 0, lanes: 1 };
		})
		.sort((a, b) => a.top - b.top || b.bottom - a.bottom);

	let cluster: PlacedEvent[] = [];
	let clusterEnd = -1;
	const finish = () => {
		const lanes = Math.max(1, ...cluster.map((item) => item.lane + 1));
		for (const item of cluster) item.lanes = lanes;
		cluster = [];
	};
	for (const item of timed) {
		if (item.top >= clusterEnd) finish();
		const used = new Set(cluster.filter((other) => other.bottom > item.top).map((other) => other.lane));
		let lane = 0;
		while (used.has(lane)) lane++;
		item.lane = lane;
		cluster.push(item);
		clusterEnd = Math.max(clusterEnd, item.bottom);
	}
	finish();
	return timed;
}

/**
 * Where a dragged interview lands: `days` columns over and `minutes` later (snapped), kept inside its new day. Returns
 * the wall-clock date and time on the user's clock.
 */
export function movedSlot(placed: Pick<PlacedEvent, "top" | "bottom">, day: string, days: number, minutes: number) {
	const length = placed.bottom - placed.top;
	const start = Math.min(DAY_MINUTES - length, Math.max(0, placed.top + snapMinutes(minutes)));
	return { date: addDays(day, days), time: timeOf(start) };
}

/** The length after dragging the bottom edge by `minutes` (snapped): at least one snap, and not past midnight. */
export function resizedLength(placed: Pick<PlacedEvent, "top" | "bottom">, minutes: number) {
	const bottom = Math.min(DAY_MINUTES, placed.bottom + snapMinutes(minutes));
	return Math.max(SNAP_MINUTES, bottom - placed.top);
}

/** The half hour a tap on an empty part of the grid picks, as a wall-clock time. */
export const tappedSlot = (minutes: number) => timeOf(Math.min(DAY_MINUTES - 30, Math.floor(minutes / 30) * 30));

/** The application with one interview moved to `at` and resized to `durationMinutes`; others are returned unchanged. */
export function withInterviewTime<T extends Pick<Application, "id" | "activity">>(
	item: T,
	change: { id: string; entryId: string; at: Date; durationMinutes: number },
): T {
	if (item.id !== change.id) return item;
	return {
		...item,
		activity: item.activity.map((entry) =>
			entry.id === change.entryId && entry.type === "interview"
				? { ...entry, at: change.at, durationMinutes: change.durationMinutes }
				: entry,
		),
	};
}
