import type { JobListingDraft } from "@rezumi/schema/jobs/listing";
import type { JobSearchInput } from "@rezumi/schema/jobs/search";

/**
 * Checks done on Rezumi's side after a provider answers (`02-teknis.md` sections 7 and 15): filters a provider can't
 * apply itself (visa sponsorship, "include jobs without pay", JobsPipe seniority), and a second look at the ones it did
 * apply, since providers sometimes return near misses. A listing that doesn't say (no country, no pay, no level) is
 * kept: only a listing that clearly doesn't match is left out.
 */

type Listing = Pick<
	JobListingDraft,
	"location" | "workArrangement" | "seniority" | "visaSponsorship" | "salary" | "closedAt" | "title" | "company"
>;

function salaryFits(listing: Listing, search: JobSearchInput): boolean {
	if (search.salaryMin === undefined) return true;
	const salary = listing.salary;
	if (!salary || (salary.min === undefined && salary.max === undefined)) return search.includeNoSalary;
	// Pay in another currency or per month or hour can't be compared without a conversion, so it isn't judged.
	if (salary.currency !== (search.salaryCurrency ?? "USD") || salary.period !== "year") return true;
	return (salary.max ?? salary.min ?? 0) >= search.salaryMin;
}

/** Whether a listing fits the search; open or closed isn't judged here. */
export function matchesSearch(listing: Listing, search: JobSearchInput): boolean {
	const code = listing.location.countryCode;
	if (search.country && code && code !== search.country) return false;
	const arrangement = listing.workArrangement;
	if (search.workArrangement) {
		if (arrangement && arrangement !== search.workArrangement) return false;
	} else if (search.remote === "only" && arrangement && arrangement !== "remote") return false;
	else if (search.remote === "exclude" && arrangement === "remote") return false;
	if (search.seniority && listing.seniority && listing.seniority !== search.seniority) return false;
	if (search.visaSponsorship && listing.visaSponsorship !== true) return false;
	return salaryFits(listing, search);
}

const tidy = (value: string | undefined) =>
	(value ?? "")
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();

/** The same job from two providers: title, company and city, ignoring case and punctuation. */
export const duplicateKey = (listing: Listing) =>
	`${tidy(listing.title)}|${tidy(listing.company.name)}|${tidy(listing.location.city)}`;

/** Keeps the first of each job, in order; `seen` holds keys already shown (an earlier page). */
export function withoutDuplicates<T extends Listing>(listings: T[], seen: Set<string> = new Set()): T[] {
	const result: T[] = [];
	for (const listing of listings) {
		const key = duplicateKey(listing);
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(listing);
	}
	return result;
}
