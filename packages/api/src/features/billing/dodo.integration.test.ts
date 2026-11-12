import type { BillingMode } from "./entitlements";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import DodoPayments, { APIConnectionError, NotFoundError } from "dodopayments";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

const PRODUCTS = {
	plusMonthly: "pdt_plusMonthly01",
	plusYearly: "pdt_plusYearly001",
	proMonthly: "pdt_proMonthly001",
	proYearly: "pdt_proYearly0001",
} as const;
const signingKey = randomBytes(32);

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as BillingMode,
	webhookKey: "" as string,
	dodo: undefined as unknown,
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
			DODO_PAYMENTS_ENVIRONMENT: "test_mode",
			DODO_PAYMENTS_API_KEY: "test-key",
			get DODO_PAYMENTS_WEBHOOK_KEY() {
				return fixture.webhookKey || undefined;
			},
			DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY: "pdt_plusMonthly01",
			DODO_PAYMENTS_PRODUCT_PLUS_YEARLY: "pdt_plusYearly001",
			DODO_PAYMENTS_PRODUCT_PRO_AI_MONTHLY: "pdt_proMonthly001",
			DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY: "pdt_proYearly0001",
		},
	};
});
vi.mock("./dodo/client", async () => {
	const actual = await vi.importActual<typeof import("./dodo/client")>("./dodo/client");
	return { ...actual, dodoApi: () => fixture.dodo };
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

const day = 24 * 60 * 60 * 1000;
const iso = (date: Date) => date.toISOString();
const notFound = () => new NotFoundError(404, { message: "Not found" }, undefined, new Headers());

type SubscriptionInput = {
	id?: string;
	product?: string;
	status?: DodoPayments.SubscriptionStatus;
	start?: Date;
	end?: Date;
	createdAt?: Date;
	trialDays?: number;
	cancelAtPeriodEnd?: boolean;
	cancelledAt?: Date | null;
	scheduled?: string | null;
	userId?: string;
	amount?: number;
};

function subscription(input: SubscriptionInput = {}) {
	const start = input.start ?? new Date(Date.now() - day);
	return {
		subscription_id: input.id ?? "sub_1",
		status: input.status ?? "active",
		product_id: input.product ?? PRODUCTS.proMonthly,
		recurring_pre_tax_amount: input.amount ?? 999,
		currency: "USD" as const,
		previous_billing_date: iso(start),
		next_billing_date: iso(input.end ?? new Date(+start + 30 * day)),
		cancel_at_next_billing_date: input.cancelAtPeriodEnd ?? false,
		cancelled_at: input.cancelledAt ? iso(input.cancelledAt) : null,
		created_at: iso(input.createdAt ?? start),
		trial_period_days: input.trialDays ?? 0,
		scheduled_change: input.scheduled
			? {
					id: "spc_1",
					product_id: input.scheduled,
					effective_at: iso(input.end ?? new Date(+start + 30 * day)),
					created_at: iso(new Date()),
					quantity: 1,
					addons: [],
				}
			: null,
		customer: { customer_id: "cus_1", email: "buyer@example.test", name: "Buyer", metadata: {} },
		metadata: { rezumi_user_id: input.userId ?? "buyer" },
	};
}

type DodoSubscription = ReturnType<typeof subscription>;

type PaymentInput = {
	id?: string;
	status?: DodoPayments.IntentStatus;
	charge?: DodoPayments.ChargeType | null;
	checkoutId?: string | null;
	total?: number;
	tax?: number;
	currency?: string;
	sub?: DodoSubscription | null;
	refundStatus?: "partial" | "full" | null;
	refunds?: { refund_id: string; status: string; amount: number }[];
	disputes?: { dispute_id: string; dispute_status: string }[];
	userId?: string;
};

function payment(input: PaymentInput = {}) {
	const sub = input.sub === undefined ? subscription() : input.sub;
	const status = input.status ?? "succeeded";
	return {
		payment_id: input.id ?? "pay_1",
		status,
		total_amount: input.total ?? 999,
		tax: input.tax ?? 0,
		currency: input.currency ?? "USD",
		created_at: iso(new Date()),
		subscription_id: sub?.subscription_id ?? null,
		checkout_session_id: input.checkoutId ?? null,
		charge_type: input.charge === undefined ? (sub ? "new" : null) : input.charge,
		is_update_payment_method: false,
		service_periods:
			sub && status === "succeeded"
				? [
						{
							subscription_id: sub.subscription_id,
							starts_at: sub.previous_billing_date,
							ends_at: sub.next_billing_date,
						},
					]
				: [],
		refunds: input.refunds ?? [],
		refund_status: input.refundStatus ?? null,
		disputes: input.disputes ?? [],
		metadata: { rezumi_user_id: input.userId ?? "buyer" },
		customer: { customer_id: "cus_1", email: "buyer@example.test", name: "Buyer", metadata: {} },
	};
}

type DodoPayment = ReturnType<typeof payment>;

function refund(input: {
	id?: string;
	paymentId?: string;
	amount?: number;
	status?: string;
	local?: string | undefined;
	partial?: boolean;
}) {
	return {
		refund_id: input.id ?? "ref_1",
		payment_id: input.paymentId ?? "pay_1",
		status: input.status ?? "succeeded",
		is_partial: input.partial ?? false,
		amount: input.amount ?? 999,
		currency: "USD",
		reason: "Customer request",
		created_at: iso(new Date()),
		metadata: input.local ? { rezumi_refund_id: input.local } : {},
		customer: { customer_id: "cus_1", email: "buyer@example.test", name: "Buyer" },
	};
}

/**
 * A fake of the Dodo API parts Rezumi calls. Subscriptions and payments live in maps the tests fill, so the handler's
 * reads find the state the test set; webhook signatures are checked by the real SDK.
 */
function fakeDodo() {
	const subscriptions = new Map<string, DodoSubscription>();
	const payments = new Map<string, DodoPayment>();
	const real = new DodoPayments({ bearerToken: "test", environment: "test_mode" });
	return {
		subscriptions: {
			byId: subscriptions,
			retrieve: vi.fn(async (id: string) => {
				const found = subscriptions.get(id);
				if (!found) throw notFound();
				return found;
			}),
			update: vi.fn(),
			changePlan: vi.fn(async (_id: string, _body: Record<string, unknown>) => ({})),
		},
		payments: {
			byId: payments,
			retrieve: vi.fn(async (id: string) => {
				const found = payments.get(id);
				if (!found) throw notFound();
				return found;
			}),
			list: vi.fn(async (): Promise<{ items: { payment_id: string; created_at: string }[] }> => ({ items: [] })),
			retrieveLineItems: vi.fn(),
		},
		checkoutSessions: { create: vi.fn(), retrieve: vi.fn() },
		customers: {
			create: vi.fn(async () => ({ customer_id: "cus_1" })),
			customerPortal: { create: vi.fn() },
		},
		refunds: { create: vi.fn(), retrieve: vi.fn() },
		invoices: { payments: { retrieve: vi.fn() } },
		webhooks: real.webhooks,
	};
}
type FakeDodo = ReturnType<typeof fakeDodo>;
const dodo = () => fixture.dodo as FakeDodo;

/** Puts a subscription where the handler's reads find it, as Dodo would have it now. */
const atDodo = (sub: DodoSubscription) => {
	dodo().subscriptions.byId.set(sub.subscription_id, sub);
	return sub;
};

/** A webhook request signed the way Dodo signs it (Standard Webhooks). */
function signed(type: string, data: unknown, webhookId = `msg_${randomUUID()}`, key = signingKey) {
	const body = JSON.stringify({ business_id: "bus_1", type, timestamp: iso(new Date()), data });
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const signature = createHmac("sha256", key).update(`${webhookId}.${timestamp}.${body}`).digest("base64");
	return new Request("https://rezumi.test/api/payments/dodo/webhook", {
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

describe.skipIf(!databaseUrl)("Dodo Payments billing", () => {
	let router: typeof import("./router").billingRouter;
	let handleDodoWebhook: typeof import("./webhook").handleDodoWebhook;
	let getEntitlements: typeof import("./entitlements").getEntitlements;
	let reconcile: typeof import("./reconcile");
	let endBillingForDeletedUser: typeof import("./deletion").endBillingForDeletedUser;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `dodo_test_${randomUUID().replaceAll("-", "")}`;

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
		const response = await handleDodoWebhook(signed(type, data, webhookId));
		return { status: response.status, body: (await response.json()) as Record<string, unknown> };
	};
	/** A payment's webhook, with its subscription as Dodo has it now. */
	const pay = (input: PaymentInput = {}, webhookId?: string) => {
		const data = payment(input);
		if (input.sub !== null) atDodo(input.sub ?? subscription());
		dodo().payments.byId.set(data.payment_id, data);
		return deliver(`payment.${data.status === "succeeded" ? "succeeded" : data.status}`, data, webhookId);
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
	const session = (id: string) => ({
		session_id: id,
		checkout_url: `https://test.checkout.dodopayments.com/session/${id}`,
	});

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
		({ handleDodoWebhook } = await import("./webhook"));
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
		fixture.webhookKey = `whsec_${signingKey.toString("base64")}`;
		fixture.dodo = fakeDodo();
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
		it("is off without a key, refuses a bad signature and keeps types it doesn't handle", async () => {
			fixture.webhookKey = "";
			expect((await handleDodoWebhook(signed("payment.succeeded", payment()))).status).toBe(404);
			fixture.webhookKey = `whsec_${signingKey.toString("base64")}`;
			const forged = await handleDodoWebhook(signed("payment.succeeded", payment(), "msg_x", randomBytes(32)));
			expect(forged.status).toBe(403);
			expect(await paymentsOf("buyer")).toEqual([]);
			const payout = await deliver("payout.created", { payout_id: "po_1" }, "msg_payout");
			expect(payout).toMatchObject({ status: 200, body: { outcome: "ignored" } });
		});

		it("applies a first Pro AI payment once: payment, subscription, access and 100 credits", async () => {
			const first = await pay({}, "msg_1");
			expect(first).toMatchObject({ status: 200, body: { outcome: "applied" } });
			const again = await pay({}, "msg_1");
			expect(again).toMatchObject({ status: 200, body: { outcome: "duplicate" } });
			// The same payment reported by another delivery changes nothing either.
			expect((await pay({}, "msg_2")).body.outcome).toBe("duplicate");

			const [row] = await paymentsOf("buyer");
			expect(row).toMatchObject({
				provider: "dodo",
				status: "paid",
				providerPaymentId: "pay_1",
				planId: "pro-ai",
				interval: "month",
				amount: 999,
				currency: "usd",
				credits: 100,
				billingReason: "subscription_create",
			});
			expect(row?.fulfilledAt).toBeInstanceOf(Date);
			const grants = await grantsOf("buyer");
			expect(grants).toHaveLength(1);
			expect(grants[0]).toMatchObject({ source: "plan", amount: 100, paymentId: row?.id });
			expect(await getEntitlements("buyer")).toMatchObject({
				planId: "pro-ai",
				source: "subscription",
				renews: true,
			});
			const events = await getDb().select().from(tables.billingPaymentEvent);
			expect(events.filter((event) => event.webhookId === "msg_1")).toHaveLength(1);
		});

		it("keeps tax apart: the amount is what Rezumi earns before tax", async () => {
			await pay({ total: 1189, tax: 190 });
			expect((await paymentsOf("buyer"))[0]).toMatchObject({ amount: 999, taxAmount: 190, totalAmount: 1189 });
		});

		it("opens a checkout for its own customer, in US dollars even from Indonesia, and links the paid payment to it", async () => {
			dodo().checkoutSessions.create.mockResolvedValue(session("cks_1"));
			const opened = await as("buyer", { "cf-ipcountry": "ID" }).checkout({
				planId: "plus",
				interval: "year",
				idempotencyKey: "click-1",
			});
			expect(opened).toMatchObject({
				redirectUrl: "https://test.checkout.dodopayments.com/session/cks_1",
				reused: false,
			});
			expect(dodo().customers.create).toHaveBeenCalledWith({
				email: "buyer@example.test",
				name: "Buyer",
				metadata: { rezumi_user_id: "buyer" },
				preferred_locale: "en",
			});
			const call = dodo().checkoutSessions.create.mock.calls[0]?.[0];
			expect(call).toMatchObject({
				product_cart: [{ product_id: PRODUCTS.plusYearly, quantity: 1 }],
				customer: { customer_id: "cus_1" },
				// Cards pay in US dollars: Rupiah is paid by QRIS (not set up in this test, so a card is the only way).
				billing_currency: "USD",
				feature_flags: { allow_currency_selection: false, allow_discount_code: true },
				subscription_data: { trial_period_days: 7 },
				metadata: { rezumi_payment_id: opened.paymentId, rezumi_user_id: "buyer" },
				return_url: `https://rezumi.test/dashboard/settings/billing/return/${opened.paymentId}`,
			});
			// The same click, and a new click for the same plan, get the open checkout back.
			await expect(
				as("buyer", { "cf-ipcountry": "ID" }).checkout({ planId: "plus", interval: "year", idempotencyKey: "click-1" }),
			).resolves.toMatchObject({ paymentId: opened.paymentId, reused: true });
			await expect(
				as("buyer", { "cf-ipcountry": "ID" }).checkout({ planId: "plus", interval: "year", idempotencyKey: "click-2" }),
			).resolves.toMatchObject({ paymentId: opened.paymentId, reused: true });
			expect(dodo().checkoutSessions.create).toHaveBeenCalledOnce();
			expect(call).not.toHaveProperty("billing_address");
			const [account] = await getDb().select().from(tables.billingAccount);
			expect(account?.providerCustomerId).toBe("cus_1");

			const sub = subscription({ product: PRODUCTS.plusYearly, end: new Date(Date.now() + 365 * day) });
			await pay({ sub, checkoutId: "cks_1", total: 3_900, currency: "USD" });
			const payments = await paymentsOf("buyer");
			expect(payments).toHaveLength(1);
			expect(payments[0]).toMatchObject({
				id: opened.paymentId,
				status: "paid",
				providerPaymentId: "pay_1",
				amount: 3_900,
				currency: "usd",
				credits: 0,
			});
			// Subscribed now: a second checkout is refused; the plan changes instead.
			await expect(
				as("buyer").checkout({ planId: "pro-ai", interval: "month", idempotencyKey: "click-3" }),
			).rejects.toMatchObject({ code: "CONFLICT" });
		});

		it("gives a first Plus subscription a 7-day free trial, and records its $0 start apart from sales", async () => {
			dodo().checkoutSessions.create.mockResolvedValueOnce(session("cks_pro")).mockResolvedValueOnce(session("cks_t"));
			expect((await as("buyer").summary()).trialAvailable).toBe(true);
			// Pro AI has no trial; Plus does, set on the checkout.
			await as("buyer").checkout({ planId: "pro-ai", interval: "month", idempotencyKey: "pro" });
			expect(dodo().checkoutSessions.create.mock.calls[0]?.[0]).toMatchObject({
				subscription_data: { trial_period_days: 0 },
				billing_currency: "USD",
			});
			expect(dodo().checkoutSessions.create.mock.calls[0]?.[0]).not.toHaveProperty("billing_address");
			const opened = await as("buyer").checkout({ planId: "plus", interval: "month", idempotencyKey: "plus" });
			expect(dodo().checkoutSessions.create.mock.calls[1]?.[0]).toMatchObject({
				subscription_data: { trial_period_days: 7 },
			});
			expect(dodo().customers.create).toHaveBeenCalledOnce();

			// Dodo saves the card with a $0 payment and keeps the subscription active until the trial's end.
			const trialEnd = new Date(Date.now() + 7 * day);
			const trial = subscription({
				product: PRODUCTS.plusMonthly,
				start: new Date(),
				end: trialEnd,
				trialDays: 7,
				amount: 499,
			});
			await pay({ sub: trial, checkoutId: "cks_t", total: 0 });
			const [started] = (await paymentsOf("buyer")).filter((row) => row.id === opened.paymentId);
			expect(started).toMatchObject({ status: "paid", amount: 0, totalAmount: 0, trialDays: 7, periodEnd: trialEnd });
			const [kept] = await getDb().select().from(tables.billingSubscription);
			expect(kept?.status).toBe("trialing");
			expect(await getEntitlements("buyer")).toMatchObject({
				planId: "plus",
				renews: true,
				currentPeriodEndsAt: trialEnd,
			});
			expect((await as("buyer").summary()).trialAvailable).toBe(false);

			const metrics = await as("owner").admin.metrics({
				from: new Date(Date.now() - day),
				to: new Date(Date.now() + day),
			});
			expect(metrics.sales.payments).toBe(0);
			expect(metrics.subscriptions).toMatchObject({ active: 0, trialing: 1, trialsStarted: 1, mrr: {} });

			// The first charge at the trial's end is a renewal: the trial is over.
			const converted = subscription({
				product: PRODUCTS.plusMonthly,
				createdAt: new Date(),
				start: trialEnd,
				end: new Date(+trialEnd + 30 * day),
				trialDays: 7,
				amount: 499,
			});
			await pay({ id: "pay_2", sub: converted, charge: "renewal", total: 499 });
			const [after] = await getDb().select().from(tables.billingSubscription);
			expect(after?.status).toBe("active");
		});

		it("gives no trial once the account has had a subscription", async () => {
			await pay({ sub: subscription({ product: PRODUCTS.plusMonthly, status: "cancelled", cancelledAt: new Date() }) });
			dodo().checkoutSessions.create.mockResolvedValue(session("cks_2"));
			await as("buyer").checkout({ planId: "plus", interval: "month", idempotencyKey: "again" });
			expect(dodo().checkoutSessions.create.mock.calls[0]?.[0]).toMatchObject({
				subscription_data: { trial_period_days: 0 },
			});
			expect((await as("buyer").summary()).trialAvailable).toBe(false);
		});

		it("records a renewal as a new payment with a new month of credits", async () => {
			const start = new Date(Date.now() - 40 * day);
			await pay({ sub: subscription({ start, end: new Date(+start + 30 * day) }) });
			const renewed = subscription({ start: new Date(+start + 30 * day), end: new Date(+start + 60 * day) });
			await pay({ id: "pay_2", sub: renewed, charge: "renewal" });
			const payments = await paymentsOf("buyer");
			expect(payments.map((row) => [row.billingReason, row.credits])).toEqual([
				["subscription_create", 0],
				["subscription_cycle", 100],
			]);
			const [sub] = await getDb().select().from(tables.billingSubscription);
			expect(sub?.paidThrough).toEqual(new Date(+start + 60 * day));
		});

		it("reads a subscription again before applying its webhook, so an older copy can't undo a newer state", async () => {
			await pay();
			const cancelledCopy = subscription({ status: "cancelled", cancelledAt: new Date() });
			// Dodo has it active again (a later change): the event's own copy is old news.
			atDodo(subscription());
			await deliver("subscription.cancelled", cancelledCopy);
			const [kept] = await getDb().select().from(tables.billingSubscription);
			expect(kept?.status).toBe("active");
			expect(dodo().subscriptions.retrieve).toHaveBeenLastCalledWith("sub_1");
			atDodo(subscription({ cancelAtPeriodEnd: true }));
			await deliver("subscription.updated", subscription());
			expect((await getEntitlements("buyer")).renews).toBe(false);
		});

		it("stops an on-hold subscription at the last paid period", async () => {
			const start = new Date(Date.now() - 31 * day);
			await pay({ sub: subscription({ start, end: new Date(+start + 30 * day) }) });
			atDodo(subscription({ status: "on_hold", start, end: new Date(+start + 30 * day) }));
			await deliver("subscription.on_hold", subscription());
			expect((await getEntitlements("buyer")).planId).toBe("free");
			// It still counts as the account's subscription: no second one, and plan changes wait for the payment.
			await expect(
				as("buyer").checkout({ planId: "plus", interval: "month", idempotencyKey: "x" }),
			).rejects.toMatchObject({ code: "CONFLICT" });
			await expect(as("buyer").changePlan({ planId: "pro-ai", interval: "year" })).rejects.toMatchObject({
				code: "CONFLICT",
			});
		});

		it("takes a fully refunded payment's credits back and leaves access to the subscription", async () => {
			await pay();
			const result = await deliver("refund.succeeded", refund({}));
			expect(result.body.outcome).toBe("applied");
			const [row] = await paymentsOf("buyer");
			expect(row).toMatchObject({ status: "refunded", refundedAmount: 999 });
			expect((await grantsOf("buyer"))[0]?.revokedAt).toBeInstanceOf(Date);
			expect((await getEntitlements("buyer")).planId).toBe("pro-ai");
		});

		it("records a partial refund made at Dodo as its share before tax", async () => {
			await pay({ total: 1189, tax: 190 });
			await deliver("refund.succeeded", refund({ amount: 595, partial: true }));
			const [row] = await paymentsOf("buyer");
			expect(row).toMatchObject({ status: "partially_refunded", refundedAmount: 500 });
			// Credits stay with a partial refund unless the admin asked otherwise.
			expect((await grantsOf("buyer"))[0]?.revokedAt).toBeNull();
		});

		it("reads a refund's payment first when the refund arrives before it", async () => {
			atDodo(subscription());
			dodo().payments.byId.set("pay_1", payment());
			expect((await deliver("refund.succeeded", refund({}))).body.outcome).toBe("applied");
			const [row] = await paymentsOf("buyer");
			expect(row).toMatchObject({ status: "refunded", providerPaymentId: "pay_1" });
		});

		it("reverses a payment whose dispute was lost and ends its subscription", async () => {
			await pay();
			const opened = await deliver("dispute.opened", {
				dispute_id: "dis_1",
				payment_id: "pay_1",
				dispute_status: "dispute_opened",
				amount: "999",
				currency: "USD",
				dispute_stage: "dispute",
				created_at: iso(new Date()),
				business_id: "bus_1",
			});
			expect(opened.body.outcome).toBe("applied");
			expect((await paymentsOf("buyer"))[0]?.status).toBe("paid");
			const alerts = await getDb().select().from(tables.billingNotification);
			expect(alerts.map((alert) => alert.kind)).toContain("payment_reversed");

			dodo().subscriptions.update.mockResolvedValue(
				atDodo(subscription({ status: "cancelled", cancelledAt: new Date() })),
			);
			await deliver("dispute.lost", {
				dispute_id: "dis_1",
				payment_id: "pay_1",
				dispute_status: "dispute_lost",
				amount: "999",
				currency: "USD",
				dispute_stage: "dispute",
				created_at: iso(new Date()),
				business_id: "bus_1",
			});
			expect((await paymentsOf("buyer"))[0]?.status).toBe("reversed");
			expect((await grantsOf("buyer"))[0]?.revokedAt).toBeInstanceOf(Date);
			expect(dodo().subscriptions.update).toHaveBeenCalledWith("sub_1", {
				status: "cancelled",
				cancel_reason: "cancelled_by_merchant",
			});
			expect((await getEntitlements("buyer")).planId).toBe("free");
		});

		it("answers 503 to a failure that may pass, so Dodo retries", async () => {
			dodo().subscriptions.retrieve.mockRejectedValueOnce(new APIConnectionError({ message: "timeout" }));
			const data = payment();
			const result = await deliver("payment.succeeded", data, "msg_retry");
			expect(result.status).toBe(503);
			expect(await paymentsOf("buyer")).toEqual([]);
			// The retry goes through: the failed attempt left the webhook id free.
			expect((await pay({}, "msg_retry")).body.outcome).toBe("applied");
		});

		it("ignores payments for products Rezumi doesn't sell, and payments that only saved a card", async () => {
			const other = await pay({ sub: subscription({ product: "pdt_somethingElse" }) });
			expect(other.body.outcome).toBe("unknown_product");
			const cardUpdate = { ...payment({ id: "pay_card" }), is_update_payment_method: true };
			expect((await deliver("payment.succeeded", cardUpdate)).body.outcome).toBe("ignored");
			expect(await paymentsOf("buyer")).toEqual([]);
		});
	});

	describe("billing job", () => {
		it("applies a checkout paid while its webhooks were lost", async () => {
			const created = new Date(Date.now() - 5 * 60 * 1000);
			const [opened] = await getDb()
				.insert(tables.billingPayment)
				.values({
					userId: "buyer",
					providerCheckoutId: "cks_9",
					idempotencyKey: "click",
					planId: "pro-ai",
					interval: "month",
					catalogVersion: 4,
					amount: 999,
					currency: "usd",
					status: "pending",
					redirectUrl: "https://test.checkout.dodopayments.com/session/cks_9",
					expiresAt: new Date(Date.now() + day),
					createdAt: created,
				})
				.returning();
			dodo().checkoutSessions.retrieve.mockResolvedValue({
				id: "cks_9",
				created_at: iso(created),
				payment_id: "pay_9",
				payment_status: "succeeded",
			});
			atDodo(subscription());
			dodo().payments.byId.set("pay_9", payment({ id: "pay_9", checkoutId: "cks_9" }));
			expect(await reconcile.reconcilePayments()).toBe(1);
			const [after] = await paymentsOf("buyer");
			expect(after).toMatchObject({ id: opened?.id, status: "paid", providerPaymentId: "pay_9", credits: 100 });
		});

		it("expires a checkout nobody paid once its session has closed", async () => {
			const created = new Date(Date.now() - 2 * day);
			await getDb()
				.insert(tables.billingPayment)
				.values({
					userId: "buyer",
					providerCheckoutId: "cks_old",
					planId: "plus",
					interval: "month",
					catalogVersion: 4,
					amount: 499,
					currency: "usd",
					status: "pending",
					redirectUrl: "https://test.checkout.dodopayments.com/session/cks_old",
					expiresAt: new Date(+created + day),
					createdAt: created,
				});
			dodo().checkoutSessions.retrieve.mockResolvedValue({ id: "cks_old", created_at: iso(created) });
			expect(await reconcile.reconcilePayments()).toBe(1);
			expect((await paymentsOf("buyer"))[0]).toMatchObject({ status: "expired", failureReason: "checkout_expired" });
		});

		it("grants each month of a yearly Pro AI subscription once", async () => {
			const start = new Date(Date.now() - 45 * day);
			const yearly = subscription({ product: PRODUCTS.proYearly, start, end: new Date(+start + 365 * day) });
			await pay({ sub: yearly });
			// The payment brought the month that is running now (the second); the job finds nothing more to give.
			expect((await grantsOf("buyer")).map((grant) => grant.amount)).toEqual([100]);
			expect(await reconcile.grantYearlyCredits()).toBe(0);
			const nextMonth = new Date(+start + 75 * day);
			expect(await reconcile.grantYearlyCredits(nextMonth)).toBe(1);
			expect(await reconcile.grantYearlyCredits(nextMonth)).toBe(0);
			const grants = await grantsOf("buyer");
			expect(grants).toHaveLength(2);
			expect(new Set(grants.map((grant) => +grant.expiresAt)).size).toBe(2);
		});

		it("credits a Pro AI upgrade whose payment webhook never came", async () => {
			await pay({ sub: subscription({ product: PRODUCTS.plusMonthly }) });
			const upgraded = atDodo(subscription({ product: PRODUCTS.proMonthly }));
			// The subscription's webhook arrived; the payment's didn't.
			await deliver("subscription.plan_changed", upgraded);
			expect((await getEntitlements("buyer")).planId).toBe("pro-ai");
			expect(await grantsOf("buyer")).toEqual([]);
			dodo().payments.byId.set("pay_2", payment({ id: "pay_2", sub: upgraded, charge: "plan_change", total: 500 }));
			dodo().payments.list.mockResolvedValue({ items: [{ payment_id: "pay_2", created_at: iso(new Date()) }] });
			expect(await reconcile.reconcileSubscriptions()).toBe(1);
			expect((await grantsOf("buyer")).map((grant) => grant.amount)).toEqual([100]);
			expect((await paymentsOf("buyer")).map((row) => row.billingReason)).toEqual([
				"subscription_create",
				"subscription_update",
			]);
			// Credited now, and not overdue: later runs leave it alone.
			expect(await reconcile.reconcileSubscriptions(new Date(Date.now() + 2 * 60 * 60 * 1000))).toBe(0);
		});

		it("cancels a deleted account's subscription at Dodo", async () => {
			await pay();
			dodo().subscriptions.update.mockResolvedValue(subscription({ status: "cancelled", cancelledAt: new Date() }));
			await endBillingForDeletedUser("buyer");
			expect(dodo().subscriptions.update).toHaveBeenCalledWith("sub_1", {
				status: "cancelled",
				cancel_reason: "cancelled_by_merchant",
			});
			// Had that failed, the job ends what still bills once the account row is gone.
			await getDb()
				.update(tables.billingSubscription)
				.set({ revokedForDeletionAt: null, status: "active" })
				.where(eq(tables.billingSubscription.providerSubscriptionId, "sub_1"));
			await getDb().delete(tables.user).where(eq(tables.user.id, "buyer"));
			dodo().subscriptions.update.mockRejectedValue(notFound());
			expect(await reconcile.endDeletedAccountSubscriptions()).toBe(1);
			const [row] = await getDb().select().from(tables.billingSubscription);
			expect(row?.userId).toBeNull();
			expect(row?.revokedForDeletionAt).toBeInstanceOf(Date);
			// The payment stays for the books, without its owner.
			const [kept] = await getDb().select().from(tables.billingPayment);
			expect(kept?.userId).toBeNull();
		});
	});

	describe("payment history", () => {
		it("leaves out attempts Dodo never answered, and gives a paid payment's invoice", async () => {
			await pay();
			await getDb().insert(tables.billingPayment).values({
				userId: "buyer",
				planId: "plus",
				interval: "month",
				catalogVersion: 4,
				amount: 499,
				currency: "usd",
				status: "failed",
				failureReason: "checkout_create_http_500",
			});
			const history = await as("buyer").payments({});
			expect(history.items).toHaveLength(1);
			const [paid] = history.items;
			dodo().invoices.payments.retrieve.mockResolvedValue(new Response(new Blob(["%PDF-1.7"])));
			const invoice = await as("buyer").invoice({ id: paid?.id ?? "" });
			expect(invoice.status).toBe("ready");
			if (invoice.status === "ready") {
				expect(invoice.file.type).toBe("application/pdf");
				expect(await invoice.file.text()).toBe("%PDF-1.7");
			}
			expect(dodo().invoices.payments.retrieve).toHaveBeenCalledWith("pay_1");
		});
	});

	describe("subscription changes", () => {
		beforeEach(async () => {
			await pay({ sub: subscription({ product: PRODUCTS.plusMonthly, amount: 499 }), total: 499 });
		});

		it("upgrades at once, charging the difference, and downgrades from the next renewal", async () => {
			const upgraded = subscription({ product: PRODUCTS.proMonthly });
			dodo().subscriptions.changePlan.mockImplementation(async () => {
				atDodo(upgraded);
				dodo().payments.byId.set("pay_2", payment({ id: "pay_2", sub: upgraded, charge: "plan_change", total: 500 }));
				dodo().payments.list.mockResolvedValue({ items: [{ payment_id: "pay_2", created_at: iso(new Date()) }] });
				return {};
			});
			const up = await as("buyer").changePlan({ planId: "pro-ai", interval: "month" });
			expect(dodo().subscriptions.changePlan).toHaveBeenLastCalledWith("sub_1", {
				product_id: PRODUCTS.proMonthly,
				quantity: 1,
				cancel_scheduled_change_plan: true,
				proration_billing_mode: "prorated_immediately_keep_cycle",
				on_payment_failure: "prevent_change",
				effective_at: "immediately",
			});
			expect(up).toMatchObject({ effective: "now", subscription: { planId: "pro-ai" } });
			expect((await grantsOf("buyer")).map((grant) => grant.amount)).toEqual([100]);
			expect((await paymentsOf("buyer")).map((row) => [row.billingReason, row.status])).toEqual([
				["subscription_create", "paid"],
				["subscription_update", "paid"],
			]);

			dodo().subscriptions.changePlan.mockImplementation(async () => {
				atDodo(subscription({ product: PRODUCTS.proMonthly, scheduled: PRODUCTS.plusMonthly }));
				return {};
			});
			const down = await as("buyer").changePlan({ planId: "plus", interval: "month" });
			expect(dodo().subscriptions.changePlan).toHaveBeenLastCalledWith("sub_1", {
				product_id: PRODUCTS.plusMonthly,
				quantity: 1,
				cancel_scheduled_change_plan: true,
				proration_billing_mode: "full_immediately",
				effective_at: "next_billing_date",
			});
			expect(down).toMatchObject({
				effective: "renewal",
				subscription: { planId: "pro-ai", pendingChange: { planId: "plus", interval: "month" } },
			});
		});

		it("starts a new period when moving to yearly", async () => {
			dodo().subscriptions.changePlan.mockImplementation(async () => {
				atDodo(
					subscription({ product: PRODUCTS.plusYearly, start: new Date(), end: new Date(Date.now() + 365 * day) }),
				);
				return {};
			});
			await as("buyer").changePlan({ planId: "plus", interval: "year" });
			expect(dodo().subscriptions.changePlan.mock.calls[0]?.[1]).toMatchObject({
				proration_billing_mode: "prorated_immediately",
				on_payment_failure: "prevent_change",
			});
		});

		it("says so when an upgrade's charge fails, and keeps the plan", async () => {
			dodo().subscriptions.changePlan.mockImplementation(async () => {
				const current = dodo().subscriptions.byId.get("sub_1");
				if (!current) throw new Error("No subscription.");
				dodo().payments.byId.set(
					"pay_2",
					payment({ id: "pay_2", sub: current, charge: "plan_change", status: "failed", total: 500 }),
				);
				dodo().payments.list.mockResolvedValue({ items: [{ payment_id: "pay_2", created_at: iso(new Date()) }] });
				return {};
			});
			// It waits a few seconds for the charge to settle before it answers.
			await expect(as("buyer").changePlan({ planId: "pro-ai", interval: "month" })).rejects.toMatchObject({
				code: "PAYMENT_FAILED",
			});
			expect((await getEntitlements("buyer")).planId).toBe("plus");
			expect(await grantsOf("buyer")).toEqual([]);
		}, 15_000);

		it("answers processing while an upgrade's charge settles, and the billing job finishes it", async () => {
			// Dodo accepts the change, but its charge settles after the answer (it can take most of a minute).
			dodo().subscriptions.changePlan.mockImplementation(async () => ({}));
			const pending = await as("buyer").changePlan({ planId: "pro-ai", interval: "month" });
			expect(pending).toMatchObject({ effective: "processing", subscription: { planId: "plus" } });
			const [requested] = await getDb()
				.select()
				.from(tables.billingAuditLog)
				.where(eq(tables.billingAuditLog.action, "subscription.change_requested"));
			expect(requested?.details).toMatchObject({ productId: PRODUCTS.proMonthly });

			// The charge settles: the plan moves, with the paid charge and a free follow-up change behind it.
			const upgraded = atDodo(subscription({ product: PRODUCTS.proMonthly }));
			dodo().payments.byId.set("pay_2", payment({ id: "pay_2", sub: upgraded, charge: "plan_change", total: 500 }));
			dodo().payments.byId.set("pay_3", payment({ id: "pay_3", sub: upgraded, charge: "plan_change", total: 0 }));
			dodo().payments.list.mockResolvedValue({
				items: [
					{ payment_id: "pay_3", created_at: iso(new Date(Date.now() + 1000)) },
					{ payment_id: "pay_2", created_at: iso(new Date()) },
				],
			});
			expect(await reconcile.reconcileSubscriptions()).toBe(1);
			expect((await getEntitlements("buyer")).planId).toBe("pro-ai");
			// The month's credits come with the charge that was paid, so refunding it takes them back.
			const grants = await grantsOf("buyer");
			expect(grants.map((grant) => grant.amount)).toEqual([100]);
			const paid = (await paymentsOf("buyer")).find((row) => row.providerPaymentId === "pay_2");
			expect(grants[0]?.paymentId).toBe(paid?.id);
			// Settled: later runs leave it alone.
			expect(await reconcile.reconcileSubscriptions(new Date(Date.now() + 2 * 60 * 1000))).toBe(0);
		}, 15_000);

		it("doesn't change a plan again that Dodo has changed already", async () => {
			// An upgrade settled at Dodo after its answer; this copy still says Plus and the button is pressed again.
			atDodo(subscription({ product: PRODUCTS.proMonthly }));
			const again = await as("buyer").changePlan({ planId: "pro-ai", interval: "month" });
			expect(dodo().subscriptions.changePlan).not.toHaveBeenCalled();
			expect(again).toMatchObject({ effective: "now", subscription: { planId: "pro-ai" } });
		});

		it("cancels at the period end and keeps it again, and opens the billing portal", async () => {
			dodo().subscriptions.update.mockResolvedValue(
				subscription({ product: PRODUCTS.plusMonthly, cancelAtPeriodEnd: true, amount: 499 }),
			);
			const cancelled = await as("buyer").cancelSubscription({ reason: "too_expensive" });
			expect(cancelled.cancelAtPeriodEnd).toBe(true);
			expect(dodo().subscriptions.update).toHaveBeenLastCalledWith("sub_1", {
				cancel_at_next_billing_date: true,
				cancellation_feedback: "too_expensive",
			});
			await expect(as("buyer").changePlan({ planId: "pro-ai", interval: "month" })).rejects.toMatchObject({
				code: "CONFLICT",
			});
			dodo().subscriptions.update.mockResolvedValue(subscription({ product: PRODUCTS.plusMonthly, amount: 499 }));
			expect((await as("buyer").resumeSubscription()).cancelAtPeriodEnd).toBe(false);
			expect(dodo().subscriptions.update).toHaveBeenLastCalledWith("sub_1", { cancel_at_next_billing_date: false });

			dodo().customers.customerPortal.create.mockResolvedValue({ link: "https://customer.dodopayments.com/x" });
			await expect(as("buyer").portal()).resolves.toEqual({ url: "https://customer.dodopayments.com/x" });
			expect(dodo().customers.customerPortal.create).toHaveBeenCalledWith("cus_1", {
				return_url: "https://rezumi.test/dashboard/settings/billing",
			});
		});

		it("refunds from the admin page through Dodo and can end the subscription too", async () => {
			const [paid] = await paymentsOf("buyer");
			if (!paid) throw new Error("The paid payment wasn't recorded.");
			dodo().refunds.create.mockImplementation(async (body: { metadata: { rezumi_refund_id: string } }) =>
				refund({ amount: 499, local: body.metadata.rezumi_refund_id }),
			);
			dodo().subscriptions.update.mockResolvedValue(
				subscription({ product: PRODUCTS.plusMonthly, status: "cancelled", cancelledAt: new Date(), amount: 499 }),
			);
			const result = await as("owner").admin.refund({
				paymentId: paid.id,
				reason: "Customer asked within 7 days",
				endSubscription: true,
			});
			expect(result).toMatchObject({ status: "succeeded", paymentStatus: "refunded", subscriptionEnded: true });
			// The whole payment: no line items, so Dodo gives the tax back too.
			expect(dodo().refunds.create).toHaveBeenCalledWith({
				payment_id: "pay_1",
				reason: "Customer asked within 7 days",
				metadata: { rezumi_refund_id: expect.any(String) },
			});
			expect(dodo().payments.retrieveLineItems).not.toHaveBeenCalled();
			expect((await getEntitlements("buyer")).planId).toBe("free");
			// The webhook for the same refund finds it by Rezumi's id and changes nothing.
			const [local] = await getDb()
				.select()
				.from(tables.billingRefund)
				.where(and(eq(tables.billingRefund.paymentId, paid.id)));
			expect(local).toMatchObject({ method: "dodo", refundKey: "ref_1", amount: 499 });
			expect((await deliver("refund.succeeded", refund({ amount: 499, local: local?.id }))).body.outcome).toBe(
				"duplicate",
			);
			expect(await getDb().select().from(tables.billingRefund)).toHaveLength(1);
		});

		it("refunds part of a payment before tax, on its line", async () => {
			const [paid] = await paymentsOf("buyer");
			if (!paid) throw new Error("The paid payment wasn't recorded.");
			dodo().payments.retrieveLineItems.mockResolvedValue({
				currency: "USD",
				partial_refund_allowed: true,
				items: [{ items_id: PRODUCTS.plusMonthly, amount: 499, refundable_amount: 499, tax: 0 }],
			});
			dodo().refunds.create.mockImplementation(async (body: { metadata: { rezumi_refund_id: string } }) =>
				refund({ amount: 200, partial: true, local: body.metadata.rezumi_refund_id }),
			);
			const result = await as("owner").admin.refund({ paymentId: paid.id, amount: 200, reason: "Goodwill" });
			expect(result).toMatchObject({ status: "succeeded", paymentStatus: "partially_refunded", refundedAmount: 200 });
			expect(dodo().refunds.create).toHaveBeenCalledWith(
				expect.objectContaining({
					currency: "USD",
					items: [{ item_id: PRODUCTS.plusMonthly, amount: 200, tax_inclusive: false }],
				}),
			);
			expect((await getEntitlements("buyer")).planId).toBe("plus");
		});
	});
});
