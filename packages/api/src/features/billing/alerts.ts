import type { DbOrTx } from "@rezumi/db/client";
import { and, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { getBillingMode } from "./entitlements";

/**
 * Alerts for the owner when a payment needs a person: kept in `billing_notification`, one row per kind per hour (its
 * `count` adds up what happened), emailed by the billing job once the hour's count reaches the kind's threshold. A
 * repeated or overlapping job, or the same problem seen every minute, still makes one email per kind per hour.
 */

const BILLING_ALERT_KINDS = [
	// Polar says an order is paid but it isn't granted here (its account is gone, or applying it failed).
	"paid_not_applied",
	// Money taken back after it was paid: a refund Polar made to head off a dispute, or a dispute.
	"payment_reversed",
	// An event that needs a look by hand: one that couldn't be applied, or a state the code doesn't expect.
	"needs_review",
	// Webhooks with a bad signature: a wrong secret after a change, or someone probing the endpoint.
	"rejected_signatures",
	// Polar's API kept failing: checkout pages or status checks.
	"provider_errors",
	// Polar refused a refund, or never confirmed one.
	"refund_failed",
] as const;

export type BillingAlertKind = (typeof BILLING_ALERT_KINDS)[number];

/** How many times an alert must happen within the hour before it is emailed; one for the rest. */
const ALERT_THRESHOLDS: Partial<Record<BillingAlertKind, number>> = { rejected_signatures: 5, provider_errors: 3 };

/** SQL for "this row's count reached its kind's threshold". */
export const alertDue = () =>
	sql`${schema.billingNotification.count} >= (case ${schema.billingNotification.kind} ${sql.join(
		Object.entries(ALERT_THRESHOLDS).map(([kind, threshold]) => sql`when ${kind} then ${threshold}`),
		sql` `,
	)} else 1 end)`;

/** The payments an alert names, at most this many. */
const MAX_ALERT_PAYMENTS = 20;
/** How long a state problem stays in the sweep after it starts: an hour, so it is reported once. */
const SWEEP_WINDOW_MS = 60 * 60 * 1000;
/** A paid payment without its pass this long after it changed has failed, not raced. */
const FULFILMENT_GRACE_MS = 5 * 60 * 1000;
/** A refund Polar hasn't settled this long after it was asked needs a look. */
const REFUND_CONFIRM_MS = 30 * 60 * 1000;
/** The daily summary goes out from this hour, Western Indonesian Time. */
const SUMMARY_HOUR_WIB = 8;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const alertKey = (kind: BillingAlertKind, now: Date) => `alert:${kind}:${now.toISOString().slice(0, 13)}`;

/**
 * Records that something alert-worthy happened. `level` reports a state the sweep sees (the hour keeps the highest
 * count) rather than one more occurrence. Runs in the caller's transaction when given one, so a rolled-back change
 * raises nothing.
 */
export async function raiseBillingAlert(
	database: DbOrTx,
	input: {
		kind: BillingAlertKind;
		paymentId?: string | undefined;
		paymentIds?: readonly string[] | undefined;
		count?: number;
		level?: boolean;
		now?: Date;
	},
) {
	const now = input.now ?? new Date();
	const paymentIds = [...new Set([...(input.paymentIds ?? []), ...(input.paymentId ? [input.paymentId] : [])])].slice(
		0,
		MAX_ALERT_PAYMENTS,
	);
	const table = schema.billingNotification;
	await database
		.insert(table)
		.values({
			key: alertKey(input.kind, now),
			kind: input.kind,
			count: input.count ?? 1,
			details: { paymentIds },
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: table.key,
			set: {
				count: input.level ? sql`greatest(${table.count}, excluded.count)` : sql`${table.count} + excluded.count`,
				// The payments named so far and these, each once.
				details: sql`jsonb_build_object('paymentIds', (select coalesce(jsonb_agg(id), '[]'::jsonb) from (select distinct id from jsonb_array_elements_text(coalesce(${table.details} -> 'paymentIds', '[]'::jsonb) || (excluded.details -> 'paymentIds')) as ids(id) limit ${MAX_ALERT_PAYMENTS}) as kept))`,
				updatedAt: now,
			},
		});
}

/** Raises an alert outside any transaction; a failure to record it is logged, never thrown at the caller. */
export function raiseBillingAlertQuietly(input: Parameters<typeof raiseBillingAlert>[1]) {
	return raiseBillingAlert(db, input).catch(() => {
		console.error("[billing] An alert could not be recorded.", { kind: input.kind });
	});
}

/**
 * The billing job's look for problems that are states rather than events: paid payments without their access and
 * credits, refunds Polar never settled. Each is caught in the hour after it starts, so the owner hears about it once
 * (or twice, across an hour boundary) rather than every hour it lasts.
 */
export async function detectBillingProblems(now = new Date()) {
	const window = (column: Parameters<typeof gt>[0], after: number) =>
		and(gt(column, new Date(+now - after - SWEEP_WINDOW_MS)), lt(column, new Date(+now - after)));
	const payment = schema.billingPayment;
	const unfulfilled = await db
		.select({ id: payment.id })
		.from(payment)
		.where(
			and(
				eq(payment.status, "paid"),
				isNull(payment.fulfilledAt),
				// A deleted account's payment is reported when it is paid (fulfillment.ts); there is no pass to wait for.
				isNotNull(payment.userId),
				window(payment.updatedAt, FULFILMENT_GRACE_MS),
			),
		)
		.limit(MAX_ALERT_PAYMENTS);
	const refund = schema.billingRefund;
	const unansweredRefunds = await db
		.select({ paymentId: refund.paymentId })
		.from(refund)
		.where(and(eq(refund.status, "requesting"), window(refund.createdAt, REFUND_CONFIRM_MS)))
		.limit(MAX_ALERT_PAYMENTS);
	const found: [BillingAlertKind, string[]][] = [
		["paid_not_applied", unfulfilled.map((row) => row.id)],
		["refund_failed", unansweredRefunds.map((row) => row.paymentId)],
	];
	let raised = 0;
	for (const [kind, paymentIds] of found) {
		if (!paymentIds.length) continue;
		await raiseBillingAlert(db, { kind, paymentIds, count: paymentIds.length, level: true, now });
		raised++;
	}
	return raised;
}

/** The calendar day in Western Indonesian Time, as YYYY-MM-DD, and the hour there. */
function wibDay(at: Date) {
	const shifted = new Date(+at + WIB_OFFSET_MS);
	return { date: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() };
}

/** Midnight WIB at the start of a YYYY-MM-DD day, as an instant. */
export const wibMidnight = (date: string) => new Date(+new Date(`${date}T00:00:00Z`) - WIB_OFFSET_MS);

/**
 * Queues the day's summary of yesterday (WIB) once it is past 08.00 WIB: one per day however often the job runs.
 * Only while plans are on or being tested and the owner has an address for it.
 */
export async function queueDailySummary(now = new Date()) {
	if (getBillingMode() === "off" || !env.BILLING_ALERT_EMAIL) return false;
	const { date, hour } = wibDay(now);
	if (hour < SUMMARY_HOUR_WIB) return false;
	const yesterday = wibDay(new Date(+wibMidnight(date) - 1)).date;
	const [queued] = await db
		.insert(schema.billingNotification)
		.values({ key: `summary:${date}`, kind: "daily_summary", details: { day: yesterday }, createdAt: now })
		.onConflictDoNothing()
		.returning({ id: schema.billingNotification.id });
	return Boolean(queued);
}

/** Alerts recorded lately, newest first, for the admin page. */
export function listRecentAlerts(limit = 20) {
	const table = schema.billingNotification;
	return db
		.select({
			id: table.id,
			kind: table.kind,
			count: table.count,
			details: table.details,
			sentAt: table.sentAt,
			createdAt: table.createdAt,
			updatedAt: table.updatedAt,
		})
		.from(table)
		.where(and(inArray(table.kind, [...BILLING_ALERT_KINDS]), or(alertDue(), isNotNull(table.sentAt))))
		.orderBy(sql`${table.updatedAt} desc`)
		.limit(limit);
}
