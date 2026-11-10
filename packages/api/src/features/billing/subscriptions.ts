import type { Transaction } from "./account";
import type { PlanProduct } from "./dodo/config";
import type { SubscriptionState } from "./subscription-access";
import type { DbOrTx } from "@rezumi/db/client";
import type { BillingSubscriptionStatus } from "@rezumi/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";

export type SubscriptionRow = typeof schema.billingSubscription.$inferSelect;

/**
 * Statuses a subscription can still bill or give access in; the others are over or never started. An on-hold one
 * waits for a new payment method (the billing portal), so it still counts: the account doesn't start a second one.
 */
export const LIVE_SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "on_hold", "paused"] as const;

/**
 * The audit action that marks an upgrade waiting for its charge (`details.subscriptionId`, `details.productId`): the
 * billing job checks the subscription until it is on that product or the request is half an hour old.
 */
export const CHANGE_REQUESTED_ACTION = "subscription.change_requested";

/** A provider's subscription as Rezumi keeps it, read at `observedAt` (see dodo/mapping.ts). */
export type SubscriptionSnapshot = {
	providerSubscriptionId: string;
	providerCustomerId: string | null;
	providerProductId: string;
	status: BillingSubscriptionStatus;
	/** The recurring price before tax and discounts, in the currency's smallest unit. */
	amount: number;
	currency: string;
	currentPeriodStart: Date;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	canceledAt: Date | null;
	startedAt: Date | null;
	endsAt: Date | null;
	endedAt: Date | null;
	/** The product a change scheduled for the next renewal moves it to (a downgrade). */
	pendingProductId: string | null;
	observedAt: Date;
};

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
	subscription: SubscriptionSnapshot;
	plan: PlanProduct;
	/** The account it belongs to; null once that account is deleted. */
	userId: string | null;
	externalCustomerId: string;
	/** The end of a period a payment just paid for; paid_through only moves forward. */
	paidThrough?: Date | null;
};

const later = (a: Date | null, b: Date | null | undefined) => (!b ? a : !a || b > a ? b : a);

/**
 * Brings Rezumi's copy of a subscription up to date, holding its row. Webhooks don't arrive in order and two reads can
 * race, so a state read earlier than the one kept is skipped; a later one replaces it. `paid_through` is merged either
 * way, since a payment is news whatever order the events came in. Call it inside the transaction that holds the
 * account's billing lock.
 */
export async function upsertSubscription(
	tx: Transaction,
	input: SubscriptionUpsert,
): Promise<{ row: SubscriptionRow; outcome: "applied" | "stale" | "duplicate" }> {
	const { subscription, plan } = input;
	const modifiedAt = subscription.observedAt;
	const fields = {
		provider: "dodo" as const,
		providerProductId: subscription.providerProductId,
		providerCustomerId: subscription.providerCustomerId,
		planId: plan.planId,
		interval: plan.interval,
		status: subscription.status,
		amount: subscription.amount,
		currency: subscription.currency,
		currentPeriodStart: subscription.currentPeriodStart,
		currentPeriodEnd: subscription.currentPeriodEnd,
		cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
		canceledAt: subscription.canceledAt,
		startedAt: subscription.startedAt,
		endsAt: subscription.endsAt,
		endedAt: subscription.endedAt,
		pendingProductId: subscription.pendingProductId,
		providerModifiedAt: modifiedAt,
	};
	const [existing] = await tx
		.select()
		.from(schema.billingSubscription)
		.where(eq(schema.billingSubscription.providerSubscriptionId, subscription.providerSubscriptionId))
		.for("update");
	if (!existing) {
		const [row] = await tx
			.insert(schema.billingSubscription)
			.values({
				...fields,
				userId: input.userId,
				externalCustomerId: input.externalCustomerId,
				providerSubscriptionId: subscription.providerSubscriptionId,
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
 * The account's subscription that matters now: the newest one still live (trialing, active, past_due, on_hold or
 * paused), or else the newest ended one. Accounts hold one subscription at a time, but an ended one stays as history.
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
