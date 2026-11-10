import type { BillingMode } from "./entitlements";
import type { SumopodPayment } from "./sumopod/client";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

const signingKey = randomBytes(32);

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	mode: "on" as BillingMode,
	webhookSecret: "" as string,
	sumopod: { create: undefined as unknown },
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
			DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY: "pdt_plusMonthly01",
			DODO_PAYMENTS_PRODUCT_PLUS_YEARLY: "pdt_plusYearly001",
			DODO_PAYMENTS_PRODUCT_PRO_AI_MONTHLY: "pdt_proMonthly001",
			DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY: "pdt_proYearly0001",
			SUMOPOD_ENVIRONMENT: "sandbox",
			SUMOPOD_API_KEY: "sandbox-key",
			get SUMOPOD_WEBHOOK_SECRET() {
				return fixture.webhookSecret || undefined;
			},
		},
	};
});
vi.mock("./sumopod/client", async () => {
	const actual = await vi.importActual<typeof import("./sumopod/client")>("./sumopod/client");
	return {
		...actual,
		createSumopodPayment: (...args: unknown[]) => (fixture.sumopod.create as (...a: unknown[]) => unknown)(...args),
	};
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
// Emails go nowhere in tests.
vi.mock("@rezumi/email/billing", () => ({ deliverBillingNotice: vi.fn(async () => ({ sent: true })) }));

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

const day = 24 * 60 * 60 * 1000;

/** Sumopod's side: the payment links it made, by its payment id. */
function fakeSumopod() {
	const links = new Map<string, SumopodPayment>();
	return {
		links,
		create: vi.fn(async (_config: unknown, input: { orderId: string; amount: number }): Promise<SumopodPayment> => {
			const id = randomUUID();
			const link = {
				payment_id: id,
				order_id: input.orderId,
				amount: input.amount,
				fee: Math.round(input.amount * 0.007) + 300,
				net_amount: input.amount - (Math.round(input.amount * 0.007) + 300),
				status: "pending",
				payment_link_url: `https://pay.sumopod.com/pay/${id}`,
				expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			};
			links.set(id, link);
			return link;
		}),
	};
}
type FakeSumopod = ReturnType<typeof fakeSumopod>;
let sumopod: FakeSumopod;

/** A webhook request signed the way Sumopod signs it (Svix). */
function signed(eventType: string, data: unknown, id = `msg_${randomUUID()}`, key = signingKey) {
	const body = JSON.stringify({ event_type: eventType, data });
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
	return new Request("https://rezumi.test/api/payments/sumopod/webhook", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"svix-id": id,
			"svix-timestamp": timestamp,
			"svix-signature": `v1,${signature}`,
		},
		body,
	});
}

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("QRIS passes through Sumopod", () => {
	let router: typeof import("./router").billingRouter;
	let handleSumopodWebhook: typeof import("./sumopod/webhook").handleSumopodWebhook;
	let getEntitlements: typeof import("./entitlements").getEntitlements;
	let grantPassCredits: typeof import("./passes").grantPassCredits;
	let reconcileQrisPayments: typeof import("./sumopod/reconcile").reconcileQrisPayments;
	let admin: Pool;
	let pool: Pool;
	const schemaName = `qris_test_${randomUUID().replaceAll("-", "")}`;
	const fromIndonesia = { "cf-ipcountry": "ID" };

	const as = (id: string, headers: Record<string, string> = fromIndonesia) =>
		createRouterClient(router, {
			context: {
				user: { id },
				authentication: { user: { id }, method: "session" },
				reqHeaders: new Headers(headers),
				locale: "id-ID",
			} as never,
		});

	const deliver = async (eventType: string, data: unknown, id?: string, key?: typeof signingKey) => {
		const response = await handleSumopodWebhook(signed(eventType, data, id, key));
		return { status: response.status, body: (await response.json()) as Record<string, unknown> };
	};

	/** Opens a pass checkout from Indonesia and returns Rezumi's payment id and Sumopod's link. */
	const open = async (planId: "plus" | "pro-ai", interval: "month" | "year", userId = "buyer") => {
		const opened = await as(userId).checkout({ planId, interval, idempotencyKey: randomUUID() });
		const [link] = [...sumopod.links.values()].filter((item) => item.order_id === `RZ-${opened.paymentId}`);
		if (!link) throw new Error("No link was made.");
		return { opened, link };
	};

	/** Sumopod says the link was paid, by webhook. */
	const paid = async (link: SumopodPayment, id?: string, amount = link.amount) => {
		const completed = { ...link, amount, status: "completed", paid_at: new Date().toISOString() };
		sumopod.links.set(link.payment_id, completed);
		return deliver("payment.completed", completed, id);
	};

	const paymentsOf = (userId: string) =>
		getDb()
			.select()
			.from(tables.billingPayment)
			.where(eq(tables.billingPayment.userId, userId))
			.orderBy(asc(tables.billingPayment.createdAt));
	const periodsOf = (userId: string) =>
		getDb()
			.select()
			.from(tables.membershipPeriod)
			.where(eq(tables.membershipPeriod.userId, userId))
			.orderBy(asc(tables.membershipPeriod.startsAt));
	const grantsOf = (userId: string) =>
		getDb()
			.select()
			.from(tables.aiCreditGrant)
			.where(eq(tables.aiCreditGrant.userId, userId))
			.orderBy(asc(tables.aiCreditGrant.expiresAt));

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
		({ handleSumopodWebhook } = await import("./sumopod/webhook"));
		({ getEntitlements } = await import("./entitlements"));
		({ grantPassCredits } = await import("./passes"));
		({ reconcileQrisPayments } = await import("./sumopod/reconcile"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.mode = "on";
		fixture.webhookSecret = `whsec_${signingKey.toString("base64")}`;
		sumopod = fakeSumopod();
		fixture.sumopod.create = sumopod.create;
		await pool.query(
			'TRUNCATE "user", released_username, billing_audit_log, billing_payment, billing_subscription, billing_payment_event, billing_notification CASCADE',
		);
		await getDb()
			.insert(tables.user)
			.values([
				{
					id: "buyer",
					name: "Budi Santoso",
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

	describe("which way to pay", () => {
		it("offers QRIS in Rupiah first from Indonesia, with a card as the other choice; only a card elsewhere", async () => {
			const indonesia = await as("buyer").summary();
			expect(indonesia).toMatchObject({
				paymentMethods: ["qris", "card"],
				paymentMethod: null,
				currency: "idr",
				canPurchase: true,
				trialAvailable: true,
			});
			const abroad = await as("buyer", { "cf-ipcountry": "SG" }).summary();
			expect(abroad).toMatchObject({ paymentMethods: ["card"], currency: "usd" });
			// Nobody outside Indonesia gets the Rupiah price.
			await expect(
				as("buyer", { "cf-ipcountry": "SG" }).checkout({
					planId: "plus",
					interval: "month",
					idempotencyKey: "abroad",
					method: "qris",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(sumopod.create).not.toHaveBeenCalled();
		});

		it("keeps an account with a QRIS pass on QRIS wherever it browses from", async () => {
			const { link } = await open("plus", "month");
			await paid(link);
			const abroad = await as("buyer", { "cf-ipcountry": "US" }).summary();
			expect(abroad).toMatchObject({ paymentMethods: ["qris"], paymentMethod: "qris", currency: "idr" });
			await expect(
				as("buyer", { "cf-ipcountry": "US" }).checkout({
					planId: "pro-ai",
					interval: "month",
					idempotencyKey: "card",
					method: "card",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			// More time, from anywhere, by QRIS.
			await expect(
				as("buyer", { "cf-ipcountry": "US" }).checkout({ planId: "plus", interval: "month", idempotencyKey: "more" }),
			).resolves.toMatchObject({ redirectUrl: expect.stringContaining("https://pay.sumopod.com/pay/") });
		});

		it("keeps a card subscriber on the card subscription, even from Indonesia", async () => {
			await getDb()
				.insert(tables.billingSubscription)
				.values({
					userId: "buyer",
					externalCustomerId: "buyer",
					providerSubscriptionId: "sub_1",
					providerProductId: "pdt_plusMonthly01",
					planId: "plus",
					interval: "month",
					status: "active",
					amount: 499,
					currency: "usd",
					currentPeriodStart: new Date(Date.now() - day),
					currentPeriodEnd: new Date(Date.now() + 29 * day),
					providerModifiedAt: new Date(),
				});
			expect(await as("buyer").summary()).toMatchObject({ paymentMethods: ["card"], paymentMethod: "card" });
			await expect(
				as("buyer").checkout({ planId: "pro-ai", interval: "month", idempotencyKey: "qris", method: "qris" }),
			).rejects.toMatchObject({ code: "CONFLICT" });
		});
	});

	describe("checkout", () => {
		it("opens one Sumopod QRIS link per plan and length, at the Rupiah price, with Rezumi's order number", async () => {
			const { opened, link } = await open("plus", "month");
			expect(opened).toMatchObject({ redirectUrl: link.payment_link_url, reused: false });
			expect(sumopod.create).toHaveBeenCalledWith(expect.anything(), {
				orderId: `RZ-${opened.paymentId}`,
				amount: 29_000,
				successReturnUrl: `https://rezumi.test/dashboard/settings/billing/return/${opened.paymentId}`,
				cancelReturnUrl: "https://rezumi.test/dashboard/settings/billing",
			});
			const [row] = await paymentsOf("buyer");
			expect(row).toMatchObject({
				provider: "sumopod",
				status: "pending",
				planId: "plus",
				interval: "month",
				durationDays: 30,
				amount: 2_900_000,
				taxAmount: 0,
				totalAmount: 2_900_000,
				currency: "idr",
				trialDays: null,
				providerCheckoutId: link.payment_id,
				providerPaymentId: null,
			});
			// A new click for the same pass gets the open link back; another length opens another.
			await expect(
				as("buyer").checkout({ planId: "plus", interval: "month", idempotencyKey: "again" }),
			).resolves.toMatchObject({ paymentId: opened.paymentId, reused: true });
			await as("buyer").checkout({ planId: "plus", interval: "year", idempotencyKey: "yearly" });
			expect(sumopod.create).toHaveBeenCalledTimes(2);
			expect(sumopod.create.mock.calls[1]?.[1]).toMatchObject({ amount: 249_000 });
			// The page offers to finish it.
			expect((await as("buyer").summary()).pendingPayment).toMatchObject({ method: "qris" });
		});

		it("records a link Sumopod refused as failed and tells the owner", async () => {
			sumopod.create.mockRejectedValueOnce(new Error("down"));
			await expect(
				as("buyer").checkout({ planId: "pro-ai", interval: "month", idempotencyKey: "down" }),
			).rejects.toMatchObject({ code: "BAD_GATEWAY" });
			expect((await paymentsOf("buyer"))[0]).toMatchObject({ status: "failed", failureReason: "payment_create_error" });
			const alerts = await getDb().select().from(tables.billingNotification);
			expect(alerts.map((alert) => alert.kind)).toContain("provider_errors");
		});
	});

	describe("webhooks", () => {
		it("is off without a secret and refuses a bad signature", async () => {
			const { link } = await open("plus", "month");
			fixture.webhookSecret = "";
			expect((await handleSumopodWebhook(signed("payment.completed", link))).status).toBe(404);
			fixture.webhookSecret = `whsec_${signingKey.toString("base64")}`;
			const forged = await deliver("payment.completed", { ...link, status: "completed" }, "msg_x", randomBytes(32));
			expect(forged.status).toBe(403);
			expect((await paymentsOf("buyer"))[0]?.status).toBe("pending");
			const test = await deliver("payment.test", { message: "hello" }, "msg_test");
			expect(test).toMatchObject({ status: 200, body: { outcome: "ignored" } });
		});

		it("grants a paid Plus pass once: 30 days, no credits, a receipt", async () => {
			const { opened, link } = await open("plus", "month");
			const first = await paid(link, "msg_1");
			expect(first).toMatchObject({ status: 200, body: { outcome: "applied" } });
			expect((await paid(link, "msg_1")).body.outcome).toBe("duplicate");
			expect((await paid(link, "msg_2")).body.outcome).toBe("duplicate");

			const [row] = await paymentsOf("buyer");
			expect(row).toMatchObject({
				id: opened.paymentId,
				status: "paid",
				providerPaymentId: link.payment_id,
				billingReason: "purchase",
				credits: 0,
			});
			expect(row?.fulfilledAt).toBeInstanceOf(Date);
			const periods = await periodsOf("buyer");
			expect(periods).toHaveLength(1);
			expect(periods[0]).toMatchObject({ planId: "plus", source: "payment", paymentId: opened.paymentId });
			expect(+(periods[0]?.endsAt ?? 0) - +(periods[0]?.startsAt ?? 0)).toBe(30 * day);
			expect(await getEntitlements("buyer")).toMatchObject({ planId: "plus", source: "period", renews: false });
			const notifications = await getDb().select().from(tables.billingNotification);
			expect(notifications.filter((item) => item.kind === "payment_receipt")).toEqual([
				expect.objectContaining({ key: `receipt:${opened.paymentId}`, userId: "buyer" }),
			]);
		});

		it("grants nothing when less than the price came in, and alerts the owner", async () => {
			const { link } = await open("plus", "year");
			const short = await paid(link, "msg_short", 1_000);
			expect(short).toMatchObject({ status: 200, body: { outcome: "error" } });
			expect((await paymentsOf("buyer"))[0]).toMatchObject({ status: "pending", failureReason: "amount_mismatch" });
			expect(await periodsOf("buyer")).toEqual([]);
			const alerts = await getDb().select().from(tables.billingNotification);
			expect(alerts.map((alert) => alert.kind)).toContain("needs_review");
		});

		it("ends a link that expired or failed, and still counts a payment that comes in late", async () => {
			const { link } = await open("plus", "month");
			await deliver("payment.expired", { ...link, status: "expired" });
			expect((await paymentsOf("buyer"))[0]).toMatchObject({ status: "expired", failureReason: "payment_expired" });
			await paid(link);
			expect((await paymentsOf("buyer"))[0]).toMatchObject({ status: "paid" });
			expect(await getEntitlements("buyer")).toMatchObject({ planId: "plus" });
		});
	});

	describe("passes", () => {
		it("gives a Pro AI pass 100 credits now, and a second pass its own month when it starts", async () => {
			const first = await open("pro-ai", "month");
			await paid(first.link);
			const second = await open("pro-ai", "month");
			await paid(second.link);
			const payments = await paymentsOf("buyer");
			expect(payments.map((row) => [row.billingReason, row.credits])).toEqual([
				["purchase", 100],
				["subscription_cycle", 0],
			]);
			const periods = await periodsOf("buyer");
			expect(periods).toHaveLength(2);
			expect(+(periods[1]?.startsAt ?? 0)).toBe(+(periods[0]?.endsAt ?? 0));
			expect(await getEntitlements("buyer")).toMatchObject({ planId: "pro-ai" });
			expect((await as("buyer").summary()).credits).toMatchObject({ balance: 100 });
			// The job adds nothing while the first pass runs, then the second pass's month when it starts.
			expect(await grantPassCredits()).toBe(0);
			const later = new Date(+(periods[1]?.startsAt ?? 0) + 60_000);
			expect(await grantPassCredits(later)).toBe(1);
			expect(await grantPassCredits(later)).toBe(0);
			const grants = await grantsOf("buyer");
			expect(grants.map((grant) => [grant.amount, grant.paymentId])).toEqual([
				[100, payments[0]?.id],
				[100, payments[1]?.id],
			]);
			expect(+(grants[1]?.expiresAt ?? 0)).toBe(+(periods[1]?.endsAt ?? 0));
		});

		it("moves up at once: a Pro AI pass starts now and the rest of Plus waits behind it", async () => {
			const plus = await open("plus", "month");
			await paid(plus.link);
			const pro = await open("pro-ai", "month");
			await paid(pro.link);
			const payments = await paymentsOf("buyer");
			expect(payments[1]).toMatchObject({ billingReason: "subscription_update", credits: 100 });
			expect(await getEntitlements("buyer")).toMatchObject({
				planId: "pro-ai",
				upcoming: [expect.objectContaining({ planId: "plus" })],
			});
			const live = (await periodsOf("buyer")).filter((period) => !period.revokedAt && period.endsAt > new Date());
			// Plus ran a moment, then its rest was moved behind Pro AI: nothing lost.
			const rest = live.find((period) => period.planId === "plus" && period.startsAt > new Date());
			expect(rest?.paymentId).toBe(plus.opened.paymentId);
		});

		it("gives a yearly Pro AI pass 100 credits a month, one month at a time", async () => {
			const { link } = await open("pro-ai", "year");
			await paid(link);
			const [period] = await periodsOf("buyer");
			expect(+(period?.endsAt ?? 0) - +(period?.startsAt ?? 0)).toBe(365 * day);
			const grants = await grantsOf("buyer");
			expect(grants).toHaveLength(1);
			const secondMonth = new Date(+(grants[0]?.expiresAt ?? 0) + 60_000);
			expect(await grantPassCredits(secondMonth)).toBe(1);
			expect(await grantsOf("buyer")).toHaveLength(2);
		});

		it("shows what a pass would do before paying", async () => {
			const plus = await open("plus", "month");
			await paid(plus.link);
			const preview = await as("buyer").previewPass({ planId: "pro-ai", interval: "year" });
			expect(preview).toMatchObject({ amount: 49_900_000, currency: "idr", days: 365, creditsPerMonth: 100 });
			expect(preview.stretches.map((stretch) => [stretch.planId, stretch.purchase])).toEqual([
				["pro-ai", true],
				["plus", false],
			]);
		});
	});

	describe("status checks and refunds", () => {
		it("waits for the webhook on the return page, and expires a link nobody paid once it closed", async () => {
			const { opened } = await open("plus", "month");
			// Sumopod can't be asked: the return page keeps waiting for the webhook.
			expect(await as("buyer").payment({ id: opened.paymentId })).toMatchObject({ status: "pending", method: "qris" });
			expect(await reconcileQrisPayments()).toBe(0);

			const abandoned = await open("pro-ai", "month");
			await getDb()
				.update(tables.billingPayment)
				.set({
					createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
					expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
				})
				.where(eq(tables.billingPayment.id, abandoned.opened.paymentId));
			expect(await reconcileQrisPayments()).toBe(1);
			expect(await reconcileQrisPayments()).toBe(0);
			const rows = await paymentsOf("buyer");
			expect(rows.find((row) => row.id === abandoned.opened.paymentId)).toMatchObject({
				status: "expired",
				failureReason: "payment_expired",
			});
			expect(rows.find((row) => row.id === opened.paymentId)).toMatchObject({ status: "pending" });
			// The admin's "check again" can't ask Sumopod either.
			await expect(as("owner").admin.syncPayment({ paymentId: opened.paymentId })).resolves.toMatchObject({
				found: false,
				status: "pending",
			});
		});

		it("records a hand refund: a full one takes the pass and its credits back", async () => {
			const { opened, link } = await open("pro-ai", "month");
			await paid(link);
			const refund = await as("owner").admin.refund({ paymentId: opened.paymentId, reason: "Customer asked" });
			expect(refund).toMatchObject({ status: "succeeded", amount: 5_900_000, paymentStatus: "refunded" });
			const [stored] = await getDb().select().from(tables.billingRefund);
			expect(stored).toMatchObject({ method: "manual", status: "succeeded" });
			expect(await getEntitlements("buyer")).toMatchObject({ planId: "free" });
			expect((await grantsOf("buyer")).every((grant) => grant.revokedAt)).toBe(true);
			await expect(as("owner").admin.refund({ paymentId: opened.paymentId, reason: "Twice" })).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
		});

		it("keeps the pass on a partial refund unless asked to take it back", async () => {
			const { opened, link } = await open("plus", "year");
			await paid(link);
			await as("owner").admin.refund({ paymentId: opened.paymentId, amount: 4_900_000, reason: "Goodwill" });
			expect((await paymentsOf("buyer"))[0]).toMatchObject({ status: "partially_refunded", refundedAmount: 4_900_000 });
			expect(await getEntitlements("buyer")).toMatchObject({ planId: "plus" });
			await as("owner").admin.refund({
				paymentId: opened.paymentId,
				amount: 100_000,
				reason: "Closing the account",
				revokeBenefits: true,
			});
			expect(await getEntitlements("buyer")).toMatchObject({ planId: "free" });
		});
	});
});
