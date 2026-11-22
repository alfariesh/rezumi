// When local reminders fire. Pure: no React Native imports. Wall-clock time in a named time zone comes from
// `@rezumi/career/time` (re-exported here for the app's older imports).
import { fromZonedDateTime } from "@rezumi/utils/timezone";

export { deviceTimeZone } from "@rezumi/career/time";

/** Minutes before an interview that a reminder can fire. */
export const REMINDER_LEADS = [10, 30, 60, 1440] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];
export const DEFAULT_LEAD: ReminderLead = 30;

/** Follow-ups are whole days; their reminder fires at this wall-clock time in the user's timezone. */
export const FOLLOW_UP_TIME = "09:00";

export type ReminderKind = "interview" | "follow-up";

/** One notification per interview and one per application's follow-up; scheduling again replaces it. */
export const reminderId = (kind: ReminderKind, applicationId: string, entryId?: string) =>
	kind === "interview" ? `interview:${entryId ?? ""}` : `follow-up:${applicationId}`;

/** When the reminder fires: `lead` minutes before `start`, or null once that moment has passed. */
export function reminderTime(start: Date, leadMinutes: number, now = new Date()): Date | null {
	const at = new Date(start.getTime() - leadMinutes * 60_000);
	return at.getTime() > now.getTime() ? at : null;
}

/** A follow-up day ("2026-10-21") as the instant 09:00 on that day in `timeZone`. */
export const followUpStart = (date: string, timeZone: string) => fromZonedDateTime(date, FOLLOW_UP_TIME, timeZone);
