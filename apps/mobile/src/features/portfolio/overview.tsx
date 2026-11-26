import type { Portfolio } from "./queries";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { Share, View } from "react-native";
import { OfflinePortfolioNotice, PortfolioLoadState } from "./layout";
import { openPortfolioLink, setPublished, usePortfolio, usePortfolioAction, usePortfolioAddress } from "./queries";
import { orpc } from "@/api/client";
import { useOnline } from "@/api/online";
import { routes } from "@/routes";
import { TabTopBar } from "@/shell/tab-chrome";
import { Button, Card, Chip, EmptyState, ListRow, ListSection, Screen, Text, Typography, showToast } from "@/ui";

export function PortfolioScreen() {
	const { t } = useLingui();
	const router = useRouter();
	const online = useOnline();
	const query = usePortfolio();
	const data = query.data;
	return (
		<View className="flex-1 bg-background">
			<TabTopBar title={t`Portfolio`} />
			{!data ? (
				<PortfolioLoadState offline={!online} error={query.isError} retry={() => void query.refetch()} />
			) : !data.enabled || !data.portfolio ? (
				<Screen onRefresh={query.refetch}>
					{data.enabled ? (
						<EmptyState
							kind="page"
							icon="globe-hemisphere-west"
							title={t`Create your portfolio`}
							description={t`Show your work on a personal page you can share.`}
							action={
								online
									? { label: t`Create portfolio`, onPress: () => router.push(routes.portfolio("create")) }
									: undefined
							}
						/>
					) : (
						<EmptyState kind="page" title={t`Portfolios aren't available for this account.`} />
					)}
				</Screen>
			) : (
				<PortfolioOverview portfolio={data.portfolio} refresh={query.refetch} />
			)}
		</View>
	);
}

type OverviewProps = { portfolio: Portfolio; refresh: () => Promise<unknown> };

function PortfolioOverview({ portfolio, refresh }: OverviewProps) {
	const { t, i18n } = useLingui();
	const router = useRouter();
	const online = useOnline();
	const { url, server, live } = usePortfolioAddress(portfolio);
	const action = usePortfolioAction();
	const stats = useQuery({ ...orpc.portfolio.statistics.queryOptions(), enabled: online });
	const messages = useQuery({ ...orpc.portfolio.messages.list.queryOptions({ input: { limit: 1 } }), enabled: online });
	const unread = messages.data?.unread;
	const shareReady = live && Boolean(url);

	const copy = async () => {
		try {
			await Clipboard.setStringAsync(url);
			showToast({ title: t`Link copied` });
		} catch {
			showToast({ title: t`Couldn't copy the link.`, variant: "danger" });
		}
	};
	return (
		<Screen testID="portfolio-overview" onRefresh={() => Promise.all([refresh(), stats.refetch(), messages.refetch()])}>
			{online ? null : <OfflinePortfolioNotice />}
			<Card className="gap-4">
				<View className="flex-row flex-wrap items-center justify-between gap-2">
					<Typography.Heading type="h5">{t`Your website`}</Typography.Heading>
					<Chip color={live ? "success" : portfolio.suspendedAt ? "danger" : "default"} size="sm">
						<Chip.Label>{portfolio.suspendedAt ? t`Taken down` : live ? t`Published` : t`Draft`}</Chip.Label>
					</Chip>
				</View>
				{url ? (
					<Text mono selectable testID="portfolio-address">
						{url}
					</Text>
				) : null}
				{live ? (
					<View className="flex-row flex-wrap gap-2">
						<Button variant="secondary" isDisabled={!shareReady} onPress={() => void copy()}>{t`Copy link`}</Button>
						<Button
							variant="secondary"
							isDisabled={!shareReady}
							onPress={() =>
								void Share.share({ message: url }).catch(() =>
									showToast({ title: t`Couldn't share the link.`, variant: "danger" }),
								)
							}
						>{t`Share link`}</Button>
					</View>
				) : !portfolio.suspendedAt ? (
					<Button
						testID="portfolio-publish"
						isDisabled={!online || action.isPending || !url}
						onPress={() => action.mutate(setPublished(true))}
					>
						{t`Publish portfolio`}
					</Button>
				) : null}
				<View className="flex-row flex-wrap gap-2">
					<Button
						testID="portfolio-preview"
						variant="secondary"
						isDisabled={!online}
						onPress={() => router.push(routes.portfolio("preview"))}
					>{t`Preview`}</Button>
					<Button
						variant="secondary"
						isDisabled={!online}
						onPress={() => void openPortfolioLink(`${server}/builder/portfolio`)}
					>{t`Edit on the web`}</Button>
				</View>
			</Card>
			<ListSection>
				<ListRow
					title={t`Publishing settings`}
					icon="globe-hemisphere-west"
					onPress={() => router.push(routes.portfolio("publish"))}
				/>
				<ListRow
					title={t`Business card`}
					description={live ? undefined : t`Publish to share your QR code.`}
					icon="qr-code"
					isDisabled={!shareReady}
					onPress={() => router.push(routes.portfolio("card"))}
				/>
				<ListRow
					title={t`Visitor statistics`}
					icon="chart-line-up"
					description={stats.data ? t`${i18n.number(stats.data.totals.views)} views in 30 days` : undefined}
					onPress={() => router.push(routes.portfolio("statistics"))}
				/>
				<ListRow
					title={t`Inbox`}
					icon="envelope"
					description={
						unread === undefined ? undefined : plural(unread, { one: "# unread message", other: "# unread messages" })
					}
					onPress={() => router.push(routes.portfolio("messages"))}
				/>
			</ListSection>
		</Screen>
	);
}
