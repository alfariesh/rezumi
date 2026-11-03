import type { BillingMode } from "./entitlements";
import type { MidtransStatusResult, MidtransTransactionStatus } from "./midtrans/client";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { createRouterClient } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { MidtransError } from "./midtrans/client";
import { notificationSignature } from "./midtrans/signature";
import { safeProviderFields } from "./midtrans/status";
import { DAY_MS } from "./timeline";

const KEY = "SB-Mid-server-test";
const OWNER_EMAIL = "owner@example.test";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as BillingMode,
	alertEmail: "owner@example.test" as string | undefined,
	// What Midtrans says about each order; absent means it has no transaction (no method chosen yet).
	statuses: new Map<string, Record<string, string>>(),
	// Get Status fails, as when Midtrans is down.
	statusUnavailable: false,
	create: vi.fn(),
	refund: vi.fn(),
	deliverReceipt: vi.fn(),
	deliverNotice: vi.fn(),
}));

vi.mock("@rezumi/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
vi.mock("@rezumi/env/server", async () => {
	const actual = await vi.importActual<typeof import("@rezumi/env/server")>("@rezumi/env/server");
	return {
		...actual,
		env: {
			...actual.env,
			APP_URL: "https://rezumi.test",
			get BILLING_MODE() {
				return fixture.mode;
			},
			get BILLING_ALERT_EMAIL() {
				return fixture.alertEmail;
			},
			BILLING_CHECKOUT_PAUSED: false,
			MIDTRANS_SERVER_KEY: "SB-Mid-server-test",
			MIDTRANS_SIGNATURE_KEY: undefined,
			MIDTRANS_ENVIRONMENT: "sandbox",
			MIDTRANS_ENABLED_PAYMENTS: ["other_qris"],
		},
	};
});

/** Midtrans' status for an order, built the way the real client parses it. */
function statusOf(orderId: string): MidtransTransactionStatus | null {
	const status = fixture.statuses.get(orderId);
	if (!status) return null;
	return {
		orderId,
		transactionStatus: status.transaction_status ?? "pending",
		statusCode: "200",
		fraudStatus: null,
		grossAmount: status.gross_amount ?? null,
		paymentType: status.payment_type ?? "qris",
		transactionId: "trx-1",
		refundAmount: status.refund_amount ?? null,
		refunds: status.refunds ? JSON.parse(status.refunds) : [],
		fields: safeProviderFields({ ...status, order_id: orderId }),
	};
}

vi.mock("./midtrans/client", async () => {
	const actual = await vi.importActual<typeof import("./midtrans/client")>("./midtrans/client");
	return {
		...actual,
		createSnapTransaction: fixture.create,
		// Through a wrapper: each test gets a fresh refund double.
		refundTransaction: (...args: unknown[]) => fixture.refund(...args),
		getTransactionStatus: async (_config: unknown, orderId: string): Promise<MidtransStatusResult> => {
			if (fixture.statusUnavailable) throw new actual.MidtransError({ kind: "timeout", operation: "status" });
			const status = statusOf(orderId);
			return status ? { found: true, status } : { found: false };
		},
	};
});
vi.mock("@rezumi/email/billing", () => ({
	deliverPaymentReceipt: fixture.deliverReceipt,
	deliverBillingNotice: fixture.deliverNotice,
}));
vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return {
		protectedProcedure: os.$context<{
			user: { id: string };
			authentication: { user: { id: string }; method: "apiKey" | "bearer" | "session" };
		}>(),
	};
});

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

/**
 * Midtrans' refund API as the sandbox behaves: a refund key refunds once (sending it again answers the same), the
 * status then lists every refund with the running total.
 */
function midtransRefunds(orderId: string, refund: { refundKey: string; amount?: number; reason: string }) {
	const status = fixture.statuses.get(orderId);
	if (!status) throw new MidtransError({ kind: "client", operation: "refund", httpStatus: 404, statusCode: "404" });
	const gross = Number.parseInt(status.gross_amount ?? "0", 10);
	const refunds: { refundKey: string; amount: string; reason: string | null }[] = status.refunds
		? JSON.parse(status.refunds)
		: [];
	if (!refunds.some((entry) => entry.refundKey === refund.refundKey)) {
		refunds.push({ refundKey: refund.refundKey, amount: `${refund.amount ?? gross}.00`, reason: refund.reason });
		const total = refunds.reduce((sum, entry) => sum + Number.parseInt(entry.amount, 10), 0);
		fixture.statuses.set(orderId, {
			...status,
			transaction_status: total >= gross ? "refund" : "partial_refund",
			refund_amount: `${total}.00`,
			refunds: JSON.stringify(refunds),
		});
	}
	const answer = statusOf(orderId);
	if (!answer) throw new Error("No status.");
	return answer;
}

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("billing operations", () => {
	let router: typeof import("./router").billingRouter;
	let handleMidtransNotification: typeof import("./notification").handleMidtransNotification;
	let runBillingJobs: typeof import("./jobs").runBillingJobs;
	let exportBillingData: typeof import("./export").exportBillingData;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `operations_test_${randomUUID().replaceAll("-", "")}`;

	const as = (id: string, method: "apiKey" | "bearer" | "session" = "session") =>
		createRouterClient(router, {
			context: {
				user: { id },
				authentication: { user: { id }, method },
				reqHeaders: new Headers(),
				locale: "en-US",
			} as never,
		});
	const owner = () => as("owner").admin;

	const paymentOf = async (id: string) => {
		const [payment] = await getDb().select().from(tables.billingPayment).where(eq(tables.billingPayment.id, id));
		if (!payment) throw new Error("Payment not found.");
		return payment;
	};
	const refundsOf = (paymentId: string) =>
		getDb()
			.select()
			.from(tables.billingRefund)
			.where(eq(tables.billingRefund.paymentId, paymentId))
			.orderBy(asc(tables.billingRefund.sequence));
	const auditOf = (action: string) =>
		getDb().select().from(tables.billingAuditLog).where(eq(tables.billingAuditLog.action, action));
	const notifications = (kind?: string) =>
		getDb()
			.select()
			.from(tables.billingNotification)
			.where(kind ? eq(tables.billingNotification.kind, kind) : undefined)
			.orderBy(asc(tables.billingNotification.createdAt));

	const midtransSays = (orderId: string, transactionStatus: string, extra: Record<string, string> = {}) =>
		fixture.statuses.set(orderId, {
			...fixture.statuses.get(orderId),
			transaction_status: transactionStatus,
			gross_amount: "79000.00",
			...extra,
		});

	const notify = (fields: { order_id: string } & Record<string, string>, signature?: string) => {
		const body = { status_code: "200", gross_amount: "79000.00", transaction_status: "settlement", ...fields };
		return handleMidtransNotification(
			new Request("https://rezumi.test/api/payments/midtrans/notification", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...body,
					signature_key:
						signature ??
						notificationSignature(
							{ orderId: body.order_id, statusCode: body.status_code, grossAmount: body.gross_amount },
							KEY,
						),
				}),
			}),
		);
	};

	/** A Pro AI purchase the buyer paid with `paymentType`, pass and credits granted. */
	const paidPayment = async (paymentType = "qris", userId = "buyer") => {
		const { paymentId } = await as(userId).checkout({ planId: "pro-ai", idempotencyKey: randomUUID() });
		const payment = await paymentOf(paymentId);
		midtransSays(payment.providerOrderId, "settlement", { payment_type: paymentType });
		await notify({ order_id: payment.providerOrderId });
		return paymentOf(paymentId);
	};

	const activePeriods = async (userId: string) =>
		(await getDb().select().from(tables.membershipPeriod).where(eq(tables.membershipPeriod.userId, userId))).filter(
			(period) => !period.revokedAt,
		);

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({
			connectionString: databaseUrl,
			max: 8,
			options: `-c search_path=${schemaName} -c statement_timeout=10000`,
		});
		fixture.db = drizzle({ client: pool });
		const migrations = new URL("../../../../../migrations/", import.meta.url);
		const directories = (await readdir(migrations, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
			.map((entry) => entry.name)
			.sort();
		for (const directory of directories) {
			const file = new URL(`${directory}/migration.sql`, migrations);
			if (existsSync(file)) await pool.query((await readFile(file, "utf8")).replaceAll('"public".', ""));
		}
		({ billingRouter: router } = await import("./router"));
		({ handleMidtransNotification } = await import("./notification"));
		({ runBillingJobs } = await import("./jobs"));
		({ exportBillingData } = await import("./export"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		fixture.alertEmail = OWNER_EMAIL;
		fixture.statuses.clear();
		fixture.statusUnavailable = false;
		fixture.create.mockReset();
		fixture.create.mockImplementation(
			async (_config: unknown, payload: { transaction_details: { order_id: string } }) => ({
				token: `token-${payload.transaction_details.order_id}`,
				redirectUrl: `https://app.sandbox.midtrans.com/snap/v4/redirection/${payload.transaction_details.order_id}`,
			}),
		);
		fixture.refund = vi.fn(
			async (_config: unknown, orderId: string, refund: Parameters<typeof midtransRefunds>[1]) => ({
				confirmed: true,
				status: midtransRefunds(orderId, refund),
			}),
		);
		fixture.deliverReceipt.mockReset().mockResolvedValue("sent");
		fixture.deliverNotice.mockReset().mockResolvedValue("sent");
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		await pool.query(
			'TRUNCATE "user", released_username, billing_audit_log, billing_payment, billing_payment_event, billing_notification CASCADE',
		);
		await getDb()
			.insert(tables.user)
			.values([
				{
					id: "owner",
					name: "Owner",
					email: "owner-account@example.test",
					username: "owner",
					displayUsername: "owner",
					emailVerified: true,
					role: "admin",
				},
				{
					id: "buyer",
					name: "Sari Wulandari",
					email: "sari@example.test",
					username: "sari",
					displayUsername: "sari",
					emailVerified: true,
				},
			]);
	});

	const expectCode = async (promise: Promise<unknown>, code: string) => {
		const error = await promise.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ORPCError);
		expect((error as ORPCError<string, unknown>).code).toBe(code);
	};

	describe("admin access", () => {
		it("refuses every admin procedure to other accounts, and to an admin outside a web session", async () => {
			const payment = await paidPayment();
			const range = { from: new Date(Date.now() - DAY_MS), to: new Date() };
			const calls = (client: ReturnType<typeof as>["admin"]) => [
				() => client.search({ query: "sari@example.test" }),
				() => client.customer({ userId: "buyer" }),
				() => client.alerts(),
				() => client.metrics(range),
				() => client.exportPayments(range),
				() => client.syncPayment({ paymentId: payment.id }),
				() => client.refund({ paymentId: payment.id, reason: "Paid twice" }),
				() => client.recordManualRefund({ paymentId: payment.id, amount: 1000, reason: "Transfer" }),
				() => client.resendReceipt({ paymentId: payment.id }),
				() => client.grantPeriod({ userId: "buyer", planId: "plus", days: 3, reason: "Goodwill" }),
				() => client.adjustCredits({ userId: "buyer", amount: 5, expiresInDays: 7, reason: "Goodwill" }),
			];
			for (const call of [...calls(as("buyer").admin), ...calls(as("owner", "bearer").admin)])
				await expectCode(call(), "FORBIDDEN");
			expect(fixture.refund).not.toHaveBeenCalled();
			expect(await paymentOf(payment.id)).toMatchObject({ status: "paid", refundedAmount: 0 });
		});

		it("finds a customer by email, order number and payment id", async () => {
			const payment = await paidPayment();
			const byEmail = await owner().search({ query: "SARI@example" });
			expect(byEmail.customers.map((customer) => customer.id)).toEqual(["buyer"]);
			const byOrder = await owner().search({ query: payment.providerOrderId.toLowerCase() });
			expect(byOrder.payments.map((row) => row.id)).toEqual([payment.id]);
			expect(byOrder.customers.map((customer) => customer.id)).toEqual(["buyer"]);
			expect((await owner().search({ query: payment.id })).payments).toHaveLength(1);
			// Wildcards are text, not patterns.
			expect((await owner().search({ query: "%%%" })).customers).toHaveLength(0);
		});

		it("shows a customer's plan, credits, payments and history without Snap tokens", async () => {
			const payment = await paidPayment();
			const view = await owner().customer({ userId: "buyer" });
			expect(view).toMatchObject({
				account: { id: "buyer", email: "sari@example.test" },
				billingApplies: true,
				plan: { planId: "pro-ai" },
				credits: { balance: 100 },
			});
			expect(view.payments).toEqual([
				expect.objectContaining({ id: payment.id, status: "paid", refundMode: "api", refunds: [] }),
			]);
			expect(JSON.stringify(view)).not.toContain("token-");
			expect(view.events.length).toBeGreaterThan(0);
			expect(view.audit.map((entry) => entry.action)).toContain("payment.fulfilled");
		});
	});

	describe("refunds", () => {
		it("refunds in full through Midtrans with a key saved first, and takes the pass and credits back once", async () => {
			const payment = await paidPayment();
			fixture.refund.mockImplementationOnce(
				async (_config: unknown, orderId: string, refund: { refundKey: string }) => {
					// The refund and its key are committed before Midtrans is asked.
					const [saved] = await refundsOf(payment.id);
					expect(saved).toMatchObject({ refundKey: refund.refundKey, status: "requesting" });
					return { confirmed: true, status: midtransRefunds(orderId, { ...refund, reason: "Paid twice" }) };
				},
			);
			const result = await owner().refund({ paymentId: payment.id, reason: "Paid twice" });
			expect(result).toMatchObject({ status: "succeeded", amount: 79_000, paymentStatus: "refunded" });
			expect(fixture.refund).toHaveBeenCalledExactlyOnceWith(expect.anything(), payment.providerOrderId, {
				refundKey: `RF-${payment.id}-1`,
				amount: undefined,
				reason: "Paid twice",
			});
			expect(await paymentOf(payment.id)).toMatchObject({ status: "refunded", refundedAmount: 79_000 });
			expect(await activePeriods("buyer")).toHaveLength(0);
			await expect(as("buyer").summary()).resolves.toMatchObject({ planId: "free", credits: { balance: 0 } });

			// Midtrans' refund notification arrives afterwards: the same refund, nothing more.
			await notify({ order_id: payment.providerOrderId, transaction_status: "refund" });
			await notify({ order_id: payment.providerOrderId, transaction_status: "refund" });
			await owner().syncPayment({ paymentId: payment.id });
			expect(await refundsOf(payment.id)).toHaveLength(1);
			expect(await auditOf("payment.benefits_revoked")).toHaveLength(1);
			expect((await auditOf("refund.requested"))[0]).toMatchObject({ actorUserId: "owner", reason: "Paid twice" });
		});

		it("makes one refund of two clicks at once", async () => {
			const payment = await paidPayment();
			const results = await Promise.allSettled([
				owner().refund({ paymentId: payment.id, reason: "Double click" }),
				owner().refund({ paymentId: payment.id, reason: "Double click" }),
			]);
			expect(results.some((result) => result.status === "fulfilled")).toBe(true);
			const keys = new Set(fixture.refund.mock.calls.map((call) => (call[2] as { refundKey: string }).refundKey));
			expect([...keys]).toEqual([`RF-${payment.id}-1`]);
			expect(await refundsOf(payment.id)).toHaveLength(1);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "refunded", refundedAmount: 79_000 });
			expect(await auditOf("payment.benefits_revoked")).toHaveLength(1);
		});

		it("takes a refund made in the Midtrans dashboard in through the notification, once", async () => {
			const payment = await paidPayment();
			midtransSays(payment.providerOrderId, "refund", {
				payment_type: "qris",
				refund_amount: "79000.00",
				refunds: JSON.stringify([{ refundKey: "dashboard-1", amount: "79000.00", reason: "Customer request" }]),
			});
			await notify({ order_id: payment.providerOrderId, transaction_status: "refund" });
			await notify({ order_id: payment.providerOrderId, transaction_status: "refund" });
			expect(await refundsOf(payment.id)).toEqual([
				expect.objectContaining({ refundKey: "dashboard-1", method: "midtrans", status: "succeeded", amount: 79_000 }),
			]);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "refunded", refundedAmount: 79_000 });
			expect(await auditOf("payment.benefits_revoked")).toHaveLength(1);
		});

		it("only records a partial refund, unless the admin takes the pass back too", async () => {
			const payment = await paidPayment();
			await owner().refund({ paymentId: payment.id, amount: 20_000, reason: "Goodwill" });
			expect(await paymentOf(payment.id)).toMatchObject({ status: "partially_refunded", refundedAmount: 20_000 });
			await expect(as("buyer").summary()).resolves.toMatchObject({ planId: "pro-ai", credits: { balance: 100 } });
			expect(fixture.refund.mock.calls[0]?.[2]).toMatchObject({ amount: 20_000 });

			await expectCode(owner().refund({ paymentId: payment.id, amount: 60_000, reason: "Too much" }), "BAD_REQUEST");
			await owner().refund({ paymentId: payment.id, amount: 30_000, reason: "Not used", revokeBenefits: true });
			expect(await paymentOf(payment.id)).toMatchObject({ status: "partially_refunded", refundedAmount: 50_000 });
			await expect(as("buyer").summary()).resolves.toMatchObject({ planId: "free", credits: { balance: 0 } });
			expect((await refundsOf(payment.id)).map((refund) => refund.refundKey)).toEqual([
				`RF-${payment.id}-1`,
				`RF-${payment.id}-2`,
			]);

			// The rest: now it is refunded in full.
			await owner().refund({ paymentId: payment.id, reason: "The rest" });
			expect(await paymentOf(payment.id)).toMatchObject({ status: "refunded", refundedAmount: 79_000 });
			await expectCode(owner().refund({ paymentId: payment.id, reason: "Again" }), "BAD_REQUEST");
		});

		it("keeps an unanswered refund to send again with the same key, and records a refusal", async () => {
			const payment = await paidPayment();
			fixture.refund.mockRejectedValueOnce(new MidtransError({ kind: "timeout", operation: "refund" }));
			await expectCode(owner().refund({ paymentId: payment.id, reason: "Paid twice" }), "BAD_GATEWAY");
			expect(await refundsOf(payment.id)).toEqual([expect.objectContaining({ status: "requesting" })]);
			// A different amount can't start while it waits; the same one goes again with the same key.
			await expectCode(owner().refund({ paymentId: payment.id, amount: 1000, reason: "Other" }), "CONFLICT");
			await expectCode(
				owner().recordManualRefund({ paymentId: payment.id, amount: 1000, reason: "Transfer" }),
				"CONFLICT",
			);
			await owner().refund({ paymentId: payment.id, reason: "Paid twice" });
			expect(fixture.refund.mock.calls.map((call) => (call[2] as { refundKey: string }).refundKey)).toEqual([
				`RF-${payment.id}-1`,
				`RF-${payment.id}-1`,
			]);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "refunded" });

			const second = await paidPayment();
			fixture.refund.mockRejectedValueOnce(
				new MidtransError({ kind: "client", operation: "refund", httpStatus: 412, statusCode: "412" }),
			);
			await expectCode(owner().refund({ paymentId: second.id, reason: "Too late" }), "BAD_REQUEST");
			expect(await refundsOf(second.id)).toEqual([
				expect.objectContaining({ status: "failed", failureReason: "refund_http_412" }),
			]);
			expect(await paymentOf(second.id)).toMatchObject({ status: "paid", refundedAmount: 0 });
			expect(await notifications("refund_failed")).toHaveLength(1);
		});

		it("keeps a refund the bank is still processing as waiting, quietly, until Midtrans lists it", async () => {
			const payment = await paidPayment("credit_card");
			fixture.refund.mockResolvedValueOnce({ confirmed: false });
			const result = await owner().refund({ paymentId: payment.id, amount: 10_000, reason: "Card refund" });
			expect(result).toMatchObject({ status: "requesting", paymentStatus: "paid", refundedAmount: 0 });
			expect(await refundsOf(payment.id)).toEqual([
				expect.objectContaining({ status: "requesting", failureReason: "bank_processing" }),
			]);
			// An hour on, waiting on the bank is no alarm.
			await runBillingJobs(new Date(Date.now() + 60 * 60_000));
			expect(await notifications("refund_failed")).toHaveLength(0);
			// The bank confirms; the refund job finds it in Midtrans' status.
			midtransRefunds(payment.providerOrderId, { refundKey: `RF-${payment.id}-1`, amount: 10_000, reason: "Card" });
			await runBillingJobs(new Date(Date.now() + 2 * 60 * 60_000));
			expect(await refundsOf(payment.id)).toEqual([
				expect.objectContaining({ status: "succeeded", failureReason: null }),
			]);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "partially_refunded", refundedAmount: 10_000 });
		});

		it("doesn't call a refusal final when Midtrans' status can't be read", async () => {
			const payment = await paidPayment();
			fixture.refund.mockRejectedValueOnce(
				new MidtransError({ kind: "client", operation: "refund", httpStatus: 412, statusCode: "412" }),
			);
			fixture.statuses.delete(payment.providerOrderId);
			fixture.statusUnavailable = true;
			await expectCode(owner().refund({ paymentId: payment.id, reason: "Paid twice" }), "BAD_GATEWAY");
			expect(await refundsOf(payment.id)).toEqual([expect.objectContaining({ status: "requesting" })]);
		});

		it("counts each refund once when the Midtrans dashboard refunds what an unanswered request didn't", async () => {
			const payment = await paidPayment();
			fixture.refund.mockRejectedValueOnce(new MidtransError({ kind: "timeout", operation: "refund" }));
			await expectCode(owner().refund({ paymentId: payment.id, amount: 30_000, reason: "Part" }), "BAD_GATEWAY");
			// Midtrans never got it; the owner refunds everything in the dashboard instead.
			midtransSays(payment.providerOrderId, "refund", {
				refund_amount: "79000.00",
				refunds: JSON.stringify([{ refundKey: "dashboard-1", amount: "79000.00", reason: null }]),
			});
			await notify({ order_id: payment.providerOrderId, transaction_status: "refund" });
			const rows = await refundsOf(payment.id);
			expect(rows.filter((row) => row.status === "succeeded").map((row) => row.amount)).toEqual([79_000]);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "refunded", refundedAmount: 79_000 });
		});

		it("marks a payment refunded once a manual refund and a Midtrans refund cover all of it", async () => {
			const payment = await paidPayment();
			await owner().recordManualRefund({ paymentId: payment.id, amount: 30_000, reason: "Part by transfer" });
			await owner().refund({ paymentId: payment.id, reason: "The rest" });
			// Midtrans knows only its 49k, so it says partial_refund; all 79k is back.
			expect(await paymentOf(payment.id)).toMatchObject({ status: "refunded", refundedAmount: 79_000 });
			expect(await activePeriods("buyer")).toHaveLength(0);
		});

		it("records a manual transfer for a virtual account payment Midtrans can't refund", async () => {
			const payment = await paidPayment("bank_transfer");
			expect((await owner().customer({ userId: "buyer" })).payments[0]).toMatchObject({ refundMode: "manual" });
			await expectCode(owner().refund({ paymentId: payment.id, reason: "Paid twice" }), "BAD_REQUEST");
			expect(fixture.refund).not.toHaveBeenCalled();
			await owner().recordManualRefund({ paymentId: payment.id, amount: 79_000, reason: "BCA transfer 3 Nov" });
			expect(await paymentOf(payment.id)).toMatchObject({ status: "refunded", refundedAmount: 79_000 });
			expect(await refundsOf(payment.id)).toEqual([
				expect.objectContaining({ method: "manual", status: "succeeded", actorUserId: "owner" }),
			]);
			expect(await activePeriods("buyer")).toHaveLength(0);
			await expectCode(
				owner().recordManualRefund({ paymentId: payment.id, amount: 1, reason: "Again" }),
				"BAD_REQUEST",
			);
			// Midtrans still says settlement after a refund by hand: checking it changes nothing and raises no alarm.
			await owner().syncPayment({ paymentId: payment.id });
			expect(await paymentOf(payment.id)).toMatchObject({ status: "refunded" });
			expect(await notifications("paid_not_applied")).toHaveLength(0);
		});
	});

	describe("alerts and emails", () => {
		it("emails one alert per kind per hour, however often it happens or the job runs", async () => {
			const first = await as("buyer").checkout({ planId: "pro-ai", idempotencyKey: randomUUID() });
			const order = (await paymentOf(first.paymentId)).providerOrderId;
			midtransSays(order, "settlement", { gross_amount: "29000.00" });
			await notify({ order_id: order, gross_amount: "29000.00" });
			await notify({ order_id: order, gross_amount: "29000.00" });
			await Promise.all([runBillingJobs(), runBillingJobs()]);
			await runBillingJobs();
			const alerts = fixture.deliverNotice.mock.calls.filter((call) =>
				(call[0] as { subject: string }).subject.includes("Nominal"),
			);
			expect(alerts).toHaveLength(1);
			expect(alerts[0]?.[0]).toMatchObject({ to: OWNER_EMAIL });
			expect(JSON.stringify(alerts[0])).not.toContain("sari@example.test");
			const [row] = await notifications("amount_mismatch");
			expect(row).toMatchObject({ count: 2, details: { paymentIds: [first.paymentId] } });
			expect(row?.sentAt).not.toBeNull();
		});

		it("waits for five bad signatures in an hour", async () => {
			const { paymentId } = await as("buyer").checkout({ planId: "pro-ai", idempotencyKey: randomUUID() });
			const order = (await paymentOf(paymentId)).providerOrderId;
			const rejected = () =>
				fixture.deliverNotice.mock.calls.filter((call) => (call[0] as { subject: string }).subject.includes("ditolak"));
			for (let index = 0; index < 4; index++) await notify({ order_id: order }, "bad");
			await runBillingJobs();
			expect(rejected()).toHaveLength(0);
			await notify({ order_id: order }, "bad");
			await runBillingJobs();
			await runBillingJobs();
			expect(rejected()).toHaveLength(1);
		});

		it("keeps alerts for the admin page when no owner address is set", async () => {
			fixture.alertEmail = undefined;
			const { paymentId } = await as("buyer").checkout({ planId: "pro-ai", idempotencyKey: randomUUID() });
			const order = (await paymentOf(paymentId)).providerOrderId;
			midtransSays(order, "settlement", { gross_amount: "1.00" });
			await notify({ order_id: order, gross_amount: "1.00" });
			await runBillingJobs();
			expect(fixture.deliverNotice).not.toHaveBeenCalled();
			expect(await owner().alerts()).toEqual([expect.objectContaining({ kind: "amount_mismatch", sentAt: null })]);
		});

		it("sends yesterday's summary once, from 08.00 WIB", async () => {
			await paidPayment();
			const paidAt = (await getDb().select().from(tables.billingPayment))[0]?.paidAt ?? new Date();
			// 07.59 WIB the next day: not yet. 08.00: once, however many runs.
			const nextDay = new Date(`${new Date(+paidAt + 7 * 3600_000 + DAY_MS).toISOString().slice(0, 10)}T00:00:00Z`);
			await runBillingJobs(new Date(+nextDay + 59 * 60_000));
			expect(fixture.deliverNotice).not.toHaveBeenCalled();
			await Promise.all([
				runBillingJobs(new Date(+nextDay + 60 * 60_000)),
				runBillingJobs(new Date(+nextDay + 60 * 60_000)),
			]);
			await runBillingJobs(new Date(+nextDay + 90 * 60_000));
			const summaries = fixture.deliverNotice.mock.calls.filter((call) =>
				(call[0] as { subject: string }).subject.includes("Ringkasan"),
			);
			expect(summaries).toHaveLength(1);
			const [summary] = summaries;
			if (!summary) throw new Error("No summary was sent.");
			const { notice } = summary[0] as { notice: { rows: { label: string; value: string }[] } };
			expect(notice.rows).toContainEqual({ label: "Pro AI", value: "1 × (Rp79.000)" });
			expect(JSON.stringify(summaries[0])).not.toContain("sari@example.test");
		});

		it("sends no summary while plans are off", async () => {
			fixture.mode = "off";
			await runBillingJobs(new Date("2026-11-03T02:00:00Z"));
			expect(await notifications("daily_summary")).toHaveLength(0);
		});

		it("reminds a customer three days before their last pass ends, once, in their language", async () => {
			const payment = await paidPayment();
			const [period] = await activePeriods("buyer");
			if (!period) throw new Error("No pass.");
			// Four days before: nothing. Three days before, twice at once: one email.
			await runBillingJobs(new Date(+period.endsAt - 4 * DAY_MS));
			expect(await notifications("expiry_reminder")).toHaveLength(0);
			const due = new Date(+period.endsAt - 3 * DAY_MS + 60_000);
			await Promise.all([runBillingJobs(due), runBillingJobs(due)]);
			await runBillingJobs(new Date(+due + 10 * 60_000));
			const reminders = fixture.deliverNotice.mock.calls.filter(
				(call) => (call[0] as { to: string }).to === "sari@example.test",
			);
			expect(reminders).toHaveLength(1);
			// The checkout's locale was English.
			expect(reminders[0]?.[0]).toMatchObject({ subject: "Your Rezumi Pro AI pass ends in 3 days" });
			expect(payment.id).toBeTruthy();
		});

		it("moves on to other accounts once one was reminded", async () => {
			await paidPayment();
			const [period] = await activePeriods("buyer");
			if (!period) throw new Error("No pass.");
			const due = new Date(+period.endsAt - 2 * DAY_MS);
			const { queueExpiryReminders } = await import("./notifications");
			expect(await queueExpiryReminders(due)).toBe(1);
			// The reminded account is no longer a candidate, so it never fills the batch again.
			expect(await queueExpiryReminders(due)).toBe(0);
			expect(await notifications("expiry_reminder")).toHaveLength(1);
		});

		it("reminds about the last queued pass only, not each one", async () => {
			await paidPayment();
			await paidPayment();
			const periods = await activePeriods("buyer");
			const first = periods.toSorted((a, b) => +a.endsAt - +b.endsAt)[0];
			if (!first) throw new Error("No pass.");
			await runBillingJobs(new Date(+first.endsAt - 2 * DAY_MS));
			expect(await notifications("expiry_reminder")).toHaveLength(0);
		});

		it("says once that an account deleted before its payment arrived can't get its pass", async () => {
			const { paymentId } = await as("buyer").checkout({ planId: "pro-ai", idempotencyKey: randomUUID() });
			const order = (await paymentOf(paymentId)).providerOrderId;
			await getDb().delete(tables.user).where(eq(tables.user.id, "buyer"));
			midtransSays(order, "settlement");
			await notify({ order_id: order });
			expect(await paymentOf(paymentId)).toMatchObject({ status: "paid", userId: null, fulfilledAt: null });
			// Hours of sweeping later it is still the one alert.
			for (const hours of [1, 2, 5]) await runBillingJobs(new Date(Date.now() + hours * 60 * 60_000));
			expect((await notifications("paid_not_applied")).map((row) => row.details)).toEqual([
				{ paymentIds: [paymentId] },
			]);
		});

		it("alerts the owner about a receipt that never went out", async () => {
			fixture.deliverReceipt.mockRejectedValue(new Error("SMTP refused"));
			const payment = await paidPayment();
			await getDb()
				.update(tables.billingPayment)
				.set({ receiptAttempts: 5, receiptAttemptedAt: new Date(Date.now() - 10 * 60_000) })
				.where(eq(tables.billingPayment.id, payment.id));
			await runBillingJobs();
			expect(await notifications("receipt_failed")).toEqual([
				expect.objectContaining({ details: { paymentIds: [payment.id] } }),
			]);
			fixture.deliverReceipt.mockReset().mockResolvedValue("sent");
			await expect(owner().resendReceipt({ paymentId: payment.id })).resolves.toEqual({ sent: true });
			expect((await paymentOf(payment.id)).receiptSentAt).not.toBeNull();
		});
	});

	describe("reports", () => {
		it("counts sales, refunds and checkouts for a period", async () => {
			const paid = await paidPayment();
			await as("buyer").checkout({ planId: "plus", idempotencyKey: randomUUID() });
			await owner().refund({ paymentId: paid.id, amount: 9_000, reason: "Goodwill" });
			const metrics = await owner().metrics({ from: new Date(Date.now() - DAY_MS), to: new Date(Date.now() + 60_000) });
			expect(metrics).toMatchObject({
				checkouts: { started: 2, buyers: 1, paid: 1 },
				sales: { payments: 1, revenue: 79_000 },
				refunds: { refunds: 1, amount: 9_000 },
				net: 70_000,
				signups: { total: 2, verified: 2 },
				credits: { planCredits: 100 },
			});
		});

		it("exports payments and refunds for the books without personal data", async () => {
			const paid = await paidPayment();
			await owner().recordManualRefund({ paymentId: paid.id, amount: 79_000, reason: '=HYPERLINK("x")' });
			const { csv, rows, filename } = await owner().exportPayments({
				from: new Date(Date.now() - DAY_MS),
				to: new Date(Date.now() + 60_000),
			});
			expect(rows).toBe(2);
			expect(filename).toMatch(/^rezumi-pembayaran-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);
			const lines = csv.replace("﻿", "").trim().split("\r\n");
			expect(lines[0]).toBe(
				"jenis,tanggal_wib,nomor_pesanan,paket,metode,jumlah_idr,status,id_transaksi_midtrans,kunci_refund",
			);
			expect(lines[1]).toMatch(
				new RegExp(`^pembayaran,[^,]+,${paid.providerOrderId},pro-ai,qris,79000,refunded,trx-1,$`),
			);
			expect(lines[2]).toMatch(/^refund,.*,-79000,refund_manual,trx-1,RF-/);
			for (const text of ["sari@example.test", "Sari", "buyer"]) expect(csv).not.toContain(text);
		});

		it("pages the period's payments with their total, and filters them by status", async () => {
			const paid = await paidPayment();
			// An open checkout for the same plan is offered again, so one of each.
			for (const planId of ["plus", "pro-ai"] as const)
				await as("buyer").checkout({ planId, idempotencyKey: randomUUID() });
			const range = { from: new Date(Date.now() - DAY_MS), to: new Date(Date.now() + 60_000) };
			const first = await owner().payments({ ...range, limit: 2 });
			expect(first.total).toBe(3);
			expect(first.items).toHaveLength(2);
			const second = await owner().payments({ ...range, limit: 2, offset: 2 });
			expect(second.items).toHaveLength(1);
			expect(new Set([...first.items, ...second.items].map((row) => row.id)).size).toBe(3);
			const onlyPaid = await owner().payments({ ...range, status: "paid" });
			expect(onlyPaid).toMatchObject({ total: 1, items: [{ id: paid.id, email: "sari@example.test" }] });
			expect((await owner().payments({ ...range, status: "waiting" })).total).toBe(2);
		});

		it("takes a bank reversal out of the net and puts it in the CSV as a negative line", async () => {
			const paid = await paidPayment();
			midtransSays(paid.providerOrderId, "deny");
			await notify({ order_id: paid.providerOrderId, transaction_status: "deny" });
			expect(await paymentOf(paid.id)).toMatchObject({ status: "reversed" });
			const range = { from: new Date(Date.now() - DAY_MS), to: new Date(Date.now() + 60_000) };
			expect(await owner().metrics(range)).toMatchObject({
				sales: { revenue: 79_000 },
				reversals: { payments: 1, amount: 79_000 },
				net: 0,
			});
			const { csv } = await owner().exportPayments(range);
			expect(csv).toMatch(new RegExp(`pembalikan,[^,]+,${paid.providerOrderId},pro-ai,qris,-79000,reversed,`));
		});

		it("refuses a backwards or too long range", async () => {
			await expectCode(owner().metrics({ from: new Date(), to: new Date(Date.now() - 1) }), "BAD_REQUEST");
			await expectCode(
				owner().exportPayments({ from: new Date(Date.now() - 500 * DAY_MS), to: new Date() }),
				"BAD_REQUEST",
			);
		});
	});

	it("puts the account's payments, refunds, passes and credits in its data export", async () => {
		const paid = await paidPayment();
		await owner().refund({ paymentId: paid.id, amount: 1000, reason: "Goodwill" });
		const exported = await exportBillingData("buyer");
		expect(exported.payments).toEqual([
			expect.objectContaining({
				orderId: paid.providerOrderId,
				status: "partially_refunded",
				refunds: [expect.objectContaining({ amount: 1000, method: "midtrans", status: "succeeded" })],
			}),
		]);
		expect(exported.passes).toHaveLength(1);
		expect(exported.creditGrants).toEqual([expect.objectContaining({ source: "plan", amount: 100 })]);
		expect(JSON.stringify(exported)).not.toContain("token-");
		expect(JSON.stringify(exported)).not.toContain("redirection");
		const rows = await getDb()
			.select()
			.from(tables.billingRefund)
			.where(and(eq(tables.billingRefund.paymentId, paid.id)));
		expect(rows).toHaveLength(1);
	});
});
