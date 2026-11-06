import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import * as pg from "drizzle-orm/pg-core";
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
		data: pg.jsonb("data").notNull().$type<PortfolioData>(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		// Editors send it back with each save to detect a change made elsewhere in the meantime.
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.sourceResumeId)],
);

export const PORTFOLIO_FILE_KINDS = ["image", "pdf"] as const;
export type PortfolioFileKind = (typeof PORTFOLIO_FILE_KINDS)[number];

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
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.userId)],
);

/**
 * Visits to a published portfolio per day (`02-teknis.md` section 9): one row per portfolio and day, counted once an
 * hour per visitor, never for its owner or crawlers. Phase 08 adds clicks, opened works, messages and sources.
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
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.unique("portfolio_statistics_daily_unique").on(t.portfolioId, t.date)],
);
