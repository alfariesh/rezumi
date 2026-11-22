import type { JobSeniority, JobWorkArrangement } from "@rezumi/schema/jobs/listing";
import type { JobListingCard, JobSearchCriteria } from "@rezumi/schema/jobs/search";
import { t } from "@lingui/core/macro";
import { formatPay, payRange } from "@rezumi/career/jobs";
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

/** A saved search's filters beyond role and place, in words: how it's worked, level, pay, visa, posting window. */
export function searchFilterLabels(search: Partial<JobSearchCriteria>, locale: string): string[] {
	const labels: string[] = [];
	if (search.workArrangement) labels.push(arrangementLabel(search.workArrangement));
	else if (search.remote === "only")
		labels.push(
			search.country
				? t({ message: "Remote in this country", context: "Job search filter" })
				: t({ message: "Remote anywhere", context: "Job search filter" }),
		);
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
	if (search.postedWithinDays && search.postedWithinDays !== 30)
		labels.push(
			search.postedWithinDays === 1
				? t`Posted in the last day`
				: search.postedWithinDays === 7
					? t`Posted in the last week`
					: t`Posted in the last 2 weeks`,
		);
	return labels;
}
