// Wall-clock dates and times in a named time zone. Uses `Intl.DateTimeFormat#formatToParts` only (Hermes has it;
// it lacks `Intl.RelativeTimeFormat` and `Intl.NumberFormat#formatToParts`).

/** An instant as the date ("2026-10-08") and time ("17:58") on a clock in `timeZone`. */
export function zonedParts(instant: Date | string, timeZone: string) {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		})
			.formatToParts(new Date(instant))
			.map(({ type, value }) => [type, value]),
	);
	return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Whether `value` is a time zone this runtime knows. */
export const isTimeZone = (value: string) => {
	try {
		new Intl.DateTimeFormat("en", { timeZone: value });
		return true;
	} catch {
		return false;
	}
};

/** The device's time zone, UTC when the runtime can't tell. */
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** Whole calendar days from `from` to `to` (both `YYYY-MM-DD`): 0 the same day, negative when `to` is earlier. */
export const daysBetweenDates = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
