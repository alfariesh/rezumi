import type { BillingAlertKind } from "./alerts";
import type { BillingMetrics } from "./reports";
import type { BillingNoticeEmailProps } from "@rezumi/email/billing";
import type { PaidPlanId } from "@rezumi/schema/billing";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, notExists, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { deliverBillingNotice } from "@rezumi/email/billing";
import { env } from "@rezumi/env/server";
import { FREE_TEMPLATES, PLANS } from "@rezumi/schema/billing";
import { alertDue, wibMidnight } from "./alerts";
import { getBillingMode, isBillingAppliedTo } from "./entitlements";
import { billingMetrics, formatWibTime } from "./reports";
import { DAY_MS } from "./timeline";

/**
 * Sends what `billing_notification` holds: the owner's alerts and daily summary (to BILLING_ALERT_EMAIL), and a
 * customer's reminder three days before their paid access ends. Each row is claimed before it is sent, so two runs
 * never send it twice, and retried a few times when the mail provider refuses it.
 */

const MAX_ATTEMPTS = 5;
// How long another sender leaves a notification alone after a send started.
const LEASE_MS = 5 * 60 * 1000;
const BATCH = 10;
/** Older unsent notifications are left: an alert from yesterday that never went out is stale news. */
const MAX_AGE_MS = 2 * DAY_MS;
/** How long before paid access ends the customer hears about it. */
const REMINDER_LEAD_MS = 3 * DAY_MS;
const REMINDER_BATCH = 100;

type NotificationRow = typeof schema.billingNotification.$inferSelect;

const PLAN_NAMES: Record<PaidPlanId, string> = { plus: "Plus", "pro-ai": "Pro AI" };

const adminUrl = (query?: string) => {
	const url = new URL("/dashboard/admin/billing", env.APP_URL);
	if (query) url.searchParams.set("query", query);
	return url.toString();
};

/** The account's time zone, or Western Indonesian Time while it is still the default UTC (or unknown). */
function timeZoneOf(timezone: string | null | undefined) {
	if (!timezone || timezone === "UTC") return "Asia/Jakarta";
	try {
		new Intl.DateTimeFormat("id-ID", { timeZone: timezone });
		return timezone;
	} catch {
		return "Asia/Jakarta";
	}
}

const formatRupiah = (amount: number) => `Rp${new Intl.NumberFormat("id-ID").format(amount)}`;

// What each alert says to the owner, and what to look at first. The runbook has the steps.
const ALERT_TEXT: Record<BillingAlertKind, { title: string; body: string }> = {
	amount_mismatch: {
		title: "Nominal pembayaran tidak cocok",
		body: "Midtrans melaporkan nominal yang berbeda dari harga pesanan, jadi paket tidak diaktifkan. Cocokkan nominalnya di dashboard Midtrans, lalu aktifkan manual atau refund.",
	},
	paid_not_applied: {
		title: "Pelanggan sudah bayar, tetapi paket belum aktif",
		body: "Midtrans menyatakan pembayaran berhasil, tetapi aktivasi di Rezumi gagal atau tertahan. Buka pembayarannya di halaman admin dan tekan Cek ulang status.",
	},
	payment_reversed: {
		title: "Pembayaran dibatalkan oleh bank",
		body: "Pembayaran yang sudah berhasil dibalik oleh bank atau penerbit (misalnya chargeback). Paket dan sisa kreditnya sudah dicabut otomatis. Cek riwayatnya di dashboard Midtrans.",
	},
	needs_review: {
		title: "Status pembayaran perlu dicek manual",
		body: "Midtrans mengirim status yang tidak bisa diproses otomatis (misalnya chargeback sebagian atau penipuan terdeteksi setelah lunas). Pembayaran dibiarkan apa adanya sampai kamu mengeceknya.",
	},
	rejected_signatures: {
		title: "Banyak notifikasi Midtrans ditolak",
		body: "Lima atau lebih notifikasi dengan tanda tangan salah dalam satu jam. Biasanya kunci Midtrans baru diganti tetapi secret di server belum (MIDTRANS_SERVER_KEY / MIDTRANS_SIGNATURE_KEY). Pembayaran tetap aktif lewat pengecekan berkala, hanya lebih lambat.",
	},
	midtrans_errors: {
		title: "API Midtrans gagal berulang kali",
		body: "Pembuatan halaman bayar atau pengecekan status ke Midtrans gagal beberapa kali. Cek status.midtrans.com dan apakah server key di server masih benar.",
	},
	receipt_failed: {
		title: "Bukti bayar gagal terkirim",
		body: "Email bukti bayar tidak sampai ke pelanggan setelah 5 kali percobaan. Cek pengaturan email server, lalu tekan Kirim ulang bukti bayar di halaman admin.",
	},
	refund_failed: {
		title: "Refund belum berhasil",
		body: "Midtrans menolak refund atau belum mengonfirmasinya. Buka pembayarannya di halaman admin, tekan Cek ulang status, dan lihat alasannya.",
	},
};

function alertNotice(row: NotificationRow): { subject: string; notice: BillingNoticeEmailProps } {
	const text = ALERT_TEXT[row.kind as BillingAlertKind] ?? { title: row.kind, body: "" };
	const paymentIds = Array.isArray(row.details.paymentIds) ? (row.details.paymentIds as string[]) : [];
	return {
		subject: `[Rezumi] Peringatan: ${text.title}`,
		notice: {
			lang: "id",
			preview: text.title,
			heading: text.title,
			paragraphs: [text.body, "Langkah lengkapnya ada di runbook pemilik (runbook-pemilik.md)."],
			rows: [
				{ label: "Terjadi", value: `${row.count} kali sejak ${formatWibTime(row.createdAt)} WIB` },
				...(paymentIds.length ? [{ label: "Pembayaran", value: paymentIds.map((id) => `RZ-${id}`).join(", ") }] : []),
			],
			action: { label: "Buka halaman admin", url: adminUrl(paymentIds[0] && `RZ-${paymentIds[0]}`) },
			footer: "Peringatan ini dikirim paling banyak sekali per jenis per jam.",
		},
	};
}

/** The owner's morning email: yesterday in WIB, and what still waits. */
function summaryNotice(day: string, metrics: BillingMetrics): { subject: string; notice: BillingNoticeEmailProps } {
	const alerts = metrics.alerts.filter((alert) => alert.count > 0);
	return {
		subject: `[Rezumi] Ringkasan penjualan ${day}`,
		notice: {
			lang: "id",
			preview: `${metrics.sales.payments} pembayaran, ${formatRupiah(metrics.sales.revenue)}`,
			heading: `Ringkasan ${day}`,
			paragraphs: [
				`Penjualan kemarin (WIB): ${metrics.sales.payments} pembayaran berhasil, total ${formatRupiah(metrics.sales.revenue)}.`,
				metrics.hangingPayments
					? `${metrics.hangingPayments} pembayaran masih menunggu dibayar lebih dari satu jam; biasanya pelanggan memilih transfer bank dan belum membayar.`
					: "Tidak ada pembayaran yang menggantung.",
			],
			rows: [
				...metrics.sales.byPlan.map((plan) => ({
					label: PLAN_NAMES[plan.planId],
					value: `${plan.payments} × (${formatRupiah(plan.revenue)})`,
				})),
				{ label: "Checkout dimulai", value: `${metrics.checkouts.started} (${metrics.checkouts.paid} sudah dibayar)` },
				{
					label: "Refund",
					value: `${metrics.refunds.refunds} (${formatRupiah(metrics.refunds.amount)})`,
				},
				...(metrics.reversals.payments
					? [
							{
								label: "Dibatalkan bank",
								value: `${metrics.reversals.payments} (${formatRupiah(metrics.reversals.amount)})`,
							},
						]
					: []),
				{ label: "Bersih", value: formatRupiah(metrics.net) },
				{ label: "Pendaftar baru", value: `${metrics.signups.total} (${metrics.signups.verified} terverifikasi)` },
				{ label: "Kredit Rezumi AI terpakai", value: String(metrics.credits.used) },
				{
					label: "Peringatan",
					value: alerts.length
						? alerts
								.map((alert) => `${ALERT_TEXT[alert.kind as BillingAlertKind]?.title ?? alert.kind} (${alert.count})`)
								.join("; ")
						: "tidak ada",
				},
			],
			action: { label: "Buka halaman admin", url: adminUrl() },
		},
	};
}

/** The customer's reminder, in the language of their last checkout: Indonesian or English. */
function reminderNotice(input: { locale: string | null; planId: PaidPlanId; endsAt: Date; timezone: string | null }): {
	subject: string;
	notice: BillingNoticeEmailProps;
} {
	const indonesian = !input.locale || input.locale.startsWith("id");
	const free = PLANS.free.limits;
	const plan = PLAN_NAMES[input.planId];
	const at = new Intl.DateTimeFormat(indonesian ? "id-ID" : "en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: timeZoneOf(input.timezone),
		timeZoneName: "short",
	}).format(input.endsAt);
	const url = new URL("/dashboard/settings/billing", env.APP_URL).toString();
	if (indonesian) {
		const heading = `Paket ${plan}-mu berakhir ${at}`;
		return {
			subject: `Paket Rezumi ${plan}-mu berakhir dalam 3 hari`,
			notice: {
				lang: "id",
				preview: heading,
				heading,
				paragraphs: [
					`Akses ${plan}-mu berakhir pada ${at}. Paket ini tidak diperpanjang otomatis, jadi tidak ada tagihan apa pun.`,
					`Setelah itu akunmu kembali ke Gratis. Semua CV dan surat tetap bisa dibuka, diedit, dan diunduh sebagai PDF. Kamu tetap bisa membuat dokumen baru selama CV aktif tidak lebih dari ${free.activeResumes} dan surat aktif tidak lebih dari ${free.activeCoverLetters}, memakai ${FREE_TEMPLATES.length} template gratis, dan memakai koneksi AI milikmu sendiri.`,
					...(input.planId === "pro-ai"
						? ["Sisa kredit Rezumi AI dari paket ini berakhir bersamaan dengan paketnya."]
						: []),
					"Bila ingin melanjutkan, kamu bisa membeli lagi kapan saja di halaman Paket.",
				],
				action: { label: "Lihat paket", url },
				footer:
					"Kamu menerima email ini karena pernah membeli paket Rezumi. Email ini hanya dikirim sekali per masa aktif.",
			},
		};
	}
	const heading = `Your ${plan} pass ends ${at}`;
	return {
		subject: `Your Rezumi ${plan} pass ends in 3 days`,
		notice: {
			lang: "en",
			preview: heading,
			heading,
			paragraphs: [
				`Your ${plan} access ends on ${at}. Passes don't renew automatically, so you won't be charged.`,
				`After that your account is back on Free. Every resume and letter stays yours to open, edit and download as a PDF. You can still create new ones while you have up to ${free.activeResumes} active resumes and ${free.activeCoverLetters} active letters, use the ${FREE_TEMPLATES.length} free templates, and use your own AI connection.`,
				...(input.planId === "pro-ai" ? ["Rezumi AI credits from this pass end with it."] : []),
				"If you'd like to continue, you can buy another pass any time on the Plan page.",
			],
			action: { label: "See plans", url },
			footer: "You're getting this because you bought a Rezumi pass. It's sent once per pass.",
		},
	};
}

/**
 * Queues a reminder for each account whose paid access (its last queued pass) ends within three days, once per end
 * time: a pass bought later moves the end and gets its own reminder. Only while plans apply to the account.
 */
export async function queueExpiryReminders(now = new Date()): Promise<number> {
	if (getBillingMode() === "off") return 0;
	const period = schema.membershipPeriod;
	const ending = await db
		.select({ userId: period.userId, endsAt: sql<Date>`max(${period.endsAt})`.mapWith(period.endsAt) })
		.from(period)
		.where(
			and(
				isNull(period.revokedAt),
				gt(period.endsAt, now),
				// Accounts reminded within the lead time are done; leaving them out lets the batch move on to the rest.
				notExists(
					db
						.select({ id: schema.billingNotification.id })
						.from(schema.billingNotification)
						.where(
							and(
								eq(schema.billingNotification.userId, period.userId),
								eq(schema.billingNotification.kind, "expiry_reminder"),
								gt(schema.billingNotification.createdAt, new Date(+now - REMINDER_LEAD_MS - DAY_MS)),
							),
						),
				),
			),
		)
		.groupBy(period.userId)
		.having(sql`max(${period.endsAt}) <= ${new Date(+now + REMINDER_LEAD_MS).toISOString()}::timestamptz`)
		.orderBy(sql`max(${period.endsAt})`)
		.limit(REMINDER_BATCH);
	let queued = 0;
	for (const { userId, endsAt } of ending) {
		if (!(await isBillingAppliedTo(userId))) continue;
		const [row] = await db
			.insert(schema.billingNotification)
			.values({
				key: `expiry:${userId}:${endsAt.getTime()}`,
				kind: "expiry_reminder",
				userId,
				details: { endsAt: endsAt.toISOString() },
				createdAt: now,
			})
			.onConflictDoNothing()
			.returning({ id: schema.billingNotification.id });
		if (row) queued++;
	}
	return queued;
}

/** The reminder for a row, or null when there is nothing to remind: the pass was extended or taken back. */
async function reminderFor(row: NotificationRow, now: Date) {
	if (!row.userId || typeof row.details.endsAt !== "string") return null;
	const endsAt = new Date(row.details.endsAt);
	const period = schema.membershipPeriod;
	const [last] = await db
		.select({ planId: period.planId, endsAt: period.endsAt })
		.from(period)
		.where(and(eq(period.userId, row.userId), isNull(period.revokedAt), gt(period.endsAt, now)))
		.orderBy(desc(period.endsAt))
		.limit(1);
	if (!last || +last.endsAt !== +endsAt) return null;
	const [owner] = await db
		.select({ email: schema.user.email, timezone: schema.user.timezone, locale: schema.billingAccount.locale })
		.from(schema.user)
		.leftJoin(schema.billingAccount, eq(schema.billingAccount.userId, schema.user.id))
		.where(eq(schema.user.id, row.userId));
	if (!owner) return null;
	return { to: owner.email, ...reminderNotice({ ...owner, planId: last.planId, endsAt }) };
}

/** Claims unsent notifications nobody else is sending; the owner's only when there is an address for them. */
function claim(now: Date) {
	const table = schema.billingNotification;
	return db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(table)
			.where(
				and(
					isNull(table.sentAt),
					lt(table.attempts, MAX_ATTEMPTS),
					gt(table.createdAt, new Date(+now - MAX_AGE_MS)),
					or(isNull(table.attemptedAt), lt(table.attemptedAt, new Date(+now - LEASE_MS))),
					env.BILLING_ALERT_EMAIL ? undefined : isNotNull(table.userId),
					// An alert waits for its threshold; summaries and reminders (count 1, no threshold) are always due.
					alertDue(),
				),
			)
			.orderBy(asc(table.createdAt))
			.limit(BATCH)
			.for("update", { skipLocked: true });
		if (rows.length)
			await tx
				.update(table)
				.set({ attempts: sql`${table.attempts} + 1`, attemptedAt: now })
				.where(
					inArray(
						table.id,
						rows.map((row) => row.id),
					),
				);
		return rows;
	});
}

/** The email a notification makes, or null when it no longer has anything to say. */
async function emailFor(row: NotificationRow, now: Date) {
	const owner = env.BILLING_ALERT_EMAIL;
	if (row.kind === "expiry_reminder") return reminderFor(row, now);
	if (!owner) return null;
	if (row.kind === "daily_summary") {
		const day = typeof row.details.day === "string" ? row.details.day : null;
		if (!day) return null;
		const from = wibMidnight(day);
		const metrics = await billingMetrics({ from, to: new Date(+from + DAY_MS) }, now);
		return { to: owner, ...summaryNotice(day, metrics) };
	}
	return { to: owner, ...alertNotice(row) };
}

/** Sends due billing notifications, a few per run. Returns how many went out. */
export async function sendBillingNotifications(now = new Date()): Promise<number> {
	const rows = await claim(now);
	let sent = 0;
	for (const row of rows) {
		try {
			const email = await emailFor(row, now);
			if (email) {
				const delivery = await deliverBillingNotice(email);
				// No email set up in production: try again later, within the attempts left.
				if (delivery === "unconfigured") continue;
				sent++;
			}
			await db
				.update(schema.billingNotification)
				.set({ sentAt: now, ...(email ? {} : { details: { ...row.details, skipped: true } }) })
				.where(eq(schema.billingNotification.id, row.id));
		} catch {
			console.error("[billing] A billing email could not be sent; the billing job tries again.", {
				kind: row.kind,
				notificationId: row.id,
			});
		}
	}
	return sent;
}
