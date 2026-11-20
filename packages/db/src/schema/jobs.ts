import type { JobProvider } from "@rezumi/schema/jobs/listing";
import * as pg from "drizzle-orm/pg-core";
import { JOB_PROVIDERS } from "@rezumi/schema/jobs/listing";
import { generateId } from "@rezumi/utils/string";

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
		providers: pg.text("providers").array().notNull().$type<JobProvider[]>(),
		query: pg.jsonb("query").notNull().$type<Record<string, unknown>>(),
		listingIds: pg.text("listing_ids").array().notNull().$type<string[]>(),
		/** Where each provider continues for "load more". */
		cursors: pg.jsonb("cursors").notNull().$type<Partial<Record<JobProvider, string>>>().default({}),
		total: pg.integer("total"),
		fetchedAt: pg.timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
		expiresAt: pg.timestamp("expires_at", { withTimezone: true }).notNull(),
	},
	(t) => [pg.index().on(t.expiresAt)],
);
