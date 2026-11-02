import type { PaidPlanId } from "@rezumi/schema/billing";
import { PLANS } from "@rezumi/schema/billing";

/** A pass lasts whole 24-hour days. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** A period still in an account's schedule: not revoked and not over yet. */
export type ScheduledPeriod = {
	id: string;
	planId: PaidPlanId;
	startsAt: Date;
	endsAt: Date;
	/** When the pass was bought; it orders passes of the same plan. */
	createdAt: Date;
};

export type PeriodUpdate = { id: string; startsAt: Date; endsAt: Date };

export type PeriodInsert<P extends ScheduledPeriod> = {
	planId: PaidPlanId;
	startsAt: Date;
	endsAt: Date;
	/** The running period whose rest this is, after a higher plan pushed it back; null for a new purchase. */
	restOf: P | null;
};

export type ScheduleChanges<P extends ScheduledPeriod> = { updates: PeriodUpdate[]; inserts: PeriodInsert<P>[] };

type Slot<P extends ScheduledPeriod> = { planId: PaidPlanId; remainingMs: number; order: number; period: P | null };

function slotOf<P extends ScheduledPeriod>(period: P, now: Date): Slot<P> {
	const remainingMs = period.endsAt.getTime() - Math.max(period.startsAt.getTime(), now.getTime());
	return { planId: period.planId, remainingMs, order: period.createdAt.getTime(), period };
}

/**
 * Lays the remaining time out back to back from now, higher plans first and then in purchase order, and returns the
 * fewest row changes that get there. A running period that stays in front is untouched. One pushed back ends now, so
 * the part already used stays as history, and its rest becomes a new row. Queued periods move.
 */
function layout<P extends ScheduledPeriod>(slots: Slot<P>[], now: Date): ScheduleChanges<P> {
	const sorted = slots.toSorted(
		(a, b) =>
			PLANS[b.planId].rank - PLANS[a.planId].rank ||
			a.order - b.order ||
			(a.period?.id ?? "").localeCompare(b.period?.id ?? ""),
	);
	const changes: ScheduleChanges<P> = { updates: [], inserts: [] };
	let cursor = now.getTime();
	for (const { planId, remainingMs, period } of sorted) {
		const startsAt = new Date(cursor);
		const endsAt = new Date(cursor + remainingMs);
		cursor = endsAt.getTime();
		if (!period) {
			changes.inserts.push({ planId, startsAt, endsAt, restOf: null });
		} else if (period.startsAt < now) {
			if (startsAt.getTime() === now.getTime()) continue;
			changes.updates.push({ id: period.id, startsAt: period.startsAt, endsAt: now });
			changes.inserts.push({ planId, startsAt, endsAt, restOf: period });
		} else if (startsAt.getTime() !== period.startsAt.getTime() || endsAt.getTime() !== period.endsAt.getTime()) {
			changes.updates.push({ id: period.id, startsAt, endsAt });
		}
	}
	return changes;
}

/**
 * Where a new pass goes. No paid day is lost: buying the same plan adds its days after the current pass, a higher plan
 * starts now and freezes the rest of a lower one until it ends, and a lower plan waits behind a higher one.
 */
export function schedulePurchase<P extends ScheduledPeriod>(
	periods: readonly P[],
	purchase: { planId: PaidPlanId; durationMs: number },
	now: Date,
): ScheduleChanges<P> {
	if (!Number.isInteger(purchase.durationMs) || purchase.durationMs <= 0)
		throw new RangeError("A pass must last a positive number of milliseconds.");
	const slots = periods.filter((period) => period.endsAt > now).map((period) => slotOf(period, now));
	slots.push({
		planId: purchase.planId,
		remainingMs: purchase.durationMs,
		order: Number.POSITIVE_INFINITY,
		period: null,
	});
	return layout(slots, now);
}

/**
 * Takes a period out of the schedule (refund or admin correction): a running one ends now, a queued one is dropped,
 * and the periods after it move up to start now. Null when the period is not in the schedule.
 */
export function revokePeriod<P extends ScheduledPeriod>(
	periods: readonly P[],
	periodId: string,
	now: Date,
): (ScheduleChanges<P> & { revoked: PeriodUpdate }) | null {
	const target = periods.find((period) => period.id === periodId && period.endsAt > now);
	if (!target) return null;
	const revoked = { id: target.id, startsAt: target.startsAt, endsAt: target.startsAt < now ? now : target.endsAt };
	const rest = periods.filter((period) => period !== target && period.endsAt > now);
	return {
		revoked,
		...layout(
			rest.map((period) => slotOf(period, now)),
			now,
		),
	};
}
