import type { BillingPaymentEventOutcome } from "@rezumi/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { applyVerifiedStatus } from "./fulfillment";
import { MidtransError, getTransactionStatus } from "./midtrans/client";
import { getMidtransConfig } from "./midtrans/config";
import { verifyNotificationSignature } from "./midtrans/signature";
import { safeProviderFields } from "./midtrans/status";

/**
 * `POST /api/payments/midtrans/notification`: Midtrans' HTTP notification. The answer tells Midtrans whether to send
 * it again: 200 once it is handled (or isn't Rezumi's), 403 for a bad signature, 503 for a passing failure (Midtrans
 * retries a 503 four times, a 500 only once). It runs whatever BILLING_MODE says, so a payment is never lost.
 */

const headers = { "Cache-Control": "no-store" };
const reply = (status: number, body?: Record<string, unknown>) =>
	body ? Response.json(body, { status, headers }) : new Response(null, { status, headers });

const text = (value: unknown) => (typeof value === "string" ? value : null);

async function findPayment(orderId: string) {
	const [payment] = await db
		.select({ id: schema.billingPayment.id })
		.from(schema.billingPayment)
		.where(eq(schema.billingPayment.providerOrderId, orderId));
	return payment ?? null;
}

function recordEvent(input: {
	paymentId: string | null;
	orderId: string;
	payload: Record<string, unknown>;
	signatureValid: boolean;
	outcome: BillingPaymentEventOutcome;
}) {
	return db.insert(schema.billingPaymentEvent).values({
		paymentId: input.paymentId,
		providerOrderId: input.orderId.slice(0, 100),
		source: "notification",
		transactionStatus: text(input.payload.transaction_status),
		statusCode: text(input.payload.status_code),
		fraudStatus: text(input.payload.fraud_status),
		grossAmount: text(input.payload.gross_amount),
		signatureValid: input.signatureValid,
		outcome: input.outcome,
		payload: safeProviderFields(input.payload),
	});
}

/**
 * Verifies the signature, finds the payment, asks Midtrans for the real status (outside any transaction) and applies
 * that, never the notification's own fields. The test notification from the dashboard and other merchants' orders on
 * the same account are acknowledged and recorded without touching anything.
 */
export async function handleMidtransNotification(request: Request): Promise<Response> {
	const config = getMidtransConfig();
	if (!config) return reply(404);
	const started = Date.now();
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return reply(400, { error: "invalid_json" });
	}
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) return reply(400, { error: "invalid_body" });
	const fields = payload as Record<string, unknown>;
	const orderId = text(fields.order_id);
	if (!orderId) return reply(400, { error: "missing_order_id" });

	try {
		if (!verifyNotificationSignature(fields, config.signatureKeys)) {
			// Kept only for one of Rezumi's orders: anyone can post here, and noise shouldn't fill the table.
			const payment = await findPayment(orderId);
			if (payment)
				await recordEvent({
					paymentId: payment.id,
					orderId,
					payload: fields,
					signatureValid: false,
					outcome: "rejected_signature",
				});
			console.warn("[billing] Rejected a Midtrans notification with a bad signature.", {
				...(payment && { paymentId: payment.id, orderId }),
			});
			return reply(403);
		}
		const payment = await findPayment(orderId);
		if (!payment) {
			await recordEvent({ paymentId: null, orderId, payload: fields, signatureValid: true, outcome: "unknown_order" });
			console.info("[billing] Acknowledged a Midtrans notification for an order that isn't Rezumi's.");
			return reply(200, { received: true });
		}
		const result = await getTransactionStatus(config, orderId);
		if (!result.found) {
			// Midtrans just told us about it: the status will be there on a retry.
			console.warn("[billing] Midtrans has no status yet for a notified order; asking it to retry.", {
				paymentId: payment.id,
				orderId,
			});
			return reply(503);
		}
		const applied = await applyVerifiedStatus({
			paymentId: payment.id,
			verified: result,
			source: "notification",
			notification: { transactionStatus: text(fields.transaction_status) },
		});
		console.info("[billing] Handled a Midtrans notification.", {
			paymentId: payment.id,
			orderId,
			status: applied.status,
			outcome: applied.outcome,
			ms: Date.now() - started,
		});
		return reply(200, { received: true });
	} catch (error) {
		console.error("[billing] Handling a Midtrans notification failed; Midtrans sends it again.", {
			orderId: orderId.slice(0, 100),
			error: error instanceof MidtransError ? error.code : "error",
		});
		return reply(503);
	}
}
