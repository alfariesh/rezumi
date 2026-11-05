import type { Transaction } from "./account";
import type { PlanProduct } from "./polar/config";
import type { PolarSubscriptionLike, SubscriptionState } from "./polar/mapping";
import type { DbOrTx } from "@rezumi/db/client";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { parseDate, providerModifiedAt } from "./polar/mapping";

export type SubscriptionRow = typeof schema.billingSubscription.$inferSelect;

/** Statuses a subscription can still bill or give access in; the others are over or never started. */
export const LIVE_SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "paused"] as const;

export function subscriptionState(row: SubscriptionRow): SubscriptionState {
	return {
		planId: row.planId,
		interval: row.interval,
		status: row.status,
		currentPeriodStart: row.currentPeriodStart,
		currentPeriodEnd: row.currentPeriodEnd,
		paidThrough: row.paidThrough,
		cancelAtPeriodEnd: row.cancelAtPeriodEnd,
		endedAt: row.endedAt,
	};
}

export type SubscriptionUpsert = {
	subscription: PolarSubscriptionLike;
	plan: PlanProduct;
	/** The account it belongs to; null once that account is deleted. */
	userId: string | null;
	externalCustomerId: string;
	/** The end of a period an order just paid for; paid_through only moves forward. */
	paidThrough?: Date | null;
};

const later = (a: Date | null, b: Date | null | undefined) => (!b ? a : !a || b > a ? b : a);

/**
 * Brings Rezumi's copy of a Polar subscription up to date, holding its row. Polar doesn't deliver webhooks in order,
 * so a state older than the one kept (by Polar's `modified_at`) is skipped; a newer one replaces it. `paid_through`
 * is merged either way, since an order's payment is news whatever order the events came in. Call it inside the
 * transaction that holds the account's billing lock.
 */
export async function upsertSubscription(
	tx: Transaction,
	input: SubscriptionUpsert,
): Promise<{ row: SubscriptionRow; outcome: "applied" | "stale" | "duplicate" }> {
	const { subscription, plan } = input;
	const modifiedAt = providerModifiedAt(subscription);
	const fields = {
		providerProductId: subscription.product_id,
		providerCustomerId: subscription.customer_id,
		planId: plan.planId,
		interval: plan.interval,
		status: subscription.status,
		amount: subscription.amount,
		currency: subscription.currency.toLowerCase(),
		currentPeriodStart: parseDate(subscription.current_period_start) ?? modifiedAt,
		currentPeriodEnd: parseDate(subscription.current_period_end),
		cancelAtPeriodEnd: subscription.cancel_at_period_end,
		canceledAt: parseDate(subscription.canceled_at),
		startedAt: parseDate(subscription.started_at),
		endsAt: parseDate(subscription.ends_at),
		endedAt: parseDate(subscription.ended_at),
		// Only full subscriptions carry pending_update; the copy inside an order leaves the scheduled change as it is.
		...("pending_update" in subscription && { pendingProductId: subscription.pending_update?.product_id ?? null }),
		providerModifiedAt: modifiedAt,
	};
	const [existing] = await tx
		.select()
		.from(schema.billingSubscription)
		.where(eq(schema.billingSubscription.providerSubscriptionId, subscription.id))
		.for("update");
	if (!existing) {
		const [row] = await tx
			.insert(schema.billingSubscription)
			.values({
				...fields,
				userId: input.userId,
				externalCustomerId: input.externalCustomerId,
				providerSubscriptionId: subscription.id,
				paidThrough: input.paidThrough ?? null,
			})
			.returning();
		if (!row) throw new Error("The subscription was not saved.");
		return { row, outcome: "applied" };
	}
	const paidThrough = later(existing.paidThrough, input.paidThrough);
	const newer = modifiedAt >= existing.providerModifiedAt;
	if (!newer && +(paidThrough ?? 0) === +(existing.paidThrough ?? 0)) return { row: existing, outcome: "stale" };
	const [row] = await tx
		.update(schema.billingSubscription)
		.set(newer ? { ...fields, paidThrough } : { paidThrough })
		.where(eq(schema.billingSubscription.id, existing.id))
		.returning();
	if (!row) throw new Error("The subscription was not saved.");
	const same =
		newer &&
		existing.status === row.status &&
		existing.planId === row.planId &&
		existing.interval === row.interval &&
		+(existing.currentPeriodEnd ?? 0) === +(row.currentPeriodEnd ?? 0) &&
		existing.cancelAtPeriodEnd === row.cancelAtPeriodEnd &&
		+(existing.paidThrough ?? 0) === +(row.paidThrough ?? 0) &&
		existing.pendingProductId === row.pendingProductId;
	return { row, outcome: same ? "duplicate" : newer ? "applied" : "stale" };
}

/**
 * The account's subscription that matters now: the newest one still live (trialing, active, past_due or paused), or
 * else the newest ended one. Accounts hold one subscription at a time at Polar, but an ended one stays as history.
 */
export async function getCurrentSubscription(userId: string, database: DbOrTx = db): Promise<SubscriptionRow | null> {
	const rows = await database
		.select()
		.from(schema.billingSubscription)
		.where(eq(schema.billingSubscription.userId, userId))
		.orderBy(desc(schema.billingSubscription.createdAt))
		.limit(10);
	return (
		rows.find((row) => (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(row.status) && !row.endedAt) ??
		rows[0] ??
		null
	);
}

/** The account's live subscriptions, for entitlements: usually none or one. */
export function liveSubscriptions(userId: string, database: DbOrTx = db): Promise<SubscriptionRow[]> {
	return database
		.select()
		.from(schema.billingSubscription)
		.where(
			and(
				eq(schema.billingSubscription.userId, userId),
				inArray(schema.billingSubscription.status, [...LIVE_SUBSCRIPTION_STATUSES]),
			),
		);
}
