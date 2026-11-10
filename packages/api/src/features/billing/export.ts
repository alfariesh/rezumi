import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";

/**
 * The account's own billing records for its data export: subscriptions, payments (cards and QRIS passes) and their
 * refunds, granted periods, and Rezumi AI credits in and out. Checkout addresses stay out, as do the internal retry
 * counters. Invoices and the billing details Dodo Payments holds are in its customer portal.
 */
export async function exportBillingData(userId: string) {
	const payments = await db
		.select({
			id: schema.billingPayment.id,
			provider: schema.billingPayment.provider,
			providerPaymentId: schema.billingPayment.providerPaymentId,
			planId: schema.billingPayment.planId,
			interval: schema.billingPayment.interval,
			durationDays: schema.billingPayment.durationDays,
			billingReason: schema.billingPayment.billingReason,
			amount: schema.billingPayment.amount,
			taxAmount: schema.billingPayment.taxAmount,
			totalAmount: schema.billingPayment.totalAmount,
			currency: schema.billingPayment.currency,
			credits: schema.billingPayment.credits,
			status: schema.billingPayment.status,
			periodStart: schema.billingPayment.periodStart,
			periodEnd: schema.billingPayment.periodEnd,
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
	const subscriptions = await db
		.select({
			id: schema.billingSubscription.id,
			planId: schema.billingSubscription.planId,
			interval: schema.billingSubscription.interval,
			status: schema.billingSubscription.status,
			amount: schema.billingSubscription.amount,
			currency: schema.billingSubscription.currency,
			currentPeriodStart: schema.billingSubscription.currentPeriodStart,
			currentPeriodEnd: schema.billingSubscription.currentPeriodEnd,
			cancelAtPeriodEnd: schema.billingSubscription.cancelAtPeriodEnd,
			startedAt: schema.billingSubscription.startedAt,
			endedAt: schema.billingSubscription.endedAt,
		})
		.from(schema.billingSubscription)
		.where(eq(schema.billingSubscription.userId, userId))
		.orderBy(asc(schema.billingSubscription.createdAt));
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
		subscriptions,
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
