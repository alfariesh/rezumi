import type { PlannedStretch } from "./timeline";
import type { BillingPaymentStatus } from "@rezumi/db/schema";
import type { PaidPlanId } from "@rezumi/schema/billing";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gt, isNotNull, isNull, lt, max, min, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { BILLING_CATALOG_VERSION, BILLING_CURRENCY, PLANS } from "@rezumi/schema/billing";
import { generateId } from "@rezumi/utils/string";
import { lockBillingAccount } from "./account";
import { raiseBillingAlertQuietly } from "./alerts";
import { isBillingAppliedTo } from "./entitlements";
import { applyVerifiedStatus } from "./fulfillment";
import {
	MidtransError,
	cancelSnapSession,
	cancelTransaction,
	createSnapTransaction,
	getTransactionStatus,
} from "./midtrans/client";
import { getMidtransConfig } from "./midtrans/config";
import { buildSnapPayload, providerOrderIdFor, windowEnd, windowStart } from "./midtrans/payload";
import { syncPaymentStatus } from "./reconcile";
import { DAY_MS, previewPurchase as previewSchedule } from "./timeline";

type PaymentRow = typeof schema.billingPayment.$inferSelect;
type Authentication = { user: { id: string }; method: "apiKey" | "bearer" | "session" };

/** A pending payment is offered again while at least this much of its window is left. */
const REUSE_MIN_REMAINING_MS = 60 * 60 * 1000;

/** Why an account can't buy right now, in the order the checks run. */
export type PurchaseBlocker = "unavailable" | "paused" | "web_only" | "guest" | "email_not_verified";

/**
 * What stops an account from buying: plans not applying to it or Midtrans not set up, purchases paused, a request
 * that isn't a web session (the apps, API keys and OAuth/MCP clients never buy), a guest account, or an unverified
 * email. Null when it can buy.
 */
export async function purchaseBlocker(authentication: Authentication): Promise<PurchaseBlocker | null> {
	if (!getMidtransConfig() || !(await isBillingAppliedTo(authentication.user.id))) return "unavailable";
	if (env.BILLING_CHECKOUT_PAUSED) return "paused";
	if (authentication.method !== "session") return "web_only";
	const [owner] = await db
		.select({ isAnonymous: schema.user.isAnonymous, emailVerified: schema.user.emailVerified })
		.from(schema.user)
		.where(eq(schema.user.id, authentication.user.id));
	if (!owner || owner.isAnonymous) return "guest";
	if (!owner.emailVerified) return "email_not_verified";
	return null;
}

// Neutral messages: no prices, no buying, no links, since the apps show server messages as they are.
const BLOCKER_ERRORS: Record<PurchaseBlocker, () => ORPCError<string, unknown>> = {
	unavailable: () => new ORPCError("BILLING_UNAVAILABLE", { status: 403, message: "This isn't available right now." }),
	paused: () =>
		new ORPCError("BILLING_UNAVAILABLE", { status: 403, message: "This is paused for now. Try again later." }),
	web_only: () => new ORPCError("FORBIDDEN", { message: "This is only available on the Rezumi website." }),
	guest: () => new ORPCError("FORBIDDEN", { message: "Create an account with your email address first." }),
	email_not_verified: () =>
		new ORPCError("EMAIL_NOT_VERIFIED", { status: 403, message: "Verify your email address first." }),
};

async function assertCanPurchase(authentication: Authentication) {
	const blocker = await purchaseBlocker(authentication);
	if (blocker) throw BLOCKER_ERRORS[blocker]();
}

/** A payment as its owner sees it. The Snap address is only for a web session, and only while it can be paid. */
export type PaymentView = {
	id: string;
	orderId: string;
	planId: PaidPlanId;
	amount: number;
	currency: string;
	durationDays: number;
	credits: number;
	status: BillingPaymentStatus;
	paymentType: string | null;
	createdAt: Date;
	expiresAt: Date | null;
	paidAt: Date | null;
	refundedAmount: number;
	redirectUrl: string | null;
};

function toPaymentView(payment: PaymentRow, authentication: Authentication, now = new Date()): PaymentView {
	const payable =
		authentication.method === "session" &&
		payment.status === "pending" &&
		payment.expiresAt !== null &&
		payment.expiresAt > now;
	return {
		id: payment.id,
		orderId: payment.providerOrderId,
		planId: payment.planId,
		amount: payment.amount,
		currency: payment.currency,
		durationDays: payment.durationDays,
		credits: payment.credits,
		status: payment.status,
		paymentType: payment.paymentType,
		createdAt: payment.createdAt,
		expiresAt: payment.expiresAt,
		paidAt: payment.paidAt,
		refundedAmount: payment.refundedAmount,
		redirectUrl: payable ? payment.redirectUrl : null,
	};
}

export type CheckoutResult = { paymentId: string; redirectUrl: string; expiresAt: Date; reused: boolean };

const unavailable = () =>
	new ORPCError("BAD_GATEWAY", { message: "The payment page could not be opened. Try again in a moment." });

/**
 * Starts paying for a pass on the web. The same request key returns the same payment, and an open payment for the same
 * plan and price is offered again rather than doubled. Otherwise a `creating` row (catalog copy and all) is committed
 * before Snap is called, so a failed or lost call still leaves a record; the Snap page is saved once it exists.
 */
export async function checkout(input: {
	authentication: Authentication;
	planId: PaidPlanId;
	idempotencyKey: string;
	/** Changing method opens a new page even when another one is open. */
	reuseOpen?: boolean;
	/** The app language, kept for later emails about the pass (it ending soon). */
	locale?: string | undefined;
	now?: Date;
}): Promise<CheckoutResult> {
	await assertCanPurchase(input.authentication);
	const config = getMidtransConfig();
	if (!config) throw BLOCKER_ERRORS.unavailable();
	const userId = input.authentication.user.id;
	const now = input.now ?? new Date();
	const plan = PLANS[input.planId];
	const start = windowStart(now);
	const prepared = await db.transaction(async (tx) => {
		const account = await lockBillingAccount(tx, userId);
		if (input.locale && account.locale !== input.locale)
			await tx
				.update(schema.billingAccount)
				.set({ locale: input.locale })
				.where(eq(schema.billingAccount.userId, userId));
		const [same] = await tx
			.select()
			.from(schema.billingPayment)
			.where(
				and(eq(schema.billingPayment.userId, userId), eq(schema.billingPayment.idempotencyKey, input.idempotencyKey)),
			);
		if (same) return { existing: same };
		if (input.reuseOpen !== false) {
			const [open] = await tx
				.select()
				.from(schema.billingPayment)
				.where(
					and(
						eq(schema.billingPayment.userId, userId),
						eq(schema.billingPayment.status, "pending"),
						eq(schema.billingPayment.planId, plan.id),
						eq(schema.billingPayment.amount, plan.priceIdr),
						isNotNull(schema.billingPayment.redirectUrl),
						gt(schema.billingPayment.expiresAt, new Date(+now + REUSE_MIN_REMAINING_MS)),
					),
				)
				.orderBy(desc(schema.billingPayment.createdAt))
				.limit(1);
			if (open) return { existing: open };
		}
		const [owner] = await tx
			.select({ name: schema.user.name, email: schema.user.email })
			.from(schema.user)
			.where(eq(schema.user.id, userId));
		if (!owner) throw new ORPCError("UNAUTHORIZED");
		const id = generateId();
		const [created] = await tx
			.insert(schema.billingPayment)
			.values({
				id,
				userId,
				providerOrderId: providerOrderIdFor(id),
				idempotencyKey: input.idempotencyKey,
				planId: plan.id,
				catalogVersion: BILLING_CATALOG_VERSION,
				amount: plan.priceIdr,
				durationDays: plan.durationDays,
				credits: plan.creditsPerPurchase,
				currency: BILLING_CURRENCY,
				status: "creating",
				channel: "web",
				expiresAt: windowEnd(start),
				createdAt: now,
			})
			.returning();
		if (!created) throw new Error("The payment was not saved.");
		return { created, owner };
	});

	if ("existing" in prepared) {
		const { existing } = prepared;
		if (existing.status === "pending" && existing.redirectUrl && existing.expiresAt && existing.expiresAt > now)
			return { paymentId: existing.id, redirectUrl: existing.redirectUrl, expiresAt: existing.expiresAt, reused: true };
		if (existing.status === "creating")
			throw new ORPCError("CONFLICT", { message: "This payment is still being prepared. Try again in a moment." });
		throw new ORPCError("CONFLICT", { message: "This request was already used. Start again." });
	}

	const { created, owner } = prepared;
	let snap: { token: string; redirectUrl: string };
	try {
		snap = await createSnapTransaction(
			config,
			buildSnapPayload({
				paymentId: created.id,
				planId: created.planId,
				amount: created.amount,
				customer: owner,
				enabledPayments: config.enabledPayments,
				appUrl: env.APP_URL,
				start,
			}),
		);
	} catch (error) {
		const code = error instanceof MidtransError ? error.code : "snap_error";
		console.error("[billing] Creating a Snap payment page failed.", {
			paymentId: created.id,
			error: code,
			...(error instanceof MidtransError && error.detail && { reason: error.detail }),
		});
		await db
			.update(schema.billingPayment)
			.set({ status: "failed", failureReason: code })
			.where(and(eq(schema.billingPayment.id, created.id), eq(schema.billingPayment.status, "creating")));
		// One failure is a hiccup; the alert is emailed from the third in an hour.
		await raiseBillingAlertQuietly({ kind: "midtrans_errors", paymentId: created.id, now });
		throw unavailable();
	}
	// The page exists, so the payment waits for the customer; a status check may have moved it on already.
	await db
		.update(schema.billingPayment)
		.set({
			snapToken: snap.token,
			redirectUrl: snap.redirectUrl,
			status: sql`case when ${schema.billingPayment.status} = 'creating' then 'pending' else ${schema.billingPayment.status} end`,
		})
		.where(eq(schema.billingPayment.id, created.id));
	console.info("[billing] Opened a Snap payment page.", { paymentId: created.id, orderId: created.providerOrderId });
	return { paymentId: created.id, redirectUrl: snap.redirectUrl, expiresAt: windowEnd(start), reused: false };
}

async function ownPayment(userId: string, paymentId: string) {
	const [payment] = await db
		.select()
		.from(schema.billingPayment)
		.where(and(eq(schema.billingPayment.id, paymentId), eq(schema.billingPayment.userId, userId)));
	if (!payment) throw new ORPCError("NOT_FOUND", { message: "No payment of yours has that ID." });
	return payment;
}

/**
 * Pays with another method. Once a method is chosen on a Snap page its order is tied to it, so the old page and
 * transaction are closed (best effort), Midtrans is asked where the old order stands, and a new payment is opened. An
 * old order that turns out to be paid is applied as paid, and no new one is opened.
 */
export async function changePaymentMethod(input: {
	authentication: Authentication;
	paymentId: string;
	now?: Date;
}): Promise<CheckoutResult> {
	await assertCanPurchase(input.authentication);
	const config = getMidtransConfig();
	if (!config) throw BLOCKER_ERRORS.unavailable();
	const now = input.now ?? new Date();
	const payment = await ownPayment(input.authentication.user.id, input.paymentId);
	if (payment.status !== "pending" && payment.status !== "creating")
		throw new ORPCError("CONFLICT", {
			message: payment.status === "paid" ? "This payment is already paid." : "This payment is no longer open.",
		});
	if (payment.snapToken) await cancelSnapSession(config, payment.snapToken).catch(() => false);
	await cancelTransaction(config, payment.providerOrderId).catch(() => null);
	let result;
	try {
		result = await getTransactionStatus(config, payment.providerOrderId);
	} catch {
		throw unavailable();
	}
	const applied = await applyVerifiedStatus({
		paymentId: payment.id,
		verified: result.found ? result : { found: false, status: "cancelled", reason: "method_changed" },
		source: "status_check",
		now,
	});
	if (applied.status === "paid" || applied.status === "partially_refunded")
		throw new ORPCError("CONFLICT", { message: "This payment is already paid." });
	if (applied.status === "pending")
		throw new ORPCError("CONFLICT", { message: "This payment can't be changed right now. Try again in a moment." });
	return checkout({
		authentication: input.authentication,
		planId: payment.planId,
		idempotencyKey: `${payment.id}:method-changed`,
		reuseOpen: false,
		now,
	});
}

/** What buying a pass now would cost and do to the account's paid time, before checkout. */
export type PurchasePreview = {
	planId: PaidPlanId;
	amount: number;
	currency: string;
	durationDays: number;
	credits: number;
	schedule: PlannedStretch[];
};

/**
 * The catalog price and, if the pass were paid now, where it would sit in the account's schedule: the same layout the
 * payment applies once it is verified. Read without the billing lock; it only informs the confirmation.
 */
export async function previewPurchase(userId: string, planId: PaidPlanId, now = new Date()): Promise<PurchasePreview> {
	if (!(await isBillingAppliedTo(userId))) throw BLOCKER_ERRORS.unavailable();
	const plan = PLANS[planId];
	const periods = await db
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
		);
	return {
		planId: plan.id,
		amount: plan.priceIdr,
		currency: BILLING_CURRENCY,
		durationDays: plan.durationDays,
		credits: plan.creditsPerPurchase,
		schedule: previewSchedule(periods, { planId: plan.id, durationMs: plan.durationDays * DAY_MS }, now),
	};
}

/** A payment with the paid time it bought: from its first day to its last, null until it is granted. */
export type PaymentDetail = PaymentView & { access: { startsAt: Date; endsAt: Date } | null };

async function withAccess(view: PaymentView): Promise<PaymentDetail> {
	// A pass pushed back by a higher plan is split in two rows; the receipt shows its whole span, as the email does.
	const [range] = await db
		.select({ startsAt: min(schema.membershipPeriod.startsAt), endsAt: max(schema.membershipPeriod.endsAt) })
		.from(schema.membershipPeriod)
		.where(eq(schema.membershipPeriod.paymentId, view.id));
	return {
		...view,
		access: range?.startsAt && range.endsAt ? { startsAt: range.startsAt, endsAt: range.endsAt } : null,
	};
}

/** One of the account's payments, checked with Midtrans first while it is still open (at most every 10 seconds). */
export async function getPayment(authentication: Authentication, paymentId: string): Promise<PaymentDetail> {
	const payment = await ownPayment(authentication.user.id, paymentId);
	if (payment.status !== "pending" && payment.status !== "creating")
		return withAccess(toPaymentView(payment, authentication));
	await syncPaymentStatus(payment.id);
	return withAccess(toPaymentView(await ownPayment(authentication.user.id, paymentId), authentication));
}

/** The account's payments, newest first. IDs are UUIDv7, so the cursor is the last ID seen. */
export async function listPayments(
	authentication: Authentication,
	page: { cursor?: string | undefined; limit: number },
): Promise<{ items: PaymentView[]; nextCursor: string | null }> {
	const rows = await db
		.select()
		.from(schema.billingPayment)
		.where(
			and(
				eq(schema.billingPayment.userId, authentication.user.id),
				page.cursor ? lt(schema.billingPayment.id, page.cursor) : undefined,
			),
		)
		.orderBy(desc(schema.billingPayment.id))
		.limit(page.limit + 1);
	const items = rows.slice(0, page.limit).map((row) => toPaymentView(row, authentication));
	return { items, nextCursor: rows.length > page.limit ? (items.at(-1)?.id ?? null) : null };
}

/** The account's newest payment that can still be paid, for the web to offer to continue; null for the apps. */
export async function getPendingPayment(authentication: Authentication, now = new Date()): Promise<PaymentView | null> {
	if (authentication.method !== "session") return null;
	const [payment] = await db
		.select()
		.from(schema.billingPayment)
		.where(
			and(
				eq(schema.billingPayment.userId, authentication.user.id),
				eq(schema.billingPayment.status, "pending"),
				isNotNull(schema.billingPayment.redirectUrl),
				gt(schema.billingPayment.expiresAt, now),
			),
		)
		.orderBy(desc(schema.billingPayment.createdAt))
		.limit(1);
	return payment ? toPaymentView(payment, authentication, now) : null;
}
