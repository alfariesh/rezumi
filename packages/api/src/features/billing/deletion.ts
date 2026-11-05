import type { PolarConfig } from "./polar/config";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { polarApi, polarErrorCode, polarStatus } from "./polar/client";
import { getPolarConfig } from "./polar/config";
import { LIVE_SUBSCRIPTION_STATUSES } from "./subscriptions";

/**
 * Deletes an account's customer at Polar and anonymizes it (name, email and billing details hashed or cleared; orders
 * kept for the books). It cancels the customer's subscriptions at once. A customer Polar doesn't know is fine.
 */
export async function deletePolarCustomer(config: PolarConfig, externalCustomerId: string): Promise<void> {
	try {
		await polarApi(config).customers.deleteExternal(externalCustomerId, { anonymize: true });
	} catch (error) {
		if (polarStatus(error) !== 404) throw error;
	}
}

/**
 * After an account is deleted: deletes and anonymizes its customer at Polar, which ends any subscription at once (no
 * refund; the deletion dialog says so). Polar keeps its orders for the books. Only accounts Polar knows (one that
 * ever subscribed) are sent. A failure is left to the billing job, which ends the subscriptions still billing; this
 * never fails the deletion.
 */
export async function endBillingForDeletedUser(userId: string, now = new Date()): Promise<void> {
	const config = getPolarConfig();
	if (!config) return;
	const known = await db
		.select({ id: schema.billingSubscription.id })
		.from(schema.billingSubscription)
		.where(eq(schema.billingSubscription.externalCustomerId, userId))
		.limit(1);
	if (!known.length) return;
	try {
		await deletePolarCustomer(config, userId);
	} catch (error) {
		console.warn("[billing] Deleting a Polar customer failed; the billing job ends its subscriptions.", {
			error: polarErrorCode("customer.delete", error),
		});
		return;
	}
	await db
		.update(schema.billingSubscription)
		.set({ revokedForDeletionAt: now })
		.where(
			and(
				eq(schema.billingSubscription.externalCustomerId, userId),
				isNull(schema.billingSubscription.revokedForDeletionAt),
				inArray(schema.billingSubscription.status, [...LIVE_SUBSCRIPTION_STATUSES]),
			),
		);
}
