import type { EventContext } from "./fulfillment";
import { webhooks } from "@polar-sh/sdk/2026-10";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { raiseBillingAlertQuietly } from "./alerts";
import { applyPolarCheckout, applyPolarOrder, applyPolarRefund, applyPolarSubscription } from "./fulfillment";
import { isTransientPolarError, polarApi, polarStatus } from "./polar/client";
import { getPolarConfig } from "./polar/config";

/**
 * Polar's webhooks: `POST /api/payments/polar/webhook`. Public and unauthenticated; the Standard Webhooks signature
 * over the raw body is the check. Polar waits 10 seconds, retries a failed delivery about ten times, doesn't keep
 * events in order, and disables an endpoint after ten failures in a row. So: a bad signature is 403 and changes
 * nothing; an event type the SDK doesn't know yet is 202; a redelivery is recognized by its `webhook-id`; a failure
 * that may pass on a retry (the database or Polar briefly unavailable) is 503; any other failure is recorded, alerted
 * and answered 200, so one event that can't be applied doesn't get the endpoint disabled (the billing job and the
 * admin page's "check again" catch up).
 */

const json = (status: number, body: Record<string, unknown>) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Postgres error codes (and their classes) that mean "try again": serialization, deadlocks, timeouts, connections. */
const TRANSIENT_PG_CODES = new Set(["40001", "40P01", "55P03", "57014", "53300", "57P01", "57P02", "57P03"]);
const TRANSIENT_NODE_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN"]);

/** Whether a failure may go away on its own: Polar or the database briefly unavailable, a lock or a timeout. */
export function isTransientFailure(error: unknown): boolean {
	for (let current = error, depth = 0; current && depth < 5; depth++) {
		if (isTransientPolarError(current)) return true;
		const code = (current as { code?: unknown }).code;
		if (
			typeof code === "string" &&
			(TRANSIENT_PG_CODES.has(code) || code.startsWith("08") || TRANSIENT_NODE_CODES.has(code))
		)
			return true;
		current = (current as { cause?: unknown }).cause;
	}
	return false;
}

/** Applies one verified event. Refunds for an order not seen yet fetch the order first. */
async function applyEvent(event: webhooks.WebhookPayload, context: EventContext) {
	switch (event.type) {
		case "order.created":
		case "order.updated":
		case "order.paid":
		case "order.refunded":
			return applyPolarOrder(event.data, context);
		case "subscription.created":
		case "subscription.updated":
		case "subscription.active":
		case "subscription.canceled":
		case "subscription.uncanceled":
		case "subscription.cycled":
		case "subscription.revoked":
		case "subscription.past_due":
		case "subscription.paused":
		case "subscription.resumed":
		case "subscription.migrated":
			return applyPolarSubscription(event.data, context);
		case "checkout.created":
		case "checkout.updated":
		case "checkout.expired":
			return applyPolarCheckout(event.data, context);
		case "refund.created":
		case "refund.updated": {
			const applied = await applyPolarRefund(event.data, context);
			if (applied) return applied;
			const config = getPolarConfig();
			if (!config) throw new Error("Polar isn't set up on this server.");
			// The refund's order hasn't reached Rezumi yet (events come in any order): fetch and apply it, then the refund.
			const order = await polarApi(config).orders.get(event.data.order_id);
			await applyPolarOrder(order, { source: "status_check", eventType: "refund.order", now: context.now });
			return (await applyPolarRefund(event.data, context)) ?? record(event, context, "ignored");
		}
		default:
			return record(event, context, "ignored");
	}
}

/**
 * Keeps an event Rezumi has nothing to do with, so the delivery log and the table agree. A failure keeps the webhook id
 * only in its payload: the id stays free, so redelivering the event from Polar's dashboard after a fix applies it.
 */
async function record(event: webhooks.WebhookPayload, context: EventContext, outcome: "ignored" | "error") {
	const data = event.data as { id?: unknown };
	await db
		.insert(schema.billingPaymentEvent)
		.values({
			webhookId: outcome === "error" ? null : (context.webhookId ?? null),
			eventType: event.type,
			providerObjectId: typeof data.id === "string" ? data.id : null,
			source: "webhook",
			outcome,
			payload: outcome === "error" ? { webhook_id: context.webhookId ?? null } : {},
			receivedAt: context.now ?? new Date(),
		})
		.onConflictDoNothing({ target: schema.billingPaymentEvent.webhookId });
	return { outcome };
}

export async function handlePolarWebhook(request: Request): Promise<Response> {
	const config = getPolarConfig();
	if (!config?.webhookSecret) return json(404, { error: "Not found" });
	const body = await request.text();
	const headers = Object.fromEntries(request.headers.entries());
	let event: webhooks.WebhookPayload;
	try {
		event = await webhooks.validateEvent(body, headers, config.webhookSecret);
	} catch (error) {
		if (error instanceof webhooks.PolarWebhookUnknownTypeError) return json(202, { received: true, handled: false });
		if (error instanceof webhooks.PolarWebhookVerificationError) {
			// Counted only when it looks like a delivery (a secret out of step), not for any stray request.
			if (headers["webhook-id"] && headers["webhook-timestamp"] && headers["webhook-signature"])
				await raiseBillingAlertQuietly({ kind: "rejected_signatures" });
			return json(403, { error: "Invalid signature" });
		}
		return json(400, { error: "Invalid payload" });
	}

	const webhookId = headers["webhook-id"] ?? null;
	const context: EventContext = { source: "webhook", eventType: event.type, webhookId, now: new Date() };
	try {
		const result = await applyEvent(event, context);
		return json(200, { received: true, outcome: result.outcome });
	} catch (error) {
		console.error("[billing] A Polar webhook couldn't be applied.", {
			type: event.type,
			webhookId,
			error: error instanceof Error ? error.name : "error",
			polarStatus: polarStatus(error),
		});
		if (isTransientFailure(error)) return json(503, { error: "Try again later" });
		try {
			await record(event, context, "error");
		} catch {
			// The database can't take even the record: it is unavailable, so Polar should try again.
			return json(503, { error: "Try again later" });
		}
		await raiseBillingAlertQuietly({ kind: "needs_review" });
		return json(200, { received: true, handled: false });
	}
}
