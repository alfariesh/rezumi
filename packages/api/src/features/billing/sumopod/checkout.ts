import type { CheckoutResult } from "../checkout";
import type { BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { BILLING_CATALOG_VERSION, PASS_DAYS, planPrice } from "@rezumi/schema/billing";
import { generateId } from "@rezumi/utils/string";
import { lockBillingAccount } from "../account";
import { raiseBillingAlertQuietly } from "../alerts";
import { createSumopodPayment, PAYMENT_LINK_HOURS, sumopodErrorCode, sumopodErrorDetail } from "./client";
import { getSumopodConfig } from "./config";
import { orderIdFor, toWholeRupiah } from "./mapping";

/** An open payment link is offered again while at least this much of it is left. */
const REUSE_MIN_REMAINING_MS = 10 * 60 * 1000;

/**
 * Opens a QRIS payment link for a pass: the plan for 30 or 365 days, at its Rupiah price (final, no tax added). The
 * same request key returns the same payment, and an open link for the same plan and length is offered again rather
 * than doubled. Otherwise a `creating` row (catalog copy and all) is committed before Sumopod is called, so a failed or
 * lost call still leaves a record; the link is saved once it exists. The pass is granted when Sumopod says it is paid.
 * The caller checked that this account may pay by QRIS.
 */
export async function openQrisCheckout(input: {
	userId: string;
	planId: PaidPlanId;
	interval: BillingInterval;
	idempotencyKey: string;
	locale?: string | undefined;
	now?: Date;
}): Promise<CheckoutResult> {
	const config = getSumopodConfig();
	if (!config) throw new ORPCError("BILLING_UNAVAILABLE", { status: 403, message: "This isn't available right now." });
	const now = input.now ?? new Date();
	const amount = planPrice(input.planId, input.interval, "idr");

	const prepared = await db.transaction(async (tx) => {
		const account = await lockBillingAccount(tx, input.userId);
		if (input.locale && account.locale !== input.locale)
			await tx
				.update(schema.billingAccount)
				.set({ locale: input.locale })
				.where(eq(schema.billingAccount.userId, input.userId));
		const [same] = await tx
			.select()
			.from(schema.billingPayment)
			.where(
				and(
					eq(schema.billingPayment.userId, input.userId),
					eq(schema.billingPayment.idempotencyKey, input.idempotencyKey),
				),
			);
		if (same) return { existing: same };
		const [open] = await tx
			.select()
			.from(schema.billingPayment)
			.where(
				and(
					eq(schema.billingPayment.userId, input.userId),
					eq(schema.billingPayment.provider, "sumopod"),
					eq(schema.billingPayment.status, "pending"),
					eq(schema.billingPayment.planId, input.planId),
					eq(schema.billingPayment.interval, input.interval),
					eq(schema.billingPayment.amount, amount),
					isNotNull(schema.billingPayment.redirectUrl),
					isNull(schema.billingPayment.providerPaymentId),
					gt(schema.billingPayment.expiresAt, new Date(+now + REUSE_MIN_REMAINING_MS)),
				),
			)
			.orderBy(desc(schema.billingPayment.createdAt))
			.limit(1);
		if (open) return { existing: open };
		const [created] = await tx
			.insert(schema.billingPayment)
			.values({
				id: generateId(),
				userId: input.userId,
				provider: "sumopod",
				idempotencyKey: input.idempotencyKey,
				planId: input.planId,
				interval: input.interval,
				durationDays: PASS_DAYS[input.interval],
				catalogVersion: BILLING_CATALOG_VERSION,
				billingReason: "purchase",
				amount,
				taxAmount: 0,
				totalAmount: amount,
				currency: "idr",
				credits: 0,
				status: "creating",
				channel: "web",
				createdAt: now,
			})
			.returning();
		if (!created) throw new Error("The payment was not saved.");
		return { created };
	});

	if ("existing" in prepared) {
		const { existing } = prepared;
		if (existing.status === "pending" && existing.redirectUrl && existing.expiresAt && existing.expiresAt > now)
			return { paymentId: existing.id, redirectUrl: existing.redirectUrl, expiresAt: existing.expiresAt, reused: true };
		if (existing.status === "creating")
			throw new ORPCError("CONFLICT", { message: "This payment is still being prepared. Try again in a moment." });
		throw new ORPCError("CONFLICT", { message: "This request was already used. Start again." });
	}

	const { created } = prepared;
	// Sumopod takes only https return addresses: a local http server (development) sends none, and the buyer comes back
	// by hand.
	const returns = new URL(env.APP_URL).protocol === "https:";
	let link: Awaited<ReturnType<typeof createSumopodPayment>>;
	try {
		link = await createSumopodPayment(config, {
			orderId: orderIdFor(created.id),
			amount: toWholeRupiah(amount),
			// The payment id in the path, so whatever Sumopod adds to the query can't break the address.
			...(returns && {
				successReturnUrl: new URL(`/dashboard/settings/billing/return/${created.id}`, env.APP_URL).toString(),
				cancelReturnUrl: new URL("/dashboard/settings/billing", env.APP_URL).toString(),
			}),
		});
	} catch (error) {
		const code = sumopodErrorCode("payment.create", error);
		console.error("[billing] Opening a Sumopod QRIS payment failed.", {
			paymentId: created.id,
			error: code,
			...(sumopodErrorDetail(error) && { reason: sumopodErrorDetail(error) }),
		});
		await db
			.update(schema.billingPayment)
			.set({ status: "failed", failureReason: code })
			.where(and(eq(schema.billingPayment.id, created.id), eq(schema.billingPayment.status, "creating")));
		await raiseBillingAlertQuietly({ kind: "provider_errors", paymentId: created.id, now });
		throw new ORPCError("BAD_GATEWAY", { message: "Billing couldn't be reached. Try again in a moment." });
	}
	const redirectUrl = link.payment_link_url ?? "";
	const offered = link.expires_at ? new Date(link.expires_at) : null;
	const expiresAt = offered && !Number.isNaN(+offered) ? offered : new Date(+now + PAYMENT_LINK_HOURS * 60 * 60 * 1000);
	// The link exists, so the payment waits for the customer; a webhook may have moved it on already.
	await db
		.update(schema.billingPayment)
		.set({
			providerCheckoutId: link.payment_id,
			redirectUrl,
			expiresAt,
			providerStatus: link.status.slice(0, 40),
			status: sql`case when ${schema.billingPayment.status} = 'creating' then 'pending' else ${schema.billingPayment.status} end`,
		})
		.where(eq(schema.billingPayment.id, created.id));
	console.info("[billing] Opened a Sumopod QRIS payment.", { paymentId: created.id, sumopodId: link.payment_id });
	return { paymentId: created.id, redirectUrl, expiresAt, reused: false };
}
