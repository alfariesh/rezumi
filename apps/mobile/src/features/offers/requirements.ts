// An offer against the user's Preferences: the minimum base (only in the same currency and pay period), the office-day
// limit and the preferred places. `met` is null when it can't be told.
import type { OfferClock } from "./clock";
import type { Offer } from "./queries";
import type { CareerProfileData } from "@rezumi/schema/career";
import { plural, t } from "@lingui/core/macro";
import { matchingPlace, meetsMinimum, sameTerms } from "@rezumi/career/offers";

export type Requirement = { met: boolean | null; text: string };

export function requirementsFor(offer: Offer, profile: CareerProfileData, clock: OfferClock): Requirement[] {
	const terms = offer.data;
	const list: Requirement[] = [];
	const { amount, currency } = profile.minBase;
	if (amount !== null) {
		const minimum = clock.money(currency, amount);
		list.push({
			met: meetsMinimum(terms, profile.minBase),
			text: sameTerms(terms, profile.minBase) ? t`${minimum} minimum` : t`${minimum} minimum, in other terms`,
		});
	}
	if (profile.maxOfficeDays !== null && terms.officeDays !== null) {
		const days = terms.officeDays;
		const limit = profile.maxOfficeDays;
		list.push({
			met: days <= limit,
			text:
				days === 0
					? t`Remote`
					: days === limit
						? plural(days, { one: "# office day, your limit", other: "# office days, your limit" })
						: days < limit
							? plural(days, { one: "# office day, under your limit", other: "# office days, under your limit" })
							: plural(days, { one: "# office day, over your limit", other: "# office days, over your limit" }),
		});
	}
	const location = terms.location.trim();
	if (profile.locations.length > 0 && location) {
		const match = matchingPlace(location, profile.locations);
		list.push({ met: match ? true : null, text: match ? location : t`${location}, not one of your places` });
	}
	return list;
}
