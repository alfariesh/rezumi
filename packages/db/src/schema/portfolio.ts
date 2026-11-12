import type { PortfolioClickKind, PortfolioVisitSource } from "@rezumi/schema/portfolio/statistics";
import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { PORTFOLIO_REPORT_REASONS, PORTFOLIO_REPORT_STATUSES } from "@rezumi/schema/portfolio/moderation";
import { generateId } from "@rezumi/utils/string";
import { user } from "./auth";
import { resume } from "./resume";

/**
 * An account's web portfolio at /<username>; at most one per account, which the unique user_id guarantees. Who sees
 * it (published, indexed, suspended) lives in columns, not in `data`, so saving data, AI drafts or imports can never
 * change it.
 */
export const portfolio = pg.pgTable(
	"portfolio",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg
			.text("user_id")
			.notNull()
			.unique("portfolio_user_unique")
			.references(() => user.id, { onDelete: "cascade" }),
		// The resume its career sections come from; null when it has none (made without one, or that resume was deleted).
		sourceResumeId: pg.text("source_resume_id").references(() => resume.id, { onDelete: "set null" }),
		isPublic: pg.boolean("is_public").notNull().default(false),
		showInSearchEngines: pg.boolean("show_in_search_engines").notNull().default(true),
		// The first time it was published; set once.
		publishedAt: pg.timestamp("published_at", { withTimezone: true }),
		// An admin took it down (Phase 11): it is treated as unpublished and can't be published until lifted.
		suspendedAt: pg.timestamp("suspended_at", { withTimezone: true }),
		suspendedReason: pg.text("suspended_reason"),
		// A visitor password (Phase 13, B16): bcrypt hash (bcryptjs, cost 10, like resumes); null = open to everyone. A
		// column, not `data`, so saves, AI drafts and imports never change it. Never logged, exported or sent anywhere.
		password: pg.text("password"),
		// Saved by the strict write schema, but read it only through `parsePortfolioData`: stored JSON may predate today's
		// schema, and the lenient read repairs what it can.
		data: pg.jsonb("data").notNull().$type<unknown>(),
		// When the weekly file sweep last compared this portfolio's files with its data and storage; null = never.
		filesCheckedAt: pg.timestamp("files_checked_at", { withTimezone: true }),
		// When the owner was last emailed about new messages, at most once per 10 minutes; messages in between are merged.
		messageEmailAt: pg.timestamp("message_email_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		// The version of `data`: editors send it back with each save to detect a change made elsewhere in the meantime.
		// Only saves of data move it (the API sets it, never an automatic update), so publishing, settings, an admin's
		// takedown or the file checks never make an open editor report a conflict.
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg.index().on(t.sourceResumeId),
		// The weekly file check picks the portfolios checked longest ago, every minute.
		pg.index().on(t.filesCheckedAt.asc().nullsFirst()),
	],
);

export const PORTFOLIO_FILE_KINDS = ["image", "pdf"] as const;

/**
 * The files an account uploaded for its portfolio. Data may only use keys recorded here; their bytes count toward
 * the storage quota, and files no longer used are cleaned up. Rows belong to the account, so they outlive a single
 * save and go with the account.
 */
export const portfolioFile = pg.pgTable(
	"portfolio_file",
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
		kind: pg.text("kind", { enum: PORTFOLIO_FILE_KINDS }).notNull(),
		// uploads/<userId>/pictures/portfolio/<id>.<ext> or uploads/<userId>/documents/portfolio/<id>.pdf
		key: pg.text("key").notNull().unique("portfolio_file_key_unique"),
		bytes: pg.integer("bytes").notNull(),
		// Images: pixel size. PDFs: page count.
		width: pg.integer("width"),
		height: pg.integer("height"),
		pages: pg.integer("pages"),
		// Since when no saved data uses the file; null while it is used. A file unused for a day is deleted by the
		// cleanup job, so an upload the editor hasn't saved yet (or an undo away) survives a short while. Deleting the
		// portfolio (or the file) sets it far in the past, so the file goes on the job's next run.
		unusedSince: pg.timestamp("unused_since", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.userId), pg.index().on(t.unusedSince)],
);

/**
 * Numbers of a published portfolio per day (`02-teknis.md` section 9): one row per portfolio and day in its owner's time
 * zone, counted once an hour per visitor, never for its owner or crawlers. No IP address or visitor ID is kept.
 */
export const portfolioStatisticsDaily = pg.pgTable(
	"portfolio_statistics_daily",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		portfolioId: pg
			.text("portfolio_id")
			.notNull()
			.references(() => portfolio.id, { onDelete: "cascade" }),
		date: pg.date("date", { mode: "string" }).notNull(),
		views: pg.integer("views").notNull().default(0),
		// Clicks per kind, works opened per work ID (at most PORTFOLIO_STATISTICS_MAX_WORKS keys), visits per source.
		clicks: pg.jsonb("clicks").notNull().default({}).$type<Partial<Record<PortfolioClickKind, number>>>(),
		works: pg.jsonb("works").notNull().default({}).$type<Record<string, number>>(),
		sources: pg.jsonb("sources").notNull().default({}).$type<Partial<Record<PortfolioVisitSource, number>>>(),
		messages: pg.integer("messages").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.unique("portfolio_statistics_daily_unique").on(t.portfolioId, t.date)],
);

/**
 * Messages visitors sent through a portfolio's contact form (`02-teknis.md` section 10). Personal data: only the
 * portfolio's owner reads them, they are never logged, and the daily job deletes them after 90 days (owner decision #7).
 */
export const portfolioMessage = pg.pgTable(
	"portfolio_message",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		portfolioId: pg
			.text("portfolio_id")
			.notNull()
			.references(() => portfolio.id, { onDelete: "cascade" }),
		name: pg.text("name").notNull(),
		email: pg.text("email").notNull(),
		body: pg.text("body").notNull(),
		// The service the visitor asked about, when they came from its order button.
		serviceId: pg.text("service_id"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		readAt: pg.timestamp("read_at", { withTimezone: true }),
		// When the owner was emailed about it; null while it waits for the next merged email.
		notifiedAt: pg.timestamp("notified_at", { withTimezone: true }),
	},
	(t) => [
		pg.index().on(t.portfolioId, t.createdAt),
		pg.index().on(t.createdAt),
		// The minute job looks for messages not emailed yet; without this it reads every message kept for 90 days.
		pg
			.index("portfolio_message_unnotified_index")
			.on(t.portfolioId, t.createdAt)
			.where(sql`${t.notifiedAt} is null`),
	],
);

/**
 * Reports visitors sent about a portfolio (`02-teknis.md` section 14). Only administrators read them; who reported is
 * never shown to the portfolio's owner, and the reporter's address is cleared 90 days after a report is handled.
 */
export const portfolioReport = pg.pgTable(
	"portfolio_report",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		portfolioId: pg
			.text("portfolio_id")
			.notNull()
			.references(() => portfolio.id, { onDelete: "cascade" }),
		reason: pg.text("reason", { enum: PORTFOLIO_REPORT_REASONS }).notNull(),
		details: pg.text("details").notNull(),
		// Given only by a reporter who wants a reply.
		reporterEmail: pg.text("reporter_email"),
		status: pg.text("status", { enum: PORTFOLIO_REPORT_STATUSES }).notNull().default("open"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		handledAt: pg.timestamp("handled_at", { withTimezone: true }),
		handledByUserId: pg.text("handled_by_user_id").references(() => user.id, { onDelete: "set null" }),
	},
	(t) => [
		pg.index().on(t.status, t.createdAt),
		pg.index().on(t.portfolioId, t.createdAt),
		// The minute job clears reporters' addresses 90 days after handling; this keeps it from reading every report.
		pg
			.index("portfolio_report_reporter_email_index")
			.on(t.handledAt)
			.where(sql`${t.reporterEmail} is not null`),
	],
);

/** Who took which moderation action on a portfolio or its owner, and why. Outlives the portfolio and the account. */
export const portfolioModerationLog = pg.pgTable(
	"portfolio_moderation_log",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		portfolioId: pg.text("portfolio_id").references(() => portfolio.id, { onDelete: "set null" }),
		targetUserId: pg.text("target_user_id").references(() => user.id, { onDelete: "set null" }),
		actorUserId: pg.text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
		// suspended, lifted, banned, unbanned, or report.<status>.
		action: pg.text("action").notNull(),
		reason: pg.text("reason"),
		details: pg.jsonb("details").notNull().$type<Record<string, unknown>>().default({}),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.portfolioId, t.createdAt), pg.index().on(t.targetUserId, t.createdAt)],
);
