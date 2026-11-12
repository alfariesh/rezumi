import type { PortfolioStatisticsRange } from "@rezumi/schema/portfolio/statistics";
import { KPI } from "@heroui-pro/react/kpi";
import { Button, Modal, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { PORTFOLIO_CLICK_KINDS, PORTFOLIO_DEVICES } from "@rezumi/schema/portfolio/statistics";
import { portfolioErrorMessage } from "../errors";
import { countryNames } from "../location/cities";
import {
	clickLabels,
	DailyBars,
	deviceLabels,
	LockedDetails,
	RankList,
	UnavailableDetails,
	workSourceLabels,
} from "./parts";
import { orpc } from "@/libs/orpc/client";

type WorkStatisticsDialogProps = {
	workId: string;
	/** The title the list showed, until the work's own numbers arrive. */
	title: string;
	range: PortfolioStatisticsRange;
	onClose: () => void;
};

/**
 * One work's numbers for the range (Phase 13 3.7): how often its page was opened, day by day, for every plan; where
 * its visitors came from (the portfolio itself among them), linking sites, countries, devices and the clicks on its
 * page with Plus.
 */
export function WorkStatisticsDialog({ workId, title, range, onClose }: WorkStatisticsDialogProps) {
	const id = useId();
	const { i18n } = useLingui();
	const query = useQuery(orpc.portfolio.workStatistics.queryOptions({ input: { workId, range } }));
	const data = query.data;
	const shownTitle = data?.work.title || title;
	const country = countryNames(i18n.locale);
	const devices = deviceLabels();
	const sources = workSourceLabels();
	const clicks = clickLabels();

	return (
		<Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
			<Modal.Container size="lg" scroll="inside">
				<Modal.Dialog aria-labelledby={`${id}-title`}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading id={`${id}-title`} className="wrap-anywhere">
							{shownTitle}
						</Modal.Heading>
						<p className="text-body-sm text-muted">
							<Trans>This work's page over the last {range} days.</Trans>
						</p>
					</Modal.Header>
					<Modal.Body className="@container grid gap-5">
						{query.isPending ? (
							<div className="grid place-items-center py-10">
								<Spinner size="md" color="current" />
							</div>
						) : query.isError || !data ? (
							<div className="flex flex-wrap items-center gap-3" role="alert">
								<p className="min-w-0 flex-1 text-body-sm text-muted">
									{portfolioErrorMessage(query.error, {
										fallback: t`This work's numbers couldn't be loaded.`,
										byCode: { NOT_IMPLEMENTED: t`A work's own numbers aren't available yet.` },
									})}
								</p>
								<Button
									size="sm"
									variant="secondary"
									isPending={query.isRefetching}
									onPress={() => void query.refetch()}
								>
									<Trans>Try again</Trans>
								</Button>
							</div>
						) : (
							<>
								<KPI>
									<KPI.Header>
										<KPI.Title>
											<Trans>Times opened</Trans>
										</KPI.Title>
									</KPI.Header>
									<KPI.Content>
										<KPI.Value maximumFractionDigits={0} value={data.totals.opens} />
									</KPI.Content>
								</KPI>
								<DailyBars
									days={data.days.map((day) => ({ date: day.date, value: day.opens }))}
									describe={(label, opens) => t`${label}: opened ${opens} times`}
									summary={(days, peak) => t`Times opened per day over ${days} days, peak ${peak}`}
									caption={<Trans>Times opened per day</Trans>}
								/>
								{data.details.state === "ready" && (
									<div className="grid gap-6 border-t border-border pt-4 @md:grid-cols-2">
										<RankList
											title={<Trans>Sources</Trans>}
											rows={data.details.sources.map((row) => ({
												key: row.source,
												label: sources[row.source],
												value: row.views,
											}))}
											empty={<Trans>No visits yet.</Trans>}
										/>
										<RankList
											title={<Trans>Sites that link to you</Trans>}
											rows={data.details.referrers.map((row) => ({
												key: row.domain,
												label: row.domain,
												value: row.views,
											}))}
											empty={<Trans>No links from other sites yet.</Trans>}
										/>
										<RankList
											title={<Trans>Countries</Trans>}
											rows={data.details.countries.map((row) => ({
												key: row.code,
												label: country(row.code),
												value: row.views,
											}))}
											empty={<Trans>No visits yet.</Trans>}
										/>
										<RankList
											title={<Trans>Devices</Trans>}
											rows={PORTFOLIO_DEVICES.map((device) => {
												const details = data.details.state === "ready" ? data.details : null;
												return {
													key: device,
													label: devices[device],
													value: details?.devices.find((row) => row.device === device)?.views ?? 0,
												};
											})}
											empty={<Trans>No visits yet.</Trans>}
										/>
										<RankList
											title={<Trans>Clicks on this page</Trans>}
											rows={PORTFOLIO_CLICK_KINDS.map((kind) => ({
												key: kind,
												label: clicks[kind],
												value: data.details.state === "ready" ? data.details.clicks[kind] : 0,
											}))}
											empty={<Trans>No clicks yet.</Trans>}
										/>
									</div>
								)}
								{data.details.state === "locked" && <LockedDetails />}
								{data.details.state === "unavailable" && <UnavailableDetails />}
							</>
						)}
					</Modal.Body>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
