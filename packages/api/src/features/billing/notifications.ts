import type { BillingAlertKind } from "./alerts";
import type { BillingMetrics, Money } from "./reports";
import type { BillingNoticeEmailProps } from "@rezumi/email/billing";
import type { PaidPlanId } from "@rezumi/schema/billing";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, notExists, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { deliverBillingNotice } from "@rezumi/email/billing";
import { env } from "@rezumi/env/server";
import { BILLING_SELLER, FREE_TEMPLATES, PLANS, toMajorUnits } from "@rezumi/schema/billing";
import { alertDue, wibMidnight } from "./alerts";
import { getBillingMode, isBillingAppliedTo } from "./entitlements";
import { billingMetrics, formatWibTime } from "./reports";
import { subscriptionAccess } from "./subscription-access";
import { getCurrentSubscription, subscriptionState } from "./subscriptions";
import { DAY_MS } from "./timeline";

/**
 * Sends what `billing_notification` holds: the owner's alerts and daily summary (to BILLING_ALERT_EMAIL), and a
 * customer's receipt for a QRIS pass and reminder three days before their pass or granted access ends. Each row is
 * claimed before it is sent, so two runs never send it twice, and retried a few times when the mail provider refuses it.
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

/** Money in each currency, written the Indonesian way: "US$4,99 + Rp59.000"; a dash when there is none. */
function formatMoney(money: Money) {
	const parts = Object.entries(money)
		.filter(([, amount]) => amount !== 0)
		.map(([currency, amount]) =>
			new Intl.NumberFormat("id-ID", {
				style: "currency",
				currency: currency.toUpperCase(),
				maximumFractionDigits: currency.toLowerCase() === "idr" ? 0 : 2,
			}).format(toMajorUnits(amount, currency)),
		);
	return parts.length ? parts.join(" + ") : "0";
}

// What each alert says to the owner, and what to look at first. The runbook has the steps.
const ALERT_TEXT: Record<BillingAlertKind, { title: string; body: string }> = {
	paid_not_applied: {
		title: "Pelanggan sudah bayar, tetapi paket belum aktif",
		body: "Penyedia pembayaran (Dodo Payments untuk kartu, Sumopod untuk QRIS) menyatakan pembayaran berhasil, tetapi aktivasi di Rezumi gagal atau akunnya sudah dihapus. Buka pembayarannya di halaman admin dan tekan Cek ulang status. Bila akunnya sudah tidak ada: kartu di-refund lewat halaman admin; QRIS kamu kembalikan sendiri (transfer) lalu catat refund-nya di halaman admin.",
	},
	payment_reversed: {
		title: "Uang pembayaran ditarik kembali",
		body: "Ada sengketa kartu (dispute) atas sebuah pembayaran. Saat baru dibuka: kirim bukti (riwayat pemakaian, email, syarat layanan) lewat dashboard Dodo Payments → Disputes dalam beberapa hari. Bila sengketa kalah atau diterima, Rezumi sudah mencabut kredit dari pembayaran itu dan membatalkan langganannya otomatis.",
	},
	needs_review: {
		title: "Kejadian pembayaran perlu dicek manual",
		body: "Ada webhook (Dodo Payments atau Sumopod) yang tidak bisa diproses otomatis, atau pembayaran QRIS yang nominalnya kurang dari harga paket. Datanya tidak diubah dan paket tidak diberikan. Cek pembayarannya di halaman admin (Cek ulang status). Setelah diperbaiki, webhook bisa dikirim ulang dari dashboard penyedianya: Dodo Payments (Developer → Webhooks → pilih endpoint → Logs) atau Sumopod (Managed Payment → Webhooks).",
	},
	rejected_signatures: {
		title: "Banyak webhook pembayaran ditolak",
		body: "Lima atau lebih webhook dengan tanda tangan salah dalam satu jam. Biasanya secret webhook di dashboard penyedia diganti tetapi server belum: DODO_PAYMENTS_WEBHOOK_KEY (Dodo Payments) atau SUMOPOD_WEBHOOK_SECRET (Sumopod). Pembayaran tetap masuk lewat pengecekan berkala, hanya lebih lambat.",
	},
	provider_errors: {
		title: "API penyedia pembayaran gagal berulang kali",
		body: "Pembuatan halaman bayar atau pengecekan status ke Dodo Payments (kartu) atau Sumopod (QRIS) gagal beberapa kali. Cek status.dodopayments.com atau status.sumopod.com, dan apakah DODO_PAYMENTS_API_KEY atau SUMOPOD_API_KEY di server masih berlaku (dan dari mode yang sama).",
	},
	refund_failed: {
		title: "Refund belum berhasil",
		body: "Dodo Payments menolak refund atau belum mengonfirmasinya (refund bisa berstatus review). Buka pembayarannya di halaman admin, tekan Cek ulang status, dan lihat alasannya.",
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
	const kinds = Object.fromEntries(metrics.sales.byKind.map((entry) => [entry.kind, entry.payments]));
	const qris = metrics.sales.byMethod.find((entry) => entry.method === "qris");
	return {
		subject: `[Rezumi] Ringkasan penjualan ${day}`,
		notice: {
			lang: "id",
			preview: `${metrics.sales.payments} pembayaran, ${formatMoney(metrics.sales.revenue)}`,
			heading: `Ringkasan ${day}`,
			paragraphs: [
				`Penjualan kemarin (WIB): ${metrics.sales.payments} pembayaran berhasil (${kinds.new ?? 0} baru, ${kinds.renewal ?? 0} perpanjangan, ${kinds.change ?? 0} ganti paket), total ${formatMoney(metrics.sales.revenue)} sebelum fee penyedia (kartu: sebelum pajak).`,
				metrics.hangingPayments
					? `${metrics.hangingPayments} checkout dibuka lebih dari satu jam lalu tetapi belum dibayar.`
					: "Tidak ada checkout yang menggantung.",
			],
			rows: [
				...metrics.sales.byPlan.map((plan) => ({
					label: PLAN_NAMES[plan.planId],
					value: `${plan.payments} × (${formatMoney(plan.revenue)})`,
				})),
				{ label: "Lewat QRIS", value: `${qris?.payments ?? 0} × (${formatMoney(qris?.revenue ?? {})})` },
				{ label: "Checkout dimulai", value: `${metrics.checkouts.started} (${metrics.checkouts.paid} sudah dibayar)` },
				{ label: "Refund", value: `${metrics.refunds.refunds} (${formatMoney(metrics.refunds.amount)})` },
				{ label: "Bersih", value: formatMoney(metrics.net) },
				{
					label: "Langganan aktif",
					value: `${metrics.subscriptions.active} (${metrics.subscriptions.canceling} akan berhenti, ${metrics.subscriptions.pastDue} gagal bayar)`,
				},
				{
					label: "Trial gratis",
					value: `${metrics.subscriptions.trialing} berjalan (${metrics.subscriptions.trialsStarted} mulai kemarin)`,
				},
				{ label: "MRR", value: formatMoney(metrics.subscriptions.mrr) },
				{ label: "Paket QRIS aktif", value: String(metrics.passes.active) },
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

/** A date and time in the customer's language and time zone: "10 Desember 2026 pukul 14.05 WIB". */
function formatWhen(at: Date, indonesian: boolean, timezone: string | null, withTime = true) {
	return new Intl.DateTimeFormat(indonesian ? "id-ID" : "en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
		...(withTime && { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }),
		timeZone: timeZoneOf(timezone),
	}).format(at);
}

/** Rupiah (or dollars) in the customer's language: "Rp29.000". */
function formatAmount(amount: number, currency: string, indonesian: boolean) {
	return new Intl.NumberFormat(indonesian ? "id-ID" : "en-US", {
		style: "currency",
		currency: currency.toUpperCase(),
		maximumFractionDigits: currency.toLowerCase() === "idr" ? 0 : 2,
	}).format(toMajorUnits(amount, currency));
}

/**
 * The customer's reminder, in the language of their last checkout: Indonesian or English. `paid` is a QRIS pass they
 * bought (it can be extended by QRIS, without losing a day); otherwise access an admin or a promotion gave.
 */
function reminderNotice(input: {
	locale: string | null;
	planId: PaidPlanId;
	endsAt: Date;
	timezone: string | null;
	paid: boolean;
}): {
	subject: string;
	notice: BillingNoticeEmailProps;
} {
	const indonesian = !input.locale || input.locale.startsWith("id");
	const free = PLANS.free.limits;
	const plan = PLAN_NAMES[input.planId];
	const at = formatWhen(input.endsAt, indonesian, input.timezone);
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
					input.paid
						? `Paket ${plan} yang kamu bayar dengan QRIS berakhir pada ${at}. Paket QRIS tidak diperpanjang otomatis, jadi tidak ada tagihan apa pun.`
						: `Akses ${plan}-mu berakhir pada ${at}. Akses ini diberikan tanpa langganan, jadi tidak diperpanjang dan tidak ada tagihan apa pun.`,
					`Setelah itu akunmu kembali ke Gratis. Semua CV dan surat tetap bisa dibuka, diedit, dan diunduh sebagai PDF. Kamu tetap bisa membuat dokumen baru selama CV aktif tidak lebih dari ${free.activeResumes} dan surat aktif tidak lebih dari ${free.activeCoverLetters}, memakai ${FREE_TEMPLATES.length} template gratis, dan memakai koneksi AI milikmu sendiri.`,
					...(input.planId === "pro-ai"
						? ["Sisa kredit Rezumi AI dari paket ini berakhir bersamaan dengan paketnya."]
						: []),
					input.paid
						? "Mau lanjut? Perpanjang dengan QRIS di halaman Paket: waktunya ditambahkan setelah paket yang sekarang, jadi tidak ada hari yang hilang."
						: "Bila ingin melanjutkan, kamu bisa membeli paket kapan saja di halaman Paket.",
				],
				action: { label: input.paid ? "Perpanjang paket" : "Lihat paket", url },
				footer: input.paid
					? "Kamu menerima email ini karena membeli paket Rezumi dengan QRIS. Email ini hanya dikirim sekali per masa aktif."
					: "Kamu menerima email ini karena akunmu mendapat akses paket Rezumi. Email ini hanya dikirim sekali per masa aktif.",
			},
		};
	}
	const heading = `Your ${plan} ${input.paid ? "plan" : "access"} ends ${at}`;
	return {
		subject: `Your Rezumi ${plan} ${input.paid ? "plan" : "access"} ends in 3 days`,
		notice: {
			lang: "en",
			preview: heading,
			heading,
			paragraphs: [
				input.paid
					? `The ${plan} plan you paid for with QRIS ends on ${at}. QRIS plans don't renew on their own, so you won't be charged.`
					: `Your ${plan} access ends on ${at}. It was given without a subscription, so it doesn't renew and you won't be charged.`,
				`After that your account is back on Free. Every resume and letter stays yours to open, edit and download as a PDF. You can still create new ones while you have up to ${free.activeResumes} active resumes and ${free.activeCoverLetters} active letters, use the ${FREE_TEMPLATES.length} free templates, and use your own AI connection.`,
				...(input.planId === "pro-ai" ? ["Rezumi AI credits that came with it end with it too."] : []),
				input.paid
					? "To keep going, extend it with QRIS on the Plan page: the time is added after your current plan, so no day is lost."
					: "If you'd like to continue, you can get a plan any time on the Plan page.",
			],
			action: { label: input.paid ? "Extend my plan" : "See plans", url },
			footer: input.paid
				? "You're getting this because you bought a Rezumi plan with QRIS. It's sent once per stretch of access."
				: "You're getting this because your account was given a Rezumi plan. It's sent once per stretch of access.",
		},
	};
}

/** The receipt for a paid QRIS pass, in the language of the checkout: Rezumi sells passes itself, so it sends one. */
function receiptNotice(input: {
	locale: string | null;
	timezone: string | null;
	name: string;
	payment: {
		id: string;
		planId: PaidPlanId;
		durationDays: number | null;
		amount: number;
		currency: string;
		paidAt: Date;
		fulfilledAt: Date | null;
		periodStart: Date | null;
		periodEnd: Date | null;
	};
}): { subject: string; notice: BillingNoticeEmailProps } {
	const indonesian = !input.locale || input.locale.startsWith("id");
	const { payment } = input;
	const plan = PLAN_NAMES[payment.planId];
	const days = payment.durationDays ?? 30;
	const amount = formatAmount(payment.amount, payment.currency, indonesian);
	const order = `RZ-${payment.id}`;
	const url = new URL(`/dashboard/settings/billing/receipt/${payment.id}`, env.APP_URL).toString();
	const credits = PLANS[payment.planId].creditsPerMonth;
	// Waiting behind the current plan: placed later than it was granted (Sumopod's paid time can be earlier still).
	const startsLater =
		payment.periodStart !== null && +payment.periodStart > +(payment.fulfilledAt ?? payment.paidAt) + 1000;
	const when = (at: Date) => formatWhen(at, indonesian, input.timezone, false);
	const period =
		payment.periodStart && payment.periodEnd ? `${when(payment.periodStart)} – ${when(payment.periodEnd)}` : null;
	const seller = `${BILLING_SELLER.name} (${BILLING_SELLER.brand}), ${BILLING_SELLER.supportEmail}`;
	if (indonesian) {
		const heading = "Pembayaran diterima";
		return {
			subject: `Bukti pembayaran Rezumi ${plan} (${days} hari)`,
			notice: {
				lang: "id",
				preview: `${amount} untuk Rezumi ${plan} ${days} hari`,
				heading,
				paragraphs: [
					`Terima kasih${input.name ? `, ${input.name}` : ""}. Pembayaran QRIS-mu untuk Rezumi ${plan} ${days} hari sudah kami terima.`,
					startsLater && payment.periodStart
						? `Paket ini mulai ${when(payment.periodStart)}, setelah paket yang sedang berjalan selesai.`
						: `Paket ${plan}-mu sudah aktif.`,
					...(credits
						? [`Termasuk ${credits} kredit Rezumi AI untuk setiap bulan paket (tidak terbawa ke bulan berikutnya).`]
						: []),
					"Paket QRIS tidak diperpanjang otomatis. Kami mengingatkanmu lewat email 3 hari sebelum berakhir.",
				],
				rows: [
					{ label: "Nomor pesanan", value: order },
					{ label: "Tanggal bayar", value: formatWhen(payment.paidAt, true, input.timezone) },
					{ label: "Paket", value: `${plan} · ${days} hari` },
					...(period ? [{ label: "Masa aktif", value: period }] : []),
					{ label: "Metode", value: "QRIS (diproses oleh Sumopod)" },
					{ label: "Jumlah", value: amount },
					{ label: "Penjual", value: seller },
				],
				action: { label: "Lihat bukti bayar", url },
				footer:
					"Bukti pembayaran ini bukan faktur pajak: penjualnya perorangan yang tidak terdaftar sebagai Pengusaha Kena Pajak, jadi harga tidak memuat PPN.",
			},
		};
	}
	return {
		subject: `Your Rezumi ${plan} receipt (${days} days)`,
		notice: {
			lang: "en",
			preview: `${amount} for Rezumi ${plan}, ${days} days`,
			heading: "Payment received",
			paragraphs: [
				`Thank you${input.name ? `, ${input.name}` : ""}. We've received your QRIS payment for Rezumi ${plan}, ${days} days.`,
				startsLater && payment.periodStart
					? `It starts on ${when(payment.periodStart)}, when your current plan ends.`
					: `Your ${plan} plan is active.`,
				...(credits
					? [`It includes ${credits} Rezumi AI credits for each month of the plan (they don't roll over).`]
					: []),
				"QRIS plans don't renew on their own. We'll email you 3 days before it ends.",
			],
			rows: [
				{ label: "Order number", value: order },
				{ label: "Paid on", value: formatWhen(payment.paidAt, false, input.timezone) },
				{ label: "Plan", value: `${plan} · ${days} days` },
				...(period ? [{ label: "Access", value: period }] : []),
				{ label: "Method", value: "QRIS (processed by Sumopod)" },
				{ label: "Amount", value: amount },
				{ label: "Seller", value: seller },
			],
			action: { label: "View receipt", url },
			footer:
				"This receipt isn't a tax invoice: the seller is an individual who isn't VAT-registered, so the price includes no VAT.",
		},
	};
}

/** The receipt email for a paid QRIS pass, or null when there's nothing to send (the payment or the account is gone). */
async function receiptFor(row: NotificationRow) {
	const paymentId = typeof row.details.paymentId === "string" ? row.details.paymentId : null;
	if (!row.userId || !paymentId) return null;
	const [payment] = await db
		.select()
		.from(schema.billingPayment)
		.where(and(eq(schema.billingPayment.id, paymentId), eq(schema.billingPayment.userId, row.userId)));
	if (!payment?.paidAt) return null;
	const [owner] = await db
		.select({
			email: schema.user.email,
			name: schema.user.name,
			timezone: schema.user.timezone,
			locale: schema.billingAccount.locale,
		})
		.from(schema.user)
		.leftJoin(schema.billingAccount, eq(schema.billingAccount.userId, schema.user.id))
		.where(eq(schema.user.id, row.userId));
	if (!owner) return null;
	return {
		to: owner.email,
		...receiptNotice({
			locale: owner.locale,
			timezone: owner.timezone,
			name: owner.name.trim().split(/\s+/)[0] ?? "",
			payment: { ...payment, paidAt: payment.paidAt },
		}),
	};
}

/**
 * Queues a reminder for each account whose pass (QRIS) or granted access (an admin grant, a promotion, an old pass)
 * ends within three days, once per end time: a later pass moves the end and gets its own reminder. Subscriptions are
 * left out: Dodo emails about renewals and cancellations. Only while plans apply to the account.
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
		.select({ planId: period.planId, endsAt: period.endsAt, provider: schema.billingPayment.provider })
		.from(period)
		.leftJoin(schema.billingPayment, eq(schema.billingPayment.id, period.paymentId))
		.where(and(eq(period.userId, row.userId), isNull(period.revokedAt), gt(period.endsAt, now)))
		.orderBy(desc(period.endsAt))
		.limit(1);
	if (!last || +last.endsAt !== +endsAt) return null;
	// A subscription carries on past the grant: nothing ends for this account.
	const subscription = await getCurrentSubscription(row.userId);
	if (subscription && subscriptionAccess(subscriptionState(subscription), endsAt)) return null;
	const [owner] = await db
		.select({ email: schema.user.email, timezone: schema.user.timezone, locale: schema.billingAccount.locale })
		.from(schema.user)
		.leftJoin(schema.billingAccount, eq(schema.billingAccount.userId, schema.user.id))
		.where(eq(schema.user.id, row.userId));
	if (!owner) return null;
	return {
		to: owner.email,
		...reminderNotice({ ...owner, planId: last.planId, endsAt, paid: last.provider === "sumopod" }),
	};
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
	if (row.kind === "payment_receipt") return receiptFor(row);
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
