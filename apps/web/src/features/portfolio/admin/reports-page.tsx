import type { PortfolioReportStatus } from "@rezumi/schema/portfolio/moderation";
import { Segment } from "@heroui-pro/react";
import { Button, Chip, SearchField, Spinner, Table, Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@rezumi/ui/components/toast";
import { formatModerationTime, reportReasonLabel, reportStatusColor, reportStatusLabel } from "./labels";
import { AdminCard } from "@/features/billing/admin/parts";
import { portfolioErrorMessage } from "@/features/portfolio/errors";
import { client, orpc } from "@/libs/orpc/client";
import { renderAsH1 } from "@/libs/typography";

type StatusFilter = PortfolioReportStatus | "all";

type PortfolioReportsPageProps = { status: StatusFilter };

/** Reports visitors sent about portfolios, and a way to find any portfolio to act on it. */
export function PortfolioReportsPage({ status }: PortfolioReportsPageProps) {
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [finding, setFinding] = useState(false);
	const reports = useInfiniteQuery(
		orpc.portfolio.admin.reports.infiniteOptions({
			input: (cursor: string | undefined) => ({ status: status === "all" ? undefined : status, cursor }),
			initialPageParam: undefined,
			getNextPageParam: (page) => page.nextCursor ?? undefined,
		}),
	);
	const items = reports.data?.pages.flatMap((page) => page.items) ?? [];
	const open = reports.data?.pages[0]?.open ?? 0;

	const find = async () => {
		if (!query.trim()) return;
		setFinding(true);
		try {
			const { portfolioId } = await client.portfolio.admin.find({ query: query.trim() });
			await navigate({ to: "/dashboard/admin/portfolios/$portfolioId", params: { portfolioId } });
		} catch (error) {
			toast.add({
				type: "error",
				description: portfolioErrorMessage(error, { fallback: t`No portfolio matches that.` }),
			});
		} finally {
			setFinding(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="grid min-w-0 gap-1">
					<Typography type="h2" render={renderAsH1}>
						<Trans>Portfolio reports</Trans>
					</Typography>
					<p className="text-sm text-muted">
						<Trans>{open} open. The portfolio's owner never sees who sent a report.</Trans>
					</p>
				</div>
				<form
					className="flex items-center gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						void find();
					}}
				>
					<SearchField aria-label={t`Username or email`} value={query} onChange={setQuery} variant="secondary">
						<SearchField.Group>
							<SearchField.SearchIcon />
							<SearchField.Input placeholder={t`Username or email`} className="w-56" />
							<SearchField.ClearButton />
						</SearchField.Group>
					</SearchField>
					<Button type="submit" variant="secondary" isPending={finding} isDisabled={!query.trim()}>
						<Trans>Find portfolio</Trans>
					</Button>
				</form>
			</header>

			<Segment
				aria-label={t`Report status`}
				selectedKey={status}
				onSelectionChange={(key) =>
					void navigate({ to: "/dashboard/admin/portfolios", search: { status: key as StatusFilter } })
				}
				className="w-fit"
			>
				<Segment.Item id="open">
					<Trans>Open</Trans>
				</Segment.Item>
				<Segment.Item id="actioned">
					<Trans>Acted on</Trans>
				</Segment.Item>
				<Segment.Item id="dismissed">
					<Trans>Dismissed</Trans>
				</Segment.Item>
				<Segment.Item id="all">
					<Trans>All</Trans>
				</Segment.Item>
			</Segment>

			<AdminCard plain title={<Trans>Reports</Trans>}>
				{reports.isPending ? (
					<Spinner size="sm" />
				) : reports.isError ? (
					<p className="text-sm text-danger" role="alert">
						{portfolioErrorMessage(reports.error, { fallback: t`Couldn't load the reports. Try again.` })}
					</p>
				) : items.length === 0 ? (
					<p className="text-sm text-muted">
						<Trans>No reports here.</Trans>
					</p>
				) : (
					<Table variant="secondary">
						<Table.ScrollContainer>
							<Table.Content aria-label={t`Reports`} className="text-sm">
								<Table.Header>
									<Table.Column isRowHeader>{t`Portfolio`}</Table.Column>
									<Table.Column>{t`Reason`}</Table.Column>
									<Table.Column>{t`Details`}</Table.Column>
									<Table.Column>{t`Received`}</Table.Column>
									<Table.Column>{t`Status`}</Table.Column>
								</Table.Header>
								<Table.Body>
									{items.map((report) => (
										<Table.Row key={report.id} id={report.id}>
											<Table.Cell>
												<Link
													to="/dashboard/admin/portfolios/$portfolioId"
													params={{ portfolioId: report.portfolioId }}
													className="font-medium text-accent hover:underline"
												>
													@{report.username}
												</Link>
												{report.suspendedAt && (
													<Chip size="sm" color="danger" variant="soft" className="ms-2">
														<Chip.Label>
															<Trans>Taken down</Trans>
														</Chip.Label>
													</Chip>
												)}
											</Table.Cell>
											<Table.Cell className="whitespace-nowrap">{reportReasonLabel(report.reason)}</Table.Cell>
											<Table.Cell className="max-w-96 truncate text-muted">{report.details}</Table.Cell>
											<Table.Cell className="whitespace-nowrap text-muted">
												{formatModerationTime(report.createdAt)}
											</Table.Cell>
											<Table.Cell>
												<Chip size="sm" variant="soft" color={reportStatusColor(report.status)}>
													<Chip.Label>{reportStatusLabel(report.status)}</Chip.Label>
												</Chip>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
				)}
				{reports.hasNextPage && (
					<Button
						className="w-fit"
						variant="secondary"
						isPending={reports.isFetchingNextPage}
						onPress={() => void reports.fetchNextPage()}
					>
						<Trans>Load more</Trans>
					</Button>
				)}
			</AdminCard>
		</div>
	);
}
