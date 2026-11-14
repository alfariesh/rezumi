import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@rezumi/utils/string";
import { user } from "./auth";

/**
 * A page the browser extension could not read, reported by its user (`applications.reportCapture`). Holds the address,
 * board, extension version and which fields were missing, never the page's text. The operator gets them merged into at
 * most one email an hour; rows go after 30 days, and with the reporting account.
 */
export const extensionCaptureReport = pg.pgTable(
	"extension_capture_report",
	{
		id: pg.text("id").primaryKey().$defaultFn(generateId),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		url: pg.text("url").notNull(),
		site: pg.text("site"),
		extensionVersion: pg.text("extension_version").notNull(),
		missing: pg.text("missing").array().notNull().default([]),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		notifiedAt: pg.timestamp("notified_at", { withTimezone: true }),
	},
	(t) => [pg.index().on(t.userId, t.createdAt), pg.index().on(t.notifiedAt, t.createdAt)],
);
