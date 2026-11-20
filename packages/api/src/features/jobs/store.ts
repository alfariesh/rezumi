import type { ProviderListing } from "./providers/shared";
import type { JobListing, JobProvider } from "@rezumi/schema/jobs/listing";
import { eq, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";

/**
 * Stores provider listings in the shared `job_listing` table (`02-teknis.md` section 6). Saving the same provider job
 * again updates it in place and keeps its Rezumi id, so a search answer can point at listings by id.
 */

type ListingRow = typeof schema.jobListing.$inferSelect;
type ListingInsert = typeof schema.jobListing.$inferInsert;

/** Title, company, place and skills in lowercase, for matching a listing against a Profile without AI. */
export function listingSearchText(listing: ProviderListing): string {
	return [listing.title, listing.company.name, listing.location.text, ...listing.skills]
		.join(" \n")
		.toLowerCase()
		.slice(0, 4_000);
}

function insertValues(listing: ProviderListing, now: Date): ListingInsert {
	return {
		provider: listing.provider,
		externalId: listing.externalId,
		title: listing.title,
		company: JSON.parse(JSON.stringify(listing.company)),
		location: JSON.parse(JSON.stringify(listing.location)),
		countryCode: listing.location.countryCode ?? null,
		workArrangement: listing.workArrangement ?? null,
		seniority: listing.seniority ?? null,
		employmentType: listing.employmentType ?? null,
		visaSponsorship: listing.visaSponsorship ?? null,
		salary: listing.salary ? JSON.parse(JSON.stringify(listing.salary)) : null,
		description: listing.description,
		requirementsSummary: listing.requirementsSummary ?? null,
		skills: listing.skills,
		postingUrl: listing.postingUrl,
		applyUrl: listing.applyUrl ?? null,
		source: listing.source ?? null,
		language: listing.language ?? null,
		postedAt: listing.postedAt ? new Date(listing.postedAt) : null,
		raw: listing.raw,
		searchText: listingSearchText(listing),
		firstSeenAt: now,
		lastSeenAt: now,
		lastVerifiedAt: now,
		closedAt: listing.closedAt ? new Date(listing.closedAt) : null,
	};
}

const stripNulls = <T extends Record<string, unknown>>(value: T) =>
	Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined)) as {
		[K in keyof T]: Exclude<T[K], null>;
	};

/** A stored row in the API shape. */
export function toJobListing(row: ListingRow): JobListing {
	const optional = stripNulls({
		workArrangement: row.workArrangement,
		seniority: row.seniority,
		employmentType: row.employmentType,
		visaSponsorship: row.visaSponsorship,
		salary: row.salary,
		requirementsSummary: row.requirementsSummary,
		applyUrl: row.applyUrl,
		source: row.source,
		language: row.language,
		postedAt: row.postedAt?.toISOString(),
	});
	return {
		id: row.id,
		provider: row.provider,
		externalId: row.externalId,
		title: row.title,
		company: row.company,
		location: row.location,
		description: row.description,
		skills: row.skills,
		postingUrl: row.postingUrl,
		...optional,
		firstSeenAt: row.firstSeenAt.toISOString(),
		lastVerifiedAt: row.lastVerifiedAt.toISOString(),
		closedAt: row.closedAt?.toISOString() ?? null,
	};
}

/** Updated on every save; `closed_at` only when the provider said whether the job is open. */
const updatedColumns = (withClosedAt: boolean) => ({
	title: sql`excluded.title`,
	company: sql`excluded.company`,
	location: sql`excluded.location`,
	countryCode: sql`excluded.country_code`,
	workArrangement: sql`excluded.work_arrangement`,
	seniority: sql`excluded.seniority`,
	employmentType: sql`excluded.employment_type`,
	visaSponsorship: sql`excluded.visa_sponsorship`,
	salary: sql`excluded.salary`,
	description: sql`excluded.description`,
	requirementsSummary: sql`excluded.requirements_summary`,
	skills: sql`excluded.skills`,
	postingUrl: sql`excluded.posting_url`,
	applyUrl: sql`excluded.apply_url`,
	source: sql`excluded.source`,
	language: sql`excluded.language`,
	postedAt: sql`excluded.posted_at`,
	raw: sql`excluded.raw`,
	searchText: sql`excluded.search_text`,
	lastSeenAt: sql`excluded.last_seen_at`,
	lastVerifiedAt: sql`excluded.last_verified_at`,
	...(withClosedAt ? { closedAt: sql`excluded.closed_at` } : {}),
});

/**
 * Saves listings and returns them stored, in the order given (a repeated provider job appears once, at its last
 * place). Idempotent: saving the same answer twice changes nothing but the seen times.
 */
export async function upsertListings(listings: ProviderListing[], now = new Date()): Promise<JobListing[]> {
	const unique = new Map<string, ProviderListing>();
	for (const listing of listings) {
		const key = `${listing.provider}:${listing.externalId}`;
		unique.delete(key);
		unique.set(key, listing);
	}
	if (unique.size === 0) return [];
	const items = [...unique.values()];
	// A listing that doesn't say whether it is open keeps the closed date it had.
	const groups = [
		{ rows: items.filter((item) => item.closedAt !== undefined), withClosedAt: true },
		{ rows: items.filter((item) => item.closedAt === undefined), withClosedAt: false },
	].filter((group) => group.rows.length > 0);
	const stored = new Map<string, JobListing>();
	await db.transaction(async (tx) => {
		for (const group of groups) {
			const rows = await tx
				.insert(schema.jobListing)
				.values(group.rows.map((item) => insertValues(item, now)))
				.onConflictDoUpdate({
					target: [schema.jobListing.provider, schema.jobListing.externalId],
					set: updatedColumns(group.withClosedAt),
				})
				.returning();
			for (const row of rows) stored.set(`${row.provider}:${row.externalId}`, toJobListing(row));
		}
	});
	return [...unique.keys()].flatMap((key) => stored.get(key) ?? []);
}

/**
 * Removes everything a provider supplied: its listings and every cached search answer that used it (its terms require
 * this once Rezumi stops using it). Applications people track keep their own copy of the posting text.
 */
export function purgeProvider(provider: JobProvider): Promise<{ listings: number; searches: number }> {
	return db.transaction(async (tx) => {
		const searches = await tx
			.delete(schema.jobSearchCache)
			.where(sql`${provider} = any(${schema.jobSearchCache.providers})`)
			.returning({ key: schema.jobSearchCache.key });
		const listings = await tx
			.delete(schema.jobListing)
			.where(eq(schema.jobListing.provider, provider))
			.returning({ id: schema.jobListing.id });
		return { listings: listings.length, searches: searches.length };
	});
}
