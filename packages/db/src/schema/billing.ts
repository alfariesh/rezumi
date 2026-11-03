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
	// The app language at the last checkout, for emails sent later (the pass ending soon). Null until then.
	locale: pg.text("locale"),
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
		// The payment that bought it, when `source` is payment. The rest of a pushed-back pass keeps it.
		paymentId: pg.text("payment_id").references((): pg.AnyPgColumn => billingPayment.id, { onDelete: "set null" }),
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
		pg.index().on(t.paymentId),
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
		// The Pro AI payment that bought them.
		paymentId: pg.text("payment_id").references((): pg.AnyPgColumn => billingPayment.id, { onDelete: "set null" }),
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
		pg.index().on(t.paymentId),
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

export const BILLING_PAYMENT_STATUSES = [
	"creating",
	"pending",
	"paid",
	"failed",
	"expired",
	"cancelled",
	"partially_refunded",
	"refunded",
	"reversed",
] as const;

/**
 * Where a payment stands. `creating` is committed before Snap is called; `pending` has a Snap page to pay on. Only a
 * verified Midtrans status moves it on from there, and `paid` never goes back: only to a refund or a reversal.
 */
export type BillingPaymentStatus = (typeof BILLING_PAYMENT_STATUSES)[number];

const statusList = (values: readonly string[]) => sql.raw(values.map((value) => `'${value}'`).join(", "));

/**
 * One attempt to pay for a pass: one Midtrans `order_id`. Paying again after it expired or failed is a new row. The
 * price, length and credits are copied from the catalog at checkout, so a later price change never touches it. Kept,
 * without its owner, after the account is deleted: it is a bookkeeping record.
 */
export const billingPayment = pg.pgTable(
	"billing_payment",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg.text("user_id").references(() => user.id, { onDelete: "set null" }),
		provider: pg.text("provider").notNull().default("midtrans").$type<"midtrans">(),
		// `transaction_details.order_id`: RZ-<id>.
		providerOrderId: pg.text("provider_order_id").notNull().unique(),
		// The key the checkout request carried; repeating it returns this payment instead of a second one.
		idempotencyKey: pg.text("idempotency_key"),
		planId: pg.text("plan_id").notNull().$type<PaidPlanId>(),
		catalogVersion: pg.integer("catalog_version").notNull(),
		// Whole Rupiah, the `gross_amount` sent.
		amount: pg.integer("amount").notNull(),
		durationDays: pg.integer("duration_days").notNull(),
		credits: pg.integer("credits").notNull(),
		currency: pg.text("currency").notNull().default("IDR"),
		status: pg.text("status").notNull().$type<BillingPaymentStatus>(),
		// Where it was bought: the website, for now.
		channel: pg.text("channel").notNull().default("web").$type<"web">(),
		// To go back to the Snap page after a refresh. Never logged.
		snapToken: pg.text("snap_token"),
		redirectUrl: pg.text("redirect_url"),
		// The end of the payment window sent to Midtrans.
		expiresAt: pg.timestamp("expires_at", { withTimezone: true }),
		paymentType: pg.text("payment_type"),
		transactionId: pg.text("transaction_id"),
		// The last verified `transaction_status` and `fraud_status`.
		providerStatus: pg.text("provider_status"),
		fraudStatus: pg.text("fraud_status"),
		paidAt: pg.timestamp("paid_at", { withTimezone: true }),
		// Set once the pass and credits are granted; it keeps fulfilment to exactly once.
		fulfilledAt: pg.timestamp("fulfilled_at", { withTimezone: true }),
		refundedAmount: pg.integer("refunded_amount").notNull().default(0),
		// Set once the receipt email went out; the billing job retries a few times until then.
		receiptSentAt: pg.timestamp("receipt_sent_at", { withTimezone: true }),
		receiptAttempts: pg.integer("receipt_attempts").notNull().default(0),
		// When the last send started: another sender leaves it alone for a while, so a receipt goes out once.
		receiptAttemptedAt: pg.timestamp("receipt_attempted_at", { withTimezone: true }),
		// Backoff for the status checks the billing job makes.
		lastCheckedAt: pg.timestamp("last_checked_at", { withTimezone: true }),
		checkAttempts: pg.integer("check_attempts").notNull().default(0),
		// A short code that is safe to show and log, never a provider payload.
		failureReason: pg.text("failure_reason"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.status, t.createdAt),
		pg.index().on(t.userId, t.createdAt),
		pg.uniqueIndex().on(t.userId, t.idempotencyKey),
		pg.check("billing_payment_status", sql`${t.status} IN (${statusList(BILLING_PAYMENT_STATUSES)})`),
		pg.check("billing_payment_amount_positive", sql`${t.amount} > 0`),
		pg.check("billing_payment_refunded_in_range", sql`${t.refundedAmount} >= 0 AND ${t.refundedAmount} <= ${t.amount}`),
	],
);

export type BillingPaymentEventSource = "notification" | "status_check" | "admin";

export type BillingPaymentEventOutcome =
	| "applied"
	| "duplicate"
	| "stale"
	| "rejected_signature"
	| "unknown_order"
	| "amount_mismatch"
	| "error";

/**
 * Every Midtrans notification and every status check that found something, with what it did. The record for support
 * and investigations: Workers keep only a sample of logs. `payload` holds an allowlist of safe fields.
 */
export const billingPaymentEvent = pg.pgTable(
	"billing_payment_event",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		// Null when the order is not one of Rezumi's.
		paymentId: pg.text("payment_id").references(() => billingPayment.id, { onDelete: "set null" }),
		providerOrderId: pg.text("provider_order_id").notNull(),
		source: pg.text("source").notNull().$type<BillingPaymentEventSource>(),
		// Midtrans' values as they came, strings included.
		transactionStatus: pg.text("transaction_status"),
		statusCode: pg.text("status_code"),
		fraudStatus: pg.text("fraud_status"),
		grossAmount: pg.text("gross_amount"),
		// Notifications only.
		signatureValid: pg.boolean("signature_valid"),
		outcome: pg.text("outcome").notNull().$type<BillingPaymentEventOutcome>(),
		payload: pg.jsonb("payload").notNull().$type<Record<string, unknown>>().default({}),
		receivedAt: pg.timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.providerOrderId, t.receivedAt), pg.index().on(t.paymentId)],
);

export type BillingRefundMethod = "midtrans" | "manual";

/**
 * `requesting`: saved, its refund key with it, before Midtrans is asked, and still there while the answer is unknown
 * (sending it again with the same key is safe). `succeeded` once Midtrans or the admin confirmed the money went back;
 * `failed` when Midtrans refused it.
 */
export type BillingRefundStatus = "requesting" | "succeeded" | "failed";

/** A waiting refund Midtrans accepted while the bank still processes it (card refunds take days): not a failure. */
export const REFUND_BANK_PROCESSING = "bank_processing";

/**
 * Money given back for a payment: through Midtrans' refund API (from the admin page, or the Midtrans dashboard, picked
 * up from its status), or by hand, such as a bank transfer for a virtual account payment Midtrans can't refund. The
 * payment's `refunded_amount` is the sum of its succeeded refunds. Kept after the account is deleted.
 */
export const billingRefund = pg.pgTable(
	"billing_refund",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		paymentId: pg
			.text("payment_id")
			.notNull()
			.references(() => billingPayment.id, { onDelete: "cascade" }),
		// The payment's nth refund; Rezumi's own refund keys are RF-<payment id>-<sequence>.
		sequence: pg.integer("sequence").notNull(),
		// Midtrans' idempotency key: the same key never refunds twice. Refunds made in the dashboard keep Midtrans' key.
		refundKey: pg.text("refund_key").notNull().unique(),
		method: pg.text("method").notNull().$type<BillingRefundMethod>(),
		status: pg.text("status").notNull().$type<BillingRefundStatus>(),
		// Whole Rupiah.
		amount: pg.integer("amount").notNull(),
		reason: pg.text("reason").notNull(),
		// Whether the admin chose to take the pass and credits back for a partial refund; a full refund always does.
		revokeBenefits: pg.boolean("revoke_benefits").notNull().default(false),
		// The admin who asked; null for one found at Midtrans.
		actorUserId: pg.text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
		// A short code that is safe to show: why it failed (refund_http_412), or REFUND_BANK_PROCESSING while it waits.
		failureReason: pg.text("failure_reason"),
		settledAt: pg.timestamp("settled_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.uniqueIndex().on(t.paymentId, t.sequence),
		pg.index().on(t.status, t.createdAt),
		pg.check("billing_refund_amount_positive", sql`${t.amount} > 0`),
		pg.check("billing_refund_method", sql`${t.method} IN ('midtrans', 'manual')`),
		pg.check("billing_refund_status", sql`${t.status} IN ('requesting', 'succeeded', 'failed')`),
	],
);

/**
 * Billing emails that must go out once: an alert to the owner (one per kind per hour, `count` adds up what happened
 * in that hour), the daily summary (one per day), and a customer's reminder that their pass ends soon (one per end
 * date). The unique `key` makes a repeated or overlapping job a no-op; the billing job sends what isn't sent yet.
 */
export const billingNotification = pg.pgTable(
	"billing_notification",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		// e.g. alert:amount_mismatch:2026-11-03T08, summary:2026-11-03, expiry:<user id>:<end time>.
		key: pg.text("key").notNull().unique(),
		// An alert kind, daily_summary or expiry_reminder.
		kind: pg.text("kind").notNull(),
		// The customer it is for; null for the owner's emails.
		userId: pg.text("user_id").references(() => user.id, { onDelete: "cascade" }),
		// How many times it happened while this notification was open.
		count: pg.integer("count").notNull().default(1),
		// Payment ids and short codes; never emails, tokens or payloads.
		details: pg.jsonb("details").notNull().$type<Record<string, unknown>>().default({}),
		sentAt: pg.timestamp("sent_at", { withTimezone: true }),
		attempts: pg.integer("attempts").notNull().default(0),
		// When the last send started: another sender leaves it alone for a while.
		attemptedAt: pg.timestamp("attempted_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.sentAt, t.createdAt), pg.index().on(t.kind, t.createdAt)],
);
