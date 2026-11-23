import type { DbOrTx } from "@rezumi/db/client";
import type { LimitOverrideKey } from "@rezumi/schema/billing";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";

/**
 * The number an administrator set for this account and limit, while it lasts; null when the plan's number applies.
 * It replaces the plan's number whether it is higher or lower, and applies even while plans don't apply to the account.
 */
export async function activeLimitOverride(
	userId: string,
	limitKey: LimitOverrideKey,
	now: Date,
	database: DbOrTx = db,
): Promise<number | null> {
	const [row] = await database
		.select({ value: schema.billingLimitOverride.value })
		.from(schema.billingLimitOverride)
		.where(
			and(
				eq(schema.billingLimitOverride.userId, userId),
				eq(schema.billingLimitOverride.limitKey, limitKey),
				or(isNull(schema.billingLimitOverride.expiresAt), gt(schema.billingLimitOverride.expiresAt, now)),
			),
		);
	return row?.value ?? null;
}

/** Every override the account has, expired ones too, for the admin customer view. */
export function listLimitOverrides(userId: string, database: DbOrTx = db) {
	return database
		.select({
			id: schema.billingLimitOverride.id,
			limitKey: schema.billingLimitOverride.limitKey,
			value: schema.billingLimitOverride.value,
			expiresAt: schema.billingLimitOverride.expiresAt,
			reason: schema.billingLimitOverride.reason,
			grantedBy: schema.billingLimitOverride.grantedBy,
			updatedAt: schema.billingLimitOverride.updatedAt,
		})
		.from(schema.billingLimitOverride)
		.where(eq(schema.billingLimitOverride.userId, userId))
		.orderBy(asc(schema.billingLimitOverride.limitKey));
}
