import type { BillingInterval, CreditSource, PaidPlanId } from "@rezumi/schema/billing";
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
	// The account's customer at Dodo Payments, made before its first checkout so every later checkout and the billing
	// portal use the same one (not whichever customer shares its email). Gone with the account; its subscriptions keep
	// their own copy.
	providerCustomerId: pg.text("provider_customer_id").unique(),
	createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: pg
		.timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date()),
});

/** `payment` is a 30-day pass bought before subscriptions; new paid access comes from `billing_subscription`. */
export type MembershipPeriodSource = "payment" | "admin" | "promo";

/**
 * One stretch of paid access granted outside a subscription: by an administrator, a promotion, or a 30-day pass bought
 * before subscriptions. An account's unrevoked periods never overlap: they queue one after another, higher plans first.
 * A revoked period is out of the schedule; one revoked while running ends at the moment it was revoked. A subscription
 * runs beside them, and the higher plan of the two applies.
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

/** Rezumi AI credits that came in: the trial, a month of Pro AI, or an administrator. Spent soonest-expiring first. */
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
		// The subscription they came with: one grant per subscription per month, whatever orders a plan change makes.
		subscriptionId: pg
			.text("subscription_id")
			.references((): pg.AnyPgColumn => billingSubscription.id, { onDelete: "set null" }),
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
		pg.uniqueIndex("ai_credit_grant_subscription_month").on(t.subscriptionId, t.expiresAt),
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

/**
 * Dodo Payments' subscription statuses, plus `trialing`: an active subscription still in its free trial (Dodo reports
 * it as active). `pending` hasn't started; `on_hold` failed a charge and waits for a new payment method; `cancelled`,
 * `failed` and `expired` are over.
 */
export const BILLING_SUBSCRIPTION_STATUSES = [
	"pending",
	"trialing",
	"active",
	"past_due",
	"on_hold",
	"paused",
	"cancelled",
	"failed",
	"expired",
] as const;

export type BillingSubscriptionStatus = (typeof BILLING_SUBSCRIPTION_STATUSES)[number];

const statusList = (values: readonly string[]) => sql.raw(values.map((value) => `'${value}'`).join(", "));

/**
 * A subscription at Dodo Payments, mirrored from its webhooks and status checks: the plan and interval its product
 * stands for, where it stands, and the period it is in. `paid_through` is the end of the last period a payment paid for,
 * so a renewal that failed (past_due, on_hold) stops access there. `provider_modified_at` is when that state was read
 * from Dodo, which keeps an older read from undoing a newer one; webhooks don't arrive in order. Kept, without its
 * owner, after the account is deleted; the billing job cancels one that was still running.
 */
export const billingSubscription = pg.pgTable(
	"billing_subscription",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg.text("user_id").references(() => user.id, { onDelete: "set null" }),
		// The account it was bought for, kept as text after the account is gone.
		externalCustomerId: pg.text("external_customer_id").notNull(),
		provider: pg.text("provider").notNull().default("dodo").$type<"dodo" | "polar">(),
		providerSubscriptionId: pg.text("provider_subscription_id").notNull().unique(),
		providerCustomerId: pg.text("provider_customer_id"),
		providerProductId: pg.text("provider_product_id").notNull(),
		planId: pg.text("plan_id").notNull().$type<PaidPlanId>(),
		interval: pg.text("interval").notNull().$type<BillingInterval>(),
		status: pg.text("status").notNull().$type<BillingSubscriptionStatus>(),
		// The recurring price, in the currency's smallest unit, before tax and discounts.
		amount: pg.integer("amount").notNull(),
		currency: pg.text("currency").notNull(),
		currentPeriodStart: pg.timestamp("current_period_start", { withTimezone: true }).notNull(),
		currentPeriodEnd: pg.timestamp("current_period_end", { withTimezone: true }),
		paidThrough: pg.timestamp("paid_through", { withTimezone: true }),
		cancelAtPeriodEnd: pg.boolean("cancel_at_period_end").notNull().default(false),
		canceledAt: pg.timestamp("canceled_at", { withTimezone: true }),
		startedAt: pg.timestamp("started_at", { withTimezone: true }),
		endsAt: pg.timestamp("ends_at", { withTimezone: true }),
		endedAt: pg.timestamp("ended_at", { withTimezone: true }),
		// A plan or interval change scheduled for the next renewal (a downgrade), by product.
		pendingProductId: pg.text("pending_product_id"),
		// When the newest state applied was read from Dodo Payments.
		providerModifiedAt: pg.timestamp("provider_modified_at", { withTimezone: true }).notNull(),
		// When the billing job last asked Dodo Payments about it.
		lastCheckedAt: pg.timestamp("last_checked_at", { withTimezone: true }),
		// Set once it was cancelled at Dodo Payments because its account was deleted.
		revokedForDeletionAt: pg.timestamp("revoked_for_deletion_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.userId, t.status),
		pg.index().on(t.status, t.currentPeriodEnd),
		pg.check("billing_subscription_status", sql`${t.status} IN (${statusList(BILLING_SUBSCRIPTION_STATUSES)})`),
		pg.check("billing_subscription_interval", sql`${t.interval} IN ('month', 'year')`),
		pg.check("billing_subscription_amount_not_negative", sql`${t.amount} >= 0`),
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
 * Where a payment stands. `creating` is committed before the checkout session is created; `pending` has a checkout page
 * to pay on (or a payment Dodo Payments is still charging). Only the provider's own state moves it on from there, and
 * `paid` never goes back: only to a refund or a reversal (a lost card dispute).
 */
export type BillingPaymentStatus = (typeof BILLING_PAYMENT_STATUSES)[number];

/**
 * Why a payment was made: a one-time purchase, a subscription's first payment, a renewal, or a plan change (Dodo's
 * charge types new, renewal and plan_change).
 */
export type BillingReason =
	| "purchase"
	| "subscription_create"
	| "subscription_cycle"
	| "subscription_update"
	| "subscription_meter_cycle";

/**
 * Money for a plan: a checkout opened on the website (until it is paid), or one payment at Dodo Payments. A
 * subscription's renewals and plan changes are payments without a checkout, so each adds a row. The plan, interval and
 * catalog version are copied when the row is made, so a later price change never touches it. Kept, without its owner,
 * after the account is deleted: it is a bookkeeping record. Older rows keep their `provider` (polar, midtrans).
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
		provider: pg.text("provider").notNull().default("dodo").$type<"dodo" | "polar" | "midtrans">(),
		// The checkout session the customer pays on; null for renewals.
		providerCheckoutId: pg.text("provider_checkout_id").unique(),
		// The provider's payment once there is one: a Dodo payment id (a Polar order id on older rows, hence the column).
		providerPaymentId: pg.text("provider_order_id").unique(),
		// The key the checkout request carried; repeating it returns this payment instead of a second one.
		idempotencyKey: pg.text("idempotency_key"),
		subscriptionId: pg
			.text("subscription_id")
			.references((): pg.AnyPgColumn => billingSubscription.id, { onDelete: "set null" }),
		planId: pg.text("plan_id").notNull().$type<PaidPlanId>(),
		// Null on 30-day passes from before subscriptions.
		interval: pg.text("interval").$type<BillingInterval>(),
		catalogVersion: pg.integer("catalog_version").notNull(),
		billingReason: pg.text("billing_reason").$type<BillingReason>(),
		// After discounts, before tax, in the currency's smallest unit: what Rezumi earns before fees. Zero for a 100%
		// discount code.
		amount: pg.integer("amount").notNull(),
		taxAmount: pg.integer("tax_amount").notNull().default(0),
		// What the customer was charged, tax included.
		totalAmount: pg.integer("total_amount").notNull().default(0),
		currency: pg.text("currency").notNull().default("usd"),
		// Rezumi AI credits it granted when it was paid.
		credits: pg.integer("credits").notNull().default(0),
		// The length of a 30-day pass from before subscriptions; null for subscriptions.
		durationDays: pg.integer("duration_days"),
		// The free trial its checkout offered, in days; null without one. A paid $0 payment is the trial starting (Dodo
		// saves the card with a $0 authorization); the first charge is the renewal when the trial ends.
		trialDays: pg.integer("trial_days"),
		status: pg.text("status").notNull().$type<BillingPaymentStatus>(),
		// Where it was bought: the website, for now.
		channel: pg.text("channel").notNull().default("web").$type<"web">(),
		// The checkout page, to go back to after a refresh. Never logged.
		redirectUrl: pg.text("redirect_url"),
		// When the checkout page closes.
		expiresAt: pg.timestamp("expires_at", { withTimezone: true }),
		// The provider's last status for it: the checkout's, then the payment's.
		providerStatus: pg.text("provider_status"),
		// The subscription period the payment pays for.
		periodStart: pg.timestamp("period_start", { withTimezone: true }),
		periodEnd: pg.timestamp("period_end", { withTimezone: true }),
		paidAt: pg.timestamp("paid_at", { withTimezone: true }),
		// Set once its access and credits are granted; it keeps fulfilment to exactly once.
		fulfilledAt: pg.timestamp("fulfilled_at", { withTimezone: true }),
		// Given back, before tax, in the currency's smallest unit.
		refundedAmount: pg.integer("refunded_amount").notNull().default(0),
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
		pg.index().on(t.subscriptionId),
		pg.uniqueIndex().on(t.userId, t.idempotencyKey),
		pg.check("billing_payment_status", sql`${t.status} IN (${statusList(BILLING_PAYMENT_STATUSES)})`),
		pg.check("billing_payment_amount_not_negative", sql`${t.amount} >= 0`),
		pg.check("billing_payment_refunded_in_range", sql`${t.refundedAmount} >= 0 AND ${t.refundedAmount} <= ${t.amount}`),
	],
);

export type BillingPaymentEventSource = "webhook" | "status_check" | "admin";

export type BillingPaymentEventOutcome =
	| "applied"
	| "duplicate"
	| "stale"
	| "ignored"
	| "unknown_product"
	| "unknown_customer"
	| "error";

/**
 * Every payment webhook and every status check that found something, with what it did. The record for support and
 * investigations: Workers keep only a sample of logs. `webhook_id` (the `webhook-id` header of Standard Webhooks) is
 * unique, so a redelivered event is recognized and skipped. `payload` holds an allowlist of safe fields.
 */
export const billingPaymentEvent = pg.pgTable(
	"billing_payment_event",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		paymentId: pg.text("payment_id").references(() => billingPayment.id, { onDelete: "set null" }),
		subscriptionId: pg.text("subscription_id").references(() => billingSubscription.id, { onDelete: "set null" }),
		// Webhooks only; a redelivery carries the same id.
		webhookId: pg.text("webhook_id").unique(),
		// For example payment.succeeded or subscription.renewed; `status_check` for the billing job's own look.
		eventType: pg.text("event_type").notNull(),
		// The provider object the event is about (a payment, subscription, checkout session, refund or dispute id).
		providerObjectId: pg.text("provider_object_id"),
		source: pg.text("source").notNull().$type<BillingPaymentEventSource>(),
		outcome: pg.text("outcome").notNull().$type<BillingPaymentEventOutcome>(),
		payload: pg.jsonb("payload").notNull().$type<Record<string, unknown>>().default({}),
		receivedAt: pg.timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg.index().on(t.providerObjectId, t.receivedAt),
		pg.index().on(t.paymentId),
		pg.index().on(t.subscriptionId),
		pg.index().on(t.eventType, t.receivedAt),
	],
);

export type BillingRefundMethod = "dodo" | "polar" | "midtrans" | "manual";

/**
 * `requesting`: saved before Dodo Payments is asked, and still there while it processes or reviews the refund. `succeeded`
 * once Dodo confirmed the money went back; `failed` when it refused the refund.
 */
export type BillingRefundStatus = "requesting" | "succeeded" | "failed";

/**
 * Money given back for a payment: through Dodo Payments' refund API from the admin page, or from Dodo's dashboard,
 * picked up from its webhooks. The payment's `refunded_amount` is the sum of its succeeded refunds. Kept after the
 * account is deleted.
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
		// The payment's nth refund.
		sequence: pg.integer("sequence").notNull(),
		// The provider's refund id once it has one; before that, Rezumi's own key (RF-<payment id>-<sequence>).
		refundKey: pg.text("refund_key").notNull().unique(),
		method: pg.text("method").notNull().$type<BillingRefundMethod>(),
		status: pg.text("status").notNull().$type<BillingRefundStatus>(),
		// Before tax, in the payment's currency's smallest unit.
		amount: pg.integer("amount").notNull(),
		reason: pg.text("reason").notNull(),
		// Whether the admin also took the plan's access and credits back.
		revokeBenefits: pg.boolean("revoke_benefits").notNull().default(false),
		// The admin who asked; null for one made at the provider.
		actorUserId: pg.text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
		// A short code that is safe to show: why it failed.
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
		pg.check("billing_refund_method", sql`${t.method} IN ('dodo', 'polar', 'midtrans', 'manual')`),
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
