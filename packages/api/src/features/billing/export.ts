import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";

/**
 * The account's own billing records for its data export: payments and their refunds, passes, and Rezumi AI credits
 * in and out. Payment page tokens and addresses stay out, as do the internal retry counters.
 */
export async function exportBillingData(userId: string) {
	const payments = await db
		.select({
			id: schema.billingPayment.id,
			orderId: schema.billingPayment.providerOrderId,
			planId: schema.billingPayment.planId,
			amount: schema.billingPayment.amount,
			currency: schema.billingPayment.currency,
			durationDays: schema.billingPayment.durationDays,
			credits: schema.billingPayment.credits,
			status: schema.billingPayment.status,
			paymentType: schema.billingPayment.paymentType,
			createdAt: schema.billingPayment.createdAt,
			expiresAt: schema.billingPayment.expiresAt,
			paidAt: schema.billingPayment.paidAt,
			refundedAmount: schema.billingPayment.refundedAmount,
		})
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.userId, userId))
		.orderBy(asc(schema.billingPayment.createdAt));
	const refunds = payments.length
		? await db
				.select({
					paymentId: schema.billingRefund.paymentId,
					amount: schema.billingRefund.amount,
					method: schema.billingRefund.method,
					status: schema.billingRefund.status,
					reason: schema.billingRefund.reason,
					createdAt: schema.billingRefund.createdAt,
					settledAt: schema.billingRefund.settledAt,
				})
				.from(schema.billingRefund)
				.where(
					inArray(
						schema.billingRefund.paymentId,
						payments.map((payment) => payment.id),
					),
				)
				.orderBy(asc(schema.billingRefund.createdAt))
		: [];
	const passes = await db
		.select({
			planId: schema.membershipPeriod.planId,
			startsAt: schema.membershipPeriod.startsAt,
			endsAt: schema.membershipPeriod.endsAt,
			source: schema.membershipPeriod.source,
			paymentId: schema.membershipPeriod.paymentId,
			revokedAt: schema.membershipPeriod.revokedAt,
			createdAt: schema.membershipPeriod.createdAt,
		})
		.from(schema.membershipPeriod)
		.where(eq(schema.membershipPeriod.userId, userId))
		.orderBy(asc(schema.membershipPeriod.startsAt));
	const creditGrants = await db
		.select({
			source: schema.aiCreditGrant.source,
			paymentId: schema.aiCreditGrant.paymentId,
			amount: schema.aiCreditGrant.amount,
			remaining: schema.aiCreditGrant.remaining,
			expiresAt: schema.aiCreditGrant.expiresAt,
			revokedAt: schema.aiCreditGrant.revokedAt,
			createdAt: schema.aiCreditGrant.createdAt,
		})
		.from(schema.aiCreditGrant)
		.where(eq(schema.aiCreditGrant.userId, userId))
		.orderBy(asc(schema.aiCreditGrant.createdAt));
	const creditUsage = await db
		.select({
			action: schema.aiCreditUsage.action,
			credits: schema.aiCreditUsage.credits,
			status: schema.aiCreditUsage.status,
			createdAt: schema.aiCreditUsage.createdAt,
			settledAt: schema.aiCreditUsage.settledAt,
		})
		.from(schema.aiCreditUsage)
		.where(eq(schema.aiCreditUsage.userId, userId))
		.orderBy(asc(schema.aiCreditUsage.createdAt));
	return {
		payments: payments.map((payment) => ({
			...payment,
			refunds: refunds
				.filter((refund) => refund.paymentId === payment.id)
				.map(({ paymentId: _paymentId, ...refund }) => refund),
		})),
		passes,
		creditGrants,
		creditUsage,
	};
}
