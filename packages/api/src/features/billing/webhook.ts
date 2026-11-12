import type { DodoApi } from "./dodo/client";
import type { DodoPaymentLike } from "./dodo/mapping";
import type { AppliedChange, EventContext, PaymentRead } from "./fulfillment";
import type DodoPayments from "dodopayments";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { raiseBillingAlertQuietly } from "./alerts";
import { dodoApi, dodoErrorCode, dodoStatus, isTransientDodoError } from "./dodo/client";
import { getDodoConfig } from "./dodo/config";
import { applyDodoDispute, applyDodoPayment, applyDodoRefund, applyDodoSubscription } from "./fulfillment";

/**
 * Dodo Payments' webhooks: `POST /api/payments/dodo/webhook`. Public and unauthenticated; the Standard Webhooks
 * signature over the raw body is the check. Dodo waits 30 seconds, retries a failed delivery eight times over about a
 * day, and doesn't keep events in order. So: a bad signature is 403 and changes nothing; a redelivery is recognized by
 * its `webhook-id`; subscriptions (and the one a payment charges) are read again from Dodo before they are applied, so
 * the newest state wins whatever order events come in; a failure that may pass on a retry (the database or Dodo
 * briefly unavailable) is 503; any other failure is recorded, alerted and answered 200, so one event that can't be
 * applied doesn't keep failing (the billing job and the admin page's "check again" catch up).
 */

const json = (status: number, body: Record<string, unknown>) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Postgres error codes (and their classes) that mean "try again": serialization, deadlocks, timeouts, connections. */
const TRANSIENT_PG_CODES = new Set(["40001", "40P01", "55P03", "57014", "53300", "57P01", "57P02", "57P03"]);
const TRANSIENT_NODE_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN"]);

/** Whether a failure may go away on its own: Dodo or the database briefly unavailable, a lock or a timeout. */
export function isTransientFailure(error: unknown): boolean {
	for (let current = error, depth = 0; current && depth < 5; depth++) {
		if (isTransientDodoError(current)) return true;
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

/** The subscription a payment charges, read from Dodo now (none for a one-time payment). */
export async function readPayment(
	api: DodoApi,
	payment: Pick<DodoPaymentLike, "subscription_id">,
): Promise<PaymentRead> {
	const observedAt = new Date();
	const subscription = payment.subscription_id ? await api.subscriptions.retrieve(payment.subscription_id) : null;
	return { subscription, observedAt };
}

/** Reads a payment from Dodo and applies it: what a refund or dispute arriving before its payment needs. */
async function applyPaymentById(api: DodoApi, paymentId: string, context: EventContext) {
	const payment = await api.payments.retrieve(paymentId);
	await applyDodoPayment(
		payment,
		{ ...context, source: "status_check", eventType: "status_check", webhookId: null },
		await readPayment(api, payment),
	);
}

/** Cancels at Dodo the subscription of a payment whose dispute was lost, then keeps its new state. */
async function endDisputedSubscription(api: DodoApi, subscriptionId: string, context: EventContext) {
	try {
		const observedAt = new Date();
		const cancelled = await api.subscriptions.update(subscriptionId, {
			status: "cancelled",
			cancel_reason: "cancelled_by_merchant",
		});
		await applyDodoSubscription(
			cancelled,
			{ ...context, source: "status_check", eventType: "subscription.cancel", webhookId: null },
			observedAt,
		);
	} catch (error) {
		console.warn("[billing] Ending a disputed payment's subscription failed.", {
			error: dodoErrorCode("subscription.cancel", error),
		});
		await raiseBillingAlertQuietly({ kind: "needs_review" });
	}
}

/** Applies one verified event. */
async function applyEvent(
	api: DodoApi,
	event: DodoPayments.UnwrapWebhookEvent,
	context: EventContext,
): Promise<Pick<AppliedChange, "outcome">> {
	switch (event.type) {
		case "payment.succeeded":
		case "payment.failed":
		case "payment.processing":
		case "payment.cancelled":
			return applyDodoPayment(event.data, context, await readPayment(api, event.data));
		case "subscription.active":
		case "subscription.updated":
		case "subscription.renewed":
		case "subscription.plan_changed":
		case "subscription.past_due":
		case "subscription.on_hold":
		case "subscription.paused":
		case "subscription.unpaused":
		case "subscription.cancelled":
		case "subscription.failed":
		case "subscription.expired": {
			// The event's copy may be older than one applied already: read where it stands now.
			const observedAt = new Date();
			const current = await api.subscriptions.retrieve(event.data.subscription_id);
			return applyDodoSubscription(current, context, observedAt);
		}
		case "refund.succeeded":
		case "refund.failed": {
			const applied = await applyDodoRefund(event.data, context);
			if (applied) return applied;
			// The refund's payment hasn't reached Rezumi yet (events come in any order): apply it, then the refund.
			await applyPaymentById(api, event.data.payment_id, context);
			return (await applyDodoRefund(event.data, context)) ?? record(event, context, "ignored");
		}
		case "dispute.opened":
		case "dispute.challenged":
		case "dispute.won":
		case "dispute.lost":
		case "dispute.accepted":
		case "dispute.cancelled":
		case "dispute.expired": {
			let applied = await applyDodoDispute(event.data, context);
			if (!applied) {
				await applyPaymentById(api, event.data.payment_id, context);
				applied = await applyDodoDispute(event.data, context);
			}
			if (!applied) return record(event, context, "ignored");
			if (applied.endSubscription) await endDisputedSubscription(api, applied.endSubscription, context);
			return applied;
		}
		default:
			return record(event, context, "ignored");
	}
}

/** The id of the object an event is about, for the event log. */
function objectIdOf(event: { data: unknown }): string | null {
	const data = event.data as Record<string, unknown> | null;
	for (const key of ["payment_id", "subscription_id", "refund_id", "dispute_id", "id"]) {
		const value = data?.[key];
		if (typeof value === "string") return value;
	}
	return null;
}

/**
 * Keeps an event Rezumi has nothing to do with, so the delivery log and the table agree. A failure keeps the webhook id
 * only in its payload: the id stays free, so resending the event from Dodo's dashboard after a fix applies it.
 */
async function record(
	event: { type: string; data: unknown },
	context: EventContext,
	outcome: "ignored" | "error",
): Promise<Pick<AppliedChange, "outcome">> {
	await db
		.insert(schema.billingPaymentEvent)
		.values({
			webhookId: outcome === "error" ? null : (context.webhookId ?? null),
			eventType: event.type,
			providerObjectId: objectIdOf(event),
			source: "webhook",
			outcome,
			payload: outcome === "error" ? { webhook_id: context.webhookId ?? null } : {},
			receivedAt: context.now ?? new Date(),
		})
		.onConflictDoNothing({ target: schema.billingPaymentEvent.webhookId });
	return { outcome };
}

export async function handleDodoWebhook(request: Request): Promise<Response> {
	const config = getDodoConfig();
	if (!config?.webhookKey) return json(404, { error: "Not found" });
	const body = await request.text();
	const headers = {
		"webhook-id": request.headers.get("webhook-id") ?? "",
		"webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
		"webhook-signature": request.headers.get("webhook-signature") ?? "",
	};
	const api = dodoApi(config);
	let event: DodoPayments.UnwrapWebhookEvent;
	try {
		event = api.webhooks.unwrap(body, { headers, key: config.webhookKey });
	} catch (error) {
		// The signature checked out, but the body isn't JSON.
		if (error instanceof SyntaxError) return json(400, { error: "Invalid payload" });
		// Counted only when it looks like a delivery (a secret out of step), not for any stray request.
		if (headers["webhook-id"] && headers["webhook-timestamp"] && headers["webhook-signature"])
			await raiseBillingAlertQuietly({ kind: "rejected_signatures" });
		return json(403, { error: "Invalid signature" });
	}
	if (!event || typeof event !== "object" || typeof event.type !== "string" || !event.data)
		return json(400, { error: "Invalid payload" });

	const webhookId = headers["webhook-id"] || null;
	const context: EventContext = { source: "webhook", eventType: event.type, webhookId, now: new Date() };
	try {
		const result = await applyEvent(api, event, context);
		return json(200, { received: true, outcome: result.outcome });
	} catch (error) {
		console.error("[billing] A Dodo Payments webhook couldn't be applied.", {
			type: event.type,
			webhookId,
			error: error instanceof Error ? error.name : "error",
			dodoStatus: dodoStatus(error),
		});
		if (isTransientFailure(error)) return json(503, { error: "Try again later" });
		try {
			await record(event, context, "error");
		} catch {
			// The database can't take even the record: it is unavailable, so Dodo should try again.
			return json(503, { error: "Try again later" });
		}
		await raiseBillingAlertQuietly({ kind: "needs_review" });
		return json(200, { received: true, handled: false });
	}
}
