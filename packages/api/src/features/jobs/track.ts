import type { PostingSource } from "@rezumi/schema/applications/data";
import type { JobListing } from "@rezumi/schema/jobs/listing";
import type { JobListingCard, JobTrackResult } from "@rezumi/schema/jobs/search";
import { jobKey } from "@rezumi/job-sites/sites";
import { jobSourceName, MAX_JOB_DESCRIPTION_CHARS } from "@rezumi/schema/jobs/listing";
import { applicationService } from "../applications/service";

/**
 * Tracking a listing (`jobs.track`, `01-desain.md` section 1): it becomes a saved application with the role, company,
 * place, pay, the provider's copy of the posting and the link to the original. A posting the person already saved (from
 * here, the extension or a pasted link) is the same application: tracking it again gives that one back.
 */

/** The application's Source: the job board, or the company's careers site, when the provider says. */
export function trackedSource(listing: Pick<JobListing, "source">): string {
	const name = jobSourceName(listing.source);
	if (!name) return "Rezumi job search";
	return name === "company-site" ? "Company careers site" : name;
}

const PERIOD_WORDS: Record<string, string> = { year: " a year", month: " a month", hour: " an hour" };

/** The listed pay as one line for the application's Salary field, in the posting's own currency. */
export function trackedSalary(salary: JobListing["salary"]): string | undefined {
	if (!salary || (salary.min === undefined && salary.max === undefined)) return undefined;
	const amount = (value: number) => {
		if (!salary.currency) return Math.round(value).toLocaleString("en-US");
		try {
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: salary.currency,
				maximumFractionDigits: 0,
			}).format(value);
		} catch {
			return `${salary.currency} ${Math.round(value).toLocaleString("en-US")}`;
		}
	};
	const { min, max } = salary;
	const range =
		min !== undefined && max !== undefined && min !== max
			? `${amount(min)}–${amount(max)}`
			: amount((min ?? max) as number);
	return `${range}${PERIOD_WORDS[salary.period] ?? ""}`;
}

/** The posting key the extension and the tracker share, for marking listings already saved. */
export const listingKey = (listing: Pick<JobListingCard, "postingUrl">) => jobKey(listing.postingUrl);

/** Which of these listings the person already tracks: listing id → application id. */
export async function trackedApplications(userId: string, listings: JobListingCard[]): Promise<Record<string, string>> {
	const keys = new Map<string, string[]>();
	for (const listing of listings) {
		const key = listingKey(listing);
		if (key) keys.set(key, [...(keys.get(key) ?? []), listing.id]);
	}
	const found = await applicationService.findIdsBySourceKeys({ userId, keys: [...keys.keys()] });
	const tracked: Record<string, string> = {};
	for (const [key, applicationId] of found) for (const id of keys.get(key) ?? []) tracked[id] = applicationId;
	return tracked;
}

/** Saves a listing as an application, or gives back the one already saved for the same posting. */
export async function trackListing(userId: string, listing: JobListing, now = new Date()): Promise<JobTrackResult> {
	const key = listingKey(listing);
	const existing = key ? await applicationService.findBySourceKey({ userId, key }) : null;
	if (existing) {
		// Saved earlier from the extension or a link: from now on the daily upkeep can say when its posting closes.
		await applicationService.linkJobListing({ userId, id: existing.id, listingId: listing.id });
		return { applicationId: existing.id, created: false };
	}

	const description = listing.description.slice(0, MAX_JOB_DESCRIPTION_CHARS);
	const postingSource: PostingSource = {
		method: "job-search",
		format: "text",
		requestedUrl: listing.postingUrl,
		resolvedUrl: listing.postingUrl,
		retrievedAt: now.toISOString(),
		providerFetchedAt: listing.lastVerifiedAt,
		truncated: listing.description.length > description.length,
		completeness: "unknown",
	};
	const salary = trackedSalary(listing.salary);
	const location = listing.location.text.trim();
	const applicationId = await applicationService.create({
		userId,
		company: listing.company.name,
		role: listing.title,
		status: "saved",
		source: trackedSource(listing),
		sourceUrl: listing.postingUrl,
		jobDescription: description || null,
		postingSource,
		jobListingId: listing.id,
		...(location ? { location } : {}),
		...(salary ? { salary } : {}),
	});
	// A fit check already run on the listing comes along to the workspace, so it isn't paid for again. Loaded here:
	// it brings the AI stack, which searching and the scheduler don't need.
	const { copyListingFit } = await import("./fit");
	await copyListingFit(userId, listing.id, applicationId);
	return { applicationId, created: true };
}
