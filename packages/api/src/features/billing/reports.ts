import type { BillingPaymentStatus } from "@rezumi/db/schema";
import type { BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import { ORPCError } from "@orpc/server";
import { and, asc, count, countDistinct, eq, gt, gte, inArray, isNotNull, lt, ne, sql, sum } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { toMajorUnits } from "@rezumi/schema/billing";
import { ADMIN_ADJUSTMENT_ACTION } from "./credits";
import { LIVE_SUBSCRIPTION_STATUSES } from "./subscriptions";

/**
 * The owner's numbers: sign-ups, checkouts, sales and refunds per currency, subscriptions, Rezumi AI use and cost for a
 * period, and the CSV for the books. Amounts are before tax (Polar collects and remits tax as the merchant of record)
 * and in each currency's smallest unit; currencies are never added together. Counts only; no names or email addresses
 * leave the database here, except the admin payment list's buyer email.
 */

export type ReportRange = { from: Date; to: Date };

/** Money in several currencies: currency code → amount in its smallest unit. */
export type Money = Record<string, number>;

/** The longest period a report or export covers. */
const MAX_RANGE_DAYS = 400;
/** An open checkout this old that can still be paid counts as hanging. */
const HANGING_AFTER_MS = 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function assertRange(range: ReportRange) {
	if (!(range.to > range.from)) throw new ORPCError("BAD_REQUEST", { message: "The end must be after the start." });
	if (+range.to - +range.from > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000)
		throw new ORPCError("BAD_REQUEST", { message: `Pick at most ${MAX_RANGE_DAYS} days.` });
}

const within = (column: Parameters<typeof gte>[0], range: ReportRange) =>
	and(gte(column, range.from), lt(column, range.to));

const toNumber = (value: unknown) => Number(value ?? 0);

/** Adds `amount` of `currency` into `money`. */
function addMoney(money: Money, currency: string, amount: number) {
	const code = currency.toLowerCase();
	money[code] = (money[code] ?? 0) + amount;
	return money;
}

const subtract = (a: Money, b: Money): Money => {
	const result: Money = { ...a };
	for (const [currency, amount] of Object.entries(b)) result[currency] = (result[currency] ?? 0) - amount;
	return result;
};

/** What an order was for, as the owner reads it: a new subscription, a renewal, or a plan change. */
export type SaleKind = "new" | "renewal" | "change";

const saleKind = (reason: string | null): SaleKind =>
	reason === "subscription_cycle" ? "renewal" : reason === "subscription_update" ? "change" : "new";

/** The numbers for a period: [from, to). Hanging checkouts and live subscriptions are counted as of `now`. */
export async function billingMetrics(range: ReportRange, now = new Date()) {
	assertRange(range);
	const user = schema.user;
	const payment = schema.billingPayment;
	const refund = schema.billingRefund;
	const subscription = schema.billingSubscription;
	const grant = schema.aiCreditGrant;
	const usage = schema.aiCreditUsage;

	const [signups] = await db
		.select({
			total: count(),
			verified: sql<number>`count(*) filter (where ${user.emailVerified})`,
		})
		.from(user)
		.where(and(within(user.createdAt, range), eq(user.isAnonymous, false)));

	// Checkouts Rezumi opened on the website (renewals have none), and how many of them were paid (whenever).
	const [checkouts] = await db
		.select({
			started: count(),
			buyers: countDistinct(payment.userId),
			paid: sql<number>`count(*) filter (where ${payment.paidAt} is not null)`,
		})
		.from(payment)
		.where(and(within(payment.createdAt, range), isNotNull(payment.idempotencyKey)));

	// A free trial starting is a paid $0 order its checkout offered a trial for: counted apart, not as a sale.
	const trialStart = sql`(${payment.trialDays} is not null and ${payment.totalAmount} = 0)`;
	const paidRows = await db
		.select({
			planId: payment.planId,
			interval: payment.interval,
			reason: payment.billingReason,
			currency: payment.currency,
			payments: count(),
			revenue: sum(payment.amount),
		})
		.from(payment)
		.where(and(isNotNull(payment.paidAt), within(payment.paidAt, range), sql`not ${trialStart}`))
		.groupBy(payment.planId, payment.interval, payment.billingReason, payment.currency);
	const [trialStarts] = await db
		.select({ started: count() })
		.from(payment)
		.where(and(isNotNull(payment.paidAt), within(payment.paidAt, range), trialStart));

	const refundRows = await db
		.select({ currency: payment.currency, refunds: count(), amount: sum(refund.amount) })
		.from(refund)
		.innerJoin(payment, eq(refund.paymentId, payment.id))
		.where(and(eq(refund.status, "succeeded"), isNotNull(refund.settledAt), within(refund.settledAt, range)))
		.groupBy(payment.currency);

	const [hanging] = await db
		.select({ payments: count() })
		.from(payment)
		.where(
			and(
				inArray(payment.status, ["creating", "pending"]),
				sql`${payment.providerOrderId} is null`,
				lt(payment.createdAt, new Date(+now - HANGING_AFTER_MS)),
				gt(payment.expiresAt, now),
			),
		);

	const liveRows = await db
		.select({
			planId: subscription.planId,
			interval: subscription.interval,
			status: subscription.status,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
			currency: subscription.currency,
			subscriptions: count(),
			amount: sum(subscription.amount),
		})
		.from(subscription)
		.where(inArray(subscription.status, [...LIVE_SUBSCRIPTION_STATUSES]))
		.groupBy(
			subscription.planId,
			subscription.interval,
			subscription.status,
			subscription.cancelAtPeriodEnd,
			subscription.currency,
		);
	const [started] = await db
		.select({ subscriptions: count() })
		.from(subscription)
		.where(within(subscription.createdAt, range));
	const [ended] = await db
		.select({ subscriptions: count() })
		.from(subscription)
		.where(and(isNotNull(subscription.endedAt), within(subscription.endedAt, range)));

	const [trials] = await db
		.select({ granted: count(), credits: sum(grant.amount) })
		.from(grant)
		.where(and(eq(grant.source, "trial"), within(grant.createdAt, range)));
	const [planCredits] = await db
		.select({ credits: sum(grant.amount) })
		.from(grant)
		.where(and(eq(grant.source, "plan"), within(grant.createdAt, range)));

	// Rezumi AI work: what was charged (committed) and what the provider cost, failed work included.
	const actions = await db
		.select({
			action: usage.action,
			committed: sql<number>`count(*) filter (where ${usage.status} = 'committed')`,
			released: sql<number>`count(*) filter (where ${usage.status} = 'released')`,
			credits: sql<number>`coalesce(sum(${usage.credits}) filter (where ${usage.status} = 'committed'), 0)`,
			costUsdMicros: sql<number>`coalesce(sum(${usage.costUsdMicros}), 0)`,
			p50UsdMicros: sql<
				number | null
			>`percentile_cont(0.5) within group (order by ${usage.costUsdMicros}) filter (where ${usage.status} = 'committed')`,
			p95UsdMicros: sql<
				number | null
			>`percentile_cont(0.95) within group (order by ${usage.costUsdMicros}) filter (where ${usage.status} = 'committed')`,
		})
		.from(usage)
		.where(and(ne(usage.action, ADMIN_ADJUSTMENT_ACTION), within(usage.createdAt, range)))
		.groupBy(usage.action)
		.orderBy(asc(usage.action));

	// One row per kind per hour; a problem that lasts names the same payments hour after hour, so count those once.
	const alertRows = await db
		.select({
			kind: schema.billingNotification.kind,
			count: schema.billingNotification.count,
			details: schema.billingNotification.details,
		})
		.from(schema.billingNotification)
		.where(
			and(sql`${schema.billingNotification.key} like 'alert:%'`, within(schema.billingNotification.createdAt, range)),
		);
	const alertKinds = new Map<string, { events: number; payments: Set<string> }>();
	for (const row of alertRows) {
		const entry = alertKinds.get(row.kind) ?? { events: 0, payments: new Set<string>() };
		entry.events += row.count;
		if (Array.isArray(row.details.paymentIds))
			for (const id of row.details.paymentIds) if (typeof id === "string") entry.payments.add(id);
		alertKinds.set(row.kind, entry);
	}

	const revenue: Money = {};
	const byPlan = new Map<PaidPlanId, { payments: number; revenue: Money }>();
	const byInterval = new Map<BillingInterval | "pass", { payments: number; revenue: Money }>();
	const byKind = new Map<SaleKind, { payments: number; revenue: Money }>();
	let payments = 0;
	for (const row of paidRows) {
		const amount = toNumber(row.revenue);
		const counted = toNumber(row.payments);
		payments += counted;
		addMoney(revenue, row.currency, amount);
		for (const [map, key] of [
			[byPlan, row.planId],
			[byInterval, row.interval ?? "pass"],
			[byKind, saleKind(row.reason)],
		] as const) {
			const entry = (map as Map<string, { payments: number; revenue: Money }>).get(key) ?? { payments: 0, revenue: {} };
			entry.payments += counted;
			addMoney(entry.revenue, row.currency, amount);
			(map as Map<string, { payments: number; revenue: Money }>).set(key, entry);
		}
	}
	const refunded: Money = {};
	let refundCount = 0;
	for (const row of refundRows) {
		refundCount += toNumber(row.refunds);
		addMoney(refunded, row.currency, toNumber(row.amount));
	}

	// Monthly recurring revenue: active subscriptions not set to end, yearly ones counted as a twelfth.
	const mrr: Money = {};
	let active = 0;
	let trialing = 0;
	let canceling = 0;
	let pastDue = 0;
	const livePlans = new Map<string, { planId: PaidPlanId; interval: BillingInterval; subscriptions: number }>();
	for (const row of liveRows) {
		const counted = toNumber(row.subscriptions);
		if (row.status === "past_due") pastDue += counted;
		// In a free trial: nothing paid yet, so not active and not in MRR until its first charge.
		else if (row.status === "trialing") trialing += counted;
		else if (row.status === "active") {
			active += counted;
			if (row.cancelAtPeriodEnd) canceling += counted;
			else addMoney(mrr, row.currency, Math.round(toNumber(row.amount) / (row.interval === "year" ? 12 : 1)));
		}
		const key = `${row.planId}:${row.interval}`;
		const entry = livePlans.get(key) ?? { planId: row.planId, interval: row.interval, subscriptions: 0 };
		entry.subscriptions += counted;
		livePlans.set(key, entry);
	}

	return {
		from: range.from,
		to: range.to,
		signups: { total: toNumber(signups?.total), verified: toNumber(signups?.verified) },
		checkouts: {
			started: toNumber(checkouts?.started),
			buyers: toNumber(checkouts?.buyers),
			paid: toNumber(checkouts?.paid),
		},
		sales: {
			payments,
			revenue,
			byPlan: (["plus", "pro-ai"] as const).map((planId) => ({
				planId,
				payments: byPlan.get(planId)?.payments ?? 0,
				revenue: byPlan.get(planId)?.revenue ?? {},
			})),
			byInterval: [...byInterval].map(([interval, entry]) => ({ interval, ...entry })),
			byKind: (["new", "renewal", "change"] as const).map((kind) => ({
				kind,
				payments: byKind.get(kind)?.payments ?? 0,
				revenue: byKind.get(kind)?.revenue ?? {},
			})),
		},
		refunds: { refunds: refundCount, amount: refunded },
		net: subtract(revenue, refunded),
		subscriptions: {
			active,
			trialing,
			trialsStarted: toNumber(trialStarts?.started),
			canceling,
			pastDue,
			started: toNumber(started?.subscriptions),
			ended: toNumber(ended?.subscriptions),
			mrr,
			byPlan: [...livePlans.values()],
		},
		hangingPayments: toNumber(hanging?.payments),
		credits: {
			trialsGranted: toNumber(trials?.granted),
			trialCredits: toNumber(trials?.credits),
			planCredits: toNumber(planCredits?.credits),
			used: actions.reduce((total, row) => total + toNumber(row.credits), 0),
		},
		ai: actions.map((row) => ({
			action: row.action,
			committed: toNumber(row.committed),
			released: toNumber(row.released),
			credits: toNumber(row.credits),
			costUsdMicros: toNumber(row.costUsdMicros),
			p50UsdMicros: row.p50UsdMicros === null ? null : Math.round(toNumber(row.p50UsdMicros)),
			p95UsdMicros: row.p95UsdMicros === null ? null : Math.round(toNumber(row.p95UsdMicros)),
		})),
		alerts: [...alertKinds].map(([kind, entry]) => ({ kind, count: entry.payments.size || entry.events })),
	};
}

export type BillingMetrics = Awaited<ReturnType<typeof billingMetrics>>;

/** One WIB day of the admin charts: paid orders per plan, and counts. */
type DayTotals = {
	day: string;
	plus: number;
	proAi: number;
	payments: number;
	refunds: number;
	started: number;
	paid: number;
	signups: number;
	credits: number;
};

/** A day in Western Indonesian Time, as YYYY-MM-DD, for a timestamp column. */
const wibDate = (column: Parameters<typeof gte>[0]) =>
	sql<string>`to_char(${column} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;

/**
 * Day by day (WIB) for the admin charts: paid orders by plan, refunds, checkouts started and paid, sign-ups, and
 * Rezumi AI credits charged. Counts, so currencies never mix. Every day of the period is there, empty ones as zeros.
 */
export async function billingDailySeries(range: ReportRange) {
	assertRange(range);
	const payment = schema.billingPayment;
	const refund = schema.billingRefund;
	const user = schema.user;
	const usage = schema.aiCreditUsage;
	const days = new Map<string, DayTotals>();
	for (let at = +range.from; at < +range.to; at += 24 * 60 * 60 * 1000) {
		const day = formatWibTime(new Date(at)).slice(0, 10);
		days.set(day, { day, plus: 0, proAi: 0, payments: 0, refunds: 0, started: 0, paid: 0, signups: 0, credits: 0 });
	}
	const add = (day: string, values: Partial<Record<Exclude<keyof DayTotals, "day">, unknown>>) => {
		const entry = days.get(day);
		if (!entry) return;
		for (const [key, value] of Object.entries(values)) entry[key as Exclude<keyof DayTotals, "day">] += toNumber(value);
	};

	const sales = await db
		.select({ day: wibDate(payment.paidAt), planId: payment.planId, payments: count() })
		.from(payment)
		.where(and(isNotNull(payment.paidAt), within(payment.paidAt, range)))
		.groupBy(sql`1`, payment.planId);
	for (const row of sales)
		add(row.day, {
			payments: row.payments,
			...(row.planId === "plus" ? { plus: row.payments } : { proAi: row.payments }),
		});

	const refunds = await db
		.select({ day: wibDate(refund.settledAt), refunds: count() })
		.from(refund)
		.where(and(eq(refund.status, "succeeded"), isNotNull(refund.settledAt), within(refund.settledAt, range)))
		.groupBy(sql`1`);
	for (const row of refunds) add(row.day, { refunds: row.refunds });

	const checkouts = await db
		.select({
			day: wibDate(payment.createdAt),
			started: count(),
			paid: sql<number>`count(*) filter (where ${payment.paidAt} is not null)`,
		})
		.from(payment)
		.where(and(within(payment.createdAt, range), isNotNull(payment.idempotencyKey)))
		.groupBy(sql`1`);
	for (const row of checkouts) add(row.day, { started: row.started, paid: row.paid });

	const signups = await db
		.select({ day: wibDate(user.createdAt), signups: count() })
		.from(user)
		.where(and(within(user.createdAt, range), eq(user.isAnonymous, false)))
		.groupBy(sql`1`);
	for (const row of signups) add(row.day, { signups: row.signups });

	const credits = await db
		.select({ day: wibDate(usage.createdAt), credits: sum(usage.credits) })
		.from(usage)
		.where(
			and(eq(usage.status, "committed"), ne(usage.action, ADMIN_ADJUSTMENT_ACTION), within(usage.createdAt, range)),
		)
		.groupBy(sql`1`);
	for (const row of credits) add(row.day, { credits: row.credits });

	return [...days.values()];
}

/** The period of the same length just before, for "compared with before" on the admin page. */
export const previousRange = (range: ReportRange): ReportRange => ({
	from: new Date(+range.from - (+range.to - +range.from)),
	to: range.from,
});

/** The admin table's status filter: what an owner looks for, each a set of payment statuses. */
const PAYMENT_STATUS_GROUPS = {
	paid: ["paid"],
	waiting: ["creating", "pending"],
	failed: ["failed", "expired", "cancelled"],
	refunded: ["partially_refunded", "refunded", "reversed"],
} as const satisfies Record<string, readonly BillingPaymentStatus[]>;

export type PaymentStatusGroup = keyof typeof PAYMENT_STATUS_GROUPS;

/**
 * One page of the payments started in a period, newest first, with their buyer's email, and how many there are in
 * all, for the admin table. `status` narrows it to one group.
 */
export async function listRecentPayments(
	range: ReportRange,
	page: { limit: number; offset: number; status?: PaymentStatusGroup | undefined },
) {
	assertRange(range);
	const payment = schema.billingPayment;
	const where = and(
		within(payment.createdAt, range),
		page.status ? inArray(payment.status, [...PAYMENT_STATUS_GROUPS[page.status]]) : undefined,
	);
	const items = await db
		.select({
			id: payment.id,
			userId: payment.userId,
			email: schema.user.email,
			orderId: payment.providerOrderId,
			planId: payment.planId,
			interval: payment.interval,
			billingReason: payment.billingReason,
			amount: payment.amount,
			totalAmount: payment.totalAmount,
			trialDays: payment.trialDays,
			currency: payment.currency,
			refundedAmount: payment.refundedAmount,
			status: payment.status,
			createdAt: payment.createdAt,
			paidAt: payment.paidAt,
		})
		.from(payment)
		.leftJoin(schema.user, eq(schema.user.id, payment.userId))
		.where(where)
		.orderBy(sql`${payment.createdAt} desc`, sql`${payment.id} desc`)
		.limit(page.limit)
		.offset(page.offset);
	const [total] = await db.select({ count: count() }).from(payment).where(where);
	return { items, total: toNumber(total?.count) };
}

/** "2026-11-03 14:05" in Western Indonesian Time, the time the books use. */
export function formatWibTime(at: Date) {
	return new Date(+at + WIB_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

/** A CSV cell: quoted when needed, and text a spreadsheet would run as a formula made inert. */
function cell(value: string | number | null) {
	if (value === null) return "";
	if (typeof value === "number") return String(value);
	const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** An amount as plain decimal units for a spreadsheet: 4.99, 59000.00. */
const decimal = (amount: number, currency: string) => toMajorUnits(amount, currency).toFixed(2);

const CSV_COLUMNS = [
	"jenis",
	"tanggal_wib",
	"order_polar",
	"paket",
	"periode",
	"alasan",
	"mata_uang",
	"jumlah_sebelum_pajak",
	"pajak",
	"total_dibayar",
	"status",
	"id_refund",
] as const;

/**
 * Orders paid and refunds made in a period, oldest first, for the books: one line per order (amounts positive) and per
 * refund (negative), so each currency's column sums to the period's net before tax and Polar's fees. Polar's order and
 * refund ids only; no names, email addresses or account ids. Payouts and fees are in Polar's dashboard.
 */
export async function exportPaymentsCsv(range: ReportRange) {
	assertRange(range);
	const payment = schema.billingPayment;
	const refund = schema.billingRefund;
	const payments = await db
		.select({
			at: payment.paidAt,
			orderId: payment.providerOrderId,
			planId: payment.planId,
			interval: payment.interval,
			reason: payment.billingReason,
			currency: payment.currency,
			amount: payment.amount,
			tax: payment.taxAmount,
			total: payment.totalAmount,
			status: payment.status,
		})
		.from(payment)
		.where(and(isNotNull(payment.paidAt), within(payment.paidAt, range)))
		.orderBy(asc(payment.paidAt));
	const refunds = await db
		.select({
			at: refund.settledAt,
			orderId: payment.providerOrderId,
			planId: payment.planId,
			interval: payment.interval,
			currency: payment.currency,
			amount: refund.amount,
			refundKey: refund.refundKey,
		})
		.from(refund)
		.innerJoin(payment, eq(refund.paymentId, payment.id))
		.where(and(eq(refund.status, "succeeded"), isNotNull(refund.settledAt), within(refund.settledAt, range)))
		.orderBy(asc(refund.settledAt));
	const lines = [
		...payments.map((row) => ({
			at: row.at ?? range.from,
			cells: [
				"pembayaran",
				formatWibTime(row.at ?? range.from),
				row.orderId,
				row.planId,
				row.interval ?? "pass",
				saleKind(row.reason),
				row.currency.toUpperCase(),
				decimal(row.amount, row.currency),
				decimal(row.tax, row.currency),
				decimal(row.total, row.currency),
				row.status,
				null,
			],
		})),
		...refunds.map((row) => ({
			at: row.at ?? range.from,
			cells: [
				"refund",
				formatWibTime(row.at ?? range.from),
				row.orderId,
				row.planId,
				row.interval ?? "pass",
				null,
				row.currency.toUpperCase(),
				decimal(-row.amount, row.currency),
				null,
				null,
				"refund",
				row.refundKey,
			],
		})),
	].toSorted((a, b) => +a.at - +b.at);
	const csv = [CSV_COLUMNS.join(","), ...lines.map((line) => line.cells.map(cell).join(","))].join("\r\n");
	const day = (at: Date) => formatWibTime(at).slice(0, 10);
	return {
		filename: `rezumi-pembayaran-${day(range.from)}-${day(new Date(+range.to - 1))}.csv`,
		// A byte-order mark so spreadsheet apps read it as UTF-8.
		csv: `﻿${csv}\r\n`,
		rows: lines.length,
	};
}
