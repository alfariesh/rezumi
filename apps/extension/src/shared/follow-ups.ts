/**
 * Follow-up dates (02-teknis.md §11). They are calendar days: like the web's form, the extension stores the picked day
 * as midnight UTC (`2026-11-20T00:00:00Z`) and reads it back as that day, whatever the device's time zone. Pure, so the
 * service worker and the panel share it and tests can pin the clock.
 */

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today on this device, as YYYY-MM-DD. */
export function localDay(now = new Date()): string {
	const offset = now.getTimezoneOffset() * 60_000;
	return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** YYYY-MM-DD plus a number of days. */
export function addDays(day: string, days: number): string {
	return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The calendar day a stored follow-up falls on. */
export const followUpDay = (at: Date | string): string => new Date(at).toISOString().slice(0, 10);

/** The stored form of a picked day, or null for none. */
export const followUpAt = (day: string): Date | null => (ISO_DAY.test(day) ? new Date(`${day}T00:00:00.000Z`) : null);

/** The calendar day a page's closing date names ("2026-12-31", "2026-12-31T23:59:00+07:00"), or null. */
export function deadlineDay(validThrough: string | null | undefined): string | null {
	const text = validThrough?.trim();
	if (!text) return null;
	const iso = /^(\d{4}-\d{2}-\d{2})/.exec(text)?.[1];
	if (iso && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) return iso;
	const parsed = Date.parse(text);
	return Number.isNaN(parsed) ? null : localDay(new Date(parsed));
}

/**
 * Aturan turunan #6: the reminder starts two days before the posting's closing date when the page states one, else
 * empty. A deadline sooner than that reminds today; one already past leaves it empty.
 */
export function defaultFollowUpDay(validThrough: string | null | undefined, today: string): string {
	const deadline = deadlineDay(validThrough);
	if (!deadline || deadline < today) return "";
	const twoDaysBefore = addDays(deadline, -2);
	return twoDaysBefore < today ? today : twoDaysBefore;
}

/** Whether a follow-up is due: its day is today or earlier. */
export const isDue = (at: Date | string, today: string) => followUpDay(at) <= today;

/** The hour (device time) desktop reminders go out (aturan turunan #7). */
const NOTIFY_HOUR = 9;

type Notifiable = { id: string; followUpAt: string };

/**
 * Aturan turunan #7: which due follow-ups to show as a desktop reminder now. Nothing before 09:00 on this device; after
 * that, each application at most once a day (`notified` holds the day each one was last shown).
 */
export function remindersToShow<T extends Notifiable>(
	items: readonly T[],
	notified: Readonly<Record<string, string>>,
	now = new Date(),
): T[] {
	if (now.getHours() < NOTIFY_HOUR) return [];
	const today = localDay(now);
	return items.filter((item) => isDue(item.followUpAt, today) && notified[item.id] !== today);
}

/** The record after showing reminders today: only today's entries are kept, so it never grows. */
export function markReminded(
	notified: Readonly<Record<string, string>>,
	ids: readonly string[],
	now = new Date(),
): Record<string, string> {
	const today = localDay(now);
	const kept = Object.fromEntries(Object.entries(notified).filter(([, day]) => day === today));
	for (const id of ids) kept[id] = today;
	return kept;
}

/** The next 09:00 on this device after `now` (today's if it is still to come). */
export function nextReminderTime(now = new Date()): Date {
	const next = new Date(now);
	next.setHours(NOTIFY_HOUR, 0, 0, 0);
	if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
	return next;
}
