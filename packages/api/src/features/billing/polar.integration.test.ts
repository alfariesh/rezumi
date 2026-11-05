import type { BillingMode } from "./entitlements";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { PolarClientError, PolarNetworkError } from "@polar-sh/sdk";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

const PRODUCTS = {
	plusMonthly: "1eed6e9a-623e-4773-9f35-dbec17a0a0d4",
	plusYearly: "1dd73112-6f2c-43f1-a546-48454c07a588",
	proMonthly: "5e164955-b367-4f38-90ff-1f07715d8833",
	proYearly: "1aa24a00-f999-49cc-b1c2-c21ebe69a917",
} as const;
const signingKey = randomBytes(32);

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as BillingMode,
	secret: "" as string,
	polar: undefined as unknown,
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
			BILLING_CHECKOUT_PAUSED: false,
			get BILLING_MODE() {
				return fixture.mode;
			},
			POLAR_ENVIRONMENT: "sandbox",
			POLAR_ACCESS_TOKEN: "polar_oat_test",
			get POLAR_WEBHOOK_SECRET() {
				return fixture.secret || undefined;
			},
			POLAR_PRODUCT_PLUS_MONTHLY: "1eed6e9a-623e-4773-9f35-dbec17a0a0d4",
			POLAR_PRODUCT_PLUS_YEARLY: "1dd73112-6f2c-43f1-a546-48454c07a588",
			POLAR_PRODUCT_PRO_AI_MONTHLY: "5e164955-b367-4f38-90ff-1f07715d8833",
			POLAR_PRODUCT_PRO_AI_YEARLY: "1aa24a00-f999-49cc-b1c2-c21ebe69a917",
		},
	};
});
vi.mock("./polar/client", async () => {
	const actual = await vi.importActual<typeof import("./polar/client")>("./polar/client");
	return { ...actual, polarApi: () => fixture.polar };
});
vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return {
		protectedProcedure: os.$context<{
			user: { id: string };
			authentication: { user: { id: string }; method: "apiKey" | "bearer" | "session" };
		}>(),
	};
});
// Alert emails go nowhere in tests.
vi.mock("@rezumi/email/billing", () => ({ deliverBillingNotice: vi.fn(async () => ({ sent: true })) }));

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

/** A fake of the Polar API parts Rezumi calls; each test sets what it needs. */
function fakePolar() {
	return {
		checkouts: { create: vi.fn(), get: vi.fn() },
		orders: {
			get: vi.fn(),
			list: vi.fn(async (): Promise<{ items: unknown[] }> => ({ items: [] })),
			invoice: vi.fn(),
			generateInvoice: vi.fn(),
		},
		subscriptions: { get: vi.fn(), update: vi.fn(), revoke: vi.fn() },
		customers: { deleteExternal: vi.fn(async () => undefined) },
		customerSessions: { create: vi.fn() },
		refunds: { create: vi.fn(), list: vi.fn(async (): Promise<{ items: unknown[] }> => ({ items: [] })) },
	};
}
type FakePolar = ReturnType<typeof fakePolar>;
const polar = () => fixture.polar as FakePolar;

const day = 24 * 60 * 60 * 1000;
const iso = (date: Date) => date.toISOString();

type SubscriptionInput = {
	id?: string;
	product?: string;
	status?: string;
	start?: Date;
	end?: Date;
	cancelAtPeriodEnd?: boolean;
	modifiedAt?: Date;
	externalId?: string;
	interval?: "month" | "year";
	endedAt?: Date | null;
	pending?: string | null;
};

function subscription(input: SubscriptionInput = {}) {
	const start = input.start ?? new Date(Date.now() - day);
	return {
		id: input.id ?? "sub_1",
		created_at: iso(new Date(+start - 1000)),
		modified_at: iso(input.modifiedAt ?? new Date()),
		amount: 999,
		currency: "usd",
		recurring_interval: input.interval ?? "month",
		recurring_interval_count: 1,
		status: input.status ?? "active",
		current_period_start: iso(start),
		current_period_end: iso(input.end ?? new Date(+start + 30 * day)),
		cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
		canceled_at: null,
		started_at: iso(start),
		ends_at: null,
		ended_at: input.endedAt ? iso(input.endedAt) : null,
		customer_id: "cus_1",
		product_id: input.product ?? PRODUCTS.proMonthly,
		discount_id: null,
		checkout_id: null,
		pending_update: input.pending ? { product_id: input.pending } : null,
		customer: { external_id: input.externalId ?? "buyer" },
		metadata: {},
	};
}

type OrderInput = {
	id?: string;
	status?: string;
	reason?: string;
	checkoutId?: string | null;
	product?: string;
	net?: number;
	refunded?: number;
	sub?: ReturnType<typeof subscription> | null;
	externalId?: string;
};

function order(input: OrderInput = {}) {
	const sub = input.sub === undefined ? subscription() : input.sub;
	return {
		id: input.id ?? "order_1",
		created_at: iso(new Date()),
		modified_at: iso(new Date()),
		status: input.status ?? "paid",
		paid: (input.status ?? "paid") !== "pending",
		billing_reason: input.reason ?? "subscription_create",
		subtotal_amount: input.net ?? 999,
		discount_amount: 0,
		net_amount: input.net ?? 999,
		tax_amount: 0,
		total_amount: input.net ?? 999,
		refunded_amount: input.refunded ?? 0,
		refunded_tax_amount: 0,
		currency: "usd",
		customer_id: "cus_1",
		product_id: input.product ?? sub?.product_id ?? PRODUCTS.proMonthly,
		subscription_id: sub?.id ?? null,
		checkout_id: input.checkoutId === undefined ? null : input.checkoutId,
		customer: { external_id: input.externalId ?? "buyer", email: "buyer@example.test" },
		subscription: sub ? { ...sub, customer: undefined, pending_update: undefined } : null,
		items: sub
			? [{ start_timestamp: sub.current_period_start, end_timestamp: sub.current_period_end, proration: false }]
			: [],
		metadata: {},
	};
}

function refund(input: {
	id?: string;
	orderId?: string;
	amount?: number;
	status?: string;
	local?: string | undefined;
	reason?: string;
}) {
	return {
		id: input.id ?? "refund_1",
		created_at: iso(new Date()),
		modified_at: iso(new Date()),
		status: input.status ?? "succeeded",
		reason: input.reason ?? "customer_request",
		amount: input.amount ?? 999,
		tax_amount: 0,
		currency: "usd",
		order_id: input.orderId ?? "order_1",
		subscription_id: "sub_1",
		customer_id: "cus_1",
		revoke_benefits: false,
		dispute: null,
		metadata: input.local ? { rezumi_refund_id: input.local } : {},
	};
}

/** A webhook request signed the way Polar signs it (Standard Webhooks). */
function signed(type: string, data: unknown, webhookId = `msg_${randomUUID()}`, key = signingKey) {
	const body = JSON.stringify({ type, timestamp: iso(new Date()), data });
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const signature = createHmac("sha256", key).update(`${webhookId}.${timestamp}.${body}`).digest("base64");
	return new Request("https://rezumi.test/api/payments/polar/webhook", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"webhook-id": webhookId,
			"webhook-timestamp": timestamp,
			"webhook-signature": `v1,${signature}`,
		},
		body,
	});
}

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("Polar billing", () => {
	let router: typeof import("./router").billingRouter;
	let handlePolarWebhook: typeof import("./webhook").handlePolarWebhook;
	let getEntitlements: typeof import("./entitlements").getEntitlements;
	let reconcile: typeof import("./reconcile");
	let endBillingForDeletedUser: typeof import("./deletion").endBillingForDeletedUser;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `polar_test_${randomUUID().replaceAll("-", "")}`;

	const as = (id: string, headers: Record<string, string> = {}) =>
		createRouterClient(router, {
			context: {
				user: { id },
				authentication: { user: { id }, method: "session" },
				reqHeaders: new Headers(headers),
				locale: "en-US",
			} as never,
		});

	const deliver = async (type: string, data: unknown, webhookId?: string) => {
		const response = await handlePolarWebhook(signed(type, data, webhookId));
		return { status: response.status, body: (await response.json()) as Record<string, unknown> };
	};

	const grantsOf = (userId: string) =>
		getDb()
			.select()
			.from(tables.aiCreditGrant)
			.where(eq(tables.aiCreditGrant.userId, userId))
			.orderBy(asc(tables.aiCreditGrant.createdAt));
	const paymentsOf = (userId: string) =>
		getDb()
			.select()
			.from(tables.billingPayment)
			.where(eq(tables.billingPayment.userId, userId))
			.orderBy(asc(tables.billingPayment.createdAt));

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
		({ handlePolarWebhook } = await import("./webhook"));
		({ getEntitlements } = await import("./entitlements"));
		reconcile = await import("./reconcile");
		({ endBillingForDeletedUser } = await import("./deletion"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		fixture.secret = `whsec_${signingKey.toString("base64")}`;
		fixture.polar = fakePolar();
		await pool.query(
			'TRUNCATE "user", released_username, billing_audit_log, billing_payment, billing_subscription, billing_payment_event, billing_notification CASCADE',
		);
		await getDb()
			.insert(tables.user)
			.values([
				{
					id: "buyer",
					name: "Buyer",
					email: "buyer@example.test",
					username: "buyer",
					displayUsername: "buyer",
					emailVerified: true,
				},
				{
					id: "owner",
					name: "Owner",
					email: "owner@example.test",
					username: "owner",
					displayUsername: "owner",
					emailVerified: true,
					role: "admin",
				},
			]);
	});

	describe("webhook endpoint", () => {
		it("is off without a secret, refuses a bad signature and accepts types it doesn't know", async () => {
			fixture.secret = "";
			expect((await handlePolarWebhook(signed("order.paid", order()))).status).toBe(404);
			fixture.secret = `whsec_${signingKey.toString("base64")}`;
			const forged = await handlePolarWebhook(signed("order.paid", order(), "msg_forged", randomBytes(32)));
			expect(forged.status).toBe(403);
			expect(await paymentsOf("buyer")).toEqual([]);
			const [alert] = await getDb().select().from(tables.billingNotification);
			expect(alert?.kind).toBe("rejected_signatures");
			expect((await handlePolarWebhook(signed("something.new", {}))).status).toBe(202);
			const stale = signed("order.paid", order());
			stale.headers.set("webhook-timestamp", String(Math.floor(Date.now() / 1000) - 3600));
			expect((await handlePolarWebhook(stale)).status).toBe(403);
		});

		it("applies a first Pro AI order once: payment, subscription, access and 100 credits", async () => {
			const first = await deliver("order.paid", order(), "msg_1");
			expect(first).toMatchObject({ status: 200, body: { outcome: "applied" } });
			const again = await deliver("order.paid", order(), "msg_1");
			expect(again).toMatchObject({ status: 200, body: { outcome: "duplicate" } });
			// The same order reported by another event changes nothing either.
			expect((await deliver("order.updated", order(), "msg_2")).body.outcome).toBe("duplicate");

			const [payment] = await paymentsOf("buyer");
			expect(payment).toMatchObject({
				status: "paid",
				providerOrderId: "order_1",
				planId: "pro-ai",
				interval: "month",
				amount: 999,
				currency: "usd",
				credits: 100,
				billingReason: "subscription_create",
			});
			expect(payment?.fulfilledAt).toBeInstanceOf(Date);
			const grants = await grantsOf("buyer");
			expect(grants).toHaveLength(1);
			expect(grants[0]).toMatchObject({ source: "plan", amount: 100, paymentId: payment?.id });
			const entitlements = await getEntitlements("buyer");
			expect(entitlements).toMatchObject({ planId: "pro-ai", source: "subscription", renews: true });
			const events = await getDb().select().from(tables.billingPaymentEvent);
			expect(events.filter((event) => event.webhookId === "msg_1")).toHaveLength(1);
		});

		it("links a paid order to the checkout Rezumi opened", async () => {
			polar().checkouts.create.mockResolvedValue({
				id: "checkout_1",
				url: "https://sandbox.polar.sh/checkout/abc",
				expires_at: iso(new Date(Date.now() + day)),
				status: "open",
			});
			const opened = await as("buyer", { "cf-ipcountry": "ID" }).checkout({
				planId: "plus",
				interval: "year",
				idempotencyKey: "click-1",
			});
			expect(opened).toMatchObject({ redirectUrl: "https://sandbox.polar.sh/checkout/abc", reused: false });
			const call = polar().checkouts.create.mock.calls[0]?.[0];
			expect(call).toMatchObject({
				products: [PRODUCTS.plusYearly],
				external_customer_id: "buyer",
				customer_email: "buyer@example.test",
				currency: "idr",
				metadata: { rezumi_payment_id: opened.paymentId },
			});
			expect(call.success_url).toBe(
				`https://rezumi.test/dashboard/settings/billing/return/${opened.paymentId}?checkout_id={CHECKOUT_ID}`,
			);
			// The same click, and a new click for the same plan, get the open checkout back.
			await expect(
				as("buyer", { "cf-ipcountry": "ID" }).checkout({ planId: "plus", interval: "year", idempotencyKey: "click-1" }),
			).resolves.toMatchObject({ paymentId: opened.paymentId, reused: true });
			await expect(
				as("buyer", { "cf-ipcountry": "ID" }).checkout({ planId: "plus", interval: "year", idempotencyKey: "click-2" }),
			).resolves.toMatchObject({ paymentId: opened.paymentId, reused: true });
			expect(polar().checkouts.create).toHaveBeenCalledOnce();

			const sub = subscription({ product: PRODUCTS.plusYearly, interval: "year" });
			await deliver("order.paid", { ...order({ sub, checkoutId: "checkout_1", net: 45_900_000 }), currency: "idr" });
			const payments = await paymentsOf("buyer");
			expect(payments).toHaveLength(1);
			expect(payments[0]).toMatchObject({
				id: opened.paymentId,
				status: "paid",
				providerOrderId: "order_1",
				amount: 45_900_000,
				currency: "idr",
				credits: 0,
			});
			// Subscribed now: a second checkout is refused; the plan changes instead.
			await expect(
				as("buyer").checkout({ planId: "pro-ai", interval: "month", idempotencyKey: "click-3" }),
			).rejects.toMatchObject({ code: "CONFLICT" });
		});

		it("records a renewal as a new payment with a new month of credits", async () => {
			const start = new Date(Date.now() - 29 * day);
			const firstSub = subscription({
				start,
				end: new Date(+start + 30 * day),
				modifiedAt: new Date(Date.now() - 1000),
			});
			await deliver("order.paid", order({ sub: firstSub }));
			const renewed = subscription({ start: new Date(+start + 30 * day), end: new Date(+start + 60 * day) });
			await deliver("subscription.cycled", renewed);
			await deliver("order.paid", order({ id: "order_2", reason: "subscription_cycle", sub: renewed }));
			const payments = await paymentsOf("buyer");
			expect(payments.map((payment) => payment.billingReason)).toEqual(["subscription_create", "subscription_cycle"]);
			const grants = await grantsOf("buyer");
			expect(grants.map((grant) => grant.amount)).toEqual([100, 100]);
			expect(grants.map((grant) => grant.expiresAt)).toEqual([
				new Date(firstSub.current_period_end),
				new Date(renewed.current_period_end),
			]);
			const [row] = await getDb().select().from(tables.billingSubscription);
			expect(row?.paidThrough).toEqual(new Date(renewed.current_period_end));
			expect(await getEntitlements("buyer")).toMatchObject({
				planId: "pro-ai",
				currentPeriodEndsAt: new Date(renewed.current_period_end),
			});
		});

		it("gives an upgrade's month of credits once, however many plan-change orders there are", async () => {
			await deliver("order.paid", order({ sub: subscription({ product: PRODUCTS.plusMonthly }) }));
			expect(await grantsOf("buyer")).toEqual([]);
			const upgraded = subscription({ product: PRODUCTS.proMonthly });
			await deliver("order.paid", order({ id: "order_2", reason: "subscription_update", sub: upgraded, net: 300 }));
			await deliver("order.paid", order({ id: "order_3", reason: "subscription_update", sub: upgraded, net: 200 }));
			expect((await grantsOf("buyer")).map((grant) => grant.amount)).toEqual([100]);
			expect((await getEntitlements("buyer")).planId).toBe("pro-ai");
		});

		it("keeps the newest subscription state whatever order its events come in", async () => {
			await deliver("order.paid", order());
			const now = Date.now();
			await deliver(
				"subscription.updated",
				subscription({ cancelAtPeriodEnd: true, modifiedAt: new Date(now + 2000) }),
			);
			const older = await deliver("subscription.updated", subscription({ modifiedAt: new Date(now + 1000) }));
			expect(older.body.outcome).toBe("stale");
			expect(await getEntitlements("buyer")).toMatchObject({ planId: "pro-ai", renews: false });
			await deliver(
				"subscription.revoked",
				subscription({ status: "canceled", endedAt: new Date(), modifiedAt: new Date(now + 3000) }),
			);
			expect((await getEntitlements("buyer")).planId).toBe("free");
		});

		it("stops a past-due subscription at the last paid period", async () => {
			const start = new Date(Date.now() - 31 * day);
			const paidSub = subscription({ start, end: new Date(Date.now() - day), modifiedAt: new Date(+start + 1000) });
			await deliver("order.paid", order({ sub: paidSub }));
			await deliver(
				"subscription.past_due",
				subscription({ status: "past_due", start: new Date(Date.now() - day), end: new Date(Date.now() + 29 * day) }),
			);
			expect((await getEntitlements("buyer")).planId).toBe("free");
			const [row] = await getDb().select().from(tables.billingSubscription);
			expect(row).toMatchObject({ status: "past_due", paidThrough: new Date(paidSub.current_period_end) });
		});

		it("takes a fully refunded order's credits back and leaves access to the subscription", async () => {
			await deliver("order.paid", order());
			await deliver("refund.created", refund({}));
			const [payment] = await paymentsOf("buyer");
			expect(payment).toMatchObject({ status: "refunded", refundedAmount: 999 });
			const [grant] = await grantsOf("buyer");
			expect(grant?.revokedAt).toBeInstanceOf(Date);
			const refunds = await getDb().select().from(tables.billingRefund);
			expect(refunds).toMatchObject([{ refundKey: "refund_1", method: "polar", status: "succeeded", amount: 999 }]);
			expect((await getEntitlements("buyer")).planId).toBe("pro-ai");
			// The order's own refunded event says the same; nothing doubles.
			await deliver("order.refunded", order({ status: "refunded", refunded: 999 }));
			expect(await getDb().select().from(tables.billingRefund)).toHaveLength(1);
		});

		it("fetches a refund's order first when the refund arrives before it", async () => {
			polar().orders.get.mockResolvedValue(order({ status: "refunded", refunded: 999 }));
			const result = await deliver("refund.created", refund({}));
			expect(result.status).toBe(200);
			expect(polar().orders.get).toHaveBeenCalledWith("order_1");
			const [payment] = await paymentsOf("buyer");
			expect(payment).toMatchObject({ status: "refunded", refundedAmount: 999, providerOrderId: "order_1" });
			// Refunded before it was ever seen paid: no credits were granted for it.
			expect(await grantsOf("buyer")).toEqual([]);
		});

		it("answers 503 to a failure that may pass, so Polar retries", async () => {
			polar().orders.get.mockRejectedValue(new PolarNetworkError("timeout"));
			const result = await deliver("refund.created", refund({}), "msg_retry");
			expect(result.status).toBe(503);
			// Nothing kept the webhook id: the retry is applied normally.
			polar().orders.get.mockResolvedValue(order({ status: "refunded", refunded: 999 }));
			expect((await deliver("refund.created", refund({}), "msg_retry")).status).toBe(200);
		});

		it("ignores orders for products Rezumi doesn't sell", async () => {
			const result = await deliver("order.paid", order({ product: "0d6f0b1c-0000-4000-8000-000000000000", sub: null }));
			expect(result.body.outcome).toBe("unknown_product");
			expect(await paymentsOf("buyer")).toEqual([]);
		});
	});

	describe("billing job", () => {
		it("applies a checkout paid while its webhooks were lost", async () => {
			const created = new Date(Date.now() - 5 * 60 * 1000);
			const [payment] = await getDb()
				.insert(tables.billingPayment)
				.values({
					userId: "buyer",
					providerCheckoutId: "checkout_9",
					idempotencyKey: "click",
					planId: "pro-ai",
					interval: "month",
					catalogVersion: 4,
					amount: 999,
					currency: "usd",
					status: "pending",
					redirectUrl: "https://sandbox.polar.sh/checkout/x",
					expiresAt: new Date(Date.now() + day),
					createdAt: created,
				})
				.returning();
			polar().checkouts.get.mockResolvedValue({
				id: "checkout_9",
				status: "succeeded",
				expires_at: iso(new Date(Date.now() + day)),
				created_at: iso(created),
				modified_at: iso(new Date()),
			});
			polar().orders.list.mockResolvedValue({ items: [order({ id: "order_9", checkoutId: "checkout_9" })] });
			expect(await reconcile.reconcilePayments()).toBe(1);
			const [after] = await paymentsOf("buyer");
			expect(after).toMatchObject({ id: payment?.id, status: "paid", providerOrderId: "order_9", credits: 100 });
		});

		it("grants each month of a yearly Pro AI subscription once", async () => {
			const start = new Date(Date.now() - 45 * day);
			const yearly = subscription({
				product: PRODUCTS.proYearly,
				interval: "year",
				start,
				end: new Date(+start + 365 * day),
			});
			await deliver("order.paid", order({ sub: yearly }));
			// The order brought the month that is running now (the second); the job finds nothing more to give.
			expect((await grantsOf("buyer")).map((grant) => grant.amount)).toEqual([100]);
			expect(await reconcile.grantYearlyCredits()).toBe(0);
			const nextMonth = new Date(+start + 75 * day);
			expect(await reconcile.grantYearlyCredits(nextMonth)).toBe(1);
			expect(await reconcile.grantYearlyCredits(nextMonth)).toBe(0);
			const grants = await grantsOf("buyer");
			expect(grants).toHaveLength(2);
			expect(new Set(grants.map((grant) => +grant.expiresAt)).size).toBe(2);
		});

		it("ends a deleted account's subscription at Polar", async () => {
			await deliver("order.paid", order());
			await endBillingForDeletedUser("buyer");
			expect(polar().customers.deleteExternal).toHaveBeenCalledWith("buyer", { anonymize: true });
			// Had that failed, the job ends what still bills once the account row is gone.
			await getDb()
				.update(tables.billingSubscription)
				.set({ revokedForDeletionAt: null })
				.where(eq(tables.billingSubscription.providerSubscriptionId, "sub_1"));
			await getDb().delete(tables.user).where(eq(tables.user.id, "buyer"));
			polar().subscriptions.revoke.mockRejectedValue(new PolarClientError(404, { detail: "Not found" }));
			expect(await reconcile.endDeletedAccountSubscriptions()).toBe(1);
			const [row] = await getDb().select().from(tables.billingSubscription);
			expect(row?.userId).toBeNull();
			expect(row?.revokedForDeletionAt).toBeInstanceOf(Date);
			// The payment stays for the books, without its owner.
			const [payment] = await getDb().select().from(tables.billingPayment);
			expect(payment?.userId).toBeNull();
		});
	});

	describe("subscription changes", () => {
		beforeEach(async () => {
			await deliver("order.paid", order({ sub: subscription({ product: PRODUCTS.plusMonthly }) }));
		});

		it("upgrades at once with a prorated invoice and downgrades from the next renewal", async () => {
			polar().subscriptions.update.mockResolvedValue(
				subscription({ product: PRODUCTS.proMonthly, modifiedAt: new Date(Date.now() + 1000) }),
			);
			const up = await as("buyer").changePlan({ planId: "pro-ai", interval: "month" });
			expect(polar().subscriptions.update).toHaveBeenLastCalledWith("sub_1", {
				product_id: PRODUCTS.proMonthly,
				proration_behavior: "invoice",
			});
			expect(up).toMatchObject({ effective: "now", subscription: { planId: "pro-ai" } });

			polar().subscriptions.update.mockResolvedValue(
				subscription({
					product: PRODUCTS.proMonthly,
					pending: PRODUCTS.plusMonthly,
					modifiedAt: new Date(Date.now() + 2000),
				}),
			);
			const down = await as("buyer").changePlan({ planId: "plus", interval: "month" });
			expect(polar().subscriptions.update).toHaveBeenLastCalledWith("sub_1", {
				product_id: PRODUCTS.plusMonthly,
				proration_behavior: "next_period",
			});
			expect(down).toMatchObject({
				effective: "renewal",
				subscription: { planId: "pro-ai", pendingChange: { planId: "plus", interval: "month" } },
			});
		});

		it("cancels at the period end and keeps it again, and opens the billing portal", async () => {
			polar().subscriptions.update.mockResolvedValue(
				subscription({
					product: PRODUCTS.plusMonthly,
					cancelAtPeriodEnd: true,
					modifiedAt: new Date(Date.now() + 1000),
				}),
			);
			const canceled = await as("buyer").cancelSubscription({ reason: "too_expensive" });
			expect(canceled.cancelAtPeriodEnd).toBe(true);
			expect(polar().subscriptions.update).toHaveBeenLastCalledWith("sub_1", {
				cancel_at_period_end: true,
				customer_cancellation_reason: "too_expensive",
				customer_cancellation_comment: null,
			});
			await expect(as("buyer").changePlan({ planId: "pro-ai", interval: "month" })).rejects.toMatchObject({
				code: "CONFLICT",
			});
			polar().subscriptions.update.mockResolvedValue(
				subscription({ product: PRODUCTS.plusMonthly, modifiedAt: new Date(Date.now() + 2000) }),
			);
			expect((await as("buyer").resumeSubscription()).cancelAtPeriodEnd).toBe(false);

			polar().customerSessions.create.mockResolvedValue({ customer_portal_url: "https://sandbox.polar.sh/portal/x" });
			await expect(as("buyer").portal()).resolves.toEqual({ url: "https://sandbox.polar.sh/portal/x" });
			expect(polar().customerSessions.create).toHaveBeenCalledWith({
				external_customer_id: "buyer",
				return_url: "https://rezumi.test/dashboard/settings/billing",
			});
		});

		it("refunds from the admin page through Polar and can end the subscription too", async () => {
			const [payment] = await paymentsOf("buyer");
			if (!payment) throw new Error("The paid order wasn't recorded.");
			polar().refunds.create.mockImplementation(async (body: { metadata: { rezumi_refund_id: string } }) =>
				refund({ amount: 999, local: body.metadata.rezumi_refund_id }),
			);
			polar().subscriptions.revoke.mockResolvedValue(
				subscription({
					product: PRODUCTS.plusMonthly,
					status: "canceled",
					endedAt: new Date(),
					modifiedAt: new Date(Date.now() + 1000),
				}),
			);
			const result = await as("owner").admin.refund({
				paymentId: payment.id,
				reason: "Customer asked within 7 days",
				endSubscription: true,
			});
			expect(result).toMatchObject({ status: "succeeded", paymentStatus: "refunded", subscriptionEnded: true });
			expect(polar().refunds.create).toHaveBeenCalledWith(
				expect.objectContaining({ order_id: "order_1", amount: 999, reason: "customer_request" }),
			);
			expect((await getEntitlements("buyer")).planId).toBe("free");
			// The webhook for the same refund finds it by Rezumi's id and changes nothing.
			const [local] = await getDb()
				.select()
				.from(tables.billingRefund)
				.where(and(eq(tables.billingRefund.paymentId, payment.id)));
			expect((await deliver("refund.updated", refund({ local: local?.id }))).body.outcome).toBe("duplicate");
			expect(await getDb().select().from(tables.billingRefund)).toHaveLength(1);
		});
	});
});
