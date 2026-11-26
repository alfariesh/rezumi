import type { RouterOutput } from "@/api/client";
import type { BarListItem } from "@/ui";
import type { PortfolioStatisticsResult, StatisticsCsvKind } from "@rezumi/portfolio/statistics-csv";
import type { PortfolioStatisticsRange, PortfolioWorkSource } from "@rezumi/schema/portfolio/statistics";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { dailyCsv, detailsCsv, statisticsCsvName, worksCsv } from "@rezumi/portfolio/statistics-csv";
import {
	PORTFOLIO_CLICK_KINDS,
	PORTFOLIO_STATISTICS_DAYS,
	PORTFOLIO_STATISTICS_RANGES,
} from "@rezumi/schema/portfolio/statistics";
import { sharePortfolioFile } from "./export";
import { OfflinePortfolioNotice, PortfolioLoadState, PortfolioPage } from "./layout";
import { usePortfolio, usePortfolioAddress } from "./queries";
import { orpc } from "@/api/client";
import { useOnline } from "@/api/online";
import {
	BarList,
	Card,
	ColumnChart,
	EmptyState,
	ListRow,
	ListSection,
	Screen,
	Segment,
	Sheet,
	Spinner,
	Text,
	Typography,
	showToast,
} from "@/ui";

type Work = PortfolioStatisticsResult["works"][number];
type Range = `${PortfolioStatisticsRange}`;
type StatsDetails = PortfolioStatisticsResult["details"] | RouterOutput["portfolio"]["workStatistics"]["details"];

export function PortfolioStatisticsScreen() {
	const { t } = useLingui();
	const [range, setRange] = useState<PortfolioStatisticsRange>(PORTFOLIO_STATISTICS_DAYS);
	const [work, setWork] = useState<Work | null>(null);
	const online = useOnline();
	const portfolio = usePortfolio();
	const { username } = usePortfolioAddress(portfolio.data?.portfolio);
	const stats = useQuery({ ...orpc.portfolio.statistics.queryOptions({ input: { range } }), enabled: online });

	return (
		<PortfolioPage title={t`Visitor statistics`}>
			<View className="px-4 pb-2">
				<Segment<Range>
					accessibilityLabel={t`Statistics date range`}
					value={`${range}`}
					onValueChange={(value) => {
						const next = PORTFOLIO_STATISTICS_RANGES.find((days) => String(days) === value);
						if (next) setRange(next);
					}}
					options={PORTFOLIO_STATISTICS_RANGES.map((days) => ({
						value: `${days}`,
						label: t`${days} days`,
					}))}
				/>
			</View>
			{stats.data === undefined ? (
				<PortfolioLoadState offline={!online} error={stats.isError} retry={() => void stats.refetch()} />
			) : stats.data === null ? (
				<Screen>
					<EmptyState kind="page" icon="chart-line-up" title={t`You don't have a portfolio yet.`} />
				</Screen>
			) : (
				<Screen onRefresh={stats.refetch}>
					{online ? null : <OfflinePortfolioNotice />}
					<StatisticsBody data={stats.data} username={username} chooseWork={setWork} />
				</Screen>
			)}
			{work ? <WorkStatisticsSheet work={work} range={range} close={() => setWork(null)} /> : null}
		</PortfolioPage>
	);
}

type StatisticsBodyProps = {
	data: PortfolioStatisticsResult;
	username?: string | undefined;
	chooseWork: (work: Work) => void;
};

function StatisticsBody({ data, username, chooseWork }: StatisticsBodyProps) {
	const { t, i18n } = useLingui();
	const [sharing, setSharing] = useState(false);
	const totalClicks = PORTFOLIO_CLICK_KINDS.reduce((sum, kind) => sum + data.totals.clicks[kind], 0);
	const figures = [
		{ label: t`Views`, count: data.totals.views },
		{ label: t`Clicks`, count: totalClicks },
		{ label: t`Messages`, count: data.totals.messages },
	];
	const sources = sourceLabels(t);
	const save = async (kind: StatisticsCsvKind) => {
		const csv = { daily: dailyCsv, works: worksCsv, details: detailsCsv }[kind](data);
		if (csv === null || sharing) return;
		setSharing(true);
		try {
			await sharePortfolioFile(statisticsCsvName(username ?? "", data.range, kind), csv, "text/csv");
		} catch {
			showToast({ title: t`Couldn't share the statistics file.`, variant: "danger" });
		} finally {
			setSharing(false);
		}
	};
	return (
		<>
			<Card className="gap-4">
				<View className="flex-row flex-wrap justify-between gap-4">
					{figures.map(({ label, count }) => (
						<View key={label} className="min-w-20 gap-1">
							<Typography.Heading type="h4">{i18n.number(count)}</Typography.Heading>
							<Text size="sm" tone="muted">
								{label}
							</Text>
						</View>
					))}
				</View>
				{data.totals.views === 0 ? (
					<EmptyState kind="inline" title={t`No visits in this period.`} />
				) : (
					<DailyChart title={t`Daily views`} days={data.days.map((day) => ({ date: day.date, value: day.views }))} />
				)}
			</Card>
			<RankCard
				title={t`Visit sources`}
				items={Object.entries(data.sources).map(([key, value]) => ({
					key,
					label: sources[key as PortfolioWorkSource],
					value,
				}))}
			/>
			{data.works.length ? (
				<ListSection title={t`Per work`}>
					{data.works.map((work) => (
						<ListRow
							key={work.id}
							title={work.title}
							trailing={
								<Text tabular tone="muted">
									{i18n.number(work.opens)}
								</Text>
							}
							onPress={() => chooseWork(work)}
						/>
					))}
				</ListSection>
			) : (
				<Card className="gap-2">
					<Typography.Heading type="h6">{t`Per work`}</Typography.Heading>
					<Text tone="muted">{t`No work was opened in this period.`}</Text>
				</Card>
			)}
			<DetailBreakdown details={data.details} />
			<ListSection title={t`Share CSV`}>
				<ListRow title={t`Daily numbers`} icon="export" isDisabled={sharing} onPress={() => void save("daily")} />
				<ListRow title={t`Work statistics`} icon="export" isDisabled={sharing} onPress={() => void save("works")} />
				{data.details.state === "ready" ? (
					<ListRow
						title={t`Visitor breakdown`}
						icon="export"
						isDisabled={sharing}
						onPress={() => void save("details")}
					/>
				) : null}
			</ListSection>
		</>
	);
}

type DailyChartProps = { title: string; days: { date: string; value: number }[] };

function DailyChart({ title, days }: DailyChartProps) {
	const { i18n } = useLingui();
	const points = days.map(({ date, value }) => ({
		label: new Date(`${date}T00:00:00`).toLocaleDateString(i18n.locale, { month: "short", day: "numeric" }),
		value,
	}));
	return (
		<View className="gap-2">
			<Typography.Heading type="h6">{title}</Typography.Heading>
			<ColumnChart
				data={points}
				maxXAxisLabels={4}
				accessibilityLabel={`${title}. ${points.map(({ label, value }) => `${label}, ${i18n.number(value)}`).join(". ")}`}
			/>
		</View>
	);
}

function sourceLabels(t: ReturnType<typeof useLingui>["t"]): Record<PortfolioWorkSource, string> {
	return {
		linkedin: "LinkedIn",
		whatsapp: "WhatsApp",
		google: "Google",
		qr: t`QR code`,
		direct: t`Direct`,
		other: t`Other sites`,
		portfolio: t`From your portfolio`,
	};
}

type RankCardProps = { title: string; items: BarListItem[] };
function RankCard({ title, items }: RankCardProps) {
	const { t } = useLingui();
	const rows = items.filter((item) => item.value > 0).sort((left, right) => right.value - left.value);
	return (
		<Card className="gap-3">
			<Typography.Heading type="h6">{title}</Typography.Heading>
			{rows.length ? <BarList items={rows} /> : <Text tone="muted">{t`No data in this period.`}</Text>}
		</Card>
	);
}

type DetailBreakdownProps = { details: StatsDetails };
function DetailBreakdown({ details }: DetailBreakdownProps) {
	const { t, i18n } = useLingui();
	if (details.state !== "ready") {
		const message =
			details.state === "locked"
				? t`Visitor breakdown is available with Plus.`
				: details.state === "not-configured"
					? t`Visitor breakdown isn't configured on this server.`
					: t`Couldn't load the visitor breakdown. Try again later.`;
		return (
			<Text tone="muted" size="sm">
				{message}
			</Text>
		);
	}
	const countryNames =
		typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(i18n.locale, { type: "region" }) : null;
	const devices = { mobile: t`Phones`, tablet: t`Tablets`, desktop: t`Computers` };
	return (
		<>
			<RankCard
				title={t`Countries`}
				items={details.countries.map(({ code, views }) => ({
					key: code,
					label: /^[A-Z]{2}$/.test(code) ? (countryNames?.of(code) ?? code) : code,
					value: views,
				}))}
			/>
			<RankCard
				title={t`Devices`}
				items={details.devices.map(({ device, views }) => ({ key: device, label: devices[device], value: views }))}
			/>
			<RankCard
				title={t`Referring sites`}
				items={details.referrers.map(({ domain, views }) => ({ key: domain, label: domain, value: views }))}
			/>
		</>
	);
}

type WorkStatisticsSheetProps = { work: Work; range: PortfolioStatisticsRange; close: () => void };
function WorkStatisticsSheet({ work, range, close }: WorkStatisticsSheetProps) {
	const { t, i18n } = useLingui();
	const online = useOnline();
	const query = useQuery({
		...orpc.portfolio.workStatistics.queryOptions({ input: { workId: work.id, range } }),
		enabled: online,
	});
	const details = query.data;
	const sources = sourceLabels(t);
	return (
		<Sheet
			isOpen
			onOpenChange={(open) => {
				if (!open) close();
			}}
			title={work.title}
			closeLabel={t`Close`}
			detents={[0.85, 1]}
		>
			<View className="gap-4 pb-4">
				{details ? (
					<>
						<Text weight="semibold">{t`${i18n.number(details.totals.opens)} opens`}</Text>
						<DailyChart
							title={t`Daily work opens`}
							days={details.days.map((day) => ({ date: day.date, value: day.opens }))}
						/>
						{details.details.state === "ready" ? (
							<RankCard
								title={t`Visit sources`}
								items={details.details.sources.map(({ source, views }) => ({
									key: source,
									label: sources[source],
									value: views,
								}))}
							/>
						) : null}
						<DetailBreakdown details={details.details} />
					</>
				) : !online ? (
					<OfflinePortfolioNotice />
				) : query.isError ? (
					<EmptyState
						kind="inline"
						title={t`Couldn't load work statistics`}
						action={{ label: t`Retry`, onPress: () => void query.refetch() }}
					/>
				) : (
					<Spinner />
				)}
			</View>
		</Sheet>
	);
}
