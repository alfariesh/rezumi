import type { Transaction } from "./account";
import type { ScheduleChanges } from "./timeline";
import type { MembershipPeriodSource } from "@rezumi/db/schema";
import type { PaidPlanId } from "@rezumi/schema/billing";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import * as schema from "@rezumi/db/schema";
import { lockBillingAccount } from "./account";
import { revokePeriod, schedulePurchase } from "./timeline";

type PeriodRow = typeof schema.membershipPeriod.$inferSelect;

/** The account's periods still in its schedule. Call it holding the billing lock, so the schedule can't change. */
function loadSchedule(tx: Transaction, userId: string, now: Date): Promise<PeriodRow[]> {
	return tx
		.select()
		.from(schema.membershipPeriod)
		.where(
			and(
				eq(schema.membershipPeriod.userId, userId),
				isNull(schema.membershipPeriod.revokedAt),
				gt(schema.membershipPeriod.endsAt, now),
			),
		)
		.orderBy(asc(schema.membershipPeriod.startsAt));
}

async function applyChanges(tx: Transaction, userId: string, changes: ScheduleChanges<PeriodRow>) {
	for (const { id, startsAt, endsAt } of changes.updates) {
		await tx
			.update(schema.membershipPeriod)
			.set({ startsAt, endsAt })
			.where(and(eq(schema.membershipPeriod.id, id), eq(schema.membershipPeriod.userId, userId)));
	}
	// The rest of a pushed-back pass is still that pass: same origin, same payment, same purchase time.
	const rests = changes.inserts.flatMap(({ restOf, ...times }) =>
		restOf
			? [
					{
						...times,
						userId,
						source: restOf.source,
						paymentId: restOf.paymentId,
						grantedBy: restOf.grantedBy,
						createdAt: restOf.createdAt,
					},
				]
			: [],
	);
	if (rests.length) await tx.insert(schema.membershipPeriod).values(rests);
}

/** Adds a pass to the account's schedule and returns its period. Runs inside the caller's transaction. */
export async function grantMembershipPeriod(
	tx: Transaction,
	input: {
		userId: string;
		planId: PaidPlanId;
		durationMs: number;
		source: MembershipPeriodSource;
		paymentId?: string | null;
		grantedBy?: string | null;
		now?: Date;
	},
): Promise<PeriodRow> {
	await lockBillingAccount(tx, input.userId);
	const now = input.now ?? new Date();
	const changes = schedulePurchase(
		await loadSchedule(tx, input.userId, now),
		{ planId: input.planId, durationMs: input.durationMs },
		now,
	);
	await applyChanges(tx, input.userId, changes);
	const purchase = changes.inserts.find((insert) => !insert.restOf);
	if (!purchase) throw new Error("The schedule has no slot for the new pass.");
	const [period] = await tx
		.insert(schema.membershipPeriod)
		.values({
			userId: input.userId,
			planId: purchase.planId,
			startsAt: purchase.startsAt,
			endsAt: purchase.endsAt,
			source: input.source,
			paymentId: input.paymentId ?? null,
			grantedBy: input.grantedBy ?? null,
		})
		.returning();
	if (!period) throw new Error("The new pass was not saved.");
	return period;
}

/**
 * Takes a period out of the account's schedule and moves the later ones up. Returns the period as it was and as it is
 * now, or null when it is already revoked, already over, or another account's.
 */
export async function revokeMembershipPeriod(
	tx: Transaction,
	input: { userId: string; periodId: string; reason: string; now?: Date },
): Promise<{ before: PeriodRow; after: PeriodRow } | null> {
	await lockBillingAccount(tx, input.userId);
	const now = input.now ?? new Date();
	const periods = await loadSchedule(tx, input.userId, now);
	const changes = revokePeriod(periods, input.periodId, now);
	const before = periods.find((period) => period.id === input.periodId);
	if (!changes || !before) return null;
	const [after] = await tx
		.update(schema.membershipPeriod)
		.set({ endsAt: changes.revoked.endsAt, revokedAt: now, revokeReason: input.reason })
		.where(and(eq(schema.membershipPeriod.id, before.id), eq(schema.membershipPeriod.userId, input.userId)))
		.returning();
	if (!after) return null;
	await applyChanges(tx, input.userId, changes);
	return { before, after };
}
