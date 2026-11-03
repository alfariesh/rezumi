import type { PaidPlanId } from "@rezumi/schema/billing";
import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { deliverPaymentReceipt } from "@rezumi/email/billing";
import { env } from "@rezumi/env/server";
import { BILLING_SELLER } from "@rezumi/schema/billing";

/** Receipts a payment gets at most, so a mailbox that keeps failing isn't tried forever. */
const MAX_RECEIPT_ATTEMPTS = 5;
// How long another sender leaves a receipt alone after a send started.
const RECEIPT_LEASE_MS = 5 * 60 * 1000;
const RECEIPT_BATCH = 10;

const PLAN_NAMES: Record<PaidPlanId, string> = { plus: "Plus", "pro-ai": "Pro AI" };

const METHOD_NAMES: Record<string, string> = {
	qris: "QRIS",
	gopay: "GoPay",
	shopeepay: "ShopeePay",
	bank_transfer: "Transfer bank (virtual account)",
	echannel: "Mandiri Bill",
	credit_card: "Kartu kredit/debit",
};

/** The account's time zone, or Western Indonesian Time while it is still the default UTC (or unknown). */
function receiptTimeZone(timezone: string | null | undefined) {
	if (!timezone || timezone === "UTC") return "Asia/Jakarta";
	try {
		new Intl.DateTimeFormat("id-ID", { timeZone: timezone });
		return timezone;
	} catch {
		return "Asia/Jakarta";
	}
}

/** "2 November 2026 pukul 14.05 WIB". */
function formatReceiptTime(at: Date, timeZone: string) {
	return new Intl.DateTimeFormat("id-ID", {
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone,
		timeZoneName: "short",
	}).format(at);
}

/** "Rp79.000", the way prices are written everywhere else. */
const formatRupiah = (amount: number) => `Rp${new Intl.NumberFormat("id-ID").format(amount)}`;

const paymentMethodName = (paymentType: string | null) =>
	(paymentType && METHOD_NAMES[paymentType]) ?? paymentType ?? "—";

/**
 * Takes the right to send one payment's receipt: paid and fulfilled, not sent, tries left, and no other sender busy
 * with it. A row another transaction holds is skipped rather than waited for.
 */
function claimReceipt(paymentId: string, now: Date) {
	return db.transaction(async (tx) => {
		const [payment] = await tx
			.select()
			.from(schema.billingPayment)
			.where(
				and(
					eq(schema.billingPayment.id, paymentId),
					inArray(schema.billingPayment.status, ["paid", "partially_refunded"]),
					isNotNull(schema.billingPayment.fulfilledAt),
					isNull(schema.billingPayment.receiptSentAt),
					lt(schema.billingPayment.receiptAttempts, MAX_RECEIPT_ATTEMPTS),
					or(
						isNull(schema.billingPayment.receiptAttemptedAt),
						lt(schema.billingPayment.receiptAttemptedAt, new Date(+now - RECEIPT_LEASE_MS)),
					),
				),
			)
			.for("update", { skipLocked: true });
		if (!payment) return null;
		await tx
			.update(schema.billingPayment)
			.set({ receiptAttempts: sql`${schema.billingPayment.receiptAttempts} + 1`, receiptAttemptedAt: now })
			.where(eq(schema.billingPayment.id, payment.id));
		return payment;
	});
}

/**
 * Emails a paid payment's receipt once. Indonesian, times in the account's zone (WIB while it is the default). The
 * seller's details come from BILLING_SELLER. Returns whether it went out; failures are retried by the billing job.
 */
async function sendPaymentReceipt(paymentId: string, now = new Date()): Promise<boolean> {
	const payment = await claimReceipt(paymentId, now);
	if (!payment) return false;
	const [owner] = payment.userId
		? await db
				.select({ email: schema.user.email, timezone: schema.user.timezone })
				.from(schema.user)
				.where(eq(schema.user.id, payment.userId))
		: [];
	if (!owner) {
		// The account is gone: nobody to send it to.
		await db
			.update(schema.billingPayment)
			.set({ receiptAttempts: MAX_RECEIPT_ATTEMPTS })
			.where(eq(schema.billingPayment.id, payment.id));
		return false;
	}
	const periods = await db
		.select({ startsAt: schema.membershipPeriod.startsAt, endsAt: schema.membershipPeriod.endsAt })
		.from(schema.membershipPeriod)
		.where(eq(schema.membershipPeriod.paymentId, payment.id))
		.orderBy(asc(schema.membershipPeriod.startsAt));
	const timeZone = receiptTimeZone(owner.timezone);
	const paidAt = payment.paidAt ?? payment.fulfilledAt ?? now;
	const first = periods[0];
	const last = periods.at(-1);
	const planName = PLAN_NAMES[payment.planId];
	try {
		const delivery = await deliverPaymentReceipt({
			to: owner.email,
			subject: `Bukti pembayaran Rezumi ${planName} (${payment.providerOrderId})`,
			receipt: {
				seller: {
					name: BILLING_SELLER.name,
					brand: BILLING_SELLER.brand,
					supportEmail: BILLING_SELLER.supportEmail,
					mailingAddress: BILLING_SELLER.mailingAddress,
				},
				orderId: payment.providerOrderId,
				paidAt: formatReceiptTime(paidAt, timeZone),
				planName,
				validFrom: formatReceiptTime(first?.startsAt ?? paidAt, timeZone),
				validUntil: formatReceiptTime(
					last?.endsAt ?? new Date(+paidAt + payment.durationDays * 24 * 60 * 60 * 1000),
					timeZone,
				),
				amount: formatRupiah(payment.amount),
				method: paymentMethodName(payment.paymentType),
				credits: payment.credits,
				durationDays: payment.durationDays,
				billingUrl: new URL("/dashboard/settings/billing", env.APP_URL).toString(),
			},
		});
		if (delivery === "unconfigured") return false;
		await db
			.update(schema.billingPayment)
			.set({ receiptSentAt: new Date() })
			.where(eq(schema.billingPayment.id, payment.id));
		return true;
	} catch {
		console.error("[billing] A payment receipt could not be sent; the billing job tries again.", {
			paymentId: payment.id,
		});
		return false;
	}
}

/** Sends receipts still owed for fulfilled payments, a few per run. */
export async function sendPendingReceipts(now = new Date()): Promise<number> {
	const due = await db
		.select({ id: schema.billingPayment.id })
		.from(schema.billingPayment)
		.where(
			and(
				inArray(schema.billingPayment.status, ["paid", "partially_refunded"]),
				isNotNull(schema.billingPayment.fulfilledAt),
				isNull(schema.billingPayment.receiptSentAt),
				lt(schema.billingPayment.receiptAttempts, MAX_RECEIPT_ATTEMPTS),
				or(
					isNull(schema.billingPayment.receiptAttemptedAt),
					lt(schema.billingPayment.receiptAttemptedAt, new Date(+now - RECEIPT_LEASE_MS)),
				),
			),
		)
		.orderBy(asc(schema.billingPayment.fulfilledAt))
		.limit(RECEIPT_BATCH);
	let sent = 0;
	for (const { id } of due) if (await sendPaymentReceipt(id, now)) sent++;
	return sent;
}

/**
 * Sends a paid payment's receipt again now, for a customer who didn't get it: the sent mark and the tries are reset,
 * then it goes out as the first one did. Whether it went out.
 */
export async function resendPaymentReceipt(paymentId: string, now = new Date()): Promise<boolean> {
	await db
		.update(schema.billingPayment)
		.set({ receiptSentAt: null, receiptAttempts: 0, receiptAttemptedAt: null })
		.where(
			and(
				eq(schema.billingPayment.id, paymentId),
				inArray(schema.billingPayment.status, ["paid", "partially_refunded"]),
				isNotNull(schema.billingPayment.fulfilledAt),
			),
		);
	return sendPaymentReceipt(paymentId, now);
}
