import type { PortfolioMessageForm } from "./contact";
import type { PortfolioReportReason } from "@rezumi/schema/portfolio/moderation";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import z from "zod";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { deliverPortfolioReportNotice } from "@rezumi/email/portfolio";
import { env } from "@rezumi/env/server";
import { PORTFOLIO_REPORT_LIMITS, PORTFOLIO_REPORT_REASONS } from "@rezumi/schema/portfolio/moderation";
import { PORTFOLIO_MESSAGE_TRAP_FIELD } from "@rezumi/schema/portfolio/statistics";
import { rateLimitConfig } from "@rezumi/utils/rate-limit";
import { createRateLimiter } from "../../redis";
import { ownerIsNotBanned } from "../resume/access-policy";
import { rateLimitAddress } from "./client-address";
import { formField, passesLimit } from "./contact";
import { portfolioOwnsProfilePath } from "./public";
import { isContactFormConfigured, verifyTurnstileToken } from "./turnstile";

const report = schema.portfolioReport;
const limits = rateLimitConfig.portfolioPublic;

const attemptLimiter = createRateLimiter("portfolioReportAttempts", limits.reportAttempts);
const ipLimiter = createRateLimiter("portfolioReportsPerIp", limits.reportsPerIp);
const visitorLimiter = createRateLimiter("portfolioReportsPerVisitor", limits.reportsPerVisitor);
const portfolioLimiter = createRateLimiter("portfolioReportsPerPortfolio", limits.reportsPerPortfolio);

const fieldsSchema = z.object({
	reason: z.enum(PORTFOLIO_REPORT_REASONS),
	details: z.string().trim().min(1).max(PORTFOLIO_REPORT_LIMITS.details),
	email: z.union([z.literal(""), z.string().trim().max(PORTFOLIO_REPORT_LIMITS.email).pipe(z.email())]),
});

export type PortfolioReportResult =
	| { ok: true; reportId?: string }
	| { ok: false; code: "invalid" | "turnstile" | "rate_limited" | "unavailable" };

const fail = (code: Extract<PortfolioReportResult, { ok: false }>["code"]) => ({ ok: false, code }) as const;

/**
 * Takes a visitor's report about a portfolio (`02-teknis.md` section 14), or null when the address shows no portfolio.
 * Works like the contact form: the trap field answers success without storing, Turnstile comes after the cheap checks,
 * and only a report that passes it counts toward the limits. The report itself is never logged.
 */
export async function submitPortfolioReport(input: {
	username: string;
	form: PortfolioMessageForm;
	trustedClient?: string | undefined;
	now?: Date;
}): Promise<PortfolioReportResult | null> {
	const [row] = await db
		.select({ id: schema.portfolio.id })
		.from(schema.portfolio)
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(
			and(
				eq(schema.user.username, input.username.toLowerCase()),
				portfolioOwnsProfilePath(schema.user.id),
				ownerIsNotBanned(),
			),
		)
		.limit(1);
	if (!row) return null;
	if (!isContactFormConfigured()) return fail("unavailable");
	if (formField(input.form, PORTFOLIO_MESSAGE_TRAP_FIELD)) return { ok: true };

	const parsed = fieldsSchema.safeParse({
		reason: formField(input.form, "reason"),
		details: formField(input.form, "details"),
		email: formField(input.form, "email"),
	});
	if (!parsed.success) return fail("invalid");

	// Per address (an IPv6 address by its /64); clients without one share a bucket.
	const client = `ip:${rateLimitAddress(input.trustedClient) ?? "unknown"}`;
	if (!(await passesLimit(attemptLimiter, client))) return fail("rate_limited");
	if (!(await verifyTurnstileToken(formField(input.form, "cf-turnstile-response"), input.trustedClient)))
		return fail("turnstile");
	if (!(await passesLimit(ipLimiter, client))) return fail("rate_limited");
	if (!(await passesLimit(visitorLimiter, `${row.id}:${client}`))) return fail("rate_limited");
	if (!(await passesLimit(portfolioLimiter, row.id))) return fail("rate_limited");

	const { reason, details, email } = parsed.data;
	const [created] = await db
		.insert(report)
		.values({ portfolioId: row.id, reason, details, reporterEmail: email || null, createdAt: input.now ?? new Date() })
		.returning({ id: report.id });
	return created ? { ok: true, reportId: created.id } : fail("unavailable");
}

const REASON_NAMES: Record<PortfolioReportReason, string> = {
	fraud: "Penipuan",
	illegal: "Konten ilegal",
	rights: "Merek atau hak cipta",
	fake_testimonial: "Testimoni palsu",
	other: "Lainnya",
};

/**
 * Emails the operator about a new report. Without an address configured the report still waits on the admin page.
 * The report's words go in the body only, never in the subject or a log.
 */
export async function notifyPortfolioReport(reportId: string): Promise<boolean> {
	const to = env.BILLING_ALERT_EMAIL;
	if (!to) return false;
	const [row] = await db
		.select({
			reason: report.reason,
			details: report.details,
			reporterEmail: report.reporterEmail,
			portfolioId: report.portfolioId,
			username: schema.user.username,
		})
		.from(report)
		.innerJoin(schema.portfolio, eq(report.portfolioId, schema.portfolio.id))
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(eq(report.id, reportId))
		.limit(1);
	if (!row) return false;
	const reason = REASON_NAMES[row.reason];
	const delivery = await deliverPortfolioReportNotice({
		to,
		subject: `[Rezumi] Laporan portfolio: ${reason}`,
		replyTo: row.reporterEmail ?? undefined,
		notice: {
			lang: "id",
			preview: `Laporan baru tentang portfolio @${row.username}`,
			heading: `Laporan baru tentang portfolio @${row.username}`,
			paragraphs: [row.details],
			rows: [
				{ label: "Alasan", value: reason },
				{ label: "Pelapor", value: row.reporterEmail ?? "Tidak meninggalkan email" },
			],
			action: {
				label: "Buka di halaman admin",
				url: new URL(`/dashboard/admin/portfolios/${row.portfolioId}`, env.APP_URL).href,
			},
			footer: "Identitas pelapor tidak pernah ditunjukkan ke pemilik portfolio.",
		},
	});
	return delivery !== "unconfigured";
}

const RETENTION_BATCH = 500;

/** Clears reporters' addresses once a report has been handled for 90 days, a batch per run. */
export async function clearHandledReporterEmails(now: Date): Promise<number> {
	const cutoff = new Date(now.getTime() - PORTFOLIO_REPORT_LIMITS.reporterEmailRetentionDays * 86_400_000);
	const due = db
		.select({ id: report.id })
		.from(report)
		.where(and(isNotNull(report.reporterEmail), isNotNull(report.handledAt), lt(report.handledAt, cutoff)))
		.limit(RETENTION_BATCH);
	const cleared = await db
		.update(report)
		.set({ reporterEmail: null })
		.where(sql`${report.id} in ${due}`)
		.returning({ id: report.id });
	return cleared.length;
}

/** Reports about the account's portfolio, for its data export: when and why, never who sent them or their words. */
export function exportPortfolioReports(userId: string) {
	return db
		.select({ reason: report.reason, status: report.status, createdAt: report.createdAt, handledAt: report.handledAt })
		.from(report)
		.innerJoin(schema.portfolio, eq(report.portfolioId, schema.portfolio.id))
		.where(eq(schema.portfolio.userId, userId));
}
