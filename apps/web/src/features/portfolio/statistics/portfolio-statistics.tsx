import type { client } from "@/libs/orpc/client";
import type { PortfolioClickKind, PortfolioDevice, PortfolioVisitSource } from "@rezumi/schema/portfolio/statistics";
import type { ReactNode } from "react";
import { KPIGroup, Widget } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { Button, Chip, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useId } from "react";
import { summarizeViews } from "@rezumi/resume/sharing";
import { PORTFOLIO_CLICK_KINDS, PORTFOLIO_DEVICES, PORTFOLIO_VISIT_SOURCES } from "@rezumi/schema/portfolio/statistics";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { countryNames } from "../location/cities";
import { WidgetHeading } from "@/components/layout/widget-heading";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { orpc } from "@/libs/orpc/client";

const VisitorMap = lazy(() => import("./visitor-map"));

type Statistics = NonNullable<Awaited<ReturnType<typeof client.portfolio.statistics>>>;
type ReadyDetails = Extract<Statistics["details"], { state: "ready" }>;

const clickLabels = (): Record<PortfolioClickKind, string> => ({
	resume: t`View resume button`,
	pdf: t`Download PDF button`,
	whatsapp: t`WhatsApp button`,
	email: t`Email button`,
	link: t`Links`,
	contact: t`Send a message button`,
	service: t`Service orders`,
	video: t`Videos played`,
	document: t`PDFs opened`,
});

const sourceLabels = (): Record<PortfolioVisitSource, string> => ({
	linkedin: "LinkedIn",
	whatsapp: "WhatsApp",
	google: "Google",
	direct: t`Direct`,
	other: t`Other sites`,
});

const deviceLabels = (): Record<PortfolioDevice, string> => ({
	mobile: t`Phones`,
	tablet: t`Tablets`,
	desktop: t`Computers`,
});

type RankRow = { key: string; label: string; value: number };

type RankListProps = { title: ReactNode; rows: readonly RankRow[]; empty: ReactNode };

/** A titled list, largest first, each row's bar against the largest: one measure, so the bars need no legend. */
function RankList({ title, rows, empty }: RankListProps) {
	const { i18n } = useLingui();
	const shown = rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
	const peak = Math.max(1, ...shown.map((row) => row.value));
	return (
		<section className="grid content-start gap-2">
			<h3 className="text-sm font-semibold">{title}</h3>
			{shown.length === 0 ? (
				<p className="text-sm text-muted">{empty}</p>
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

type DailyVisitsProps = { days: Statistics["days"] };

/** Visits per day, as in Share's Visitors: each bar's whole column answers the pointer. */
function DailyVisits({ days }: DailyVisitsProps) {
	const { i18n } = useLingui();
	const summary = summarizeViews(days.map((day) => ({ ...day, downloads: 0 })));
	const dayLabel = (date: string) =>
		new Date(`${date}T00:00:00`).toLocaleDateString(i18n.locale, { month: "short", day: "numeric" });
	const firstDay = days[0]?.date;
	return (
		<div className="grid gap-1">
			<div
				role="img"
				aria-label={t`Daily visits over 30 days, peak ${summary.peak}`}
				className="flex h-20 items-end gap-0.5"
			>
				{summary.bars.map((bar) => {
					const label = dayLabel(bar.date);
					const visits = bar.views;
					return (
						<span key={bar.date} title={t`${label}: ${visits} visits`} className="group flex h-full flex-1 items-end">
							<span
								className={cn("w-full rounded-t-sm", visits > 0 ? "bg-accent/70 group-hover:bg-accent" : "bg-border")}
								style={{ height: `${Math.max(5, Math.round(bar.height * 100))}%` }}
							/>
						</span>
					);
				})}
			</div>
			<div className="flex justify-between text-xs text-muted tabular-nums">
				<span>{firstDay ? dayLabel(firstDay) : ""}</span>
				<span>
					<Trans>Today</Trans>
				</span>
			</div>
			<table className="sr-only">
				<caption>
					<Trans>Visits per day</Trans>
				</caption>
				<tbody>
					{days.map((day) => (
						<tr key={day.date}>
							<th scope="row">{dayLabel(day.date)}</th>
							<td>{day.views}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

type DetailsProps = { details: ReadyDetails };

/** Where visitors are and what they use, from Cloudflare Analytics Engine, which samples: so these are estimates. */
function ReadyStatisticsDetails({ details }: DetailsProps) {
	const { i18n } = useLingui();
	const country = countryNames(i18n.locale);
	const devices = deviceLabels();
	return (
		<section className="grid gap-4 border-t border-border pt-4">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="text-sm font-semibold">
					<Trans>Where visitors come from</Trans>
				</h3>
				<Chip size="sm" variant="soft">
					<Trans>Estimated</Trans>
				</Chip>
			</div>
			{details.countries.length > 0 && (
				<Suspense
					fallback={
						<div className="grid aspect-5/2 place-items-center rounded-xl border border-border">
							<Spinner size="sm" color="current" />
						</div>
					}
				>
					<VisitorMap countries={details.countries} />
				</Suspense>
			)}
			<div className="grid gap-6 @lg:grid-cols-3">
				<RankList
					title={<Trans>Countries</Trans>}
					rows={details.countries.map((row) => ({ key: row.code, label: country(row.code), value: row.views }))}
					empty={<Trans>No visits yet.</Trans>}
				/>
				<RankList
					title={<Trans>Devices</Trans>}
					rows={PORTFOLIO_DEVICES.map((device) => ({
						key: device,
						label: devices[device],
						value: details.devices.find((row) => row.device === device)?.views ?? 0,
					}))}
					empty={<Trans>No visits yet.</Trans>}
				/>
				<RankList
					title={<Trans>Sites that link to you</Trans>}
					rows={details.referrers.map((row) => ({ key: row.domain, label: row.domain, value: row.views }))}
					empty={<Trans>No links from other sites yet.</Trans>}
				/>
			</div>
			{details.workDays.length > 0 && (
				<RankList
					title={<Trans>Work opened by day</Trans>}
					rows={details.workDays.map((row) => ({
						key: `${row.date}-${row.workId}`,
						label: `${new Date(`${row.date}T00:00:00`).toLocaleDateString(i18n.locale, { month: "short", day: "numeric" })} · ${row.title}`,
						value: row.opens,
					}))}
					empty={null}
				/>
			)}
		</section>
	);
}

/** What the free plan sees in place of the details (owner decision #16). */
function LockedDetails() {
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

/** The portfolio's numbers over the last 30 days (`01-desain.md` section 10). Only its owner can read them. */
export function PortfolioStatistics() {
	const { data, isPending } = useQuery(orpc.portfolio.statistics.queryOptions());
	const titleId = useId();
	const clicks = clickLabels();
	const sources = sourceLabels();
	if (isPending)
		return (
			<div className="grid place-items-center py-10">
				<Spinner size="md" color="current" />
			</div>
		);
	if (!data) return null;
	const totalClicks = PORTFOLIO_CLICK_KINDS.reduce((sum, kind) => sum + data.totals.clicks[kind], 0);
	const tiles = [
		{ key: "visits", title: t`Visits`, value: data.totals.views },
		{ key: "clicks", title: t`Button clicks`, value: totalClicks },
		{ key: "messages", title: t`Messages`, value: data.totals.messages },
	];

	return (
		<Widget role="region" aria-labelledby={titleId} className="@container">
			<WidgetHeading
				id={titleId}
				icon="chart-line-up"
				title={<Trans>Visitors</Trans>}
				description={<Trans>The last 30 days. Only you see these, and your own visits aren't counted.</Trans>}
			/>
			<Widget.Content className="grid gap-5">
				<KPIGroup>
					{tiles.flatMap((tile, index) => [
						...(index > 0 ? [<KPIGroup.Separator key={`${tile.key}-separator`} />] : []),
						<KPI key={tile.key}>
							<KPI.Header>
								<KPI.Title>{tile.title}</KPI.Title>
							</KPI.Header>
							<KPI.Content>
								<KPI.Value maximumFractionDigits={0} value={tile.value} />
							</KPI.Content>
						</KPI>,
					])}
				</KPIGroup>
				<DailyVisits days={data.days} />
				<div className="grid gap-6 @lg:grid-cols-3">
					<RankList
						title={<Trans>Clicks</Trans>}
						rows={PORTFOLIO_CLICK_KINDS.map((kind) => ({
							key: kind,
							label: clicks[kind],
							value: data.totals.clicks[kind],
						}))}
						empty={<Trans>No clicks yet.</Trans>}
					/>
					<RankList
						title={<Trans>Sources</Trans>}
						rows={PORTFOLIO_VISIT_SOURCES.map((source) => ({
							key: source,
							label: sources[source],
							value: data.sources[source],
						}))}
						empty={<Trans>No visits yet.</Trans>}
					/>
					<RankList
						title={<Trans>Most opened work</Trans>}
						rows={data.works.map((work) => ({ key: work.id, label: work.title, value: work.opens }))}
						empty={<Trans>No work opened yet.</Trans>}
					/>
				</div>
				{data.details.state === "ready" && <ReadyStatisticsDetails details={data.details} />}
				{data.details.state === "locked" && <LockedDetails />}
			</Widget.Content>
		</Widget>
	);
}
