import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * One custom domain per account, opening its primary resume once DNS proves the account owns it. Several accounts may
 * claim a host; only the one whose token DNS publishes gets verified, and a later proof moves it.
 */
export const customDomain = pg.pgTable(
	"custom_domain",
	{
		userId: pg
			.text("user_id")
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		// Lowercase ASCII (punycode), without a trailing dot.
		hostname: pg.text("hostname").notNull(),
		// The value the account publishes in a TXT record at `_rx-verify.<hostname>`.
		verificationToken: pg.text("verification_token").notNull(),
		verifiedAt: pg.timestamp("verified_at", { withTimezone: true }),
		lastCheckedAt: pg.timestamp("last_checked_at", { withTimezone: true }),
		// Since when DNS has stopped pointing here; a domain failing for a week loses its verification.
		failingSince: pg.timestamp("failing_since", { withTimezone: true }),
		// Cloudflare for SaaS: the custom hostname made for this domain, and what Cloudflare last said about it. All empty
		// on an installation without the automation.
		cfHostnameId: pg.text("cf_hostname_id"),
		cfHostnameStatus: pg.text("cf_hostname_status"),
		cfSslStatus: pg.text("cf_ssl_status"),
		// What's stopping the domain, in words the app explains; null while it's working or simply waiting.
		cfProblem: pg.text("cf_problem"),
		// When the job looks at this hostname next; null means as soon as it can.
		cfNextCheckAt: pg.timestamp("cf_next_check_at", { withTimezone: true }),
		// Since when the account's plan hasn't included custom domains (`00-keputusan.md` rule #2).
		planLapsedAt: pg.timestamp("plan_lapsed_at", { withTimezone: true }),
		planCheckedAt: pg.timestamp("plan_checked_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg
			.uniqueIndex("custom_domain_verified_hostname")
			.on(t.hostname)
			.where(sql`${t.verifiedAt} is not null`),
	],
);

/**
 * Cloudflare custom hostnames waiting to be deleted. Has no link to the account on purpose: the row has to outlive the
 * `custom_domain` row and the account it came from, and each hostname costs money until it's gone.
 */
export const customDomainRemoval = pg.pgTable("custom_domain_removal", {
	cfHostnameId: pg.text("cf_hostname_id").primaryKey(),
	hostname: pg.text("hostname").notNull(),
	attempts: pg.integer("attempts").notNull().default(0),
	nextAttemptAt: pg.timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
	createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
