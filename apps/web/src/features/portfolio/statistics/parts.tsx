import type {
	PortfolioClickKind,
	PortfolioDevice,
	PortfolioVisitSource,
	PortfolioWorkSource,
} from "@rezumi/schema/portfolio/statistics";
import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { summarizeViews } from "@rezumi/resume/sharing";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { openPlanDialog } from "@/features/billing/plan-dialog";

// Pieces the portfolio's statistics and a work's statistics share.

export const clickLabels = (): Record<PortfolioClickKind, string> => ({
	resume: t`View resume button`,
	pdf: t`Download PDF button`,
	whatsapp: t`WhatsApp button`,
	email: t`Email button`,
	link: t`Links`,
	contact: t`Send a message button`,
	service: t`Service orders`,
	video: t`Videos played`,
	document: t`PDFs opened`,
	embed: t`Embeds opened`,
	vcard: t`Contacts saved`,
});

export const sourceLabels = (): Record<PortfolioVisitSource, string> => ({
	linkedin: "LinkedIn",
	whatsapp: "WhatsApp",
	google: "Google",
	qr: t`QR code`,
	direct: t`Direct`,
	other: t`Other sites`,
});

export const deviceLabels = (): Record<PortfolioDevice, string> => ({
	mobile: t`Phones`,
	tablet: t`Tablets`,
	desktop: t`Computers`,
});

export type RankRow = { key: string; label: string; value: number };

type RankListProps = {
	title: ReactNode;
	rows: readonly RankRow[];
	empty: ReactNode;
	/** Keeps the rows in the order given (by date, say) instead of largest first. */
	keepOrder?: boolean;
};

/** A titled list, largest first, each row's bar against the largest: one measure, so the bars need no legend. */
export function RankList({ title, rows, empty, keepOrder = false }: RankListProps) {
	const { i18n } = useLingui();
	const positive = rows.filter((row) => row.value > 0);
	const shown = keepOrder ? positive : positive.sort((a, b) => b.value - a.value);
	const peak = Math.max(1, ...shown.map((row) => row.value));
	return (
		<section className="grid content-start gap-2">
			<h3 className="text-sm font-semibold">{title}</h3>
			{shown.length === 0 ? (
				<p className="text-body-sm text-muted">{empty}</p>
			) : (
				<ul className="grid gap-2">
					{shown.map((row) => (
						<li key={row.key} className="grid gap-1 text-sm">
							<div className="flex items-baseline justify-between gap-3">
								<span className="min-w-0 truncate">{row.label}</span>
								<span className="text-muted tabular-nums">{row.value.toLocaleString(i18n.locale)}</span>
							</div>
							<div className="h-1 rounded-full bg-surface-secondary" aria-hidden="true">
								<div className="h-full rounded-full bg-accent" style={{ width: `${(row.value / peak) * 100}%` }} />
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

/** Where visits to a work's page came from: the portfolio's sources, and the portfolio itself. */
export const workSourceLabels = (): Record<PortfolioWorkSource, string> => ({
	...sourceLabels(),
	portfolio: t`From your portfolio`,
});

type DailyBarsProps = {
	days: readonly { date: string; value: number }[];
	/** What a bar counts, for its tooltip: "Nov 3: 4 visits". */
	describe: (label: string, value: number) => string;
	/** The chart in words, for screen readers. */
	summary: (days: number, peak: number) => string;
	/** The table that stands in for the chart, for screen readers. */
	caption: ReactNode;
};

/** A count per day as bars, as in Share's Visitors: each bar's whole column answers the pointer. */
export function DailyBars({ days, describe, summary: describeChart, caption }: DailyBarsProps) {
	const { i18n } = useLingui();
	const summary = summarizeViews(days.map((day) => ({ date: day.date, views: day.value, downloads: 0 })));
	const dayLabel = (date: string) =>
		new Date(`${date}T00:00:00`).toLocaleDateString(i18n.locale, { month: "short", day: "numeric" });
	const firstDay = days[0]?.date;
	return (
		<div className="grid gap-1">
			<div role="img" aria-label={describeChart(days.length, summary.peak)} className="flex h-20 items-end gap-px">
				{summary.bars.map((bar) => (
					<span
						key={bar.date}
						title={describe(dayLabel(bar.date), bar.views)}
						className="group flex h-full flex-1 items-end"
					>
						<span
							className={cn("w-full rounded-t-sm", bar.views > 0 ? "bg-accent/70 group-hover:bg-accent" : "bg-border")}
							style={{ height: `${Math.max(5, Math.round(bar.height * 100))}%` }}
						/>
					</span>
				))}
			</div>
			<div className="flex justify-between text-xs text-muted tabular-nums">
				<span>{firstDay ? dayLabel(firstDay) : ""}</span>
				<span>
					<Trans>Today</Trans>
				</span>
			</div>
			<table className="sr-only">
				<caption>{caption}</caption>
				<tbody>
					{days.map((day) => (
						<tr key={day.date}>
							<th scope="row">{dayLabel(day.date)}</th>
							<td>{day.value}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** What the free plan sees in place of the details (owner decision #16). */
export function LockedDetails() {
	return (
		<section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-secondary p-4">
			<p className="min-w-0 flex-1 basis-60 text-sm text-pretty">
				<Trans>See visitors' countries on a map, their devices, and which sites link to you with Plus.</Trans>
			</p>
			<Button
				size="sm"
				variant="secondary"
				onPress={() => openPlanDialog({ kind: "feature", feature: "detailedPortfolioStats" })}
			>
				<Icon name="lock" size={16} />
				<Trans>See what's included</Trans>
			</Button>
		</section>
	);
}

/**
 * Reading the details failed this time (Analytics Engine didn't answer); the counts above still show. Where Analytics
 * Engine isn't set up at all (`not-configured`: Node, local development), nothing is said: there's nothing to wait for.
 */
export function UnavailableDetails() {
	return (
		<p className="border-t border-border pt-4 text-body-sm text-muted">
			<Trans>Countries, devices and linking sites can't be shown right now. Try again later.</Trans>
		</p>
	);
}
