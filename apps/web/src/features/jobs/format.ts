import type { JobSeniority, JobWorkArrangement } from "@rezumi/schema/jobs/listing";
import type { JobListingCard } from "@rezumi/schema/jobs/search";
import { t } from "@lingui/core/macro";
import { jobSourceName } from "@rezumi/schema/jobs/listing";

/** How a listing reads on its card and in its detail: each in the person's language, the provider's data as given. */

export const arrangementLabel = (arrangement: JobWorkArrangement) =>
	arrangement === "remote" ? t`Remote` : arrangement === "hybrid" ? t`Hybrid` : t`On-site`;

export const seniorityLabel = (seniority: JobSeniority) => {
	switch (seniority) {
		case "entry":
			return t({ message: "Entry level", context: "Job seniority" });
		case "junior":
			return t({ message: "Junior", context: "Job seniority" });
		case "mid":
			return t({ message: "Mid level", context: "Job seniority" });
		case "senior":
			return t({ message: "Senior", context: "Job seniority" });
		case "lead":
			return t({ message: "Lead", context: "Job seniority" });
		case "executive":
			return t({ message: "Executive", context: "Job seniority" });
	}
};

/** "via LinkedIn", "via the company's careers site", or nothing when the provider doesn't say. */
export function sourceLabel(listing: Pick<JobListingCard, "source">): string | null {
	const name = jobSourceName(listing.source);
	if (!name) return null;
	return name === "company-site" ? t`via the company's careers site` : t`via ${name}`;
}

/** The place as the posting gives it, else its parts. */
export function placeLabel(listing: Pick<JobListingCard, "location">): string {
	const { location } = listing;
	return (
		location.text.trim() ||
		[location.city, location.region, location.country].filter((part): part is string => Boolean(part)).join(", ")
	);
}

const amount = (value: number, currency: string, locale: string) => {
	if (!currency) return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
	try {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
			notation: value >= 10_000 ? "compact" : "standard",
			maximumFractionDigits: value >= 10_000 ? 1 : 0,
		}).format(value);
	} catch {
		return `${currency} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)}`;
	}
};

/** The listed pay in its own currency ("£70K–£85K a year"); null when the posting lists none. */
export function salaryLabel(salary: JobListingCard["salary"], locale: string): string | null {
	if (!salary || (salary.min === undefined && salary.max === undefined)) return null;
	const { min, max, currency } = salary;
	const range =
		min !== undefined && max !== undefined && min !== max
			? `${amount(min, currency, locale)}–${amount(max, currency, locale)}`
			: amount((min ?? max) as number, currency, locale);
	switch (salary.period) {
		case "year":
			return t({ message: `${range} a year`, context: "Listed pay" });
		case "month":
			return t({ message: `${range} a month`, context: "Listed pay" });
		case "hour":
			return t({ message: `${range} an hour`, context: "Listed pay" });
		default:
			return range;
	}
}
