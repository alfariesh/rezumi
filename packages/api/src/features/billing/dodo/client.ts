import type { DodoConfig } from "./config";
import DodoPayments, { APIConnectionError, APIError, InternalServerError, RateLimitError } from "dodopayments";

/**
 * Dodo Payments' API through its official SDK, which runs on `fetch` (Workers and Node alike). Requests time out after
 * 8 seconds and are retried once: Dodo waits 30 seconds for a webhook reply, and a webhook may make a call or two.
 */

export type DodoApi = DodoPayments;

const TIMEOUT_MS = 8_000;

const clients = new Map<string, DodoApi>();

/** One client per key and mode, made on first use. */
export function dodoApi(config: DodoConfig): DodoApi {
	const key = `${config.environment}:${config.apiKey}`;
	let client = clients.get(key);
	if (!client) {
		client = new DodoPayments({
			bearerToken: config.apiKey,
			environment: config.environment,
			webhookKey: config.webhookKey,
			timeout: TIMEOUT_MS,
			maxRetries: 1,
		});
		clients.set(key, client);
	}
	return client;
}

/** What a Dodo call is, for error codes and logs. */
export type DodoOperation =
	| "checkout.create"
	| "checkout.get"
	| "customer.create"
	| "customer_portal.create"
	| "payment.get"
	| "payment.list"
	| "payment.invoice"
	| "subscription.get"
	| "subscription.update"
	| "subscription.change_plan"
	| "subscription.cancel"
	| "refund.create"
	| "refund.get";

/** The HTTP status Dodo answered with, when it answered. */
export function dodoStatus(error: unknown): number | undefined {
	return error instanceof APIError && !(error instanceof APIConnectionError) ? error.status : undefined;
}

/**
 * Whether trying the same Dodo call again later may work: no answer (a timeout is a connection error), a rate limit,
 * or a server error.
 */
export function isTransientDodoError(error: unknown): boolean {
	return error instanceof APIConnectionError || error instanceof RateLimitError || error instanceof InternalServerError;
}

/** A short code that is safe to store and log, e.g. `checkout_create_http_422` or `payment_get_network`. */
export function dodoErrorCode(operation: DodoOperation, error: unknown): string {
	const name = operation.replace(".", "_");
	const status = dodoStatus(error);
	if (status) return `${name}_http_${status}`;
	return error instanceof APIConnectionError ? `${name}_network` : `${name}_error`;
}

/**
 * Dodo's reason for refusing a request, for logs and admins: the message of a 4xx body, with anything shaped like an
 * email address taken out. Never the request.
 */
export function dodoErrorDetail(error: unknown): string | undefined {
	const status = dodoStatus(error);
	if (!status || status >= 500 || !(error instanceof APIError)) return undefined;
	const body: unknown = error.error;
	const message =
		typeof body === "string"
			? body
			: body && typeof body === "object" && "message" in body
				? String((body as { message: unknown }).message)
				: undefined;
	return message?.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]").slice(0, 500);
}
