import type { EventContext } from "../fulfillment";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { raiseBillingAlertQuietly } from "../alerts";
import { isTransientFailure } from "../webhook";
import { getSumopodConfig } from "./config";
import { applySumopodPayment } from "./fulfillment";
import { safePaymentFields, SUMOPOD_PAYMENT_EVENTS, sumopodWebhookSchema, webhookPayment } from "./mapping";
import { verifySumopodSignature } from "./signature";

/**
 * Sumopod's webhooks: `POST /api/payments/sumopod/webhook`. Public and unauthenticated; the Svix signature over the raw
 * body is the check (the plain `X-Webhook-Token` header isn't used: a signature also proves the body). Sumopod waits 10
 * seconds for a 2xx and marks the delivery failed otherwise (it can be resent from its Webhooks tab), so: a bad
 * signature is 403 and changes nothing; a redelivery is recognized by its `svix-id`; a failure that may pass on a retry
 * is 503; any other failure is recorded, alerted and answered 200 (the billing job and the admin page's "check again"
 * catch up).
 */

const json = (status: number, body: Record<string, unknown>) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Keeps a delivery Rezumi has nothing to do with, or one that failed, so the delivery log and the table agree. */
async function record(
	type: string,
	objectId: string | null,
	context: EventContext,
	outcome: "ignored" | "error",
	payload: Record<string, unknown>,
) {
	await db
		.insert(schema.billingPaymentEvent)
		.values({
			// A failure keeps the delivery id only in its payload: resending it from Sumopod after a fix applies it.
			webhookId: outcome === "error" ? null : (context.webhookId ?? null),
			eventType: type,
			providerObjectId: objectId,
			source: "webhook",
			outcome,
			payload: outcome === "error" ? { ...payload, svix_id: context.webhookId ?? null } : payload,
			receivedAt: context.now ?? new Date(),
		})
		.onConflictDoNothing({ target: schema.billingPaymentEvent.webhookId });
}

export async function handleSumopodWebhook(request: Request): Promise<Response> {
	const config = getSumopodConfig();
	if (!config?.webhookSecret) return json(404, { error: "Not found" });
	const body = await request.text();
	const headers = {
		id: request.headers.get("svix-id") ?? "",
		timestamp: request.headers.get("svix-timestamp") ?? "",
		signature: request.headers.get("svix-signature") ?? "",
	};
	const valid = await verifySumopodSignature({ secret: config.webhookSecret, ...headers, body });
	if (!valid) {
		// Counted only when it looks like a delivery (a secret out of step), not for any stray request.
		if (headers.id && headers.timestamp && headers.signature)
			await raiseBillingAlertQuietly({ kind: "rejected_signatures" });
		return json(403, { error: "Invalid signature" });
	}
	let event: { event_type: string; data: unknown };
	try {
		const parsed = sumopodWebhookSchema.safeParse(JSON.parse(body));
		if (!parsed.success) return json(400, { error: "Invalid payload" });
		event = parsed.data;
	} catch {
		return json(400, { error: "Invalid payload" });
	}

	const context: EventContext = {
		source: "webhook",
		eventType: event.event_type,
		webhookId: headers.id,
		now: new Date(),
	};
	const payment = webhookPayment(event.data);
	try {
		if (!(SUMOPOD_PAYMENT_EVENTS as readonly string[]).includes(event.event_type) || !payment) {
			// payment.test from Sumopod's settings page, or an event Rezumi doesn't use: kept, nothing changes.
			await record(event.event_type, payment?.payment_id ?? null, context, "ignored", {});
			return json(200, { received: true, outcome: "ignored" });
		}
		const result = await applySumopodPayment(payment, context);
		return json(200, { received: true, outcome: result.outcome });
	} catch (error) {
		console.error("[billing] A Sumopod webhook couldn't be applied.", {
			type: event.event_type,
			webhookId: headers.id,
			error: error instanceof Error ? error.name : "error",
		});
		if (isTransientFailure(error)) return json(503, { error: "Try again later" });
		try {
			await record(event.event_type, payment?.payment_id ?? null, context, "error", safePaymentFields(payment ?? {}));
		} catch {
			// The database can't take even the record: it is unavailable, so Sumopod should try again.
			return json(503, { error: "Try again later" });
		}
		await raiseBillingAlertQuietly({ kind: "needs_review" });
		return json(200, { received: true, handled: false });
	}
}
