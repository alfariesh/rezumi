import type { AdminAccountMetrics, AdminAccountRow, ReportPreset } from "./labels";
import type { DataGridColumn } from "@heroui-pro/react";
import { DataGrid } from "@heroui-pro/react";
import { Avatar, Button, Chip, Dropdown, Label, SearchField, Skeleton, Typography } from "@heroui/react";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { getInitials } from "@rezumi/utils/string";
import { getPlanName } from "../plan";
import { usePlanDates } from "../purchase";
import { reportRange } from "./labels";
import { AdminCard, IconButton, PageNav, PeriodMenu, StatWidget, trendOf } from "./parts";
import { EmptyBlock } from "@/components/layout/empty-block";
import { getReadableErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { renderAsH1 } from "@/libs/typography";

const PAGE_SIZE = 20;

type AccountPlanFilter = "all" | "free" | "plus" | "pro-ai";

const PLAN_FILTERS = (): { id: AccountPlanFilter; label: string }[] => [
	{ id: "all", label: t`All plans` },
	{ id: "free", label: "Free" },
	{ id: "plus", label: "Plus" },
	{ id: "pro-ai", label: "Pro AI" },
];

const formatCount = (value: number) => new Intl.NumberFormat(i18n.locale).format(value);
const formatShare = (part: number, whole: number) =>
	new Intl.NumberFormat(i18n.locale, { style: "percent", maximumFractionDigits: 1 }).format(whole ? part / whole : 0);

type MetricsRowProps = { metrics: AdminAccountMetrics };

function MetricsRow({ metrics }: MetricsRowProps) {
	const { signups, active, paying } = metrics;
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<StatWidget
				icon={<Icon name="user-circle" size={16} />}
				title={<Trans>Accounts</Trans>}
				value={formatCount(metrics.accounts)}
				color="var(--color-accent)"
				footer={t`${formatCount(metrics.verified)} verified their email · ${formatCount(metrics.guests)} guests not counted`}
			/>
			<StatWidget
				icon={<Icon name="user-plus" size={16} />}
				title={<Trans>New sign-ups</Trans>}
				value={formatCount(signups.total)}
				trend={trendOf(signups.total, signups.previous)}
				series={signups.daily.map((day) => day.signups)}
				color="var(--chart-2)"
				footer={t`${formatCount(signups.verified)} verified their email`}
			/>
			<StatWidget
				icon={<Icon name="chart-line-up" size={16} />}
				title={<Trans>Active in the last 30 days</Trans>}
				value={formatCount(active.month)}
				color="var(--color-success)"
				footer={t`${formatCount(active.week)} in the last 7 days · ${formatShare(active.month, metrics.accounts)} of accounts`}
			/>
			<StatWidget
				icon={<Icon name="seal-check" size={16} />}
				title={<Trans>On a paid plan now</Trans>}
				value={formatCount(paying.total)}
				color="var(--color-warning)"
				footer={t`Plus ${formatCount(paying.plus)} · Pro AI ${formatCount(paying.proAi)} · ${formatShare(paying.total, metrics.accounts)} of accounts`}
			/>
		</div>
	);
}

type AccountsCardProps = { query: string; plan: AccountPlanFilter };

/** Every account, newest first, or what the search found; a row opens the account's billing page. */
function AccountsCard({ query, plan }: AccountsCardProps) {
	const navigate = useNavigate();
	const { formatDay } = usePlanDates();
	const [text, setText] = useState(query);
	const [page, setPage] = useState(1);
	const accounts = useQuery({
		...orpc.billing.admin.accounts.queryOptions({
			input: {
				...(query ? { query } : {}),
				...(plan === "all" ? {} : { plan }),
				limit: PAGE_SIZE,
				offset: (page - 1) * PAGE_SIZE,
			},
		}),
		placeholderData: keepPreviousData,
	});
	const rows = accounts.data?.accounts ?? [];
	const total = accounts.data?.total ?? 0;
	const search = (next: { query?: string; plan?: AccountPlanFilter }) =>
		void navigate({
			to: "/dashboard/admin/accounts",
			search: {
				query: (next.query ?? query) || undefined,
				plan: (next.plan ?? plan) === "all" ? undefined : (next.plan ?? plan),
			},
		});

	const columns: DataGridColumn<AdminAccountRow>[] = [
		{
			id: "account",
			header: t`Account`,
			isRowHeader: true,
			cell: (row) => (
				<span className="flex min-w-0 items-center gap-2.5">
					<Avatar size="sm" color="accent" variant="soft" className="shrink-0">
						<Avatar.Fallback className="text-xs font-semibold">{getInitials(row.name)}</Avatar.Fallback>
					</Avatar>
					<span className="grid min-w-0 gap-0.5">
						<span className="truncate text-sm font-medium">{row.name}</span>
						<span className="truncate text-xs text-muted">{row.email}</span>
					</span>
				</span>
			),
		},
		{
			id: "plan",
			header: t`Plan`,
			cell: (row) => (
				<Chip size="sm" variant="soft" color={row.planId === "free" ? "default" : "accent"}>
					<Chip.Label>{getPlanName(row.planId)}</Chip.Label>
				</Chip>
			),
		},
		{
			id: "joined",
			header: t`Joined`,
			cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatDay(row.createdAt)}</span>,
		},
		{
			id: "seen",
			header: t`Last signed in`,
			cell: (row) => (
				<span className="whitespace-nowrap text-muted tabular-nums">
					{row.lastSeenAt ? formatDay(row.lastSeenAt) : "—"}
				</span>
			),
		},
		{
			id: "status",
			header: t`Status`,
			cell: (row) => (
				<span className="flex flex-wrap gap-1">
					{row.emailVerified ? (
						<Chip size="sm" variant="soft" color="success">
							<Chip.Label>{t`verified`}</Chip.Label>
						</Chip>
					) : (
						<Chip size="sm" variant="soft">
							<Chip.Label>{t`email not verified`}</Chip.Label>
						</Chip>
					)}
					{row.admin && (
						<Chip size="sm" variant="soft" color="warning">
							<Chip.Label>{t`admin`}</Chip.Label>
						</Chip>
					)}
					{row.banned && (
						<Chip size="sm" variant="soft" color="danger">
							<Chip.Label>{t`banned`}</Chip.Label>
						</Chip>
					)}
				</span>
			),
		},
	];

	return (
		<AdminCard
			plain
			title={
				<span className="flex items-center gap-2">
					<Trans>All accounts</Trans>
					<Chip size="sm" variant="soft">
						<Chip.Label>{formatCount(total)}</Chip.Label>
					</Chip>
				</span>
			}
			description={<Trans>Newest first, guests left out. A row opens the account's billing page.</Trans>}
			action={
				<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
					<Dropdown>
						<Button size="sm" variant="tertiary" aria-label={t`Plan`}>
							<Icon name="sliders-horizontal" size={16} />
							{PLAN_FILTERS().find((option) => option.id === plan)?.label}
							<Icon name="caret-down" size={14} className="text-muted" />
						</Button>
						<Dropdown.Popover placement="bottom end" className="min-w-44">
							<Dropdown.Menu
								selectionMode="single"
								selectedKeys={[plan]}
								onAction={(key) => search({ plan: key as AccountPlanFilter })}
							>
								{PLAN_FILTERS().map((option) => (
									<Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
										<Label>{option.label}</Label>
										<Dropdown.ItemIndicator />
									</Dropdown.Item>
								))}
							</Dropdown.Menu>
						</Dropdown.Popover>
					</Dropdown>
					<form
						className="w-full sm:w-72"
						onSubmit={(event) => {
							event.preventDefault();
							search({ query: text.trim() });
						}}
					>
						<SearchField
							aria-label={t`Find an account`}
							variant="secondary"
							fullWidth
							value={text}
							onChange={setText}
							onClear={() => search({ query: "" })}
						>
							<SearchField.Group>
								<SearchField.SearchIcon />
								<SearchField.Input placeholder={t`Name, email or username`} spellCheck={false} />
								<SearchField.ClearButton />
							</SearchField.Group>
						</SearchField>
					</form>
				</div>
			}
		>
			{accounts.error ? (
				<p role="alert" className="text-body-sm text-danger">
					{getReadableErrorMessage(accounts.error, t`The accounts couldn't load.`)}
				</p>
			) : accounts.isLoading ? (
				<Skeleton className="h-48 rounded-xl" />
			) : (
				<DataGrid
					aria-label={t`Accounts`}
					columns={columns}
					data={rows}
					getRowId={(row) => row.id}
					contentClassName="min-w-[760px]"
					onRowAction={(key) =>
						void navigate({ to: "/dashboard/admin/billing/$userId", params: { userId: String(key) } })
					}
					renderEmptyState={() =>
						query || plan !== "all" ? (
							<EmptyBlock kind="filtered" title={<Trans>No accounts match.</Trans>} />
						) : (
							<EmptyBlock kind="inline" className="m-3" title={t`No accounts yet.`} />
						)
					}
				/>
			)}
			{total > PAGE_SIZE && <PageNav page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />}
		</AdminCard>
	);
}

type AccountsAdminPageProps = { query: string; plan: AccountPlanFilter };

/** Every account with the numbers that matter: how many, new ones, who is active, who pays. */
export function AccountsAdminPage({ query, plan }: AccountsAdminPageProps) {
	const queryClient = useQueryClient();
	const [preset, setPreset] = useState<ReportPreset>("30d");
	const [range, setRange] = useState(() => reportRange("30d"));
	const metrics = useQuery(orpc.billing.admin.accountMetrics.queryOptions({ input: range }));

	return (
		<div className="flex flex-col gap-4">
			<header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="grid min-w-0 gap-1">
					<Typography type="h2" render={renderAsH1}>
						<Trans>Accounts</Trans>
					</Typography>
					<p className="text-body-sm text-muted">
						<Trans>
							The period applies to new sign-ups (days in WIB). Activity counts sign-ins used, refreshed about once a
							day.
						</Trans>
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<PeriodMenu
						preset={preset}
						onChange={(next) => {
							setPreset(next);
							setRange(reportRange(next));
						}}
					/>
					<IconButton
						label={t`Refresh`}
						onPress={() => {
							void queryClient.invalidateQueries({ queryKey: orpc.billing.admin.accountMetrics.key() });
							void queryClient.invalidateQueries({ queryKey: orpc.billing.admin.accounts.key() });
						}}
					>
						<Icon name="arrow-clockwise" size={16} />
					</IconButton>
				</div>
			</header>

			{metrics.data ? (
				<MetricsRow metrics={metrics.data} />
			) : metrics.error ? (
				<p role="alert" className="text-body-sm text-danger">
					{getReadableErrorMessage(metrics.error, t`The numbers couldn't load.`)}
				</p>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{[0, 1, 2, 3].map((index) => (
						<Skeleton key={index} className="h-36 rounded-2xl" />
					))}
				</div>
			)}

			<AccountsCard key={`${query}|${plan}`} query={query} plan={plan} />
		</div>
	);
}
