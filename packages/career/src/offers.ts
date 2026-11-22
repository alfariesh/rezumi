// Comparing saved offers: money only in the same currency and period, the Preferences minimum, preferred places, the
// pair to open with, and deadlines given as a bare day. No words: each app formats and translates.
import type { CareerProfileData, OfferTerms } from "@rezumi/schema/career";
import { daysBetweenDates, zonedParts } from "./time";

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

/** A preferred place the offer's location names (or is named by), ignoring case. */
export const matchingPlace = (location: string, places: readonly string[]) => {
	const where = location.toLocaleLowerCase();
	if (!where) return undefined;
	return places.find((place) => {
		const wanted = place.toLocaleLowerCase();
		return where.includes(wanted) || wanted.includes(where);
	});
};

/** The pair to open with: the newest offer, and the newest one from a different application. */
export function defaultPair(offers: readonly { id: string; applicationId: string | null }[]) {
	const [first] = offers;
	const second = offers.find((offer) => offer.applicationId !== first?.applicationId);
	return [first?.id, second?.id] as const;
}

/**
 * A deadline the offer gave as a day with no time (`YYYY-MM-DD`): the day itself, never shifted by a time zone, and
 * whole days from today in `timeZone` (0 today, 1 tomorrow, negative once it has passed). Format `date` with
 * `timeZone: "UTC"` so it shows as the same day everywhere.
 */
export function dateOnlyDeadline(day: string, now: Date, timeZone: string) {
	return { date: new Date(`${day}T00:00:00Z`), days: daysBetweenDates(zonedParts(now, timeZone).date, day) };
}
