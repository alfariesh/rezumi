import type { Transaction } from "./account";
import type { PlannedStretch } from "./timeline";
import type { DbOrTx } from "@rezumi/db/client";
import type { BillingReason } from "@rezumi/db/schema";
import type { BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import { and, asc, eq, gt, inArray, isNull, lte, notExists } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { PASS_DAYS, PLANS } from "@rezumi/schema/billing";
import { grantPassMonth } from "./credits";
import { revokePaymentCredits } from "./fulfillment";
import { grantMembershipPeriod, revokeMembershipPeriod } from "./periods";
import { creditMonth } from "./subscription-access";
import { DAY_MS, previewPurchase } from "./timeline";

/**
 * Prepaid passes paid by QRIS (Sumopod): 30 or 365 days of a plan that don't renew. A pass takes its place in the
 * account's schedule like any period (timeline.ts): the same plan adds its days after the current one, a higher plan
 * starts now and pauses the rest of a lower one until it ends, a lower plan waits behind a higher one. Pro AI passes
 * bring 100 credits for each month they run (one calendar month at a time for a yearly pass, the whole pass for a
 * monthly one); credits don't roll over.
 */

type PaymentRow = typeof schema.billingPayment.$inferSelect;
type PeriodRow = typeof schema.membershipPeriod.$inferSelect;

/** How long the pass a payment bought lasts. */
export function passDurationMs(payment: Pick<PaymentRow, "durationDays" | "interval">): number {
	return (payment.durationDays ?? PASS_DAYS[payment.interval ?? "month"]) * DAY_MS;
}

/** The account's periods still in its schedule (running or waiting), soonest first. */
function scheduleOf(database: DbOrTx, userId: string, now: Date) {
	return database
		.select({
			id: schema.membershipPeriod.id,
			planId: schema.membershipPeriod.planId,
			startsAt: schema.membershipPeriod.startsAt,
			endsAt: schema.membershipPeriod.endsAt,
			createdAt: schema.membershipPeriod.createdAt,
		})
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

/**
 * What a pass does to the account's paid time, as the history and the owner's reports name it: more of the same plan
 * (`subscription_cycle`, a renewal), a move up from a lower plan (`subscription_update`, a change), or else a new
 * purchase.
 */
export function passReason(
	schedule: readonly { planId: PaidPlanId }[],
	planId: PaidPlanId,
): Extract<BillingReason, "purchase" | "subscription_cycle" | "subscription_update"> {
	if (schedule.some((period) => period.planId === planId)) return "subscription_cycle";
	if (schedule.some((period) => PLANS[period.planId].rank < PLANS[planId].rank)) return "subscription_update";
	return "purchase";
}

/** Grants the running month of a Pro AI pass's credits, when its pass covers `now`. Returns the credits granted. */
async function grantRunningMonth(
	tx: Transaction,
	input: { userId: string; payment: Pick<PaymentRow, "id" | "planId" | "interval">; period: PeriodRow; now: Date },
): Promise<number> {
	const perMonth = PLANS[input.payment.planId].creditsPerMonth;
	if (!perMonth || input.period.startsAt > input.now) return 0;
	const month = creditMonth(
		{ start: input.period.startsAt, end: input.period.endsAt },
		input.payment.interval ?? "month",
		input.now,
	);
	if (!month) return 0;
	const grant = await grantPassMonth(tx, {
		userId: input.userId,
		paymentId: input.payment.id,
		amount: perMonth,
		startsAt: month.start,
		expiresAt: month.end,
		now: input.now,
	});
	return grant?.amount ?? 0;
}

/**
 * Grants a paid pass: its time in the schedule, and for Pro AI its first month of credits when it starts now (a pass
 * that waits behind another gets its credits from the billing job when it starts). Runs inside the caller's
 * transaction, holding the account's billing lock and the payment row.
 */
export async function fulfilPass(
	tx: Transaction,
	payment: PaymentRow & { userId: string },
	now: Date,
): Promise<{ period: PeriodRow; credits: number; reason: ReturnType<typeof passReason> }> {
	const reason = passReason(await scheduleOf(tx, payment.userId, now), payment.planId);
	const period = await grantMembershipPeriod(tx, {
		userId: payment.userId,
		planId: payment.planId,
		durationMs: passDurationMs(payment),
		source: "payment",
		paymentId: payment.id,
		now,
	});
	const credits = await grantRunningMonth(tx, { userId: payment.userId, payment, period, now });
	return { period, credits, reason };
}

/**
 * Takes a pass back (a full refund, or a partial one that asked to): each period its payment placed ends now or leaves
 * the queue, the periods after it move up, and its unspent credits go. Returns how many periods it took back. Runs
 * inside the caller's transaction, holding the account's billing lock.
 */
export async function revokePass(
	tx: Transaction,
	payment: Pick<PaymentRow, "id" | "userId">,
	reason: string,
	now = new Date(),
): Promise<number> {
	let revoked = 0;
	if (payment.userId) {
		const periods = await tx
			.select({ id: schema.membershipPeriod.id })
			.from(schema.membershipPeriod)
			.where(
				and(
					eq(schema.membershipPeriod.paymentId, payment.id),
					isNull(schema.membershipPeriod.revokedAt),
					gt(schema.membershipPeriod.endsAt, now),
				),
			);
		for (const period of periods)
			if (await revokeMembershipPeriod(tx, { userId: payment.userId, periodId: period.id, reason, now })) revoked++;
	}
	await revokePaymentCredits(tx, payment, reason);
	return revoked;
}

/**
 * Credits for the months of Pro AI passes the payment didn't cover: a pass that waited behind another and has now
 * started, and each later month of a yearly pass. Once per pass per month, so two runs never double them. Returns how
 * many grants it made.
 */
export async function grantPassCredits(now = new Date()): Promise<number> {
	const perMonth = PLANS["pro-ai"].creditsPerMonth;
	if (!perMonth) return 0;
	const period = schema.membershipPeriod;
	const payment = schema.billingPayment;
	const grant = schema.aiCreditGrant;
	const rows = await db
		.select({
			userId: period.userId,
			paymentId: payment.id,
			startsAt: period.startsAt,
			endsAt: period.endsAt,
			interval: payment.interval,
		})
		.from(period)
		.innerJoin(payment, eq(period.paymentId, payment.id))
		.where(
			and(
				eq(period.planId, "pro-ai"),
				eq(period.source, "payment"),
				isNull(period.revokedAt),
				lte(period.startsAt, now),
				gt(period.endsAt, now),
				eq(payment.provider, "sumopod"),
				inArray(payment.status, ["paid", "partially_refunded"]),
				// This month's grant (or one taken back) is there already: the usual case, every minute of the month.
				notExists(
					db
						.select({ id: grant.id })
						.from(grant)
						.where(and(eq(grant.paymentId, payment.id), isNull(grant.subscriptionId), gt(grant.expiresAt, now))),
				),
			),
		)
		.limit(200);
	let granted = 0;
	for (const row of rows) {
		const month = creditMonth({ start: row.startsAt, end: row.endsAt }, row.interval ?? "month", now);
		if (!month) continue;
		try {
			const given = await db.transaction((tx) =>
				grantPassMonth(tx, {
					userId: row.userId,
					paymentId: row.paymentId,
					amount: perMonth,
					startsAt: month.start,
					expiresAt: month.end,
					now,
				}),
			);
			if (given) granted++;
		} catch {
			console.error("[billing] Granting a pass's month of credits failed; it is tried again on the next run.", {
				paymentId: row.paymentId,
			});
		}
	}
	return granted;
}

/**
 * The paid time the account would have if it bought a pass now, in the order it is used: the same layout a paid pass
 * gets, for showing before payment what it does to the current one.
 */
export async function previewPass(
	userId: string,
	planId: PaidPlanId,
	interval: BillingInterval,
	now = new Date(),
): Promise<PlannedStretch[]> {
	const schedule = await scheduleOf(db, userId, now);
	return previewPurchase(schedule, { planId, durationMs: PASS_DAYS[interval] * DAY_MS }, now);
}

/**
 * Whether the account has a QRIS pass running or waiting. While it does, it keeps paying by QRIS (more time, or a move
 * up), wherever it is browsing from.
 */
export async function hasQrisPass(userId: string, now = new Date(), database: DbOrTx = db): Promise<boolean> {
	const [found] = await database
		.select({ id: schema.membershipPeriod.id })
		.from(schema.membershipPeriod)
		.innerJoin(schema.billingPayment, eq(schema.membershipPeriod.paymentId, schema.billingPayment.id))
		.where(
			and(
				eq(schema.membershipPeriod.userId, userId),
				eq(schema.membershipPeriod.source, "payment"),
				isNull(schema.membershipPeriod.revokedAt),
				gt(schema.membershipPeriod.endsAt, now),
				eq(schema.billingPayment.provider, "sumopod"),
			),
		)
		.limit(1);
	return Boolean(found);
}
