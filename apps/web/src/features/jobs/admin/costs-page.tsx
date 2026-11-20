import type { JobCostEvents, JobCostReport } from "./costs";
import type { ReactNode } from "react";
import { ChartTooltip } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { Button, Dropdown, Label, Skeleton, Table, Typography } from "@heroui/react";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cacheShare, dailyCostSeries, featureName, formatUsd, kindName, PROVIDER_COLORS, providerName } from "./costs";
import { AdminCard, IconButton, LegendDot, MiniStat, StatWidget } from "@/features/billing/admin/parts";
import { getReadableErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { renderAsH1 } from "@/libs/typography";

type Period = 7 | 30;

const PERIODS = (): { id: Period; label: string }[] => [
	{ id: 7, label: t`7 days` },
	{ id: 30, label: t`30 days` },
];

const percent = (value: number) =>
	new Intl.NumberFormat(i18n.locale, { style: "percent", maximumFractionDigits: 0 }).format(value);
const integer = (value: number) => new Intl.NumberFormat(i18n.locale).format(value);

/** "3 Nov" for a UTC day (YYYY-MM-DD) on the chart's axis. */
function dayLabel(day: unknown) {
	if (typeof day !== "string") return "";
	return new Date(`${day}T00:00:00Z`).toLocaleDateString(i18n.locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

type CostTooltipProps = {
	active?: boolean;
	label?: unknown;
	payload?: { dataKey?: unknown; name?: unknown; value?: unknown; color?: string }[];
};

function CostTooltip({ active, label, payload }: CostTooltipProps) {
	if (!active || !payload?.length) return null;
	return (
		<ChartTooltip>
			<ChartTooltip.Header>{dayLabel(label)}</ChartTooltip.Header>
			{payload.map((entry) => (
				<ChartTooltip.Item key={String(entry.dataKey)}>
					<ChartTooltip.Indicator color={entry.color ?? "currentColor"} />
					<ChartTooltip.Label>{String(entry.name)}</ChartTooltip.Label>
					<ChartTooltip.Value>{formatUsd(Math.round(Number(entry.value) * 1_000_000))}</ChartTooltip.Value>
				</ChartTooltip.Item>
			))}
		</ChartTooltip>
	);
}

type ReportProps = { report: JobCostReport };

/** Today's spending against the budget, the treg balance, cache hits and failures. */
function KpiRow({ report }: ReportProps) {
	const { today, treg, events } = report;
	const share = today.budgetMicro ? today.spentMicro / today.budgetMicro : 0;
	const ok = events.status === "ok" ? events : null;
	const cache = ok ? cacheShare(ok.search) : null;
	const errors = ok ? ok.tools.reduce((sum, row) => sum + row.errors, 0) : null;
	const refused = ok ? ok.tools.reduce((sum, row) => sum + row.budget, 0) : 0;
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<StatWidget
				icon={<Icon name="scales" size={16} />}
				title={<Trans>Spent today</Trans>}
				value={formatUsd(today.spentMicro)}
				color={today.warn ? "var(--color-warning)" : "var(--color-success)"}
				footer={t`${percent(share)} of the ${formatUsd(today.budgetMicro)} daily budget (UTC day ${today.day})`}
			/>
			<StatWidget
				icon={<Icon name="key" size={16} />}
				title={<Trans>treg balance</Trans>}
				value={treg.status === "ok" ? formatUsd(treg.balanceMicro) : "—"}
				footer={
					treg.status === "ok"
						? t`treg charged ${formatUsd(treg.totalMicro)} in ${report.days} days`
						: treg.status === "not-configured"
							? t`No treg token on this server`
							: t`treg didn't answer; try Refresh`
				}
			/>
			<StatWidget
				icon={<Icon name="lightning" size={16} />}
				title={<Trans>Answered from cache</Trans>}
				value={cache === null ? "—" : percent(cache)}
				footer={
					ok
						? t`${integer(ok.search.cacheHits + ok.search.stale)} from cache · ${integer(ok.search.providerCalls)} provider calls`
						: t`Counted on Cloudflare only`
				}
			/>
			<StatWidget
				icon={<Icon name="warning-circle" size={16} />}
				title={<Trans>Failed calls</Trans>}
				value={errors === null ? "—" : integer(errors)}
				color="var(--color-danger)"
				footer={ok ? t`${integer(refused)} held back by the daily budget` : t`Counted on Cloudflare only`}
			/>
		</div>
	);
}

/** Why the page wants a look: the budget nearly spent, searching switched off or impossible here. */
function AttentionCard({ report }: ReportProps) {
	const { today } = report;
	const lines: ReactNode[] = [];
	if (!today.available)
		lines.push(<Trans key="token">There's no treg token on this server, so nobody can search for jobs.</Trans>);
	if (today.switchedOff)
		lines.push(
			<Trans key="flag">FLAG_DISABLE_JOB_SEARCH is on: people get saved results only, and job alerts wait.</Trans>,
		);
	if (today.warn)
		lines.push(
			<Trans key="budget">
				Today's spending passed 80% of the daily budget. Past the budget, people get saved results only until midnight
				UTC. Raise JOB_SEARCH_DAILY_BUDGET_USD if the use is real.
			</Trans>,
		);
	if (report.treg.status === "ok" && report.treg.balanceMicro < today.budgetMicro)
		lines.push(
			<Trans key="balance">
				The treg balance is below one day's budget. Top it up (or turn on auto top-up) in treg's dashboard under Team →
				Billing; an empty balance stops every search.
			</Trans>,
		);
	if (lines.length === 0) return null;
	return (
		<AdminCard tone="warning" icon="warning" title={<Trans>Needs attention</Trans>}>
			<ul className="flex list-disc flex-col gap-1 ps-5 text-body-sm">
				{lines.map((line, index) => (
					<li key={index}>{line}</li>
				))}
			</ul>
		</AdminCard>
	);
}

type EventsProps = { events: JobCostReport["events"]; days: number; now: Date };

/** Cost day by day per provider, from Analytics Engine. */
function DailyCostCard({ events, days, now }: EventsProps) {
	const ok = events.status === "ok" ? events : null;
	const series = ok ? dailyCostSeries(ok.daily, days, now) : null;
	const total = ok ? ok.daily.reduce((sum, point) => sum + point.costMicro, 0) : 0;
	return (
		<AdminCard
			icon="chart-line-up"
			title={<Trans>Cost per day</Trans>}
			description={<Trans>What each provider call cost, as Rezumi recorded it.</Trans>}
			action={
				series && series.providers.length > 0 ? (
					<div className="flex flex-wrap items-center gap-3">
						{series.providers.map((provider) => (
							<LegendDot
								key={provider}
								color={PROVIDER_COLORS[provider] ?? "var(--chart-3)"}
								label={providerName(provider)}
							/>
						))}
					</div>
				) : undefined
			}
		>
			{!ok ? (
				<EventsMissing status={events.status === "ok" ? "unavailable" : events.status} />
			) : (
				<>
					<div className="flex flex-wrap gap-x-6 gap-y-3">
						<MiniStat value={formatUsd(total)} label={t`In ${days} days`} />
						<MiniStat
							value={integer(ok.daily.reduce((sum, point) => sum + point.calls, 0))}
							label={t`Provider calls`}
						/>
					</div>
					{series && series.providers.length > 0 ? (
						<BarChart data={series.rows} height={200}>
							<BarChart.Grid vertical={false} />
							<BarChart.XAxis dataKey="day" tickFormatter={dayLabel} tickMargin={8} minTickGap={16} />
							<BarChart.YAxis tickFormatter={(value) => `$${Number(value).toFixed(2)}`} width={48} />
							{series.providers.map((provider, index) => (
								<BarChart.Bar
									key={provider}
									dataKey={provider}
									name={providerName(provider)}
									stackId="cost"
									fill={PROVIDER_COLORS[provider] ?? "var(--chart-3)"}
									maxBarSize={18}
									{...(index === series.providers.length - 1 && {
										radius: [6, 6, 0, 0] as [number, number, number, number],
									})}
								/>
							))}
							<BarChart.Tooltip content={<CostTooltip />} />
						</BarChart>
					) : (
						<p className="py-6 text-center text-body-sm text-muted">
							<Trans>No paid calls in this period.</Trans>
						</p>
					)}
				</>
			)}
		</AdminCard>
	);
}

type EventsMissingProps = { status: "not-configured" | "unavailable" };

function EventsMissing({ status }: EventsMissingProps) {
	return (
		<p className="py-6 text-center text-body-sm text-muted">
			{status === "not-configured" ? (
				<Trans>
					Call statistics come from Cloudflare Analytics Engine, so they show on the live site only. The budget and the
					treg figures above work everywhere.
				</Trans>
			) : (
				<Trans>The call statistics couldn't be read. Try Refresh in a moment.</Trans>
			)}
		</p>
	);
}

type TregProps = { treg: JobCostReport["treg"]; days: number };

/** What treg's ledger charged per feature: the money that actually left the balance. */
function LedgerCard({ treg, days }: TregProps) {
	return (
		<AdminCard
			icon="list-bullets"
			title={<Trans>treg ledger</Trans>}
			description={<Trans>What treg charged in {days} days, by what the calls were for.</Trans>}
			{...(treg.status === "ok" && { contentClassName: "p-0" })}
		>
			{treg.status !== "ok" ? (
				<p className="py-6 text-center text-body-sm text-muted">
					{treg.status === "not-configured" ? (
						<Trans>No treg token on this server.</Trans>
					) : (
						<Trans>treg didn't answer. Try Refresh in a moment.</Trans>
					)}
				</p>
			) : (
				<Table variant="secondary">
					<Table.ScrollContainer>
						<Table.Content aria-label={t`treg ledger`} className="text-sm">
							<Table.Header>
								<Table.Column isRowHeader>{t`Used for`}</Table.Column>
								<Table.Column className="text-end">{t`Calls`}</Table.Column>
								<Table.Column className="text-end">{t`Charged`}</Table.Column>
							</Table.Header>
							<Table.Body>
								{[
									...treg.usage.map((row) => ({ id: row.feature, ...row, name: featureName(row.feature) })),
									...(treg.unattributedMicro > 0
										? [
												{
													id: "untagged",
													feature: "",
													calls: null,
													chargedMicro: treg.unattributedMicro,
													name: t`Untagged (by hand, or from another app on this treg team)`,
												},
											]
										: []),
								].map((row) => (
									<Table.Row key={row.id} id={row.id}>
										<Table.Cell>{row.name}</Table.Cell>
										<Table.Cell className="text-end tabular-nums">
											{row.calls === null ? "—" : integer(row.calls)}
										</Table.Cell>
										<Table.Cell className="text-end font-medium tabular-nums">{formatUsd(row.chargedMicro)}</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			)}
		</AdminCard>
	);
}

type ToolsProps = { tools: JobCostEvents["tools"] };

const milliseconds = (value: number | null) => (value === null ? "—" : t`${integer(value)} ms`);

/** Calls per provider and tool: how many, what they cost, how fast and how many failed. */
type ToolsCardProps = { events: JobCostReport["events"] };

function ToolsCard({ events }: ToolsCardProps) {
	return (
		<AdminCard
			plain
			title={<Trans>Calls by provider</Trans>}
			description={<Trans>Speed is for calls that reached the provider; 95% of them were at least this fast.</Trans>}
		>
			{events.status !== "ok" ? (
				<EventsMissing status={events.status} />
			) : events.tools.length === 0 ? (
				<p className="py-6 text-center text-body-sm text-muted">
					<Trans>No provider calls in this period.</Trans>
				</p>
			) : (
				<ToolsTable tools={events.tools} />
			)}
		</AdminCard>
	);
}

function ToolsTable({ tools }: ToolsProps) {
	return (
		<Table>
			<Table.ScrollContainer>
				<Table.Content aria-label={t`Calls by provider`} className="min-w-[44rem] text-sm">
					<Table.Header>
						<Table.Column isRowHeader>{t`Provider`}</Table.Column>
						<Table.Column>{t`For`}</Table.Column>
						<Table.Column className="text-end">{t`Calls`}</Table.Column>
						<Table.Column className="text-end">{t`Cost`}</Table.Column>
						<Table.Column className="text-end">{t`Average`}</Table.Column>
						<Table.Column className="text-end">{t`95%`}</Table.Column>
						<Table.Column className="text-end">{t`Failed`}</Table.Column>
					</Table.Header>
					<Table.Body>
						{tools.map((row) => (
							<Table.Row key={`${row.provider}|${row.tool}|${row.kind}`} id={`${row.provider}|${row.tool}|${row.kind}`}>
								<Table.Cell>
									<div className="grid">
										<span className="font-medium">{providerName(row.provider)}</span>
										<span className="font-mono text-xs text-muted">{row.tool}</span>
									</div>
								</Table.Cell>
								<Table.Cell className="text-muted">{kindName(row.kind)}</Table.Cell>
								<Table.Cell className="text-end tabular-nums">{integer(row.calls)}</Table.Cell>
								<Table.Cell className="text-end font-medium tabular-nums">{formatUsd(row.costMicro)}</Table.Cell>
								<Table.Cell className="text-end whitespace-nowrap tabular-nums">{milliseconds(row.avgMs)}</Table.Cell>
								<Table.Cell className="text-end whitespace-nowrap tabular-nums">{milliseconds(row.p95Ms)}</Table.Cell>
								<Table.Cell className={row.errors > 0 ? "text-end text-danger tabular-nums" : "text-end tabular-nums"}>
									{integer(row.errors)}
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table.Content>
			</Table.ScrollContainer>
		</Table>
	);
}

/** What Rezumi keeps: listings, cached pages, alerts that are on, and how the night's upkeep went. */
type StoreProps = { store: JobCostReport["store"] };

function StoreCard({ store }: StoreProps) {
	const upkeep = store.upkeep;
	return (
		<AdminCard icon="briefcase" title={<Trans>Stored data</Trans>}>
			<div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
				<MiniStat value={integer(store.openListings)} label={t`Open listings`} />
				<MiniStat value={integer(store.closedListings)} label={t`Closed, not yet removed`} />
				<MiniStat value={integer(store.alertsOn)} label={t`Job alerts on`} />
				<MiniStat value={integer(store.freshCachePages)} label={t`Fresh result pages`} />
				<MiniStat value={integer(store.cachePages)} label={t`Result pages kept`} />
				<MiniStat
					value={upkeep ? (upkeep.completedAt ? t`Done` : t`Running`) : "—"}
					label={upkeep ? t`Upkeep ${upkeep.day} · ${integer(upkeep.closed)} closed` : t`Nightly upkeep hasn't run`}
				/>
			</div>
		</AdminCard>
	);
}

/** The owner's view of what job search costs (Settings → Job search costs). */
export function JobCostsPage() {
	const queryClient = useQueryClient();
	const [days, setDays] = useState<Period>(7);
	const report = useQuery({
		...orpc.jobs.admin.costs.queryOptions({ input: { days } }),
		placeholderData: keepPreviousData,
	});

	return (
		<div className="flex flex-col gap-4">
			<header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="grid min-w-0 gap-1">
					<Typography type="h2" render={renderAsH1}>
						<Trans>Job search costs</Trans>
					</Typography>
					<p className="text-body-sm text-muted">
						<Trans>
							Jobs, job alerts, assistant web search and link reading. Days in UTC, as the budget counts them.
						</Trans>
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Dropdown>
						<Button size="sm" variant="tertiary" aria-label={t`Period`}>
							<Icon name="calendar-blank" size={16} />
							{PERIODS().find((option) => option.id === days)?.label}
							<Icon name="caret-down" size={14} className="text-muted" />
						</Button>
						<Dropdown.Popover placement="bottom end" className="min-w-36">
							<Dropdown.Menu
								selectionMode="single"
								selectedKeys={[String(days)]}
								onAction={(key) => setDays(Number(key) === 30 ? 30 : 7)}
							>
								{PERIODS().map((option) => (
									<Dropdown.Item key={option.id} id={String(option.id)} textValue={option.label}>
										<Label>{option.label}</Label>
										<Dropdown.ItemIndicator />
									</Dropdown.Item>
								))}
							</Dropdown.Menu>
						</Dropdown.Popover>
					</Dropdown>
					<IconButton
						label={t`Refresh`}
						onPress={() => void queryClient.invalidateQueries({ queryKey: orpc.jobs.admin.key() })}
					>
						<Icon name="arrow-clockwise" size={16} />
					</IconButton>
				</div>
			</header>

			{report.data ? (
				<>
					<AttentionCard report={report.data} />
					<KpiRow report={report.data} />
					<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
						<DailyCostCard events={report.data.events} days={report.data.days} now={report.data.generatedAt} />
						<LedgerCard treg={report.data.treg} days={report.data.days} />
					</div>
					<ToolsCard events={report.data.events} />
					<StoreCard store={report.data.store} />
				</>
			) : report.error ? (
				<p role="alert" className="text-body-sm text-danger">
					{getReadableErrorMessage(report.error, t`The numbers couldn't load.`)}
				</p>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{[0, 1, 2, 3].map((index) => (
						<Skeleton key={index} className="h-36 rounded-2xl" />
					))}
				</div>
			)}
		</div>
	);
}
