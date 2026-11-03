import type { BillingPaymentStatus } from "@rezumi/db/schema";
import type { PaidPlanId } from "@rezumi/schema/billing";
import { ORPCError } from "@orpc/server";
import { and, asc, count, countDistinct, eq, gt, gte, inArray, isNotNull, lt, ne, sql, sum } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { ADMIN_ADJUSTMENT_ACTION } from "./credits";

/**
 * The owner's numbers: sign-ups, checkouts, sales, refunds, Rezumi AI use and cost for a period, and the CSV for the
 * books. Counts only; no names or email addresses leave the database here.
 */

export type ReportRange = { from: Date; to: Date };

/** The longest period a report or export covers. */
const MAX_RANGE_DAYS = 400;
/** An open payment this old that can still be paid counts as hanging. */
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

/**
 * Paid payments the bank took back (a deny after settlement, a chargeback) in a period, dated when that was applied:
 * the money still held after earlier refunds, which is what leaves the books.
 */
function reversalsIn(range: ReportRange) {
	const payment = schema.billingPayment;
	const event = schema.billingPaymentEvent;
	return db
		.select({
			at: sql<Date>`min(${event.receivedAt})`.mapWith(event.receivedAt),
			orderId: payment.providerOrderId,
			planId: payment.planId,
			method: payment.paymentType,
			amount: sql<number>`${payment.amount} - ${payment.refundedAmount}`.mapWith(Number),
			transactionId: payment.transactionId,
		})
		.from(event)
		.innerJoin(payment, eq(event.paymentId, payment.id))
		.where(
			and(
				eq(payment.status, "reversed"),
				eq(event.outcome, "applied"),
				inArray(event.transactionStatus, ["deny", "failure", "chargeback"]),
				// Failed attempts before the payment went through aren't the reversal.
				sql`${event.receivedAt} >= ${payment.paidAt}`,
				within(event.receivedAt, range),
			),
		)
		.groupBy(payment.id);
}

/** The numbers for a period: [from, to). Pending payments that hang are counted as of `now`. */
export async function billingMetrics(range: ReportRange, now = new Date()) {
	assertRange(range);
	const user = schema.user;
	const payment = schema.billingPayment;
	const refund = schema.billingRefund;
	const grant = schema.aiCreditGrant;
	const usage = schema.aiCreditUsage;

	const [signups] = await db
		.select({
			total: count(),
			verified: sql<number>`count(*) filter (where ${user.emailVerified})`,
		})
		.from(user)
		.where(and(within(user.createdAt, range), eq(user.isAnonymous, false)));

	const [checkouts] = await db
		.select({
			started: count(),
			buyers: countDistinct(payment.userId),
			// Of the payments started in the period, how many were paid (whenever).
			paid: sql<number>`count(*) filter (where ${payment.paidAt} is not null)`,
		})
		.from(payment)
		.where(within(payment.createdAt, range));

	const paidRows = await db
		.select({
			planId: payment.planId,
			method: payment.paymentType,
			payments: count(),
			revenue: sum(payment.amount),
		})
		.from(payment)
		.where(and(isNotNull(payment.paidAt), within(payment.paidAt, range)))
		.groupBy(payment.planId, payment.paymentType);

	const refundRows = await db
		.select({ method: refund.method, refunds: count(), amount: sum(refund.amount) })
		.from(refund)
		.where(and(eq(refund.status, "succeeded"), isNotNull(refund.settledAt), within(refund.settledAt, range)))
		.groupBy(refund.method);

	const [hanging] = await db
		.select({ payments: count() })
		.from(payment)
		.where(
			and(
				inArray(payment.status, ["creating", "pending"]),
				lt(payment.createdAt, new Date(+now - HANGING_AFTER_MS)),
				gt(payment.expiresAt, now),
			),
		);

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

	const reversals = await reversalsIn(range);
	const reversed = reversals.reduce((total, row) => total + row.amount, 0);

	const sales = paidRows.map((row) => ({
		planId: row.planId,
		method: row.method,
		payments: toNumber(row.payments),
		revenue: toNumber(row.revenue),
	}));
	const revenue = sales.reduce((total, row) => total + row.revenue, 0);
	const refunds = refundRows.map((row) => ({
		method: row.method,
		refunds: toNumber(row.refunds),
		amount: toNumber(row.amount),
	}));
	const refunded = refunds.reduce((total, row) => total + row.amount, 0);
	const byPlan = (planId: PaidPlanId) => ({
		planId,
		payments: sales.filter((row) => row.planId === planId).reduce((total, row) => total + row.payments, 0),
		revenue: sales.filter((row) => row.planId === planId).reduce((total, row) => total + row.revenue, 0),
	});
	const methods = new Map<string, { payments: number; revenue: number }>();
	for (const row of sales) {
		const method = row.method ?? "unknown";
		const entry = methods.get(method) ?? { payments: 0, revenue: 0 };
		methods.set(method, { payments: entry.payments + row.payments, revenue: entry.revenue + row.revenue });
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
			payments: sales.reduce((total, row) => total + row.payments, 0),
			revenue,
			byPlan: [byPlan("plus"), byPlan("pro-ai")],
			byMethod: [...methods].map(([method, entry]) => ({ method, ...entry })),
		},
		refunds: { refunds: refunds.reduce((total, row) => total + row.refunds, 0), amount: refunded, byMethod: refunds },
		reversals: { payments: reversals.length, amount: reversed },
		net: revenue - refunded - reversed,
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

/** One WIB day of the admin charts: revenue per plan in Rupiah, and counts. */
type DayTotals = {
	day: string;
	plus: number;
	proAi: number;
	payments: number;
	refunds: number;
	reversals: number;
	started: number;
	paid: number;
	signups: number;
	credits: number;
};

/** A day in Western Indonesian Time, as YYYY-MM-DD, for a timestamp column. */
const wibDate = (column: Parameters<typeof gte>[0]) =>
	sql<string>`to_char(${column} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;

/**
 * Day by day (WIB) for the admin charts: revenue by plan and payments, refunds, checkouts started and paid,
 * sign-ups, and Rezumi AI credits charged. Every day of the period is there, empty ones as zeros.
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
		days.set(day, {
			day,
			plus: 0,
			proAi: 0,
			payments: 0,
			refunds: 0,
			reversals: 0,
			started: 0,
			paid: 0,
			signups: 0,
			credits: 0,
		});
	}
	const add = (day: string, values: Partial<Record<Exclude<keyof DayTotals, "day">, unknown>>) => {
		const entry = days.get(day);
		if (!entry) return;
		for (const [key, value] of Object.entries(values)) entry[key as Exclude<keyof DayTotals, "day">] += toNumber(value);
	};

	const sales = await db
		.select({ day: wibDate(payment.paidAt), planId: payment.planId, payments: count(), revenue: sum(payment.amount) })
		.from(payment)
		.where(and(isNotNull(payment.paidAt), within(payment.paidAt, range)))
		.groupBy(sql`1`, payment.planId);
	for (const row of sales)
		add(row.day, {
			payments: row.payments,
			...(row.planId === "plus" ? { plus: row.revenue } : { proAi: row.revenue }),
		});

	const refunds = await db
		.select({ day: wibDate(refund.settledAt), amount: sum(refund.amount) })
		.from(refund)
		.where(and(eq(refund.status, "succeeded"), isNotNull(refund.settledAt), within(refund.settledAt, range)))
		.groupBy(sql`1`);
	for (const row of refunds) add(row.day, { refunds: row.amount });

	for (const row of await reversalsIn(range)) add(formatWibTime(row.at).slice(0, 10), { reversals: row.amount });

	const checkouts = await db
		.select({
			day: wibDate(payment.createdAt),
			started: count(),
			paid: sql<number>`count(*) filter (where ${payment.paidAt} is not null)`,
		})
		.from(payment)
		.where(within(payment.createdAt, range))
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
			amount: payment.amount,
			refundedAmount: payment.refundedAmount,
			status: payment.status,
			paymentType: payment.paymentType,
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

const CSV_COLUMNS = [
	"jenis",
	"tanggal_wib",
	"nomor_pesanan",
	"paket",
	"metode",
	"jumlah_idr",
	"status",
	"id_transaksi_midtrans",
	"kunci_refund",
] as const;

/**
 * Payments paid, refunds made and bank reversals in a period, oldest first, for the books and tax: one line per
 * payment (amount positive), per refund and per reversal (negative), so the column sums to the period's net. Order
 * numbers and Midtrans references only; no names, email addresses or account ids.
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
			method: payment.paymentType,
			amount: payment.amount,
			status: payment.status,
			transactionId: payment.transactionId,
		})
		.from(payment)
		.where(and(isNotNull(payment.paidAt), within(payment.paidAt, range)))
		.orderBy(asc(payment.paidAt));
	const refunds = await db
		.select({
			at: refund.settledAt,
			orderId: payment.providerOrderId,
			planId: payment.planId,
			method: payment.paymentType,
			amount: refund.amount,
			refundMethod: refund.method,
			transactionId: payment.transactionId,
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
				row.method,
				row.amount,
				row.status,
				row.transactionId,
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
				row.method,
				-row.amount,
				row.refundMethod === "manual" ? "refund_manual" : "refund_midtrans",
				row.transactionId,
				row.refundKey,
			],
		})),
		...(await reversalsIn(range)).map((row) => ({
			at: row.at,
			cells: [
				"pembalikan",
				formatWibTime(row.at),
				row.orderId,
				row.planId,
				row.method,
				-row.amount,
				"reversed",
				row.transactionId,
				null,
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
