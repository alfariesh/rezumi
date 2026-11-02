import type { CreditSource, PaidPlanId } from "@rezumi/schema/billing";
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

/** Rezumi AI credits that came in: the trial, a Pro AI purchase, or an administrator. Spent soonest-expiring first. */
export const aiCreditGrant = pg.pgTable(
	"ai_credit_grant",
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
		source: pg.text("source").notNull().$type<CreditSource>(),
		// The payment that bought them. Payments arrive in membership phase 06, which adds the foreign key.
		paymentId: pg.text("payment_id"),
		amount: pg.integer("amount").notNull(),
		// What is left to spend. Reserving takes from it; a released reservation gives it back.
		remaining: pg.integer("remaining").notNull(),
		expiresAt: pg.timestamp("expires_at", { withTimezone: true }).notNull(),
		revokedAt: pg.timestamp("revoked_at", { withTimezone: true }),
		note: pg.text("note"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg.index().on(t.userId, t.expiresAt),
		pg.check("ai_credit_grant_amount_positive", sql`${t.amount} > 0`),
		pg.check("ai_credit_grant_source", sql`${t.source} IN ('trial', 'plan', 'admin')`),
		pg.check("ai_credit_grant_remaining_in_range", sql`${t.remaining} >= 0 AND ${t.remaining} <= ${t.amount}`),
	],
);

export type CreditUsageStatus = "reserved" | "committed" | "released";

/** Which grants a usage took its credits from, so a release gives each back. */
export type CreditAllocation = { grantId: string; credits: number };

/**
 * Rezumi AI credits reserved before a piece of work runs, then committed when it gives a usable result or released
 * when it doesn't. An administrator's correction downward is recorded here too, already committed.
 */
export const aiCreditUsage = pg.pgTable(
	"ai_credit_usage",
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
		// `<userId>:<action>:<idempotencyKey>`: a double click or a network retry finds the first reservation.
		operationKey: pg.text("operation_key").notNull().unique(),
		// A CREDIT_COSTS key, or admin-adjustment.
		action: pg.text("action").notNull(),
		credits: pg.integer("credits").notNull(),
		status: pg.text("status").notNull().$type<CreditUsageStatus>(),
		allocations: pg.jsonb("allocations").notNull().$type<CreditAllocation[]>().default([]),
		provider: pg.text("provider"),
		model: pg.text("model"),
		inputTokens: pg.integer("input_tokens"),
		outputTokens: pg.integer("output_tokens"),
		costUsdMicros: pg.bigint("cost_usd_micros", { mode: "number" }),
		errorCode: pg.text("error_code"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		settledAt: pg.timestamp("settled_at", { withTimezone: true }),
	},
	(t) => [
		pg.index().on(t.userId, t.createdAt),
		pg.index().on(t.status, t.createdAt),
		pg.check("ai_credit_usage_credits_positive", sql`${t.credits} > 0`),
		pg.check("ai_credit_usage_status", sql`${t.status} IN ('reserved', 'committed', 'released')`),
	],
);
