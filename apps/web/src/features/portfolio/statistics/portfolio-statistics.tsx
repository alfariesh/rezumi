import type { StatisticsCsvKind } from "./csv";
import type { client } from "@/libs/orpc/client";
import type { PortfolioStatisticsRange } from "@rezumi/schema/portfolio/statistics";
import { KPIGroup, Segment, Widget } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { Button, Chip, Dropdown, Label, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useRouteContext, useRouter } from "@tanstack/react-router";
import { Suspense, useId, useState } from "react";
import {
	PORTFOLIO_CLICK_KINDS,
	PORTFOLIO_DEVICES,
	PORTFOLIO_STATISTICS_DAYS,
	PORTFOLIO_STATISTICS_RANGES,
	PORTFOLIO_VISIT_SOURCES,
} from "@rezumi/schema/portfolio/statistics";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { ChunkBoundary, retryableLazy } from "../editor/chunk-boundary";
import { countryNames } from "../location/cities";
import { saveFile } from "../save-file";
import { dailyCsv, detailsCsv, statisticsCsvName, worksCsv } from "./csv";
import {
	clickLabels,
	DailyBars,
	deviceLabels,
	LockedDetails,
	RankList,
	sourceLabels,
	UnavailableDetails,
} from "./parts";
import { WorkStatisticsDialog } from "./work-statistics";
import { WidgetHeading } from "@/components/layout/widget-heading";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { deviceTimeZone, saveAccountTimeZone } from "@/features/settings/timezone";
import { authClient } from "@/libs/auth/client";
import { orpc } from "@/libs/orpc/client";

const visitorMap = retryableLazy(() => import("./visitor-map"));

type Statistics = NonNullable<Awaited<ReturnType<typeof client.portfolio.statistics>>>;
type ReadyDetails = Extract<Statistics["details"], { state: "ready" }>;

/** How many days of "Work opened by day" show: the most recent ones. */
const WORK_DAYS_SHOWN = 10;

/**
 * Days are counted in the account's timezone (Settings → Timezone, UTC until it's set), which the person may never
 * have chosen: say which, and where to change it.
 */
function DayZoneNote() {
	const { session } = useRouteContext({ strict: false });
	const queryClient = useQueryClient();
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const timeZone = session?.user.timezone ?? "UTC";
	const device = deviceTimeZone();

	// This device is somewhere else: one press counts the days in its zone (the server reads the new zone at once).
	const switchToDevice = async (zone: string) => {
		setSaving(true);
		const saved = await saveAccountTimeZone(zone, queryClient, () => router.invalidate());
		setSaving(false);
		if (!saved) {
			toast.add({ type: "error", description: t`Couldn't save the timezone. Try again.` });
			return;
		}
		await queryClient.invalidateQueries({ queryKey: orpc.portfolio.statistics.key() });
	};

	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-xs text-muted">
			<p>
				<Trans>Days are counted in {timeZone}.</Trans>{" "}
				<Link
					to="/dashboard/settings/app"
					hash="timezone"
					className="underline underline-offset-2 hover:text-foreground"
				>
					<Trans>Change timezone</Trans>
				</Link>
			</p>
			{device && device !== timeZone && (
				<Button size="sm" variant="secondary" isPending={saving} onPress={() => void switchToDevice(device)}>
					<Trans>Use {device}</Trans>
				</Button>
			)}
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
				<ChunkBoundary>
					{(attempt) => {
						const VisitorMap = visitorMap(attempt);
						return (
							<Suspense
								fallback={
									<div className="grid aspect-5/2 place-items-center rounded-xl border border-border">
										<Spinner size="sm" color="current" />
									</div>
								}
							>
								<VisitorMap countries={details.countries} />
							</Suspense>
						);
					}}
				</ChunkBoundary>
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
					keepOrder
					// The latest days first, the most opened work first within a day; older days are summed in "Most opened work".
					rows={details.workDays
						.toSorted((a, b) => b.date.localeCompare(a.date) || b.opens - a.opens)
						.slice(0, WORK_DAYS_SHOWN)
						.map((row) => ({
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

/**
 * The portfolio's numbers for the last 7, 30 or 90 days (`01-desain.md` section 10, Phase 13 3.7), the range kept in
 * the address (`?range=`). Only its owner can read them.
 */
export function PortfolioStatistics() {
	const [range, setRange] = useStatisticsRange();
	const { data, isPending, isError, isPlaceholderData, refetch, isRefetching } = useQuery({
		...orpc.portfolio.statistics.queryOptions({ input: { range } }),
		// Another range keeps the numbers shown until its own arrive, instead of a spinner over the page.
		placeholderData: keepPreviousData,
	});
	const [openWork, setOpenWork] = useState<{ id: string; title: string } | null>(null);
	const titleId = useId();
	const clicks = clickLabels();
	const sources = sourceLabels();
	if (isPending)
		return (
			<div className="grid place-items-center py-10">
				<Spinner size="md" color="current" />
			</div>
		);
	if (isError && !data)
		return (
			<Widget role="region" aria-labelledby={titleId}>
				<WidgetHeading id={titleId} icon="chart-line-up" title={<Trans>Visitors</Trans>} />
				<Widget.Content className="flex flex-wrap items-center gap-3">
					<p className="min-w-0 flex-1 text-body-sm text-muted">
						<Trans>The numbers couldn't be loaded.</Trans>
					</p>
					<Button size="sm" variant="secondary" isPending={isRefetching} onPress={() => void refetch()}>
						<Trans>Try again</Trans>
					</Button>
				</Widget.Content>
			</Widget>
		);
	if (!data) return null;
	const totalClicks = PORTFOLIO_CLICK_KINDS.reduce((sum, kind) => sum + data.totals.clicks[kind], 0);
	const tiles = [
		{ key: "visits", title: t`Visits`, value: data.totals.views },
		// Buttons, links, videos played and PDFs opened: the Clicks list below names each.
		{ key: "clicks", title: t`Clicks`, value: totalClicks },
		{ key: "messages", title: t`Messages`, value: data.totals.messages },
	];

	return (
		<Widget role="region" aria-labelledby={titleId} aria-busy={isPlaceholderData} className="@container">
			<WidgetHeading
				id={titleId}
				icon="chart-line-up"
				title={<Trans>Visitors</Trans>}
				description={<Trans>Only you see these, and your own visits aren't counted.</Trans>}
			/>
			<Widget.Content className="grid gap-5">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<RangeSwitch value={range} onChange={setRange} />
					<CsvMenu statistics={data} />
				</div>
				{isError && (
					// The numbers below are still the earlier range's: say so, rather than show them as this one's.
					<div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-secondary p-3">
						<p className="min-w-0 flex-1 text-body-sm">
							<Trans>The numbers for these days couldn't be loaded. The ones below are from before.</Trans>
						</p>
						<Button size="sm" variant="secondary" isPending={isRefetching} onPress={() => void refetch()}>
							<Trans>Try again</Trans>
						</Button>
					</div>
				)}
				<div className={cn("grid gap-5 transition-opacity", isPlaceholderData && "opacity-60")}>
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
					<div className="grid gap-1">
						<DailyBars
							days={data.days.map((day) => ({ date: day.date, value: day.views }))}
							describe={(label, visits) => t`${label}: ${visits} visits`}
							summary={(days, peak) => t`Daily visits over ${days} days, peak ${peak}`}
							caption={<Trans>Visits per day</Trans>}
						/>
						<DayZoneNote />
					</div>
					<div className="grid gap-6 @lg:grid-cols-2">
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
					</div>
					<WorksTable works={data.works} onDetails={setOpenWork} />
					{data.details.state === "ready" && <ReadyStatisticsDetails details={data.details} />}
					{data.details.state === "locked" && <LockedDetails />}
					{data.details.state === "unavailable" && <UnavailableDetails />}
				</div>
			</Widget.Content>
			{openWork && (
				<WorkStatisticsDialog
					workId={openWork.id}
					title={openWork.title}
					range={range}
					onClose={() => setOpenWork(null)}
				/>
			)}
		</Widget>
	);
}

const routeApi = getRouteApi("/dashboard/portfolio/");

/** The range in the address, 30 days when it says none; changing it replaces the address, not a new history step. */
function useStatisticsRange(): [PortfolioStatisticsRange, (range: PortfolioStatisticsRange) => void] {
	const { range } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	return [
		range ?? PORTFOLIO_STATISTICS_DAYS,
		(next) =>
			void navigate({
				to: ".",
				search: (search: ReturnType<typeof routeApi.useSearch>) => ({
					...search,
					range: next === PORTFOLIO_STATISTICS_DAYS ? undefined : next,
				}),
				replace: true,
				resetScroll: false,
			}),
	];
}

type RangeSwitchProps = { value: PortfolioStatisticsRange; onChange: (range: PortfolioStatisticsRange) => void };

const rangeLabel = (days: PortfolioStatisticsRange) =>
	({ 7: t`Last 7 days`, 30: t`Last 30 days`, 90: t`Last 90 days` })[days];

/** Last 7, 30 or 90 days. */
function RangeSwitch({ value, onChange }: RangeSwitchProps) {
	return (
		<Segment
			aria-label={t`Days shown`}
			size="sm"
			selectedKey={String(value)}
			onSelectionChange={(key) => {
				const next = PORTFOLIO_STATISTICS_RANGES.find((days) => String(days) === String(key));
				if (next) onChange(next);
			}}
		>
			{PORTFOLIO_STATISTICS_RANGES.map((days) => (
				<Segment.Item key={days} id={String(days)} className="w-auto px-2.5">
					{rangeLabel(days)}
				</Segment.Item>
			))}
		</Segment>
	);
}

type WorksTableProps = {
	works: Statistics["works"];
	onDetails: (work: { id: string; title: string }) => void;
};

/** Every work opened in the range: how often, its share of all openings, and its own numbers behind Details. */
export function WorksTable({ works, onDetails }: WorksTableProps) {
	const { i18n } = useLingui();
	const total = works.reduce((sum, work) => sum + work.opens, 0);
	const percent = new Intl.NumberFormat(i18n.locale, { style: "percent", maximumFractionDigits: 0 });
	return (
		<section className="grid gap-2">
			<h3 className="text-sm font-semibold">
				<Trans>Per work</Trans>
			</h3>
			{works.length === 0 ? (
				<p className="text-body-sm text-muted">
					<Trans>No work opened yet.</Trans>
				</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-xs text-muted">
							<tr>
								<th scope="col" className="py-1.5 pe-3 text-start font-medium">
									<Trans>Work</Trans>
								</th>
								<th scope="col" className="py-1.5 pe-3 text-end font-medium">
									<Trans>Opened</Trans>
								</th>
								<th scope="col" className="py-1.5 pe-3 text-end font-medium">
									<Trans>Of total</Trans>
								</th>
								<th scope="col" className="py-1.5">
									<span className="sr-only">
										<Trans>Details</Trans>
									</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{works.map((work) => (
								<tr key={work.id} className="border-t border-border">
									<th scope="row" className="max-w-0 py-1.5 pe-3 text-start font-normal">
										<span className="block truncate" title={work.title}>
											{work.title}
										</span>
									</th>
									<td className="py-1.5 pe-3 text-end tabular-nums">{work.opens.toLocaleString(i18n.locale)}</td>
									<td className="py-1.5 pe-3 text-end text-muted tabular-nums">
										{percent.format(total ? work.opens / total : 0)}
									</td>
									<td className="py-1 text-end">
										<Button
											size="sm"
											variant="ghost"
											aria-label={t`Details for ${work.title}`}
											onPress={() => onDetails({ id: work.id, title: work.title })}
										>
											<Trans>Details</Trans>
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}

/** Download CSV: the days and the works for every plan, the breakdown with Plus (owner decision #1). */
function CsvMenu({ statistics }: { statistics: Statistics }) {
	const { data: session } = authClient.useSession();
	const username = session?.user.username ?? "";
	const { details } = statistics;

	const download = (kind: StatisticsCsvKind) => {
		if (kind === "details" && details.state === "locked") {
			openPlanDialog({ kind: "feature", feature: "detailedPortfolioStats" });
			return;
		}
		const text =
			kind === "daily" ? dailyCsv(statistics) : kind === "works" ? worksCsv(statistics) : detailsCsv(statistics);
		if (text === null) return;
		saveFile(new Blob([text], { type: "text/csv;charset=utf-8" }), statisticsCsvName(username, statistics.range, kind));
	};

	return (
		<Dropdown>
			<Button size="sm" variant="secondary">
				<Icon name="download-simple" size={16} />
				<Trans>Download CSV</Trans>
			</Button>
			<Dropdown.Popover placement="bottom end" className="w-72">
				<Dropdown.Menu
					aria-label={t`Download CSV`}
					disabledKeys={details.state === "ready" || details.state === "locked" ? [] : ["details"]}
					onAction={(key) => download(key as StatisticsCsvKind)}
				>
					<Dropdown.Item id="daily" textValue={t`Daily numbers`}>
						<div className="grid">
							<Label>
								<Trans>Daily numbers</Trans>
							</Label>
							<span className="text-xs text-muted">
								<Trans>Visits, messages, clicks and sources per day</Trans>
							</span>
						</div>
					</Dropdown.Item>
					<Dropdown.Item id="works" textValue={t`Works`}>
						<div className="grid">
							<Label>
								<Trans>Works</Trans>
							</Label>
							<span className="text-xs text-muted">
								<Trans>How often each work was opened</Trans>
							</span>
						</div>
					</Dropdown.Item>
					<Dropdown.Item id="details" textValue={t`Breakdown`}>
						<div className="grid">
							<Label className="flex items-center gap-1.5">
								<Trans>Breakdown</Trans>
								{details.state === "locked" && (
									<Chip size="sm" variant="soft" color="accent">
										<Icon name="lock" size={12} aria-hidden />
										Plus
									</Chip>
								)}
							</Label>
							<span className="text-xs text-muted">
								{details.state === "ready" || details.state === "locked" ? (
									<Trans>Countries, devices, linking sites and works by day</Trans>
								) : (
									<Trans>Not available right now</Trans>
								)}
							</span>
						</div>
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}
