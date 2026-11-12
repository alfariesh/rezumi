import type { PortfolioReportReason, PortfolioReportStatus } from "@rezumi/schema/portfolio/moderation";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";

export function reportReasonLabel(reason: PortfolioReportReason): string {
	return {
		fraud: t`Fraud or a scam`,
		illegal: t`Illegal content`,
		rights: t`Trademark or copyright`,
		fake_testimonial: t`A fake testimonial`,
		other: t`Something else`,
	}[reason];
}

export function reportStatusLabel(status: PortfolioReportStatus): string {
	return { open: t`Open`, actioned: t`Acted on`, dismissed: t`Dismissed` }[status];
}

export const reportStatusColor = (status: PortfolioReportStatus) =>
	({ open: "warning", actioned: "success", dismissed: "default" } as const)[status];

/** "3 Nov 2026, 14.05" in the viewer's own time zone. */
export const formatModerationTime = (value: Date) =>
	value.toLocaleString(i18n.locale, { dateStyle: "medium", timeStyle: "short" });

/** A line of the moderation log in plain words. */
export function moderationActionLabel(action: string): string {
	const labels: Record<string, string> = {
		suspended: t`Took the portfolio down`,
		lifted: t`Lifted the takedown`,
		banned: t`Banned the account`,
		unbanned: t`Lifted the account ban`,
		"report.open": t`Reopened a report`,
		"report.actioned": t`Marked a report as acted on`,
		"report.dismissed": t`Dismissed a report`,
		// The owner deleted their portfolio (logged against the account).
		deleted: t`Deleted the portfolio`,
	};
	return labels[action] ?? action;
}
