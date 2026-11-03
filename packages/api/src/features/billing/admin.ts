import type { PaidPlanId } from "@rezumi/schema/billing";
import { ORPCError } from "@orpc/server";
import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { lockBillingAccount } from "./account";
import { deductCredits, getCreditBalance, grantCredits } from "./credits";
import { isBillingAppliedTo, resolveEntitlements } from "./entitlements";
import { grantMembershipPeriod, revokeMembershipPeriod } from "./periods";
import { resendPaymentReceipt } from "./receipt";
import { recordManualRefund, refundModeOf, requestRefund, syncPaymentWithMidtrans } from "./refunds";
import { DAY_MS } from "./timeline";

/** Billing tools for the owner: web sessions of accounts with the admin role only. */
export async function assertBillingAdmin(authentication: { user: { id: string }; method: string } | null | undefined) {
	if (authentication?.method !== "session")
		throw new ORPCError("FORBIDDEN", { message: "Billing tools are only available in a web browser." });
	const [account] = await db
		.select({ role: schema.user.role })
		.from(schema.user)
		.where(eq(schema.user.id, authentication.user.id));
	if (account?.role !== "admin") throw new ORPCError("FORBIDDEN", { message: "Only administrators can do this." });
}

async function findUserId(target: { userId?: string | undefined; email?: string | undefined }) {
	const [account] = await db
		.select({ id: schema.user.id })
		.from(schema.user)
		.where(
			target.userId
				? eq(schema.user.id, target.userId)
				: sql`lower(${schema.user.email}) = lower(${target.email ?? ""})`,
		);
	if (!account) throw new ORPCError("NOT_FOUND", { message: "No account matches that user." });
	return account.id;
}

const periodSummary = (period: typeof schema.membershipPeriod.$inferSelect) => ({
	id: period.id,
	userId: period.userId,
	planId: period.planId,
	startsAt: period.startsAt,
	endsAt: period.endsAt,
});

// How much of an account's history the customer view shows.
const VIEW_LIMIT = 50;
const SEARCH_LIMIT = 20;

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

type PaymentRow = typeof schema.billingPayment.$inferSelect;

/** A payment as the admin page shows it: everything but the Snap token and page address. */
const adminPayment = (payment: PaymentRow) => ({
	id: payment.id,
	userId: payment.userId,
	orderId: payment.providerOrderId,
	planId: payment.planId,
	amount: payment.amount,
	durationDays: payment.durationDays,
	credits: payment.credits,
	status: payment.status,
	paymentType: payment.paymentType,
	transactionId: payment.transactionId,
	providerStatus: payment.providerStatus,
	createdAt: payment.createdAt,
	expiresAt: payment.expiresAt,
	paidAt: payment.paidAt,
	fulfilledAt: payment.fulfilledAt,
	refundedAmount: payment.refundedAmount,
	receiptSentAt: payment.receiptSentAt,
	failureReason: payment.failureReason,
	refundMode: refundModeOf(payment.paymentType),
});

const customerSummary = {
	id: schema.user.id,
	name: schema.user.name,
	email: schema.user.email,
	createdAt: schema.user.createdAt,
};

/** Where an admin's search lands: an email (or part of one), an order number RZ-…, a payment or account id. */
async function search(input: { query: string }) {
	const query = input.query.trim();
	const orderId = /^RZ-/i.test(query) ? `RZ-${query.slice(3)}` : null;
	const id = orderId ? orderId.slice(3) : UUID.test(query) ? query : null;
	const payments = id
		? await db
				.select()
				.from(schema.billingPayment)
				.where(
					or(
						eq(schema.billingPayment.id, id),
						eq(schema.billingPayment.providerOrderId, orderId ?? `RZ-${id}`),
						eq(schema.billingPayment.transactionId, query),
						eq(schema.billingPayment.userId, id),
					),
				)
				.orderBy(desc(schema.billingPayment.createdAt))
				.limit(SEARCH_LIMIT)
		: await db
				.select()
				.from(schema.billingPayment)
				.where(eq(schema.billingPayment.transactionId, query))
				.limit(SEARCH_LIMIT);
	const pattern = `%${query.toLowerCase().replaceAll(/[\\%_]/g, (match) => `\\${match}`)}%`;
	const ownerIds = [...new Set(payments.flatMap((payment) => (payment.userId ? [payment.userId] : [])))];
	const customers = await db
		.select(customerSummary)
		.from(schema.user)
		.where(
			or(
				sql`lower(${schema.user.email}) like ${pattern}`,
				...(id ? [eq(schema.user.id, id)] : []),
				...(ownerIds.length ? [inArray(schema.user.id, ownerIds)] : []),
			),
		)
		.orderBy(desc(schema.user.createdAt))
		.limit(SEARCH_LIMIT);
	return { customers, payments: payments.map(adminPayment) };
}

/** Everything about one account's billing, for support: plan and schedule, credits, payments, refunds and history. */
async function customer(input: { userId: string }) {
	const now = new Date();
	const [account] = await db
		.select({
			...customerSummary,
			emailVerified: schema.user.emailVerified,
			isAnonymous: schema.user.isAnonymous,
			role: schema.user.role,
			timezone: schema.user.timezone,
		})
		.from(schema.user)
		.where(eq(schema.user.id, input.userId));
	if (!account) throw new ORPCError("NOT_FOUND", { message: "No account has that ID." });
	const periods = await db
		.select()
		.from(schema.membershipPeriod)
		.where(eq(schema.membershipPeriod.userId, input.userId))
		.orderBy(desc(schema.membershipPeriod.startsAt))
		.limit(VIEW_LIMIT);
	const payments = await db
		.select()
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.userId, input.userId))
		.orderBy(desc(schema.billingPayment.createdAt))
		.limit(VIEW_LIMIT);
	const paymentIds = payments.map((payment) => payment.id);
	const refunds = paymentIds.length
		? await db
				.select({
					id: schema.billingRefund.id,
					paymentId: schema.billingRefund.paymentId,
					refundKey: schema.billingRefund.refundKey,
					method: schema.billingRefund.method,
					status: schema.billingRefund.status,
					amount: schema.billingRefund.amount,
					reason: schema.billingRefund.reason,
					revokeBenefits: schema.billingRefund.revokeBenefits,
					failureReason: schema.billingRefund.failureReason,
					createdAt: schema.billingRefund.createdAt,
					settledAt: schema.billingRefund.settledAt,
				})
				.from(schema.billingRefund)
				.where(inArray(schema.billingRefund.paymentId, paymentIds))
				.orderBy(desc(schema.billingRefund.createdAt))
		: [];
	const events = paymentIds.length
		? await db
				.select({
					id: schema.billingPaymentEvent.id,
					paymentId: schema.billingPaymentEvent.paymentId,
					source: schema.billingPaymentEvent.source,
					transactionStatus: schema.billingPaymentEvent.transactionStatus,
					outcome: schema.billingPaymentEvent.outcome,
					receivedAt: schema.billingPaymentEvent.receivedAt,
				})
				.from(schema.billingPaymentEvent)
				.where(inArray(schema.billingPaymentEvent.paymentId, paymentIds))
				.orderBy(desc(schema.billingPaymentEvent.receivedAt))
				.limit(VIEW_LIMIT)
		: [];
	const grants = await db
		.select({
			id: schema.aiCreditGrant.id,
			source: schema.aiCreditGrant.source,
			paymentId: schema.aiCreditGrant.paymentId,
			amount: schema.aiCreditGrant.amount,
			remaining: schema.aiCreditGrant.remaining,
			expiresAt: schema.aiCreditGrant.expiresAt,
			revokedAt: schema.aiCreditGrant.revokedAt,
			createdAt: schema.aiCreditGrant.createdAt,
		})
		.from(schema.aiCreditGrant)
		.where(eq(schema.aiCreditGrant.userId, input.userId))
		.orderBy(desc(schema.aiCreditGrant.createdAt))
		.limit(VIEW_LIMIT);
	const audit = await db
		.select({
			id: schema.billingAuditLog.id,
			action: schema.billingAuditLog.action,
			reason: schema.billingAuditLog.reason,
			actorUserId: schema.billingAuditLog.actorUserId,
			details: schema.billingAuditLog.details,
			createdAt: schema.billingAuditLog.createdAt,
		})
		.from(schema.billingAuditLog)
		.where(eq(schema.billingAuditLog.targetUserId, input.userId))
		.orderBy(desc(schema.billingAuditLog.createdAt))
		.limit(VIEW_LIMIT);
	// The plan as the account would have it with plans on, even while they don't apply to it yet.
	const plan = resolveEntitlements(
		periods.filter((period) => !period.revokedAt),
		now,
	);
	return {
		account,
		billingApplies: await isBillingAppliedTo(input.userId),
		plan: { planId: plan.planId, currentPeriodEndsAt: plan.currentPeriodEndsAt, upcoming: plan.upcoming },
		periods: periods.map((period) => ({
			id: period.id,
			planId: period.planId,
			startsAt: period.startsAt,
			endsAt: period.endsAt,
			source: period.source,
			paymentId: period.paymentId,
			revokedAt: period.revokedAt,
			revokeReason: period.revokeReason,
			// Still in the schedule: running or queued, so it can be revoked.
			live: !period.revokedAt && period.endsAt > now,
		})),
		credits: await getCreditBalance(input.userId, now),
		grants,
		payments: payments.map((payment) => ({
			...adminPayment(payment),
			refunds: refunds.filter((refund) => refund.paymentId === payment.id),
		})),
		events,
		audit,
	};
}

/** Writes an admin action to the audit log, outside any transaction. */
function audit(input: {
	actorUserId: string;
	targetUserId: string | null;
	action: string;
	reason?: string | undefined;
	details: Record<string, unknown>;
}) {
	return db.insert(schema.billingAuditLog).values({ ...input, reason: input.reason ?? null });
}

async function paymentOwner(paymentId: string) {
	const [payment] = await db
		.select({ userId: schema.billingPayment.userId, status: schema.billingPayment.status })
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.id, paymentId));
	if (!payment) throw new ORPCError("NOT_FOUND", { message: "No payment has that ID." });
	return payment;
}

export const billingAdmin = {
	search,
	customer,

	/** Asks Midtrans where a payment stands now and applies it: the "check again" button. */
	syncPayment: async (input: { actorUserId: string; paymentId: string }) => {
		const before = await paymentOwner(input.paymentId);
		const result = await syncPaymentWithMidtrans(input.paymentId);
		const after = await paymentOwner(input.paymentId);
		await audit({
			actorUserId: input.actorUserId,
			targetUserId: before.userId,
			action: "payment.synced",
			details: {
				paymentId: input.paymentId,
				found: Boolean(result),
				transactionStatus: result?.transactionStatus ?? null,
				before: before.status,
				after: after.status,
			},
		});
		return {
			found: Boolean(result),
			transactionStatus: result?.transactionStatus ?? null,
			status: after.status,
			changed: before.status !== after.status || result?.outcome === "applied",
		};
	},

	refund: (input: {
		actorUserId: string;
		paymentId: string;
		amount?: number | undefined;
		reason: string;
		revokeBenefits?: boolean | undefined;
	}) => requestRefund(input),

	recordManualRefund: (input: {
		actorUserId: string;
		paymentId: string;
		amount: number;
		reason: string;
		revokeBenefits?: boolean | undefined;
	}) => recordManualRefund(input),

	/** Sends a paid payment's receipt again now. */
	resendReceipt: async (input: { actorUserId: string; paymentId: string }) => {
		const payment = await paymentOwner(input.paymentId);
		if (payment.status !== "paid" && payment.status !== "partially_refunded")
			throw new ORPCError("BAD_REQUEST", { message: "Only a paid payment has a receipt." });
		if (!payment.userId) throw new ORPCError("BAD_REQUEST", { message: "The account was deleted: nobody to send to." });
		const sent = await resendPaymentReceipt(input.paymentId);
		await audit({
			actorUserId: input.actorUserId,
			targetUserId: payment.userId,
			action: "receipt.resent",
			details: { paymentId: input.paymentId, sent },
		});
		return { sent };
	},

	/** Gives an account a pass by hand, queued like a purchase. For support and testing before payments exist. */
	grantPeriod: async (input: {
		actorUserId: string;
		userId?: string | undefined;
		email?: string | undefined;
		planId: PaidPlanId;
		days: number;
		reason: string;
	}) => {
		const userId = await findUserId(input);
		return db.transaction(async (tx) => {
			const period = await grantMembershipPeriod(tx, {
				userId,
				planId: input.planId,
				durationMs: input.days * DAY_MS,
				source: "admin",
				grantedBy: input.actorUserId,
			});
			await tx.insert(schema.billingAuditLog).values({
				actorUserId: input.actorUserId,
				targetUserId: userId,
				action: "period.granted",
				reason: input.reason,
				details: {
					periodId: period.id,
					planId: period.planId,
					days: input.days,
					startsAt: period.startsAt.toISOString(),
					endsAt: period.endsAt.toISOString(),
				},
			});
			return periodSummary(period);
		});
	},

	/**
	 * Corrects an account's Rezumi AI credits: a positive amount grants new credits that expire after `expiresInDays`;
	 * a negative one takes credits away, soonest-expiring first, never below zero. Recorded with its reason.
	 */
	adjustCredits: async (input: {
		actorUserId: string;
		userId?: string | undefined;
		email?: string | undefined;
		amount: number;
		expiresInDays?: number | undefined;
		reason: string;
	}) => {
		const userId = await findUserId(input);
		const now = new Date();
		const expiresInDays = input.expiresInDays;
		if (input.amount > 0 && !expiresInDays)
			throw new ORPCError("BAD_REQUEST", { message: "Say in how many days the credits expire." });
		return db.transaction(async (tx) => {
			await lockBillingAccount(tx, userId);
			const balanceBefore = (await getCreditBalance(userId, now, tx)).balance;
			let change: { grantId: string; expiresAt: Date } | { usageId: string };
			if (input.amount > 0 && expiresInDays) {
				const grant = await grantCredits(tx, {
					userId,
					source: "admin",
					amount: input.amount,
					expiresAt: new Date(+now + expiresInDays * DAY_MS),
					note: input.reason,
					now,
				});
				change = { grantId: grant.id, expiresAt: grant.expiresAt };
			} else {
				change = { usageId: (await deductCredits(tx, { userId, credits: -input.amount, now })).usageId };
			}
			const balance = balanceBefore + input.amount;
			const expiresAt = "expiresAt" in change ? change.expiresAt : null;
			await tx.insert(schema.billingAuditLog).values({
				actorUserId: input.actorUserId,
				targetUserId: userId,
				action: "credits.adjusted",
				reason: input.reason,
				details: {
					amount: input.amount,
					...change,
					...(expiresAt && { expiresAt: expiresAt.toISOString() }),
					balanceBefore,
					balanceAfter: balance,
				},
			});
			return { userId, amount: input.amount, balance, expiresAt };
		});
	},

	/** Takes a pass away: a running one ends now, a queued one is dropped, and later passes move up. */
	revokePeriod: async (input: { actorUserId: string; periodId: string; reason: string }) => {
		const [owner] = await db
			.select({ userId: schema.membershipPeriod.userId })
			.from(schema.membershipPeriod)
			.where(eq(schema.membershipPeriod.id, input.periodId));
		if (!owner) throw new ORPCError("NOT_FOUND", { message: "No membership period has that ID." });
		return db.transaction(async (tx) => {
			const result = await revokeMembershipPeriod(tx, {
				userId: owner.userId,
				periodId: input.periodId,
				reason: input.reason,
			});
			if (!result)
				throw new ORPCError("BAD_REQUEST", { message: "This membership period has already ended or been revoked." });
			await tx.insert(schema.billingAuditLog).values({
				actorUserId: input.actorUserId,
				targetUserId: owner.userId,
				action: "period.revoked",
				reason: input.reason,
				details: {
					periodId: result.before.id,
					planId: result.before.planId,
					startsAt: result.before.startsAt.toISOString(),
					endsAt: result.before.endsAt.toISOString(),
					endedAt: result.after.endsAt.toISOString(),
				},
			});
			return periodSummary(result.after);
		});
	},
};
