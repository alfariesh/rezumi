// How a job listing and a job search read in the app: each in the person's language around the provider's data as
// given (the web's features/jobs/format.ts). The pay and place themselves come from @rezumi/career/jobs.
import type { JobSeniority, JobWorkArrangement } from "@rezumi/schema/jobs/listing";
import type { JobListingCard, JobSearchCriteria } from "@rezumi/schema/jobs/search";
import { plural, t } from "@lingui/core/macro";
import { formatPay, payRange } from "@rezumi/career/jobs";
import { jobSourceName } from "@rezumi/schema/jobs/listing";

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

/** The listed pay in its own currency ("£70K–£85K a year"); null when the posting lists none. */
export function salaryLabel(salary: JobListingCard["salary"], locale: string): string | null {
	const pay = payRange(salary, locale);
	if (!pay) return null;
	const { range } = pay;
	switch (pay.period) {
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

/** The posting windows, as the search's choices name them. */
export const postedLabel = (days: number) =>
	days === 1
		? t`Posted in the last day`
		: days === 7
			? t`Posted in the last week`
			: days === 14
				? t`Posted in the last 2 weeks`
				: t`Posted in the last 30 days`;

/** The posting window on the search row's chip, short: the chip says what it filters by its icon. */
export const postedShortLabel = (days: number) =>
	days === 1
		? t({ message: "Last day", context: "Job search filter: posted within" })
		: days === 7
			? t({ message: "Last week", context: "Job search filter: posted within" })
			: days === 14
				? t({ message: "Last 2 weeks", context: "Job search filter: posted within" })
				: t({ message: "Last 30 days", context: "Job search filter: posted within" });

/** "Remote in this country" with a country, "Remote anywhere" without. */
export const remoteLabel = (country: string | undefined) =>
	country
		? t({ message: "Remote in this country", context: "Job search filter" })
		: t({ message: "Remote anywhere", context: "Job search filter" });

/** A saved search's filters beyond role and place, in words: how it's worked, level, pay, visa, posting window. */
export function searchFilterLabels(search: Partial<JobSearchCriteria>, locale: string): string[] {
	const labels: string[] = [];
	if (search.workArrangement) labels.push(arrangementLabel(search.workArrangement));
	else if (search.remote === "only") labels.push(remoteLabel(search.country));
	if (search.seniority) labels.push(seniorityLabel(search.seniority));
	if (search.salaryMin !== undefined) {
		const pay = formatPay(search.salaryMin, search.salaryCurrency ?? "USD", locale);
		labels.push(
			search.includeNoSalary === false
				? t({ message: `Pay from ${pay} a year`, context: "Job search filter" })
				: t({ message: `Pay from ${pay} a year, or not listed`, context: "Job search filter" }),
		);
	}
	if (search.visaSponsorship) labels.push(t`Visa sponsorship`);
	if (search.postedWithinDays && search.postedWithinDays !== 30) labels.push(postedLabel(search.postedWithinDays));
	return labels;
}

const DAY = 86_400_000;

/**
 * When a listing was posted, in days ("Posted 3 days ago"); a date past a month. Hermes has no
 * `Intl.RelativeTimeFormat`, so the words are the app's own.
 */
export function postedAgo(postedAt: string, now: Date, locale: string): string {
	// Calendar days on this device, so "today" means today here, not "within 24 hours".
	const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
	const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(new Date(postedAt))) / DAY));
	if (days === 0) return t({ message: "Posted today", context: "Job listing" });
	if (days === 1) return t({ message: "Posted yesterday", context: "Job listing" });
	if (days <= 31) return plural(days, { one: "Posted # day ago", other: "Posted # days ago" });
	const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
		new Date(postedAt),
	);
	return t({ message: `Posted ${date}`, context: "Job listing" });
}

/** How fresh a page of results is ("updated 5 min ago"). */
export function updatedAgo(fetchedAt: string, now: Date): string {
	const minutes = Math.max(0, Math.floor((now.getTime() - new Date(fetchedAt).getTime()) / 60_000));
	if (minutes < 1) return t({ message: "updated just now", context: "Job search results" });
	if (minutes < 60) return plural(minutes, { one: "updated # min ago", other: "updated # min ago" });
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return plural(hours, { one: "updated # hour ago", other: "updated # hours ago" });
	return plural(Math.floor(hours / 24), { one: "updated # day ago", other: "updated # days ago" });
}
