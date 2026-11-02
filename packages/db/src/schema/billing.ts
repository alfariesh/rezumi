import type { PaidPlanId } from "@rezumi/schema/billing";
import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@rezumi/utils/string";
import { user } from "./auth";

/**
 * One row per account that has touched billing. Its row lock (`SELECT … FOR UPDATE`) serializes every change to the
 * account's passes, credits and payments; Hyperdrive's transaction pooling rules out advisory locks.
 */
export const billingAccount = pg.pgTable("billing_account", {
	userId: pg
		.text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	// When the one-time Rezumi AI trial credits were granted; set once per account.
	trialGrantedAt: pg.timestamp("trial_granted_at", { withTimezone: true }),
	createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: pg
		.timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date()),
});

export type MembershipPeriodSource = "payment" | "admin" | "promo";

/**
 * One stretch of paid access. An account's unrevoked periods never overlap: passes queue one after another, higher
 * plans first. A revoked period is out of the schedule; one revoked while running ends at the moment it was revoked.
 */
export const membershipPeriod = pg.pgTable(
	"membership_period",
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
		planId: pg.text("plan_id").notNull().$type<PaidPlanId>(),
		startsAt: pg.timestamp("starts_at", { withTimezone: true }).notNull(),
		endsAt: pg.timestamp("ends_at", { withTimezone: true }).notNull(),
		source: pg.text("source").notNull().$type<MembershipPeriodSource>(),
		// The admin who granted it, when `source` is admin.
		grantedBy: pg.text("granted_by").references(() => user.id, { onDelete: "set null" }),
		revokedAt: pg.timestamp("revoked_at", { withTimezone: true }),
		revokeReason: pg.text("revoke_reason"),
		// When the pass was bought: it orders passes of the same plan. The rest of a pass that a higher plan pushed back
		// keeps its original time.
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg.index().on(t.userId, t.endsAt),
		pg.check("membership_period_ends_after_start", sql`${t.endsAt} > ${t.startsAt}`),
	],
);

/** Who changed what in billing, and why. Kept after the account is deleted, for bookkeeping. */
export const billingAuditLog = pg.pgTable(
	"billing_audit_log",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		// The admin who acted; null for the system.
		actorUserId: pg.text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
		targetUserId: pg.text("target_user_id").references(() => user.id, { onDelete: "set null" }),
		// For example period.granted or period.revoked.
		action: pg.text("action").notNull(),
		// Required for admin actions.
		reason: pg.text("reason"),
		// A short summary, without resume content or personal data that isn't needed.
		details: pg.jsonb("details").notNull().$type<Record<string, unknown>>().default({}),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.targetUserId, t.createdAt)],
);
