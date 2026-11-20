import type { FitData } from "@rezumi/schema/career";
import type { JobProvider } from "@rezumi/schema/jobs/listing";
import type { JobSearchCriteria } from "@rezumi/schema/jobs/search";
import * as pg from "drizzle-orm/pg-core";
import { JOB_PROVIDERS } from "@rezumi/schema/jobs/listing";
import { generateId } from "@rezumi/utils/string";
import { user } from "./auth";

/**
 * Job listings from Hirebase and JobsPipe (`.agents/docs/plans/lowongan/02-teknis.md` section 6). Shared between
 * accounts as a cache: no user columns, and never a recruiter's or hiring team's contact details. A provider's rows can
 * be removed together (`purgeProvider`), which its terms require when Rezumi stops using it.
 */

export type JobCompanyData = { name: string; domain?: string; logoUrl?: string; size?: string; industry?: string };
export type JobLocationData = {
	city?: string;
	region?: string;
	country?: string;
	countryCode?: string;
	text: string;
};
export type JobSalaryData = {
	min?: number;
	max?: number;
	currency: string;
	period: "year" | "month" | "hour" | "unknown";
};

export const jobListing = pg.pgTable(
	"job_listing",
	{
		id: pg
			.text("id")
			.primaryKey()
			.$defaultFn(() => generateId()),
		provider: pg.text("provider", { enum: JOB_PROVIDERS }).notNull().$type<JobProvider>(),
		externalId: pg.text("external_id").notNull(),
		title: pg.text("title").notNull(),
		company: pg.jsonb("company").notNull().$type<JobCompanyData>(),
		location: pg.jsonb("location").notNull().$type<JobLocationData>(),
		countryCode: pg.text("country_code"),
		workArrangement: pg.text("work_arrangement", { enum: ["onsite", "hybrid", "remote"] }),
		seniority: pg.text("seniority", { enum: ["entry", "junior", "mid", "senior", "lead", "executive"] }),
		employmentType: pg.text("employment_type"),
		visaSponsorship: pg.boolean("visa_sponsorship"),
		salary: pg.jsonb("salary").$type<JobSalaryData>(),
		description: pg.text("description").notNull(),
		requirementsSummary: pg.text("requirements_summary"),
		skills: pg.jsonb("skills").notNull().$type<string[]>().default([]),
		postingUrl: pg.text("posting_url").notNull(),
		applyUrl: pg.text("apply_url"),
		source: pg.text("source"),
		language: pg.text("language"),
		postedAt: pg.timestamp("posted_at", { withTimezone: true }),
		/** The provider fields Rezumi uses, as they came; never contact details. */
		raw: pg.jsonb("raw").notNull().$type<Record<string, unknown>>().default({}),
		/** Lowercase title, company, place and skills, for matching against a Profile. */
		searchText: pg.text("search_text").notNull(),
		firstSeenAt: pg.timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
		/** Last time a provider answer included it; unused listings are removed 30 days later (K3). */
		lastSeenAt: pg.timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
		/** Last time it was confirmed open. */
		lastVerifiedAt: pg.timestamp("last_verified_at", { withTimezone: true }).notNull().defaultNow(),
		closedAt: pg.timestamp("closed_at", { withTimezone: true }),
	},
	(t) => [pg.uniqueIndex().on(t.provider, t.externalId), pg.index().on(t.closedAt), pg.index().on(t.lastSeenAt)],
);

/** One answer to a normalized search, pointing at its listings in order. */
export const jobSearchCache = pg.pgTable(
	"job_search_cache",
	{
		/** sha256 of the normalized search, its providers and the schema version. */
		key: pg.text("key").primaryKey(),
		providers: pg.text("providers").$type<JobProvider>().array().notNull(),
		query: pg.jsonb("query").notNull().$type<Record<string, unknown>>(),
		listingIds: pg.text("listing_ids").array().notNull(),
		/** Where each provider continues for "load more". */
		cursors: pg.jsonb("cursors").notNull().$type<Partial<Record<JobProvider, string>>>().default({}),
		total: pg.integer("total"),
		fetchedAt: pg.timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
		expiresAt: pg.timestamp("expires_at", { withTimezone: true }).notNull(),
	},
	(t) => [pg.index().on(t.expiresAt)],
);

/**
 * Listings a person hid from their search results. Its own table rather than `career_opportunity.dismissedAt`: hiding
 * works on any search result, which needn't be an opportunity, and Phase 04 reads it before adding opportunities.
 * Removed with the account or the listing.
 */
export const jobListingHidden = pg.pgTable(
	"job_listing_hidden",
	{
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		listingId: pg
			.text("listing_id")
			.notNull()
			.references(() => jobListing.id, { onDelete: "cascade" }),
		hiddenAt: pg.timestamp("hidden_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.primaryKey({ columns: [t.userId, t.listingId] }), pg.index().on(t.listingId)],
);

/**
 * A person's AI fit check of one listing (K8, Phase 05), kept so opening the listing again doesn't pay for it twice.
 * `inputVersion` is the Profile's version when it ran: a changed Profile marks the check as outdated. Removed with the
 * account or the listing.
 */
export const jobListingFit = pg.pgTable(
	"job_listing_fit",
	{
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		listingId: pg
			.text("listing_id")
			.notNull()
			.references(() => jobListing.id, { onDelete: "cascade" }),
		data: pg.jsonb("data").notNull().$type<FitData>(),
		/** The Profile facts the check cited. */
		factIds: pg.text("fact_ids").array().notNull().default([]),
		inputVersion: pg.text("input_version").notNull(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.primaryKey({ columns: [t.userId, t.listingId] }), pg.index().on(t.listingId)],
);

/**
 * A person's recent job searches (the Jobs page's "Recent job searches"), newest first, at most 10 per account. One row
 * per search, whatever its page: `criteriaKey` is the hash of the normalized search, so "Data Analyst" and "data
 * analyst" share a row; `criteria` keeps it as it was last asked. Removed with the account.
 */
export const jobSearchRecent = pg.pgTable(
	"job_search_recent",
	{
		id: pg
			.text("id")
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		criteriaKey: pg.text("criteria_key").notNull(),
		criteria: pg.jsonb("criteria").notNull().$type<JobSearchCriteria>(),
		searchedAt: pg.timestamp("searched_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.uniqueIndex().on(t.userId, t.criteriaKey), pg.index().on(t.userId, t.searchedAt)],
);

/**
 * The daily listing upkeep (`02-teknis.md` section 10), one row per UTC day. It runs over several scheduler ticks:
 * `nextPage` is the next page of Hirebase's closed-jobs feed to read (null once read to the end), and the lease keeps
 * two ticks from running it at once. A day whose run never finished is left behind; the next day's run starts from it.
 */
export const jobMaintenance = pg.pgTable("job_maintenance", {
	/** The UTC day, YYYY-MM-DD. */
	day: pg.text("day").primaryKey(),
	/** Where the closed-jobs feed starts: the last finished run's day (the feed answers whole days). */
	since: pg.text("since").notNull(),
	nextPage: pg.integer("next_page").default(1),
	/** Listings marked closed by this run. */
	closed: pg.integer("closed").notNull().default(0),
	startedAt: pg.timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
	leaseUntil: pg.timestamp("lease_until", { withTimezone: true }),
	completedAt: pg.timestamp("completed_at", { withTimezone: true }),
});
