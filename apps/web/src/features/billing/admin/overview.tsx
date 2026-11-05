import type { AdminMetrics, AdminPaymentRow, ReportPreset } from "./labels";
import type { DataGridColumn } from "@heroui-pro/react";
import type { ReactNode } from "react";
import { ChartTooltip, DataGrid } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { LineChart } from "@heroui-pro/react/line-chart";
import { PieChart } from "@heroui-pro/react/pie-chart";
import {
	Button,
	Chip,
	Dropdown,
	Label,
	Pagination,
	SearchField,
	Skeleton,
	Spinner,
	Table,
	Typography,
} from "@heroui/react";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { downloadWithAnchor } from "@rezumi/utils/file";
import { getCreditActionName } from "../credits";
import { getPlanName } from "../plan";
import {
	formatPrice,
	getPaymentReasonLabel,
	getPaymentStatusColor,
	getPaymentStatusLabel,
	usePlanDates,
} from "../purchase";
import { formatMoney, formatUsdMicros, getAlertLabel, reportRange } from "./labels";
import { AdminCard, CHART_COLORS, IconButton, LegendDot, MiniStat, StatWidget, trendOf } from "./parts";
import { getReadableErrorMessage } from "@/libs/error-message";
import { client, orpc } from "@/libs/orpc/client";
import { renderAsH1 } from "@/libs/typography";

const PRESETS = (): { id: ReportPreset; label: string }[] => [
	{ id: "7d", label: t`7 days` },
	{ id: "30d", label: t`30 days` },
	{ id: "90d", label: t`90 days` },
	{ id: "month", label: t`This month` },
	{ id: "last-month", label: t`Last month` },
];

const PLUS_COLOR = "var(--chart-4)";
const PRO_AI_COLOR = "var(--chart-2)";

/** "3 Nov" for a WIB day (YYYY-MM-DD) on a chart axis. */
function dayLabel(day: unknown) {
	if (typeof day !== "string") return "";
	const [year, month, date] = day.split("-").map(Number);
	return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1)).toLocaleDateString(i18n.locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

/** "1,2 jt" on an axis: short. */
const compactNumber = (value: unknown) =>
	new Intl.NumberFormat(i18n.locale, { notation: "compact", maximumFractionDigits: 1 }).format(Number(value));

type KpiCardProps = {
	icon: ReactNode;
	title: ReactNode;
	value: number;
	format: "decimal" | "percent";
	previous: number | null;
	series?: number[];
	color: string;
	footer?: ReactNode;
};

const formatValue = (value: number, format: KpiCardProps["format"]) =>
	new Intl.NumberFormat(i18n.locale, {
		style: format,
		maximumFractionDigits: format === "percent" ? 1 : 0,
	}).format(value);

/** One headline number with how it moved since the period before, and its day-by-day line. */
function KpiCard({ icon, title, value, format, previous, series, color, footer }: KpiCardProps) {
	return (
		<StatWidget
			icon={icon}
			title={title}
			value={formatValue(value, format)}
			trend={previous === null ? null : trendOf(value, previous)}
			{...(series && { series })}
			color={color}
			footer={footer}
		/>
	);
}

type MetricsProps = { metrics: AdminMetrics };

function KpiRow({ metrics }: MetricsProps) {
	const { daily, previous, checkouts } = metrics;
	const conversion = checkouts.started ? checkouts.paid / checkouts.started : 0;
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<KpiCard
				icon={<Icon name="arrows-clockwise" size={16} />}
				title={<Trans>Active subscriptions</Trans>}
				value={metrics.subscriptions.active}
				format="decimal"
				previous={null}
				color="var(--color-success)"
				footer={t`${metrics.subscriptions.trialing} in a free trial · ${metrics.subscriptions.canceling} set to end · ${metrics.subscriptions.pastDue} payment failed`}
			/>
			<KpiCard
				icon={<Icon name="check-circle" size={16} />}
				title={<Trans>Paid payments</Trans>}
				value={metrics.sales.payments}
				format="decimal"
				previous={previous.payments}
				series={daily.map((day) => day.payments)}
				color="var(--color-accent)"
			/>
			<KpiCard
				icon={<Icon name="arrows-down-up" size={16} />}
				title={<Trans>Checkout conversion</Trans>}
				value={conversion}
				format="percent"
				previous={previous.started ? previous.paid / previous.started : 0}
				series={daily.map((day) => (day.started ? day.paid / day.started : 0))}
				color="var(--color-warning)"
				footer={t`${checkouts.paid} of ${checkouts.started} checkouts paid`}
			/>
			<KpiCard
				icon={<Icon name="user-plus" size={16} />}
				title={<Trans>New sign-ups</Trans>}
				value={metrics.signups.total}
				format="decimal"
				previous={previous.signups}
				series={daily.map((day) => day.signups)}
				color={PRO_AI_COLOR}
				footer={t`${metrics.signups.verified} verified their email`}
			/>
		</div>
	);
}

type TooltipEntry = { dataKey?: unknown; name?: unknown; value?: unknown; color?: string };
type DayTooltipProps = { active?: boolean; label?: unknown; payload?: TooltipEntry[] };

/** The chart tooltip: the day, then each series with its value, formatted. */
function tooltipFor(format: (value: number) => string) {
	return function DayTooltip({ active, label, payload }: DayTooltipProps) {
		if (!active || !payload?.length) return null;
		return (
			<ChartTooltip>
				<ChartTooltip.Header>{dayLabel(label)}</ChartTooltip.Header>
				{payload.map((entry) => (
					<ChartTooltip.Item key={String(entry.dataKey)}>
						<ChartTooltip.Indicator color={entry.color ?? "currentColor"} />
						<ChartTooltip.Label>{String(entry.name)}</ChartTooltip.Label>
						<ChartTooltip.Value>{format(Number(entry.value))}</ChartTooltip.Value>
					</ChartTooltip.Item>
				))}
			</ChartTooltip>
		);
	};
}

const CountTooltip = tooltipFor((value) => new Intl.NumberFormat(i18n.locale).format(value));

/**
 * Paid orders day by day, Plus and Pro AI stacked, with the period's money above: per currency and before tax, since
 * Polar collects the tax and the currencies never add up.
 */
function SalesCard({ metrics }: MetricsProps) {
	const plan = (id: "plus" | "pro-ai") =>
		metrics.sales.byPlan.find((row) => row.planId === id) ?? { payments: 0, revenue: {} };
	const kinds = Object.fromEntries(metrics.sales.byKind.map((row) => [row.kind, row.payments]));
	const proAi = plan("pro-ai");
	const plus = plan("plus");
	return (
		<AdminCard
			icon="chart-line-up"
			title={<Trans>Sales</Trans>}
			action={
				<div className="flex items-center gap-3">
					<LegendDot color={PRO_AI_COLOR} label="Pro AI" />
					<LegendDot color={PLUS_COLOR} label="Plus" />
				</div>
			}
		>
			<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
				<MiniStat value={formatMoney(proAi.revenue)} label={t`Pro AI · ${proAi.payments} paid`} />
				<MiniStat value={formatMoney(plus.revenue)} label={t`Plus · ${plus.payments} paid`} />
				<MiniStat value={formatMoney(metrics.refunds.amount)} label={t`Refunded · ${metrics.refunds.refunds}`} />
				<MiniStat value={formatMoney(metrics.net)} label={t`Net, before tax and Polar's fees`} />
			</div>
			<p className="text-xs text-muted">
				{t`${kinds.new ?? 0} new · ${kinds.renewal ?? 0} renewals · ${kinds.change ?? 0} plan changes`}
			</p>
			<BarChart data={metrics.daily} height={200}>
				<BarChart.Grid vertical={false} />
				<BarChart.XAxis dataKey="day" tickFormatter={dayLabel} tickMargin={8} minTickGap={16} />
				<BarChart.YAxis tickFormatter={compactNumber} width={40} />
				<BarChart.Bar dataKey="proAi" name="Pro AI" stackId="sales" fill={PRO_AI_COLOR} maxBarSize={18} />
				<BarChart.Bar
					dataKey="plus"
					name="Plus"
					stackId="sales"
					fill={PLUS_COLOR}
					maxBarSize={18}
					radius={[6, 6, 0, 0]}
				/>
				<BarChart.Tooltip content={<CountTooltip />} />
			</BarChart>
		</AdminCard>
	);
}

/** Checkouts started against paid, day by day: where buyers drop off. */
function CheckoutCard({ metrics }: MetricsProps) {
	const { checkouts } = metrics;
	return (
		<AdminCard
			icon="list-checks"
			title={<Trans>Checkouts</Trans>}
			action={
				<div className="flex items-center gap-3">
					<LegendDot color={PLUS_COLOR} label={t`Started`} />
					<LegendDot color={PRO_AI_COLOR} label={t`Paid`} />
				</div>
			}
		>
			<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
				<MiniStat value={checkouts.started} label={t`Started`} />
				<MiniStat value={checkouts.paid} label={t`Paid`} />
				<MiniStat value={checkouts.buyers} label={t`Accounts`} />
				<MiniStat value={metrics.hangingPayments} label={t`Waiting over an hour, now`} />
			</div>
			<LineChart data={metrics.daily} height={200}>
				<LineChart.Grid vertical={false} />
				<LineChart.XAxis dataKey="day" tickFormatter={dayLabel} tickMargin={8} minTickGap={16} />
				<LineChart.YAxis allowDecimals={false} width={32} />
				<LineChart.Line
					dataKey="started"
					name={t`Started`}
					dot={false}
					stroke={PLUS_COLOR}
					strokeWidth={2}
					type="monotone"
				/>
				<LineChart.Line
					dataKey="paid"
					name={t`Paid`}
					dot={false}
					stroke={PRO_AI_COLOR}
					strokeWidth={2}
					type="monotone"
				/>
				<LineChart.Tooltip content={<CountTooltip />} />
			</LineChart>
		</AdminCard>
	);
}

/** The subscriptions running now, by plan and interval, and what they bring in a month. */
function SubscriptionsCard({ metrics }: MetricsProps) {
	const { subscriptions } = metrics;
	const rows = subscriptions.byPlan.toSorted((a, b) => b.subscriptions - a.subscriptions);
	const colorAt = (index: number) => CHART_COLORS[index % CHART_COLORS.length] ?? "currentColor";
	const label = (row: (typeof rows)[number]) =>
		`${getPlanName(row.planId)} · ${row.interval === "year" ? t`yearly` : t`monthly`}`;
	return (
		<AdminCard
			icon="arrows-clockwise"
			title={<Trans>Subscriptions</Trans>}
			description={<Trans>Running now; started and ended in this period.</Trans>}
		>
			<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
				<MiniStat value={formatMoney(subscriptions.mrr)} label={t`Monthly recurring, before tax`} />
				<MiniStat value={subscriptions.started} label={t`Started`} />
				<MiniStat value={subscriptions.trialsStarted} label={t`Free trials started`} />
				<MiniStat value={subscriptions.ended} label={t`Ended`} />
			</div>
			{rows.length === 0 ? (
				<p className="py-10 text-center text-sm text-muted">
					<Trans>No subscriptions yet.</Trans>
				</p>
			) : (
				<div className="flex flex-col items-center gap-6 sm:flex-row">
					<div className="relative shrink-0">
						<PieChart height={180} width={180}>
							<PieChart.Pie
								data={rows.map((row) => ({ name: label(row), value: row.subscriptions }))}
								dataKey="value"
								nameKey="name"
								innerRadius="70%"
								cornerRadius={6}
								paddingAngle={2}
								strokeWidth={0}
							>
								{rows.map((row, index) => (
									<PieChart.Cell key={`${row.planId}:${row.interval}`} fill={colorAt(index)} />
								))}
							</PieChart.Pie>
						</PieChart>
						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
							<span className="text-lg font-semibold tabular-nums">{subscriptions.active}</span>
							<span className="text-xs text-muted">
								<Trans>active</Trans>
							</span>
						</div>
					</div>
					<ul className="flex w-full flex-col gap-2">
						{rows.map((row, index) => (
							<li key={`${row.planId}:${row.interval}`} className="flex items-center gap-3 text-sm">
								<span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorAt(index) }} />
								<span className="flex-1">{label(row)}</span>
								<span className="font-medium tabular-nums">{row.subscriptions}</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</AdminCard>
	);
}

/** Rezumi AI: credits charged per kind of work, what the provider cost, and the typical cost of one. */
function AiCard({ metrics }: MetricsProps) {
	const rows = metrics.ai.filter((row) => row.committed + row.released > 0).toSorted((a, b) => b.credits - a.credits);
	const top = Math.max(1, ...rows.map((row) => row.credits));
	const cost = metrics.ai.reduce((sum, row) => sum + row.costUsdMicros, 0);
	// Without AI_COST_* rates the server records tokens only, so there is no cost to show.
	const priced = metrics.ai.some((row) => row.p50UsdMicros !== null && row.costUsdMicros > 0);
	return (
		<AdminCard
			icon="sparkle"
			title="Rezumi AI"
			description={<Trans>Credits charged, and what the AI provider cost.</Trans>}
		>
			<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
				<MiniStat value={metrics.credits.used} label={t`Credits used`} />
				<MiniStat value={metrics.credits.trialsGranted} label={t`Trials given`} />
				<MiniStat
					value={priced ? formatUsdMicros(cost) : "—"}
					label={priced ? t`Provider cost` : t`Cost (rates not set)`}
				/>
			</div>
			{rows.length === 0 ? (
				<p className="py-6 text-center text-sm text-muted">
					<Trans>No Rezumi AI work in this period.</Trans>
				</p>
			) : (
				<ul className="flex flex-col gap-3">
					{rows.map((row) => (
						<li key={row.action} className="grid gap-1.5">
							<div className="flex items-baseline gap-2 text-sm">
								<span className="flex-1 truncate">{getCreditActionName(row.action)}</span>
								<span className="font-medium tabular-nums">{t`${row.credits} credits`}</span>
								{priced && (
									<span className="w-28 text-end text-xs text-muted tabular-nums">
										{t`median ${formatUsdMicros(row.p50UsdMicros)}`}
									</span>
								)}
							</div>
							<div className="h-1.5 overflow-hidden rounded-full bg-default">
								<div
									className="h-full rounded-full bg-accent"
									style={{ width: `${Math.max(2, (row.credits / top) * 100)}%` }}
								/>
							</div>
						</li>
					))}
				</ul>
			)}
		</AdminCard>
	);
}

/** Alerts from the last week, when there are any: the first thing to look at. */
function AttentionCard() {
	const alerts = useQuery(orpc.billing.admin.alerts.queryOptions({ input: { limit: 20 } }));
	const { formatShort } = usePlanDates();
	const [since] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
	const recent = (alerts.data ?? []).filter((alert) => +alert.updatedAt > since);
	if (recent.length === 0) return null;
	return (
		<AdminCard
			tone="warning"
			contentClassName="p-0"
			icon="warning"
			title={<Trans>Needs attention</Trans>}
			description={
				<Trans>Alerts from the last 7 days, one per kind per hour. The owner's runbook has the steps.</Trans>
			}
		>
			<Table variant="secondary">
				<Table.ScrollContainer>
					<Table.Content aria-label={t`Alerts`} className="text-sm">
						<Table.Header className="sr-only">
							<Table.Column isRowHeader>{t`Alert`}</Table.Column>
							<Table.Column>{t`Times`}</Table.Column>
							<Table.Column>{t`When`}</Table.Column>
							<Table.Column>{t`Email`}</Table.Column>
							<Table.Column>{t`Payments`}</Table.Column>
						</Table.Header>
						<Table.Body>
							{recent.map((alert, index) => {
								const paymentIds = Array.isArray(alert.details.paymentIds)
									? (alert.details.paymentIds as string[])
									: [];
								return (
									<Table.Row
										key={alert.id}
										id={alert.id}
										className={index === recent.length - 1 ? "[&_td]:border-b-0" : ""}
									>
										<Table.Cell className="font-medium">{getAlertLabel(alert.kind)}</Table.Cell>
										<Table.Cell>
											<Chip size="sm" variant="soft">
												<Chip.Label>×{alert.count}</Chip.Label>
											</Chip>
										</Table.Cell>
										<Table.Cell className="whitespace-nowrap text-muted">{formatShort(alert.updatedAt)}</Table.Cell>
										<Table.Cell className="whitespace-nowrap text-muted">
											{alert.sentAt ? t`Emailed` : t`Not emailed`}
										</Table.Cell>
										<Table.Cell className="text-end">
											{paymentIds.slice(0, 3).map((id) => (
												<Link
													key={id}
													to="/dashboard/admin/billing"
													search={{ query: `RZ-${id}` }}
													className="ms-2 font-mono text-xs text-accent hover:underline"
												>
													RZ-…{id.slice(-6)}
												</Link>
											))}
										</Table.Cell>
									</Table.Row>
								);
							})}
						</Table.Body>
					</Table.Content>
				</Table.ScrollContainer>
			</Table>
		</AdminCard>
	);
}

const PAGE_SIZE = 20;

type StatusFilter = "all" | "paid" | "waiting" | "failed" | "refunded";

const STATUS_FILTERS = (): { id: StatusFilter; label: string }[] => [
	{ id: "all", label: t`All statuses` },
	{ id: "paid", label: t`Paid` },
	{ id: "waiting", label: t`Waiting for payment` },
	{ id: "failed", label: t`Failed, expired or cancelled` },
	{ id: "refunded", label: t`Refunded or reversed` },
];

/** Page numbers to show: the first, the last, and the ones around the current page, with gaps between. */
function pageNumbers(page: number, pages: number): (number | "ellipsis")[] {
	if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
	const middle = [page - 1, page, page + 1].filter((entry) => entry > 1 && entry < pages);
	return [
		1,
		...((middle[0] ?? pages) > 2 ? ["ellipsis" as const] : []),
		...middle,
		...((middle.at(-1) ?? 1) < pages - 1 ? ["ellipsis" as const] : []),
		pages,
	];
}

type PaymentsCardProps = { range: { from: Date; to: Date }; query: string };

/** The period's newest payments, or what a search found; a row opens its customer. */
function PaymentsCard({ range, query }: PaymentsCardProps) {
	const navigate = useNavigate();
	const { formatShort } = usePlanDates();
	const [text, setText] = useState(query);
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<StatusFilter>("all");
	const searching = query.trim().length >= 3;
	const recent = useQuery({
		...orpc.billing.admin.payments.queryOptions({
			input: {
				...range,
				limit: PAGE_SIZE,
				offset: (page - 1) * PAGE_SIZE,
				...(status === "all" ? {} : { status }),
			},
		}),
		enabled: !searching,
		placeholderData: keepPreviousData,
	});
	const found = useQuery({
		...orpc.billing.admin.search.queryOptions({ input: { query } }),
		enabled: searching,
	});
	const emails = new Map((found.data?.customers ?? []).map((customer) => [customer.id, customer.email]));
	const rows: AdminPaymentRow[] = searching
		? (found.data?.payments ?? []).map((payment) => ({
				...payment,
				email: payment.userId ? (emails.get(payment.userId) ?? null) : null,
			}))
		: (recent.data?.items ?? []);
	const loading = searching ? found.isLoading : recent.isLoading;
	const error = searching ? found.error : recent.error;
	const customers = searching ? (found.data?.customers ?? []) : [];
	const total = searching ? rows.length : (recent.data?.total ?? 0);
	const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const first = (page - 1) * PAGE_SIZE + 1;

	const columns: DataGridColumn<AdminPaymentRow>[] = [
		{
			id: "order",
			header: t`Order`,
			isRowHeader: true,
			cell: (row) => (
				<span className="grid gap-0.5 whitespace-nowrap">
					<span className="font-mono text-xs whitespace-nowrap" title={row.orderId ?? row.id}>
						{row.orderId ? `…${row.orderId.slice(-8)}` : t`checkout only`}
					</span>
					<span className="text-xs text-muted">{formatShort(row.createdAt)}</span>
				</span>
			),
		},
		{
			id: "customer",
			header: t`Customer`,
			cell: (row) =>
				row.email ? (
					<span className="block max-w-56 truncate">{row.email}</span>
				) : (
					<span className="text-muted">{t`Account deleted`}</span>
				),
		},
		{ id: "plan", header: t`Plan`, cell: (row) => getPlanName(row.planId) },
		{
			id: "amount",
			header: t`Amount`,
			align: "end",
			cell: (row) => (
				<span className="grid gap-0.5 tabular-nums">
					<span>{formatPrice(row.amount, row.currency)}</span>
					{row.refundedAmount > 0 && (
						<span className="text-xs text-muted">−{formatPrice(row.refundedAmount, row.currency)}</span>
					)}
				</span>
			),
		},
		{ id: "what", header: t`What`, cell: (row) => getPaymentReasonLabel(row) },
		{
			id: "status",
			header: t`Status`,
			cell: (row) => (
				<Chip size="sm" variant="soft" color={getPaymentStatusColor(row.status)}>
					<Chip.Label>{getPaymentStatusLabel(row.status)}</Chip.Label>
				</Chip>
			),
		},
		{
			id: "open",
			header: <span className="sr-only">{t`Open`}</span>,
			align: "end",
			cell: (row) =>
				row.userId ? (
					<Link
						to="/dashboard/admin/billing/$userId"
						params={{ userId: row.userId }}
						aria-label={t`Open customer`}
						className="inline-flex text-muted hover:text-foreground"
					>
						<Icon name="caret-right" size={18} />
					</Link>
				) : null,
		},
	];

	return (
		<AdminCard
			plain
			title={
				<span className="flex items-center gap-2">
					{searching ? <Trans>Search results</Trans> : <Trans>Payments</Trans>}
					<Chip size="sm" variant="soft">
						<Chip.Label>{total}</Chip.Label>
					</Chip>
				</span>
			}
			description={
				searching ? (
					<Trans>Everything matching “{query}”, any date.</Trans>
				) : (
					<Trans>Newest payments started in this period. Search finds any customer.</Trans>
				)
			}
			action={
				<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
					{!searching && (
						<Dropdown>
							<Button size="sm" variant="tertiary" aria-label={t`Status`}>
								<Icon name="sliders-horizontal" size={16} />
								{STATUS_FILTERS().find((option) => option.id === status)?.label}
								<Icon name="caret-down" size={14} className="text-muted" />
							</Button>
							<Dropdown.Popover placement="bottom end" className="min-w-44">
								<Dropdown.Menu
									selectionMode="single"
									selectedKeys={[status]}
									onAction={(key) => {
										setStatus(key as StatusFilter);
										setPage(1);
									}}
								>
									{STATUS_FILTERS().map((option) => (
										<Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
											<Label>{option.label}</Label>
											<Dropdown.ItemIndicator />
										</Dropdown.Item>
									))}
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown>
					)}
					<form
						className="w-full sm:w-72"
						onSubmit={(event) => {
							event.preventDefault();
							void navigate({ to: "/dashboard/admin/billing", search: { query: text.trim() || undefined } });
						}}
					>
						<SearchField
							aria-label={t`Find a customer`}
							fullWidth
							value={text}
							onChange={setText}
							onClear={() => void navigate({ to: "/dashboard/admin/billing", search: {} })}
						>
							<SearchField.Group>
								<SearchField.SearchIcon />
								<SearchField.Input placeholder={t`Email, RZ-… or ID`} spellCheck={false} />
								<SearchField.ClearButton />
							</SearchField.Group>
						</SearchField>
					</form>
				</div>
			}
		>
			{customers.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{customers.map((customer) => (
						<Link
							key={customer.id}
							to="/dashboard/admin/billing/$userId"
							params={{ userId: customer.id }}
							className="inline-flex items-center gap-1.5 rounded-full bg-default px-3 py-1 text-sm hover:bg-default-hover"
						>
							<Icon name="user-circle" size={16} className="text-muted" />
							{customer.email}
						</Link>
					))}
				</div>
			)}
			{error ? (
				<p role="alert" className="text-sm text-danger">
					{getReadableErrorMessage(error, t`The payments couldn't load.`)}
				</p>
			) : loading ? (
				<Skeleton className="h-48 rounded-xl" />
			) : (
				<DataGrid
					aria-label={t`Payments`}
					columns={columns}
					data={rows}
					getRowId={(row) => row.id}
					contentClassName="min-w-[760px]"
					onRowAction={(key) => {
						const userId = rows.find((row) => row.id === key)?.userId;
						if (userId) void navigate({ to: "/dashboard/admin/billing/$userId", params: { userId } });
					}}
					renderEmptyState={() => (
						<p className="py-10 text-center text-sm text-muted">
							{searching ? t`Nothing matches.` : t`No payments in this period.`}
						</p>
					)}
				/>
			)}
			{!searching && total > PAGE_SIZE && (
				<Pagination size="sm" className="w-full">
					<Pagination.Summary>{t`${first}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}</Pagination.Summary>
					<Pagination.Content>
						<Pagination.Item>
							<Pagination.Previous isDisabled={page === 1} onPress={() => setPage(page - 1)}>
								<Pagination.PreviousIcon />
							</Pagination.Previous>
						</Pagination.Item>
						{pageNumbers(page, pages).map((entry, index) =>
							entry === "ellipsis" ? (
								<Pagination.Item key={`ellipsis-${index}`}>
									<Pagination.Ellipsis />
								</Pagination.Item>
							) : (
								<Pagination.Item key={entry}>
									<Pagination.Link isActive={entry === page} onPress={() => setPage(entry)}>
										{entry}
									</Pagination.Link>
								</Pagination.Item>
							),
						)}
						<Pagination.Item>
							<Pagination.Next isDisabled={page === pages} onPress={() => setPage(page + 1)}>
								<Pagination.NextIcon />
							</Pagination.Next>
						</Pagination.Item>
					</Pagination.Content>
				</Pagination>
			)}
		</AdminCard>
	);
}

type BillingAdminPageProps = { query: string };

/** The owner's billing desk: the period, headline numbers with trends, charts, alerts, and the payments. */
export function BillingAdminPage({ query }: BillingAdminPageProps) {
	const queryClient = useQueryClient();
	const [preset, setPreset] = useState<ReportPreset>("30d");
	// Worked out when the period is picked, so the queries keep their keys between renders.
	const [range, setRange] = useState(() => reportRange("30d"));
	const [exporting, setExporting] = useState(false);
	const metrics = useQuery(orpc.billing.admin.metrics.queryOptions({ input: range }));

	const exportCsv = async () => {
		setExporting(true);
		try {
			const result = await client.billing.admin.exportPayments(range);
			downloadWithAnchor(new Blob([result.csv], { type: "text/csv;charset=utf-8" }), result.filename);
		} catch (error) {
			toast.add({ type: "error", description: getReadableErrorMessage(error, t`The export failed. Try again.`) });
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="grid min-w-0 gap-1">
					<Typography type="h2" render={renderAsH1}>
						<Trans>Billing</Trans>
					</Typography>
					<p className="text-sm text-muted">
						<Trans>Days in WIB. Trends compare with the period just before.</Trans>
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
					<Dropdown>
						<Button size="sm" variant="tertiary" aria-label={t`Period`}>
							<Icon name="calendar-blank" size={16} />
							{PRESETS().find((option) => option.id === preset)?.label}
							<Icon name="caret-down" size={14} className="text-muted" />
						</Button>
						<Dropdown.Popover placement="bottom end" className="min-w-44">
							<Dropdown.Menu
								selectionMode="single"
								selectedKeys={[preset]}
								onAction={(key) => {
									setPreset(key as ReportPreset);
									setRange(reportRange(key as ReportPreset));
								}}
							>
								{PRESETS().map((option) => (
									<Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
										<Label>{option.label}</Label>
										<Dropdown.ItemIndicator />
									</Dropdown.Item>
								))}
							</Dropdown.Menu>
						</Dropdown.Popover>
					</Dropdown>
					<IconButton
						label={t`Refresh`}
						onPress={() => void queryClient.invalidateQueries({ queryKey: orpc.billing.admin.key() })}
					>
						<Icon name="arrow-clockwise" size={16} />
					</IconButton>
					<Button size="sm" isPending={exporting} onPress={() => void exportCsv()}>
						{exporting ? <Spinner size="sm" color="current" aria-hidden /> : <Icon name="download-simple" size={16} />}
						<Trans>Download CSV</Trans>
					</Button>
				</div>
			</header>

			<AttentionCard />

			{metrics.data ? (
				<>
					<KpiRow metrics={metrics.data} />
					<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
						<SalesCard metrics={metrics.data} />
						<CheckoutCard metrics={metrics.data} />
					</div>
					<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
						<SubscriptionsCard metrics={metrics.data} />
						<AiCard metrics={metrics.data} />
					</div>
				</>
			) : metrics.error ? (
				<p role="alert" className="text-sm text-danger">
					{getReadableErrorMessage(metrics.error, t`The numbers couldn't load.`)}
				</p>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{[0, 1, 2, 3].map((index) => (
						<Skeleton key={index} className="h-36 rounded-2xl" />
					))}
				</div>
			)}

			<PaymentsCard key={`${query}|${+range.from}`} range={range} query={query} />
		</div>
	);
}
