// Each compared term of one offer, with notes against the other column only where they can be told honestly: money in
// the same currency and pay period (@rezumi/career/offers), never a total, and "unknown" said as a question to ask.
import type { OfferClock } from "./clock";
import type { Offer } from "./queries";
import type { IconName } from "@/ui";
import { plural, t } from "@lingui/core/macro";
import { moneyDifference } from "@rezumi/career/offers";

export type CellNote = { icon: IconName; tone: "better" | "warn" | "muted"; text: string };
export type Cell = { value: string; known: boolean; strong?: boolean; notes: CellNote[] };
export type RowKey = "base" | "variable" | "equity" | "location" | "leave" | "learning" | "other" | "respondBy";

export const rows = (): { key: RowKey; label: string }[] => [
	{ key: "base", label: t`Base salary` },
	{ key: "variable", label: t`Bonus` },
	{ key: "equity", label: t`Equity` },
	{ key: "location", label: t`Where you work` },
	{ key: "leave", label: t`Leave` },
	{ key: "learning", label: t`Learning budget` },
	{ key: "other", label: t`Other benefits` },
	{ key: "respondBy", label: t`Respond by` },
];

export const companyOf = (offer: Offer) => offer.application?.company ?? t`Deleted application`;
export const versionLabel = (offer: Offer) => (offer.data.version === "verbal" ? t`Verbal offer` : t`Written offer`);

export function offerCells(offer: Offer, other: Offer | undefined, clock: OfferClock): Record<RowKey, Cell> {
	const terms = offer.data;
	const unknown: Cell = {
		value: t`Unknown`,
		known: false,
		notes: [{ icon: "question", tone: "warn", text: t`Not in the offer · ask ${companyOf(offer)}` }],
	};
	const money = (amount: number) => {
		const value = clock.money(terms.currency, amount);
		return { hour: t`${value} an hour`, month: t`${value} a month`, year: t`${value} a year` }[terms.period];
	};
	const better = (key: "base" | "variable" | "learning"): CellNote[] => {
		if (!other) return [];
		const difference = moneyDifference(terms, other.data, key);
		if (difference !== null && difference > 0)
			return [{ icon: "arrow-up", tone: "better", text: t`${clock.money(terms.currency, difference)} more` }];
		if (difference === null && terms[key] !== null && other.data[key] !== null)
			return [
				{
					icon: "info",
					tone: "muted",
					text:
						terms.currency === other.data.currency
							? t`Different pay period, not compared`
							: t`Different currency, not compared`,
				},
			];
		return [];
	};
	const text = (value: string): Cell => (value.trim() ? { value: value.trim(), known: true, notes: [] } : unknown);
	const amount = (key: "base" | "variable" | "learning", extra: CellNote[] = []): Cell => {
		const value = terms[key];
		return value === null
			? unknown
			: { value: money(value), known: true, strong: key === "base", notes: [...better(key), ...extra] };
	};

	const days = terms.officeDays;
	const office =
		days === null
			? null
			: days === 0
				? terms.location.trim()
					? null
					: t`Remote`
				: plural(days, { one: "# office day a week", other: "# office days a week" });
	const place = [terms.location.trim(), office].filter(Boolean).join(" · ");
	const deadline = terms.respondBy ? clock.deadline(terms.respondBy) : null;
	const conditions = terms.variableConditions.trim();

	return {
		base: amount("base"),
		variable: amount("variable", conditions ? [{ icon: "question", tone: "warn", text: conditions }] : []),
		equity: terms.equity.trim()
			? {
					value: terms.equity.trim(),
					known: true,
					// A share of the company is worth what the valuation says, after dilution.
					notes: [
						{
							icon: "question",
							tone: "warn",
							text: terms.equity.includes("%") ? t`Valuation and dilution uncertain` : t`Value uncertain`,
						},
					],
				}
			: unknown,
		location: place ? { value: place, known: true, notes: [] } : unknown,
		leave: text(terms.leave),
		learning: amount("learning"),
		other: text(terms.other),
		respondBy: deadline
			? {
					value: deadline.value,
					known: true,
					notes: [
						{ icon: "clock", tone: deadline.soon ? "warn" : "muted", text: deadline.distance },
						...(deadline.noTime ? [{ icon: "info", tone: "muted", text: t`No time given` } as const] : []),
					],
				}
			: unknown,
	};
}
