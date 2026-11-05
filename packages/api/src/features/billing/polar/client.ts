import type { PolarConfig } from "./config";
import { PolarClientError, PolarError, PolarNetworkError, PolarRateLimitError, PolarServerError } from "@polar-sh/sdk";
import { createPolar } from "@polar-sh/sdk/2026-10";

/**
 * Polar's API, pinned to version 2026-10 (2027-01 is still "next" and may change until 1 January 2027). The SDK runs on
 * `fetch` with no dependencies, on Workers and Node alike. Requests time out after 10 seconds; webhook replies must
 * come within 10, so nothing here is called while a webhook waits.
 */

export type PolarApi = ReturnType<typeof createPolar>;

const TIMEOUT_SECONDS = 10;

const clients = new Map<string, PolarApi>();

/** One client per token and environment, made on first use. */
export function polarApi(config: PolarConfig): PolarApi {
	const key = `${config.environment}:${config.accessToken}`;
	let client = clients.get(key);
	if (!client) {
		client = createPolar({
			accessToken: config.accessToken,
			environment: config.environment,
			timeout: TIMEOUT_SECONDS,
		});
		clients.set(key, client);
	}
	return client;
}

/** What a Polar call is, for error codes and logs. */
export type PolarOperation =
	| "checkout.create"
	| "checkout.get"
	| "order.get"
	| "order.list"
	| "order.invoice"
	| "subscription.get"
	| "subscription.update"
	| "subscription.revoke"
	| "customer.delete"
	| "customer_session.create"
	| "refund.create"
	| "refund.list";

/** The HTTP status Polar answered with, when it answered. */
export function polarStatus(error: unknown): number | undefined {
	if (error instanceof PolarRateLimitError) return 429;
	if (error instanceof PolarClientError || error instanceof PolarServerError) return error.statusCode;
	return undefined;
}

/**
 * Whether trying the same Polar call again later may work: no answer (a timeout surfaces as a network error), a rate
 * limit, or a server error.
 */
export function isTransientPolarError(error: unknown): boolean {
	return (
		error instanceof PolarNetworkError || error instanceof PolarRateLimitError || error instanceof PolarServerError
	);
}

/** A short code that is safe to store and log, e.g. `checkout_create_http_422` or `order_get_network`. */
export function polarErrorCode(operation: PolarOperation, error: unknown): string {
	const name = operation.replace(".", "_");
	const status = polarStatus(error);
	if (status) return `${name}_http_${status}`;
	return error instanceof PolarError ? `${name}_network` : `${name}_error`;
}

/**
 * Polar's validation messages, for logs and admins: the `detail` strings of a 4xx body, with anything shaped like an
 * email address taken out. Never the request.
 */
export function polarErrorDetail(error: unknown): string | undefined {
	if (!(error instanceof PolarClientError)) return undefined;
	const body: unknown = error.error;
	const detail =
		typeof body === "string"
			? body
			: body && typeof body === "object" && "detail" in body
				? JSON.stringify((body as { detail: unknown }).detail)
				: undefined;
	return detail?.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]").slice(0, 500);
}
