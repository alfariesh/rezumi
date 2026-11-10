import type { SumopodConfig } from "./config";
import z from "zod";

/**
 * Sumopod's payment API over `fetch` (Workers and Node alike): a payment link for one QRIS payment, authenticated with
 * the project's `X-Api-Key`. Amounts are whole Rupiah. The API has nothing to ask where a payment stands (checked against
 * the sandbox 2026-11-10: every status path is a 404, and `/merchant/*` needs a dashboard login), so webhooks bring that
 * news. Requests time out after 8 seconds and aren't retried here: the customer tries again.
 */

const TIMEOUT_MS = 8_000;

/** How long a payment link stays open. Sumopod allows 1 to 24 hours; an hour is plenty to scan a QR code. */
export const PAYMENT_LINK_HOURS = 1;

/** What a Sumopod call is, for error codes and logs. */
export type SumopodOperation = "payment.create";

/** A Sumopod call that failed: `status` is the HTTP status it answered with, null when it didn't answer. */
class SumopodError extends Error {
	constructor(
		readonly operation: SumopodOperation,
		readonly status: number | null,
		readonly detail?: string,
	) {
		super(`Sumopod ${operation} failed${status ? ` with HTTP ${status}` : " without an answer"}.`);
		this.name = "SumopodError";
	}
}

/** The HTTP status Sumopod answered with, when it answered. */
function sumopodStatus(error: unknown): number | undefined {
	return error instanceof SumopodError && error.status !== null ? error.status : undefined;
}

/** Sumopod's reason for refusing a request (a 4xx body's message), for logs; never the request. */
export function sumopodErrorDetail(error: unknown): string | undefined {
	return error instanceof SumopodError && error.status !== null && error.status < 500 ? error.detail : undefined;
}

/** A short code that is safe to store and log, e.g. `payment_create_http_422` or `payment_get_network`. */
export function sumopodErrorCode(operation: SumopodOperation, error: unknown): string {
	const name = operation.replace(".", "_");
	const status = sumopodStatus(error);
	if (status) return `${name}_http_${status}`;
	return error instanceof SumopodError ? `${name}_network` : `${name}_error`;
}

const optionalText = z.string().nullish();
const optionalAmount = z.number().nullish();

/** A payment as Sumopod's API and webhooks describe it; fields Rezumi doesn't use are left out. */
export const sumopodPaymentSchema = z.object({
	payment_id: z.string().min(1),
	order_id: z.string().min(1),
	amount: z.number(),
	fee: optionalAmount,
	net_amount: optionalAmount,
	status: z.string().min(1),
	payment_link_url: optionalText,
	payment_method: optionalText,
	expires_at: optionalText,
	paid_at: optionalText,
	settled_at: optionalText,
	completed_at: optionalText,
});

export type SumopodPayment = z.infer<typeof sumopodPaymentSchema>;

/** Sumopod's reason for refusing a request, for logs and admins: the message of a 4xx body, never the request. */
function detailOf(body: unknown): string | undefined {
	if (typeof body === "string") return body.slice(0, 300);
	if (!body || typeof body !== "object") return undefined;
	const record = body as Record<string, unknown>;
	// A validation error says which field in `details`; others carry `message` or `error`.
	const message = record.details ?? record.message ?? record.error ?? record.detail;
	if (typeof message === "string") return message.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]").slice(0, 300);
	return undefined;
}

/** The payment in an answer: the body itself, or its `data` when Sumopod wraps it. */
function paymentOf(operation: SumopodOperation, body: unknown): SumopodPayment {
	const candidate =
		body && typeof body === "object" && "data" in body && (body as { data: unknown }).data
			? (body as { data: unknown }).data
			: body;
	const parsed = sumopodPaymentSchema.safeParse(candidate);
	if (!parsed.success) throw new SumopodError(operation, 200, "unexpected_response");
	return parsed.data;
}

async function call(
	config: SumopodConfig,
	operation: SumopodOperation,
	path: string,
	init: { method: "GET" | "POST"; body?: Record<string, unknown> },
): Promise<{ status: number; body: unknown }> {
	let response: Response;
	try {
		response = await fetch(new URL(path, config.apiUrl), {
			method: init.method,
			headers: {
				accept: "application/json",
				"x-api-key": config.apiKey,
				...(init.body && { "content-type": "application/json" }),
			},
			...(init.body && { body: JSON.stringify(init.body) }),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch {
		throw new SumopodError(operation, null);
	}
	const text = await response.text().catch(() => "");
	let body: unknown = text;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		// Not JSON (a proxy's error page): keep the text for the detail.
	}
	if (!response.ok) throw new SumopodError(operation, response.status, detailOf(body));
	return { status: response.status, body };
}

/**
 * Opens a QRIS payment link for one order. `amount` is whole Rupiah. The return addresses override the project's
 * defaults for this payment only; Sumopod takes only https (or an app link), so a local http server leaves them out.
 */
export async function createSumopodPayment(
	config: SumopodConfig,
	input: { orderId: string; amount: number; successReturnUrl?: string; cancelReturnUrl?: string },
): Promise<SumopodPayment> {
	if (!Number.isInteger(input.amount) || input.amount <= 0)
		throw new RangeError("A Sumopod payment needs a positive whole Rupiah amount.");
	const { body } = await call(config, "payment.create", "/api/v1/payments", {
		method: "POST",
		body: {
			order_id: input.orderId,
			amount: input.amount,
			currency: "IDR",
			expires_in_hours: PAYMENT_LINK_HOURS,
			...(input.successReturnUrl && { success_return_url: input.successReturnUrl }),
			...(input.cancelReturnUrl && { cancel_return_url: input.cancelReturnUrl }),
			payment_method_type_code: "QRIS",
		},
	});
	const payment = paymentOf("payment.create", body);
	if (!payment.payment_link_url) throw new SumopodError("payment.create", 200, "no_payment_link");
	return payment;
}
