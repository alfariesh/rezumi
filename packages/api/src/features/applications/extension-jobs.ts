import { isNotNull, isNull, lt, max, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { deliverBillingNotice } from "@rezumi/email/billing";
import { env } from "@rezumi/env/server";

/** The operator gets the browser extension's page reports merged into at most one email per window. */
const REPORT_EMAIL_WINDOW_MS = 60 * 60 * 1000;
/** Reports go after this long: they only point at pages to check. */
const REPORT_RETENTION_DAYS = 30;

const DIGEST_ROWS = 50;

/**
 * Emails the operator (`BILLING_ALERT_EMAIL`) the page reports not yet sent, at most once an hour, oldest first. Safe
 * to run twice: rows are marked once the email went out. Without an address the reports wait (and expire).
 */
export async function sendCaptureReportDigest(now: Date): Promise<boolean> {
	const to = env.BILLING_ALERT_EMAIL;
	if (!to) return false;
	const report = schema.extensionCaptureReport;
	const [last] = await db
		.select({ at: max(report.notifiedAt) })
		.from(report)
		.where(isNotNull(report.notifiedAt));
	if (last?.at && now.getTime() - last.at.getTime() < REPORT_EMAIL_WINDOW_MS) return false;
	const pending = await db
		.select({
			id: report.id,
			url: report.url,
			site: report.site,
			extensionVersion: report.extensionVersion,
			missing: report.missing,
		})
		.from(report)
		.where(isNull(report.notifiedAt))
		.orderBy(report.createdAt)
		.limit(DIGEST_ROWS);
	if (pending.length === 0) return false;

	const delivery = await deliverBillingNotice({
		to,
		subject: `[Rezumi] Plugin gagal membaca ${pending.length} halaman`,
		notice: {
			lang: "id",
			preview: `${pending.length} laporan halaman dari plugin browser`,
			heading: "Laporan halaman dari plugin browser",
			paragraphs: [
				"Pengguna melaporkan halaman lowongan yang tidak terbaca lengkap oleh plugin. Isi halaman tidak ikut dikirim.",
			],
			rows: pending.map((item) => ({
				label: `${item.site ?? "situs lain"} · v${item.extensionVersion}`,
				value: `${item.url}${item.missing.length > 0 ? ` (tidak terbaca: ${item.missing.join(", ")})` : ""}`,
			})),
		},
	});
	if (delivery === "unconfigured") return false;
	await db
		.update(report)
		.set({ notifiedAt: now })
		.where(
			sql`${report.id} in (${sql.join(
				pending.map((item) => sql`${item.id}`),
				sql`, `,
			)})`,
		);
	return true;
}

/** Deletes page reports past their retention, a batch per run. */
export async function deleteOldCaptureReports(now: Date): Promise<number> {
	const report = schema.extensionCaptureReport;
	const cutoff = new Date(now.getTime() - REPORT_RETENTION_DAYS * 86_400_000);
	const old = db.select({ id: report.id }).from(report).where(lt(report.createdAt, cutoff)).limit(500);
	const deleted = await db
		.delete(report)
		.where(sql`${report.id} in ${old}`)
		.returning({ id: report.id });
	return deleted.length;
}

/** Page report upkeep, run every minute with the other scheduled jobs. */
export async function runExtensionJobs(now = new Date()) {
	const emailed = await sendCaptureReportDigest(now).catch(() => {
		console.error("[extension] Sending page reports failed; they are tried again on the next run.");
		return false;
	});
	const deleted = await deleteOldCaptureReports(now).catch(() => {
		console.error("[extension] Deleting old page reports failed; they are tried again on the next run.");
		return 0;
	});
	return { emailed, deleted };
}
