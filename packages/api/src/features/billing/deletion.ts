import type { DodoConfig } from "./dodo/config";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { dodoApi, dodoErrorCode, dodoStatus } from "./dodo/client";
import { getDodoConfig } from "./dodo/config";
import { applyDodoSubscription } from "./fulfillment";
import { LIVE_SUBSCRIPTION_STATUSES } from "./subscriptions";

/**
 * Cancels a subscription at Dodo Payments at once (no refund) and keeps its new state. One Dodo no longer knows, or
 * that has ended already, is fine.
 */
export async function cancelProviderSubscription(config: DodoConfig, providerSubscriptionId: string, now = new Date()) {
	const api = dodoApi(config);
	try {
		const observedAt = new Date();
		const cancelled = await api.subscriptions.update(providerSubscriptionId, {
			status: "cancelled",
			cancel_reason: "cancelled_by_merchant",
		});
		await applyDodoSubscription(cancelled, { source: "admin", eventType: "subscription.cancel", now }, observedAt);
	} catch (error) {
		const status = dodoStatus(error);
		if (status !== 404 && status !== 409 && status !== 422) throw error;
	}
}

/**
 * After an account is deleted: cancels its subscriptions at Dodo Payments at once (no refund; the deletion dialog says
 * so). Dodo keeps the customer and its payments for the books, as the seller must. Only accounts that ever subscribed
 * are sent. A failure is left to the billing job, which ends the subscriptions still billing; this never fails the
 * deletion.
 */
export async function endBillingForDeletedUser(userId: string, now = new Date()): Promise<void> {
	const config = getDodoConfig();
	if (!config) return;
	const live = await db
		.select({ id: schema.billingSubscription.id, providerId: schema.billingSubscription.providerSubscriptionId })
		.from(schema.billingSubscription)
		.where(
			and(
				eq(schema.billingSubscription.externalCustomerId, userId),
				eq(schema.billingSubscription.provider, "dodo"),
				isNull(schema.billingSubscription.revokedForDeletionAt),
				inArray(schema.billingSubscription.status, [...LIVE_SUBSCRIPTION_STATUSES]),
			),
		);
	for (const subscription of live) {
		try {
			await cancelProviderSubscription(config, subscription.providerId, now);
		} catch (error) {
			console.warn("[billing] Cancelling a deleted account's subscription failed; the billing job ends it.", {
				error: dodoErrorCode("subscription.cancel", error),
			});
			continue;
		}
		await db
			.update(schema.billingSubscription)
			.set({ revokedForDeletionAt: now })
			.where(eq(schema.billingSubscription.id, subscription.id));
	}
}
