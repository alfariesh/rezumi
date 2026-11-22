// Offers' clock and words for time: the profile's time zone (Settings → Preferences, else the device's), money in the
// offer's own currency, and a deadline's day with how far off it is. A deadline given as a bare day stays that day in
// every time zone (@rezumi/career/offers → dateOnlyDeadline); Hermes has no Intl.RelativeTimeFormat, so the distance
// is written with plural.
import { plural, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { dateOnlyDeadline } from "@rezumi/career/offers";
import { daysBetweenDates, deviceTimeZone, isTimeZone, zonedParts } from "@rezumi/career/time";
import { isDateOnly } from "@rezumi/schema/career";
import { useNow } from "@/features/career/hooks";
import { useProfile } from "@/features/settings/queries";

export type Deadline = { value: string; distance: string; soon: boolean; noTime: boolean };

/** "Today", "Tomorrow", "In 3 days", "2 days ago". */
export const daysAway = (days: number) =>
	days === 0
		? t`Today`
		: days === 1
			? t`Tomorrow`
			: days > 1
				? plural(days, { one: "In # day", other: "In # days" })
				: plural(-days, { one: "# day ago", other: "# days ago" });

export function useOfferClock() {
	const { i18n } = useLingui();
	const profile = useProfile();
	const now = useNow();
	const preferred = profile.data?.timezone;
	const timeZone = preferred && isTimeZone(preferred) ? preferred : deviceTimeZone();
	const locale = i18n.locale;
	const money = (currency: string, amount: number) =>
		new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	const deadline = (respondBy: string): Deadline => {
		if (isDateOnly(respondBy)) {
			const { date, days } = dateOnlyDeadline(respondBy, now, timeZone);
			const value = new Intl.DateTimeFormat(locale, { timeZone: "UTC", dateStyle: "medium" }).format(date);
			return { value, distance: daysAway(days), soon: days <= 1, noTime: true };
		}
		const at = new Date(respondBy);
		const value = new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(at);
		const days = daysBetweenDates(zonedParts(now, timeZone).date, zonedParts(at, timeZone).date);
		const passed = at.getTime() < now.getTime();
		return {
			value,
			distance: passed && days === 0 ? t`Passed` : daysAway(days),
			soon: at.getTime() - now.getTime() < 48 * 3_600_000,
			noTime: false,
		};
	};
	const created = (value: Date | string) =>
		new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium" }).format(new Date(value));
	return { locale, timeZone, now, money, deadline, created };
}

export type OfferClock = ReturnType<typeof useOfferClock>;
