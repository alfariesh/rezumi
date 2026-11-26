import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@rezumi/utils/string";
import { user } from "./auth";

/**
 * An account's Profile: the person's details and career history that resumes, cover letters and the portfolio take
 * their content from. One per account; the row appears with the first save, and an account without one reads as a
 * Profile holding only the account's name and email.
 *
 * Not to be confused with `career_profile`, which keeps job-search preferences (the Preferences tab).
 */
export const profile = pg.pgTable("profile", {
	userId: pg
		.text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	// Saved through the strict write schema, but read only through `parseProfileData`: stored JSON may predate today's
	// shapes, and the lenient read replaces what no longer fits with empty values.
	data: pg.jsonb("data").notNull().$type<unknown>(),
	createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	// The version of `data`: editors send it back with each save to detect a change made elsewhere in the meantime.
	// The API sets it (never an automatic update), in milliseconds, so the value a client holds compares exactly.
	updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One website import (`.agents/docs/plans/impor-website/02-teknis.md` section 7): what was read and what it cost, kept
 * for the account's free first import and for counts; its result (Profile and work drafts) only for a day, for review.
 * No page text is kept.
 */
export const websiteImport = pg.pgTable(
	"website_import",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// The address read, after redirects once known.
		url: pg.text("url").notNull(),
		status: pg.text("status").notNull().$type<"running" | "succeeded" | "failed">(),
		// The account's free import: Rezumi AI ran it without credits (owner decision W2).
		free: pg.boolean("free").notNull().default(false),
		// Credits taken when it succeeded on Rezumi AI; 0 when free or on the person's own AI.
		credits: pg.integer("credits").notNull().default(0),
		pagesRead: pg.integer("pages_read").notNull().default(0),
		workCount: pg.integer("work_count").notNull().default(0),
		// Tokens and cost of a free import, which has no credit usage row to keep them.
		inputTokens: pg.integer("input_tokens"),
		outputTokens: pg.integer("output_tokens"),
		costUsdMicros: pg.bigint("cost_usd_micros", { mode: "number" }),
		errorCode: pg.text("error_code"),
		// `WebsiteImportResult` without its own run fields; cleared once `resultExpiresAt` passes.
		result: pg.jsonb("result").$type<unknown>(),
		resultExpiresAt: pg.timestamp("result_expires_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		finishedAt: pg.timestamp("finished_at", { withTimezone: true }),
	},
	(t) => [
		pg.index().on(t.userId, t.createdAt),
		pg.index().on(t.resultExpiresAt),
		pg.index().on(t.status, t.createdAt),
		// One free import per account, held while it runs: two tabs can't both take it.
		pg
			.uniqueIndex("website_import_one_free")
			.on(t.userId)
			.where(sql`${t.free} AND ${t.status} IN ('running', 'succeeded')`),
		pg.check("website_import_status", sql`${t.status} IN ('running', 'succeeded', 'failed')`),
	],
);
