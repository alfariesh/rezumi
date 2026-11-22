import { dateOnlyDeadline as sharedDeadline } from "@rezumi/career/offers";

export { defaultPair, matchingPlace, meetsMinimum, moneyDifference, sameTerms } from "@rezumi/career/offers";

export const formatMoney = (locale: string, currency: string, amount: number) =>
	new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

/**
 * A deadline the offer gave as a day with no time (`YYYY-MM-DD`): the day itself, never shifted by a time zone, and
 * whole days from today in the user's time zone (0 today, 1 tomorrow, negative once it has passed).
 */
export function dateOnlyDeadline(date: string, now: Date, timeZone: string, locale: string) {
	const { date: day, days } = sharedDeadline(date, now, timeZone);
	const label = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		weekday: "short",
		day: "numeric",
		month: "short",
	}).format(day);
	const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
	return { label, days, relative: relative.charAt(0).toLocaleUpperCase() + relative.slice(1) };
}
