import type { MidtransConfig } from "./config";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
	MidtransError,
	cancelSnapSession,
	cancelTransaction,
	createSnapTransaction,
	expireTransaction,
	getTransactionStatus,
} from "./client";
import { buildSnapPayload } from "./payload";

const config: MidtransConfig = {
	environment: "sandbox",
	serverKey: "SB-Mid-server-test",
	signatureKeys: ["SB-Mid-server-test"],
	enabledPayments: ["other_qris"],
	snapBaseUrl: "https://app.sandbox.midtrans.com",
	coreBaseUrl: "https://api.sandbox.midtrans.com",
};

const fetchMock = vi.fn<typeof fetch>();
const answer = (status: number, body: unknown) =>
	fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

const stub = () => vi.stubGlobal("fetch", fetchMock);

/** The MidtransError a call fails with; the test fails if it doesn't. */
async function failureOf(call: Promise<unknown>): Promise<MidtransError> {
	try {
		await call;
	} catch (error) {
		if (error instanceof MidtransError) return error;
		throw error;
	}
	throw new Error("Expected the call to fail.");
}
const request = (index = 0) => {
	const [url, init] = fetchMock.mock.calls[index] ?? [];
	return { url: String(url), init: init ?? {} };
};

const payload = buildSnapPayload({
	paymentId: "0197f326-973a-743c-b0a9-77cfc3c95d53",
	planId: "plus",
	amount: 29_000,
	customer: { name: "Sari", email: "sari@example.test" },
	enabledPayments: ["other_qris"],
	appUrl: "https://rezumi.app",
	start: new Date("2026-11-02T07:00:00Z"),
});

describe("Midtrans client", () => {
	it("creates a Snap page on the Snap host with Basic auth and JSON", async () => {
		stub();
		answer(201, { token: "snap-token", redirect_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/x" });
		await expect(createSnapTransaction(config, payload)).resolves.toEqual({
			token: "snap-token",
			redirectUrl: "https://app.sandbox.midtrans.com/snap/v4/redirection/x",
		});
		const { url, init } = request();
		expect(url).toBe("https://app.sandbox.midtrans.com/snap/v1/transactions");
		expect(init.method).toBe("POST");
		const headers = new Headers(init.headers);
		expect(headers.get("authorization")).toBe(`Basic ${btoa("SB-Mid-server-test:")}`);
		expect(headers.get("content-type")).toBe("application/json");
		expect(headers.get("accept")).toBe("application/json");
		expect(JSON.parse(String(init.body))).toEqual(payload);
		expect(init.signal).toBeInstanceOf(AbortSignal);
		expect(init.redirect).toBe("manual");
	});

	it("turns a Snap refusal into a client error without echoing the key or the body", async () => {
		stub();
		answer(401, { error_messages: ["Access denied due to unauthorized transaction"] });
		const failure = createSnapTransaction(config, payload);
		await expect(failure).rejects.toMatchObject({ kind: "client", httpStatus: 401, code: "snap_create_http_401" });
		const error = await failureOf(failure);
		expect(error.message).not.toContain("SB-Mid-server-test");
		expect(error.message).not.toContain("sari@example.test");
		expect(error.transient).toBe(false);
	});

	it("keeps Midtrans' reason for the logs, without email addresses", async () => {
		stub();
		answer(400, {
			error_messages: [
				"Gopay callback url can't be used if gopay payment type is not enabled",
				"sari@example.test is bad",
			],
		});
		const error = await failureOf(createSnapTransaction(config, payload));
		expect(error.detail).toBe("Gopay callback url can't be used if gopay payment type is not enabled; [email] is bad");
		expect(error.message).not.toContain("Gopay");
	});

	it.each([
		[500, "server", true],
		[503, "server", true],
		[400, "client", false],
	] as const)("classes HTTP %i as %s", async (status, kind, transient) => {
		stub();
		answer(status, { status_code: String(status) });
		const error = await failureOf(getTransactionStatus(config, "RZ-1"));
		expect(error).toBeInstanceOf(MidtransError);
		expect(error.kind).toBe(kind);
		expect(error.transient).toBe(transient);
	});

	it("reports a timeout and a network failure as transient", async () => {
		stub();
		fetchMock.mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
		await expect(getTransactionStatus(config, "RZ-1")).rejects.toMatchObject({ kind: "timeout", transient: true });
		fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
		await expect(getTransactionStatus(config, "RZ-1")).rejects.toMatchObject({ kind: "network", transient: true });
	});

	it("reads a transaction from the Core API host, keeping amounts as strings", async () => {
		stub();
		answer(200, {
			status_code: "200",
			order_id: "RZ-1",
			transaction_status: "settlement",
			fraud_status: "accept",
			gross_amount: "29000.00",
			payment_type: "qris",
			transaction_id: "trx-1",
			signature_key: "never-kept",
		});
		const result = await getTransactionStatus(config, "RZ-1");
		expect(request().url).toBe("https://api.sandbox.midtrans.com/v2/RZ-1/status");
		expect(result).toEqual({
			found: true,
			status: expect.objectContaining({
				orderId: "RZ-1",
				transactionStatus: "settlement",
				statusCode: "200",
				grossAmount: "29000.00",
				paymentType: "qris",
				transactionId: "trx-1",
			}),
		});
		expect(result.found && result.status.fields).not.toHaveProperty("signature_key");
	});

	it("treats 'not found' before a method is chosen as an answer, in the body or the HTTP status", async () => {
		stub();
		answer(200, { status_code: "404", status_message: "Transaction doesn't exist." });
		await expect(getTransactionStatus(config, "RZ-1")).resolves.toEqual({ found: false });
		answer(404, { status_code: "404" });
		await expect(getTransactionStatus(config, "RZ-1")).resolves.toEqual({ found: false });
	});

	it("refuses a status for another order", async () => {
		stub();
		answer(200, { status_code: "200", order_id: "RZ-2", transaction_status: "settlement", gross_amount: "1.00" });
		await expect(getTransactionStatus(config, "RZ-1")).rejects.toMatchObject({ kind: "invalid_response" });
	});

	it("cancels and expires on the Core API host and tells done from not found and not allowed", async () => {
		stub();
		answer(200, { status_code: "200", transaction_status: "cancel" });
		await expect(cancelTransaction(config, "RZ-1")).resolves.toBe("done");
		expect(request(0).url).toBe("https://api.sandbox.midtrans.com/v2/RZ-1/cancel");
		answer(200, { status_code: "412", status_message: "Merchant cannot modify the status of the transaction" });
		await expect(cancelTransaction(config, "RZ-1")).resolves.toBe("not_allowed");
		answer(200, { status_code: "407", transaction_status: "expire" });
		await expect(expireTransaction(config, "RZ-1")).resolves.toBe("done");
		expect(request(2).url).toBe("https://api.sandbox.midtrans.com/v2/RZ-1/expire");
		answer(404, { status_code: "404" });
		await expect(expireTransaction(config, "RZ-1")).resolves.toBe("not_found");
	});

	it("closes an unused Snap page on the Snap host", async () => {
		stub();
		answer(200, { canceled_at: "2026-11-02T07:00:00Z" });
		await expect(cancelSnapSession(config, "snap-token")).resolves.toBe(true);
		expect(request().url).toBe("https://app.sandbox.midtrans.com/snap/v1/transactions/snap-token/cancel");
		answer(400, { error_messages: ["Transaction is on progress"] });
		await expect(cancelSnapSession(config, "snap-token")).resolves.toBe(false);
	});

	it("uses the production hosts for production", async () => {
		stub();
		answer(200, { status_code: "404" });
		await getTransactionStatus({ ...config, coreBaseUrl: "https://api.midtrans.com" }, "RZ-1");
		expect(request().url).toBe("https://api.midtrans.com/v2/RZ-1/status");
	});
});
