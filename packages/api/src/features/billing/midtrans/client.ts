import type { MidtransConfig } from "./config";
import type { SnapTransactionPayload } from "./payload";
import { safeProviderFields } from "./status";

/**
 * A thin Midtrans client on `fetch`: Basic auth with the server key, JSON, a timeout, and typed errors. No logging
 * here, and errors never carry headers, request bodies, tokens or redirect URLs. `midtrans-client` isn't used: it
 * pulls in axios and Node-only modules and has never run on Workers.
 */

const TIMEOUT_MS = 10_000;
const USER_AGENT = "Rezumi-Billing/1.0";

export type MidtransOperation = "snap.create" | "snap.cancel" | "status" | "cancel" | "expire" | "refund";

/** network and timeout never got an answer; client is a 4xx (a wrong key, a bad request), server a 5xx. */
export type MidtransErrorKind = "network" | "timeout" | "client" | "server" | "invalid_response";

export class MidtransError extends Error {
	readonly kind: MidtransErrorKind;
	readonly operation: MidtransOperation;
	readonly httpStatus: number | undefined;
	/** Midtrans' own `status_code` from the body, when it sent one. */
	readonly statusCode: string | undefined;
	/** Midtrans' reason, for logs: its error messages with anything shaped like an email address taken out. */
	readonly detail: string | undefined;

	constructor(input: {
		kind: MidtransErrorKind;
		operation: MidtransOperation;
		httpStatus?: number | undefined;
		statusCode?: string | undefined;
		detail?: string | undefined;
	}) {
		super(`Midtrans ${input.operation} failed: ${input.kind}${input.httpStatus ? ` (HTTP ${input.httpStatus})` : ""}.`);
		this.name = "MidtransError";
		this.kind = input.kind;
		this.operation = input.operation;
		this.httpStatus = input.httpStatus;
		this.statusCode = input.statusCode;
		this.detail = input.detail;
	}

	/** Whether trying again later may work. */
	get transient() {
		return this.kind === "network" || this.kind === "timeout" || this.kind === "server";
	}

	/** A short code that is safe to store and log, e.g. `snap_http_400`. */
	get code() {
		const operation = this.operation.replace(".", "_");
		return this.httpStatus ? `${operation}_http_${this.httpStatus}` : `${operation}_${this.kind}`;
	}
}

/** A transaction as Midtrans reports it, its values kept as the strings they came as. */
export type MidtransTransactionStatus = {
	orderId: string;
	transactionStatus: string;
	statusCode: string;
	fraudStatus: string | null;
	grossAmount: string | null;
	paymentType: string | null;
	transactionId: string | null;
	/** Refunded so far, in total. */
	refundAmount: string | null;
	/** Each refund Midtrans knows about, from the API or its dashboard. */
	refunds: MidtransRefund[];
	/** The allowlisted fields, safe to store. */
	fields: Record<string, string>;
};

export type MidtransStatusResult = { found: false } | { found: true; status: MidtransTransactionStatus };

/** One refund in a status: its key (ours, RF-…, or one Midtrans made for a dashboard refund) and amount string. */
export type MidtransRefund = { refundKey: string; amount: string; reason: string | null };

/** What a cancel or expire did: done, nothing to act on yet (no method chosen), or not allowed in its state. */
export type MidtransActionResult = "done" | "not_found" | "not_allowed";

const authorization = (serverKey: string) => `Basic ${btoa(`${serverKey}:`)}`;

const text = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" ? String(value) : null);

async function call(
	config: MidtransConfig,
	operation: MidtransOperation,
	url: string,
	init: { method: "GET" | "POST"; body?: string },
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
	let response: Response;
	try {
		response = await fetch(url, {
			method: init.method,
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				Authorization: authorization(config.serverKey),
				"User-Agent": USER_AGENT,
			},
			...(init.body === undefined ? {} : { body: init.body }),
			redirect: "manual",
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch (error) {
		const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
		throw new MidtransError({ kind: timedOut ? "timeout" : "network", operation });
	}
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new MidtransError({
			kind: response.status >= 500 ? "server" : "invalid_response",
			operation,
			httpStatus: response.status,
		});
	}
	if (!body || typeof body !== "object" || Array.isArray(body))
		throw new MidtransError({ kind: "invalid_response", operation, httpStatus: response.status });
	return { httpStatus: response.status, body: body as Record<string, unknown> };
}

/** Midtrans' error messages, short and without email addresses, safe to log. */
function reasonOf(body: Record<string, unknown>) {
	const messages = Array.isArray(body.error_messages) ? body.error_messages : [body.status_message];
	const reason = messages
		.filter((message): message is string => typeof message === "string")
		.join("; ")
		.replaceAll(/\S+@\S+/g, "[email]")
		.slice(0, 300);
	return reason || undefined;
}

const httpError = (
	operation: MidtransOperation,
	httpStatus: number,
	body: Record<string, unknown>,
	statusCode?: string | null,
) =>
	new MidtransError({
		kind: httpStatus >= 500 ? "server" : httpStatus >= 400 ? "client" : "invalid_response",
		operation,
		httpStatus,
		statusCode: statusCode ?? undefined,
		detail: reasonOf(body),
	});

/** Creates a Snap payment page. Its token and redirect URL are opaque; keep them out of logs. */
export async function createSnapTransaction(
	config: MidtransConfig,
	payload: SnapTransactionPayload,
): Promise<{ token: string; redirectUrl: string }> {
	const { httpStatus, body } = await call(config, "snap.create", `${config.snapBaseUrl}/snap/v1/transactions`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
	const token = text(body.token);
	const redirectUrl = text(body.redirect_url);
	if (httpStatus >= 200 && httpStatus < 300 && token && redirectUrl?.startsWith("https://"))
		return { token, redirectUrl };
	throw httpError("snap.create", httpStatus >= 300 ? httpStatus : 502, body);
}

/** Closes a Snap page nobody has chosen a method on yet. Best effort: false when it couldn't. */
export async function cancelSnapSession(config: MidtransConfig, token: string): Promise<boolean> {
	const { httpStatus } = await call(
		config,
		"snap.cancel",
		`${config.snapBaseUrl}/snap/v1/transactions/${encodeURIComponent(token)}/cancel`,
		{ method: "POST" },
	);
	return httpStatus >= 200 && httpStatus < 300;
}

/** The refunds listed in a status or refund answer; entries without a key or amount are left out. */
function refundsOf(body: Record<string, unknown>): MidtransRefund[] {
	if (!Array.isArray(body.refunds)) return [];
	return body.refunds.flatMap((entry: unknown) => {
		if (!entry || typeof entry !== "object") return [];
		const refund = entry as Record<string, unknown>;
		const refundKey = text(refund.refund_key);
		const amount = text(refund.refund_amount);
		if (!refundKey || !amount) return [];
		return [{ refundKey: refundKey.slice(0, 100), amount, reason: text(refund.reason)?.slice(0, 255) ?? null }];
	});
}

/** A status-shaped answer (Get Status, or a refund's reply) for the order it must belong to. */
function transactionOf(orderId: string, body: Record<string, unknown>, transactionStatus: string, statusCode: string) {
	return {
		orderId,
		transactionStatus,
		statusCode,
		fraudStatus: text(body.fraud_status),
		grossAmount: text(body.gross_amount),
		paymentType: text(body.payment_type),
		transactionId: text(body.transaction_id),
		refundAmount: text(body.refund_amount),
		refunds: refundsOf(body),
		fields: safeProviderFields(body),
	} satisfies MidtransTransactionStatus;
}

/**
 * The transaction behind an order. A Snap order has none until the customer chooses a method, so "not found" is an
 * answer, not an error: Midtrans says it with `status_code` 404 in the body (the HTTP status isn't documented).
 */
export async function getTransactionStatus(config: MidtransConfig, orderId: string): Promise<MidtransStatusResult> {
	const { httpStatus, body } = await call(
		config,
		"status",
		`${config.coreBaseUrl}/v2/${encodeURIComponent(orderId)}/status`,
		{ method: "GET" },
	);
	const statusCode = text(body.status_code);
	if (httpStatus === 404 || statusCode === "404") return { found: false };
	const transactionStatus = text(body.transaction_status);
	if (httpStatus !== 200 || !transactionStatus || !statusCode) throw httpError("status", httpStatus, body, statusCode);
	if (text(body.order_id) !== orderId) throw new MidtransError({ kind: "invalid_response", operation: "status" });
	return { found: true, status: transactionOf(orderId, body, transactionStatus, statusCode) };
}

async function act(
	config: MidtransConfig,
	operation: "cancel" | "expire",
	orderId: string,
): Promise<MidtransActionResult> {
	const { httpStatus, body } = await call(
		config,
		operation,
		`${config.coreBaseUrl}/v2/${encodeURIComponent(orderId)}/${operation}`,
		{ method: "POST" },
	);
	const statusCode = text(body.status_code);
	if (httpStatus === 404 || statusCode === "404") return "not_found";
	if (statusCode === "412") return "not_allowed";
	if (httpStatus === 200 && (statusCode === "200" || statusCode === "407")) return "done";
	throw httpError(operation, httpStatus, body, statusCode);
}

/** Cancels a transaction that isn't settled yet. Settled ones answer `not_allowed`. */
export function cancelTransaction(config: MidtransConfig, orderId: string) {
	return act(config, "cancel", orderId);
}

/** Ends a pending transaction's payment window now. */
export function expireTransaction(config: MidtransConfig, orderId: string) {
	return act(config, "expire", orderId);
}

/**
 * What Midtrans said to a refund: `confirmed` with the transaction after it (`200`), or accepted while the bank still
 * processes it (`201`, card refunds mostly), which only a later status shows the end of.
 */
export type MidtransRefundAnswer = { confirmed: true; status: MidtransTransactionStatus } | { confirmed: false };

/**
 * Refunds a settled transaction (`POST /v2/{order_id}/refund`, the one endpoint Midtrans now asks for every method).
 * The refund key makes it idempotent: sending the same key again never refunds twice. No amount means the whole
 * payment. A refusal throws with Midtrans' `status_code` (412: not refundable in its state, 414: a wrong amount, 406:
 * the key was already used).
 */
export async function refundTransaction(
	config: MidtransConfig,
	orderId: string,
	refund: { refundKey: string; amount?: number | undefined; reason: string },
): Promise<MidtransRefundAnswer> {
	const { httpStatus, body } = await call(
		config,
		"refund",
		`${config.coreBaseUrl}/v2/${encodeURIComponent(orderId)}/refund`,
		{
			method: "POST",
			body: JSON.stringify({
				refund_key: refund.refundKey,
				...(refund.amount === undefined ? {} : { amount: refund.amount }),
				reason: refund.reason,
			}),
		},
	);
	const statusCode = text(body.status_code);
	const transactionStatus = text(body.transaction_status);
	const accepted = httpStatus >= 200 && httpStatus < 300;
	if (accepted && statusCode === "201") return { confirmed: false };
	if (!accepted || statusCode !== "200" || !transactionStatus) {
		// Refusals often come as HTTP 200 with the real code in the body; the error carries that code.
		const code = accepted && /^[45]\d\d$/.test(statusCode ?? "") ? Number(statusCode) : httpStatus;
		throw httpError("refund", code >= 400 ? code : 502, body, statusCode);
	}
	if (text(body.order_id) !== orderId) throw new MidtransError({ kind: "invalid_response", operation: "refund" });
	const status = transactionOf(orderId, body, transactionStatus, statusCode);
	// The reply names the refund it made at the top level rather than in a list.
	const refundKey = text(body.refund_key);
	const amount = text(body.refund_amount);
	if (!status.refunds.length && refundKey && amount) status.refunds = [{ refundKey, amount, reason: refund.reason }];
	return { confirmed: true, status };
}
