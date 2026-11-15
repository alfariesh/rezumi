/**
 * Follow-up dates are calendar days: the web's form stores the picked day as midnight UTC (`new Date("2026-11-20")`),
 * and shows it back as that day. So a follow-up is due once its UTC day is today or earlier in the person's time zone
 * (02-teknis.md §11, plugin-browser plan).
 */

/** At most this many due follow-ups per answer: the extension's home list and badge, not a report. */
export const MAX_DUE_FOLLOW_UPS = 50;

/** Today's calendar day in a time zone (an unknown or missing zone counts as UTC), as [year, month 1–12, day]. */
function dayIn(timeZone: string | undefined, now: Date): [number, number, number] {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = new Intl.DateTimeFormat("en-CA", {
			timeZone: timeZone || "UTC",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(now);
	} catch {
		parts = new Intl.DateTimeFormat("en-CA", {
			timeZone: "UTC",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(now);
	}
	const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
	return [part("year"), part("month"), part("day")];
}

/**
 * The first moment that is no longer due: midnight UTC of tomorrow's calendar day in the person's time zone. Every
 * follow-up before it falls on today or earlier.
 */
export function dueBefore(timeZone: string | undefined, now = new Date()): Date {
	const [year, month, day] = dayIn(timeZone, now);
	return new Date(Date.UTC(year, month - 1, day + 1));
}
