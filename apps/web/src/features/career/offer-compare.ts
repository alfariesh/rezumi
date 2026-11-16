import type { CareerProfileData, OfferTerms } from "@rezumi/schema/career";

type Pay = Pick<OfferTerms, "currency" | "period">;

/** Money is only compared in the same currency and pay period: anything else needs a guessed rate or hours. */
export const sameTerms = (a: Pay, b: Pay) => a.currency === b.currency && a.period === b.period;

/** How much more `a` pays than `b` (negative when less), or null when it can't be told honestly. */
export function moneyDifference(a: OfferTerms, b: OfferTerms, key: "base" | "variable" | "learning") {
	const x = a[key];
	const y = b[key];
	if (x === null || y === null || !sameTerms(a, b)) return null;
	return x - y;
}

/** Whether the base clears the Preferences minimum; null when either is unknown or they're in different terms. */
export function meetsMinimum(offer: OfferTerms, minBase: CareerProfileData["minBase"]) {
	if (offer.base === null || minBase.amount === null || !sameTerms(offer, minBase)) return null;
	return offer.base >= minBase.amount;
}

export const formatMoney = (locale: string, currency: string, amount: number) =>
	new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

/** A preferred place the offer's location names (or is named by), ignoring case. */
export const matchingPlace = (location: string, places: string[]) => {
	const where = location.toLocaleLowerCase();
	return places.find((place) => {
		const wanted = place.toLocaleLowerCase();
		return where.includes(wanted) || wanted.includes(where);
	});
};

/** The pair to open with: the newest offer, and the newest one from a different application. */
export function defaultPair(offers: { id: string; applicationId: string | null }[]) {
	const [first] = offers;
	const second = offers.find((offer) => offer.applicationId !== first?.applicationId);
	return [first?.id, second?.id] as const;
}

/** Today's calendar date in a time zone, as `YYYY-MM-DD`. */
const calendarDate = (now: Date, timeZone: string) => {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}`;
};

/**
 * A deadline the offer gave as a day with no time (`YYYY-MM-DD`): the day itself, never shifted by a time zone, and
 * whole days from today in the user's time zone (0 today, 1 tomorrow, negative once it has passed).
 */
export function dateOnlyDeadline(date: string, now: Date, timeZone: string, locale: string) {
	const day = Date.parse(`${date}T00:00:00Z`);
	const days = Math.round((day - Date.parse(`${calendarDate(now, timeZone)}T00:00:00Z`)) / 86_400_000);
	const label = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		weekday: "short",
		day: "numeric",
		month: "short",
	}).format(day);
	const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
	return { label, days, relative: relative.charAt(0).toLocaleUpperCase() + relative.slice(1) };
}
