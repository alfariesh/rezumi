import * as pg from "drizzle-orm/pg-core";
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
