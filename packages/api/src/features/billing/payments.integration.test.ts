import type { BillingMode } from "./entitlements";
import type { MidtransStatusResult } from "./midtrans/client";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { createRouterClient } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";
import { notificationSignature } from "./midtrans/signature";
import { safeProviderFields } from "./midtrans/status";
import { DAY_MS } from "./timeline";

const KEY = "SB-Mid-server-test";

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as BillingMode,
	serverKey: "SB-Mid-server-test" as string | undefined,
	signatureKey: undefined as string | undefined,
	paused: false,
	// What Midtrans says about each order; absent means it has no transaction (no method chosen yet).
	statuses: new Map<string, Record<string, string>>(),
	statusError: null as Error | null,
	create: vi.fn(),
	cancel: vi.fn(),
	expire: vi.fn(),
	cancelSnap: vi.fn(),
	deliver: vi.fn(),
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
			get BILLING_CHECKOUT_PAUSED() {
				return fixture.paused;
			},
			get MIDTRANS_SERVER_KEY() {
				return fixture.serverKey;
			},
			get MIDTRANS_SIGNATURE_KEY() {
				return fixture.signatureKey;
			},
			MIDTRANS_ENVIRONMENT: "sandbox",
			MIDTRANS_ENABLED_PAYMENTS: ["other_qris"],
		},
	};
});
vi.mock("./midtrans/client", async () => {
	const actual = await vi.importActual<typeof import("./midtrans/client")>("./midtrans/client");
	return {
		...actual,
		createSnapTransaction: fixture.create,
		cancelTransaction: fixture.cancel,
		expireTransaction: fixture.expire,
		cancelSnapSession: fixture.cancelSnap,
		getTransactionStatus: async (_config: unknown, orderId: string): Promise<MidtransStatusResult> => {
			if (fixture.statusError) throw fixture.statusError;
			const status = fixture.statuses.get(orderId);
			if (!status) return { found: false };
			return {
				found: true,
				status: {
					orderId,
					transactionStatus: status.transaction_status ?? "pending",
					statusCode: status.status_code ?? "200",
					fraudStatus: status.fraud_status ?? null,
					grossAmount: status.gross_amount ?? null,
					paymentType: status.payment_type ?? "qris",
					transactionId: "trx-1",
					refundAmount: status.refund_amount ?? null,
					fields: safeProviderFields({ ...status, order_id: orderId }),
				},
			};
		},
	};
});
vi.mock("@rezumi/email/billing", () => ({ deliverPaymentReceipt: fixture.deliver }));
// Authentication is resolved by the server adapter; these tests hand the procedures its result.
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

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("Midtrans payments", () => {
	let router: typeof import("./router").billingRouter;
	let handleMidtransNotification: typeof import("./notification").handleMidtransNotification;
	let syncPaymentStatus: typeof import("./reconcile").syncPaymentStatus;
	let reconcilePayments: typeof import("./reconcile").reconcilePayments;
	let runBillingJobs: typeof import("./jobs").runBillingJobs;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `payments_test_${randomUUID().replaceAll("-", "")}`;

	const as = (id: string, method: "apiKey" | "bearer" | "session" = "session") =>
		createRouterClient(router, {
			context: { user: { id }, authentication: { user: { id }, method }, reqHeaders: new Headers() } as never,
		});

	const paymentOf = async (id: string) => {
		const [payment] = await getDb().select().from(tables.billingPayment).where(eq(tables.billingPayment.id, id));
		if (!payment) throw new Error("Payment not found.");
		return payment;
	};
	const periodsOf = (userId: string) =>
		getDb()
			.select()
			.from(tables.membershipPeriod)
			.where(eq(tables.membershipPeriod.userId, userId))
			.orderBy(asc(tables.membershipPeriod.startsAt));
	const grantsOf = (userId: string) =>
		getDb().select().from(tables.aiCreditGrant).where(eq(tables.aiCreditGrant.userId, userId));
	const eventsOf = (paymentId: string) =>
		getDb()
			.select()
			.from(tables.billingPaymentEvent)
			.where(eq(tables.billingPaymentEvent.paymentId, paymentId))
			.orderBy(asc(tables.billingPaymentEvent.receivedAt), asc(tables.billingPaymentEvent.id));

	/** Midtrans now reports this for the order. */
	const midtransSays = (orderId: string, transactionStatus: string, extra: Record<string, string> = {}) =>
		fixture.statuses.set(orderId, { transaction_status: transactionStatus, gross_amount: "79000.00", ...extra });

	/** POSTs a notification signed like Midtrans signs it (or with `signature` instead), with `key`. */
	const notify = (fields: { order_id: string } & Record<string, string>, signature?: string, key = KEY) => {
		const body = {
			status_code: "200",
			gross_amount: "79000.00",
			transaction_status: "settlement",
			payment_type: "qris",
			...fields,
		};
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
							key,
						),
				}),
			}),
		);
	};

	/** Starts a Pro AI checkout for the buyer and returns its payment row. */
	const startCheckout = async (planId: "plus" | "pro-ai" = "pro-ai", userId = "buyer") => {
		const result = await as(userId).checkout({ planId, idempotencyKey: randomUUID() });
		return paymentOf(result.paymentId);
	};

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
		({ syncPaymentStatus, reconcilePayments } = await import("./reconcile"));
		({ runBillingJobs } = await import("./jobs"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		fixture.serverKey = KEY;
		fixture.signatureKey = undefined;
		fixture.paused = false;
		fixture.statuses.clear();
		fixture.statusError = null;
		fixture.create.mockReset();
		fixture.create.mockImplementation(
			async (_config: unknown, payload: { transaction_details: { order_id: string } }) => ({
				token: `token-${payload.transaction_details.order_id}`,
				redirectUrl: `https://app.sandbox.midtrans.com/snap/v4/redirection/${payload.transaction_details.order_id}`,
			}),
		);
		fixture.cancel.mockReset().mockResolvedValue("done");
		fixture.expire.mockReset().mockResolvedValue("done");
		fixture.cancelSnap.mockReset().mockResolvedValue(true);
		fixture.deliver.mockReset().mockResolvedValue("sent");
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		await pool.query('TRUNCATE "user", billing_audit_log, billing_payment, billing_payment_event CASCADE');
		await getDb()
			.insert(tables.user)
			.values([
				{
					id: "buyer",
					name: "Sari Wulandari",
					email: "sari@example.test",
					username: "sari",
					displayUsername: "sari",
					emailVerified: true,
				},
				{
					id: "unverified",
					name: "Budi",
					email: "budi@example.test",
					username: "budi",
					displayUsername: "budi",
				},
				{
					id: "guest",
					name: "Guest",
					email: "guest@example.test",
					username: "guest",
					displayUsername: "guest",
					emailVerified: true,
					isAnonymous: true,
				},
			]);
	});

	const expectCode = async (promise: Promise<unknown>, code: string) => {
		const error = await promise.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ORPCError);
		expect((error as ORPCError<string, unknown>).code).toBe(code);
	};

	describe("checkout", () => {
		it("commits the payment as creating before it calls Snap, then saves the page", async () => {
			fixture.create.mockImplementationOnce(
				async (_config: unknown, payload: { transaction_details: { order_id: string } }) => {
					const orderId = payload.transaction_details.order_id;
					const [row] = await getDb()
						.select()
						.from(tables.billingPayment)
						.where(eq(tables.billingPayment.providerOrderId, orderId));
					expect(row?.status).toBe("creating");
					return { token: "snap-token", redirectUrl: "https://app.sandbox.midtrans.com/snap/v4/redirection/x" };
				},
			);
			const result = await as("buyer").checkout({ planId: "pro-ai", idempotencyKey: "click-1" });
			expect(result).toMatchObject({
				redirectUrl: "https://app.sandbox.midtrans.com/snap/v4/redirection/x",
				reused: false,
			});
			const payment = await paymentOf(result.paymentId);
			expect(payment).toMatchObject({
				status: "pending",
				planId: "pro-ai",
				amount: 79_000,
				durationDays: 30,
				credits: 100,
				catalogVersion: 1,
				currency: "IDR",
				channel: "web",
				snapToken: "snap-token",
				providerOrderId: `RZ-${payment.id}`,
			});
			expect(+(payment.expiresAt ?? 0) - +payment.createdAt).toBeGreaterThan(DAY_MS - 1000);
			const [, payload] = fixture.create.mock.calls[0] as [unknown, Record<string, unknown>];
			expect(payload).toMatchObject({
				transaction_details: { order_id: `RZ-${payment.id}`, gross_amount: 79_000 },
				customer_details: { first_name: "Sari Wulandari", email: "sari@example.test" },
				enabled_payments: ["other_qris"],
				callbacks: { finish: `https://rezumi.test/dashboard/settings/billing/return/${payment.id}/` },
			});
		});

		it("returns the same payment for a repeated key and offers an open one again instead of doubling it", async () => {
			const first = await as("buyer").checkout({ planId: "pro-ai", idempotencyKey: "click-1" });
			const again = await as("buyer").checkout({ planId: "pro-ai", idempotencyKey: "click-1" });
			const otherClick = await as("buyer").checkout({ planId: "pro-ai", idempotencyKey: "click-2" });
			expect(again).toMatchObject({ paymentId: first.paymentId, reused: true });
			expect(otherClick).toMatchObject({ paymentId: first.paymentId, reused: true });
			const plus = await as("buyer").checkout({ planId: "plus", idempotencyKey: "click-3" });
			expect(plus.paymentId).not.toBe(first.paymentId);
			expect(fixture.create).toHaveBeenCalledTimes(2);
		});

		it("lets parallel clicks with one key open one payment", async () => {
			const results = await Promise.allSettled(
				Array.from({ length: 4 }, () => as("buyer").checkout({ planId: "plus", idempotencyKey: "same-click" })),
			);
			const rows = await getDb().select().from(tables.billingPayment);
			expect(rows).toHaveLength(1);
			expect(fixture.create).toHaveBeenCalledOnce();
			expect(results.some((result) => result.status === "fulfilled")).toBe(true);
		});

		it.each([
			["the mobile app's bearer token", "buyer", "bearer", "FORBIDDEN"],
			["an API key", "buyer", "apiKey", "FORBIDDEN"],
			["an unverified email", "unverified", "session", "EMAIL_NOT_VERIFIED"],
			["a guest account", "guest", "session", "FORBIDDEN"],
		] as const)("refuses %s", async (_name, userId, method, code) => {
			await expectCode(as(userId, method).checkout({ planId: "plus", idempotencyKey: randomUUID() }), code);
			expect(fixture.create).not.toHaveBeenCalled();
		});

		it("refuses while paused, while plans are off, and without Midtrans", async () => {
			fixture.paused = true;
			await expectCode(as("buyer").checkout({ planId: "plus", idempotencyKey: randomUUID() }), "BILLING_UNAVAILABLE");
			fixture.paused = false;
			fixture.mode = "off";
			await expectCode(as("buyer").checkout({ planId: "plus", idempotencyKey: randomUUID() }), "BILLING_UNAVAILABLE");
			fixture.mode = "on";
			fixture.serverKey = undefined;
			await expectCode(as("buyer").checkout({ planId: "plus", idempotencyKey: randomUUID() }), "BILLING_UNAVAILABLE");
			expect(fixture.create).not.toHaveBeenCalled();
			expect(await getDb().select().from(tables.billingPayment)).toHaveLength(0);
		});

		it("marks the payment failed when Snap refuses, and a new click starts over", async () => {
			const { MidtransError } = await import("./midtrans/client");
			fixture.create.mockRejectedValueOnce(
				new MidtransError({ kind: "client", operation: "snap.create", httpStatus: 400 }),
			);
			await expectCode(as("buyer").checkout({ planId: "plus", idempotencyKey: "click-1" }), "BAD_GATEWAY");
			const [failed] = await getDb().select().from(tables.billingPayment);
			expect(failed).toMatchObject({ status: "failed", failureReason: "snap_create_http_400" });
			await expectCode(as("buyer").checkout({ planId: "plus", idempotencyKey: "click-1" }), "CONFLICT");
			await expect(as("buyer").checkout({ planId: "plus", idempotencyKey: "click-2" })).resolves.toMatchObject({
				reused: false,
			});
		});

		it("shows the open payment and whether the session can buy in the summary, to web sessions only", async () => {
			const payment = await startCheckout("plus");
			const web = await as("buyer").summary();
			expect(web).toMatchObject({ canPurchase: true, purchaseBlockedBy: null, pendingPayment: { id: payment.id } });
			expect(web.pendingPayment?.redirectUrl).toContain("https://app.sandbox.midtrans.com/");
			const app = await as("buyer", "bearer").summary();
			expect(app).toMatchObject({ canPurchase: false, purchaseBlockedBy: "web_only", pendingPayment: null });
			await expect(as("unverified").summary()).resolves.toMatchObject({ purchaseBlockedBy: "email_not_verified" });
			const appView = await as("buyer", "bearer").payment({ id: payment.id });
			expect(appView).toMatchObject({ id: payment.id, status: "pending", redirectUrl: null });
		});

		it("keeps payments to their owner", async () => {
			const payment = await startCheckout();
			await expectCode(as("unverified").payment({ id: payment.id }), "NOT_FOUND");
		});
	});

	describe("notifications", () => {
		it("grants the pass and the credits once a verified settlement arrives", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			const response = await notify({ order_id: payment.providerOrderId });
			expect(response.status).toBe(200);
			expect(await paymentOf(payment.id)).toMatchObject({
				status: "paid",
				providerStatus: "settlement",
				paymentType: "qris",
			});
			const [period] = await periodsOf("buyer");
			expect(period).toMatchObject({ planId: "pro-ai", source: "payment", paymentId: payment.id });
			expect(+(period?.endsAt ?? 0) - +(period?.startsAt ?? 0)).toBe(30 * DAY_MS);
			const [grant] = await grantsOf("buyer");
			expect(grant).toMatchObject({ source: "plan", amount: 100, remaining: 100, paymentId: payment.id });
			expect(+(grant?.expiresAt ?? 0)).toBe(+(period?.endsAt ?? 0));
			await expect(as("buyer").summary()).resolves.toMatchObject({ planId: "pro-ai", credits: { balance: 100 } });
			const [event] = await eventsOf(payment.id);
			expect(event).toMatchObject({ source: "notification", outcome: "applied", signatureValid: true });
			expect(JSON.stringify(event?.payload)).not.toContain("signature");
			const audit = await getDb()
				.select()
				.from(tables.billingAuditLog)
				.where(eq(tables.billingAuditLog.action, "payment.fulfilled"));
			expect(audit).toHaveLength(1);
		});

		it("trusts Midtrans' status, not the notification's own fields", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "pending");
			expect((await notify({ order_id: payment.providerOrderId, transaction_status: "settlement" })).status).toBe(200);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "pending" });
			expect(await periodsOf("buyer")).toHaveLength(0);
		});

		it("fulfils exactly once when notifications and status checks race", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			const later = new Date(+payment.createdAt + 3 * 60 * 1000);
			const results = await Promise.all([
				notify({ order_id: payment.providerOrderId }),
				notify({ order_id: payment.providerOrderId }),
				notify({ order_id: payment.providerOrderId }),
				syncPaymentStatus(payment.id),
				reconcilePayments(later),
				as("buyer").payment({ id: payment.id }),
			]);
			expect(results.slice(0, 3).map((response) => (response as Response).status)).toEqual([200, 200, 200]);
			expect(await periodsOf("buyer")).toHaveLength(1);
			expect(await grantsOf("buyer")).toHaveLength(1);
			const events = await eventsOf(payment.id);
			expect(events.filter((event) => event.outcome === "applied")).toHaveLength(1);
		});

		it("records a duplicate notification without granting again", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			await notify({ order_id: payment.providerOrderId });
			await notify({ order_id: payment.providerOrderId });
			expect(await periodsOf("buyer")).toHaveLength(1);
			expect(await grantsOf("buyer")).toHaveLength(1);
			expect((await eventsOf(payment.id)).map((event) => event.outcome)).toEqual(["applied", "duplicate"]);
		});

		it("keeps a paid payment paid when a late pending or expire arrives", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			await notify({ order_id: payment.providerOrderId });
			for (const status of ["pending", "expire", "cancel"]) {
				midtransSays(payment.providerOrderId, status);
				expect((await notify({ order_id: payment.providerOrderId, transaction_status: status })).status).toBe(200);
			}
			expect(await paymentOf(payment.id)).toMatchObject({ status: "paid", providerStatus: "settlement" });
			expect((await eventsOf(payment.id)).map((event) => event.outcome)).toEqual([
				"applied",
				"stale",
				"stale",
				"stale",
			]);
			expect((await periodsOf("buyer")).filter((period) => !period.revokedAt)).toHaveLength(1);
		});

		it("grants nothing when the amount doesn't match", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement", { gross_amount: "29000.00" });
			expect((await notify({ order_id: payment.providerOrderId, gross_amount: "29000.00" })).status).toBe(200);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "pending", fulfilledAt: null });
			expect(await periodsOf("buyer")).toHaveLength(0);
			expect((await eventsOf(payment.id)).map((event) => event.outcome)).toEqual(["amount_mismatch"]);
		});

		it("takes the pass and the remaining credits back on a full refund", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			await notify({ order_id: payment.providerOrderId });
			midtransSays(payment.providerOrderId, "refund", { refund_amount: "79000.00" });
			await notify({ order_id: payment.providerOrderId, transaction_status: "refund" });
			expect(await paymentOf(payment.id)).toMatchObject({ status: "refunded", refundedAmount: 79_000 });
			const [period] = await periodsOf("buyer");
			expect(period?.revokedAt).not.toBeNull();
			const [grant] = await grantsOf("buyer");
			expect(grant?.revokedAt).not.toBeNull();
			await expect(as("buyer").summary()).resolves.toMatchObject({ planId: "free", credits: { balance: 0 } });
			// Asking again changes nothing more.
			await notify({ order_id: payment.providerOrderId, transaction_status: "refund" });
			const revoked = await getDb()
				.select()
				.from(tables.billingAuditLog)
				.where(eq(tables.billingAuditLog.action, "payment.benefits_revoked"));
			expect(revoked).toHaveLength(1);
		});

		it("reverses a paid payment when the bank denies it after settlement", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			await notify({ order_id: payment.providerOrderId });
			midtransSays(payment.providerOrderId, "deny");
			await notify({ order_id: payment.providerOrderId, transaction_status: "deny" });
			expect(await paymentOf(payment.id)).toMatchObject({ status: "reversed" });
			await expect(as("buyer").summary()).resolves.toMatchObject({ planId: "free", credits: { balance: 0 } });
		});

		it("only records a partial refund", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			await notify({ order_id: payment.providerOrderId });
			midtransSays(payment.providerOrderId, "partial_refund", { refund_amount: "20000.00" });
			await notify({ order_id: payment.providerOrderId, transaction_status: "partial_refund" });
			expect(await paymentOf(payment.id)).toMatchObject({ status: "partially_refunded", refundedAmount: 20_000 });
			await expect(as("buyer").summary()).resolves.toMatchObject({ planId: "pro-ai", credits: { balance: 100 } });
		});

		it("gives the pass to a customer who paid after the payment expired", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "expire");
			await notify({ order_id: payment.providerOrderId, transaction_status: "expire" });
			expect(await paymentOf(payment.id)).toMatchObject({ status: "expired" });
			midtransSays(payment.providerOrderId, "settlement");
			await notify({ order_id: payment.providerOrderId });
			expect(await paymentOf(payment.id)).toMatchObject({ status: "paid" });
			expect(await periodsOf("buyer")).toHaveLength(1);
		});

		it("acknowledges an order that isn't Rezumi's without changing anything", async () => {
			const payment = await startCheckout();
			const response = await notify({ order_id: "ORDER-from-the-dashboard-test" });
			expect(response.status).toBe(200);
			const events = await getDb()
				.select()
				.from(tables.billingPaymentEvent)
				.where(isNull(tables.billingPaymentEvent.paymentId));
			expect(events).toMatchObject([{ providerOrderId: "ORDER-from-the-dashboard-test", outcome: "unknown_order" }]);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "pending" });
		});

		it("accepts notifications signed with the account's Signature Secret Key, and still the server key", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			expect((await notify({ order_id: payment.providerOrderId }, undefined, "SB-signature-secret")).status).toBe(403);
			fixture.signatureKey = "SB-signature-secret";
			expect((await notify({ order_id: payment.providerOrderId }, undefined, "SB-signature-secret")).status).toBe(200);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "paid" });
			expect((await notify({ order_id: payment.providerOrderId })).status).toBe(200);
			expect((await eventsOf(payment.id)).map((event) => event.outcome)).toEqual([
				"rejected_signature",
				"applied",
				"duplicate",
			]);
		});

		it("refuses a bad signature with 403 and changes nothing", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			const response = await notify({ order_id: payment.providerOrderId }, "0".repeat(128));
			expect(response.status).toBe(403);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "pending" });
			expect(await periodsOf("buyer")).toHaveLength(0);
			expect((await eventsOf(payment.id)).map((event) => [event.outcome, event.signatureValid])).toEqual([
				["rejected_signature", false],
			]);
			// Garbage for orders that don't exist isn't stored.
			expect((await notify({ order_id: "ORDER-unknown" }, "0".repeat(128))).status).toBe(403);
			expect(await getDb().select().from(tables.billingPaymentEvent)).toHaveLength(1);
		});

		it("still applies payments while plans are off, so none is lost", async () => {
			const payment = await startCheckout();
			fixture.mode = "off";
			midtransSays(payment.providerOrderId, "settlement");
			expect((await notify({ order_id: payment.providerOrderId })).status).toBe(200);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "paid" });
			expect(await periodsOf("buyer")).toHaveLength(1);
		});

		it("answers 503 for Midtrans to retry when its status can't be read yet", async () => {
			const payment = await startCheckout();
			expect((await notify({ order_id: payment.providerOrderId })).status).toBe(503);
			fixture.statusError = new Error("Midtrans is down");
			midtransSays(payment.providerOrderId, "settlement");
			expect((await notify({ order_id: payment.providerOrderId })).status).toBe(503);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "pending" });
		});

		it("answers 404 without Midtrans set up, and 400 for a body that isn't a notification", async () => {
			const payment = await startCheckout();
			expect(
				(
					await handleMidtransNotification(
						new Request("https://rezumi.test/api/payments/midtrans/notification", { method: "POST", body: "not json" }),
					)
				).status,
			).toBe(400);
			fixture.serverKey = undefined;
			expect((await notify({ order_id: payment.providerOrderId })).status).toBe(404);
		});
	});

	describe("status checks and the billing job", () => {
		it("checks an open payment when its page is looked at, at most every 10 seconds", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			await expect(as("buyer").payment({ id: payment.id })).resolves.toMatchObject({
				status: "paid",
				redirectUrl: null,
			});
			const events = await eventsOf(payment.id);
			expect(events).toMatchObject([{ source: "status_check", outcome: "applied" }]);
		});

		it("backs off between the job's checks and expires a payment whose window closed unpaid", async () => {
			const payment = await startCheckout();
			const start = +payment.createdAt;
			expect(await reconcilePayments(new Date(start + 60 * 1000))).toBe(0);
			expect(await reconcilePayments(new Date(start + 3 * 60 * 1000))).toBe(1);
			// Checked a moment ago: the next check waits.
			expect(await reconcilePayments(new Date(start + 4 * 60 * 1000))).toBe(0);
			expect(await paymentOf(payment.id)).toMatchObject({ status: "pending", checkAttempts: 1 });
			expect(fixture.expire).not.toHaveBeenCalled();
			const closed = new Date(+(payment.expiresAt ?? 0) + 31 * 60 * 1000);
			expect(await reconcilePayments(closed)).toBe(1);
			expect(fixture.expire).toHaveBeenCalledOnce();
			expect(await paymentOf(payment.id)).toMatchObject({ status: "expired", failureReason: "window_closed" });
			expect(await periodsOf("buyer")).toHaveLength(0);
		});

		it("takes Midtrans' answer after expiring, even when it turns out paid", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			fixture.expire.mockResolvedValueOnce("not_allowed");
			await reconcilePayments(new Date(+(payment.expiresAt ?? 0) + 31 * 60 * 1000));
			expect(await paymentOf(payment.id)).toMatchObject({ status: "paid" });
		});

		it("lets two job runs at once check each payment once", async () => {
			await startCheckout("plus");
			await startCheckout("pro-ai");
			const later = new Date(Date.now() + 3 * 60 * 1000);
			const [a, b] = await Promise.all([reconcilePayments(later), reconcilePayments(later)]);
			expect(a + b).toBe(2);
		});

		it("sends the receipt once, after fulfilment, and retries one that failed", async () => {
			const payment = await startCheckout();
			midtransSays(payment.providerOrderId, "settlement");
			await notify({ order_id: payment.providerOrderId });
			fixture.deliver.mockRejectedValueOnce(new Error("The email could not be delivered (EAUTH)."));
			const now = new Date();
			expect((await runBillingJobs(now)).sentReceipts).toBe(0);
			// Within the lease nobody tries again.
			expect((await runBillingJobs(new Date(+now + 60 * 1000))).sentReceipts).toBe(0);
			expect((await runBillingJobs(new Date(+now + 6 * 60 * 1000))).sentReceipts).toBe(1);
			expect((await runBillingJobs(new Date(+now + 12 * 60 * 1000))).sentReceipts).toBe(0);
			expect(fixture.deliver).toHaveBeenCalledTimes(2);
			const [{ to, receipt }] = fixture.deliver.mock.calls[1] as [{ to: string; receipt: Record<string, unknown> }];
			expect(to).toBe("sari@example.test");
			expect(receipt).toMatchObject({
				orderId: payment.providerOrderId,
				planName: "Pro AI",
				amount: "Rp79.000",
				method: "QRIS",
				credits: 100,
				durationDays: 30,
				seller: { brand: "Rezumi" },
			});
			expect(String(receipt.paidAt)).toContain("WIB");
			expect((await paymentOf(payment.id)).receiptSentAt).not.toBeNull();
		});
	});

	describe("changing the payment method", () => {
		it("closes the old page and order, then opens a new payment", async () => {
			const old = await startCheckout("plus");
			const result = await as("buyer").changePaymentMethod({ paymentId: old.id });
			expect(fixture.cancelSnap).toHaveBeenCalledOnce();
			expect(fixture.cancel).toHaveBeenCalledOnce();
			expect(await paymentOf(old.id)).toMatchObject({ status: "cancelled", failureReason: "method_changed" });
			expect(result.paymentId).not.toBe(old.id);
			expect(await paymentOf(result.paymentId)).toMatchObject({ status: "pending", planId: "plus" });
			await expectCode(as("buyer").changePaymentMethod({ paymentId: old.id }), "CONFLICT");
		});

		it("applies an old payment that turns out paid instead of opening a new one", async () => {
			const old = await startCheckout();
			midtransSays(old.providerOrderId, "settlement");
			fixture.cancel.mockResolvedValueOnce("not_allowed");
			await expectCode(as("buyer").changePaymentMethod({ paymentId: old.id }), "CONFLICT");
			expect(await paymentOf(old.id)).toMatchObject({ status: "paid" });
			expect(await getDb().select().from(tables.billingPayment)).toHaveLength(1);
			expect(await periodsOf("buyer")).toHaveLength(1);
		});
	});

	describe("passes bought one after another", () => {
		it("keeps the payment on the rest of a pass a higher plan pushed back, so a refund takes all of it", async () => {
			const plus = await startCheckout("plus");
			midtransSays(plus.providerOrderId, "settlement", { gross_amount: "29000.00" });
			await notify({ order_id: plus.providerOrderId, gross_amount: "29000.00" });
			const pro = await startCheckout("pro-ai");
			midtransSays(pro.providerOrderId, "settlement");
			await notify({ order_id: pro.providerOrderId });
			const plusPieces = (await periodsOf("buyer")).filter((period) => period.planId === "plus");
			expect(plusPieces.length).toBe(2);
			expect(plusPieces.every((period) => period.paymentId === plus.id)).toBe(true);
			midtransSays(plus.providerOrderId, "refund", { gross_amount: "29000.00" });
			await notify({ order_id: plus.providerOrderId, gross_amount: "29000.00", transaction_status: "refund" });
			const left = await getDb()
				.select()
				.from(tables.membershipPeriod)
				.where(and(eq(tables.membershipPeriod.userId, "buyer"), isNull(tables.membershipPeriod.revokedAt)));
			expect(left.filter((period) => period.endsAt > new Date()).map((period) => period.planId)).toEqual(["pro-ai"]);
		});

		it("lists the account's payments newest first, a page at a time", async () => {
			const first = await startCheckout("plus");
			const second = await startCheckout("pro-ai");
			const page = await as("buyer").payments({ limit: 1 });
			expect(page.items.map((item) => item.id)).toEqual([second.id]);
			const next = await as("buyer").payments({ limit: 1, cursor: page.nextCursor ?? undefined });
			expect(next).toMatchObject({ items: [{ id: first.id }], nextCursor: null });
		});
	});
});
