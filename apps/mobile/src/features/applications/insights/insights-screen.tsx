// Insights, a section of Applications (plans/mobile Phase 10; the web's insights-view.tsx): how far applications get,
// how often and how fast people reply, tailored against base resume, applications per week, sources, and where the
// active ones went. Everything is worked out on the device from the applications list (@rezumi/career/insights).
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { FunnelCard, SourcesCard, TailoredCard, WeeklyCard } from "./insights-cards";
import { PipelineFlow } from "./pipeline-flow";
import { ReplyFigures } from "./reply-figures";
import { useInsights } from "./use-insights";
import { ApplicationsViewsRow } from "@/features/applications/views-row";
import { routes } from "@/routes";
import { TabTopBar } from "@/shell/tab-chrome";
import { useIsTablet } from "@/shell/use-is-tablet";
import { Alert, Button, EmptyState, Screen, Skeleton } from "@/ui";

export function InsightsScreen() {
	const { t } = useLingui();
	return (
		<View className="flex-1 bg-background">
			<TabTopBar title={t`Applications`} />
			<ApplicationsViewsRow current="insights" />
			<InsightsBody />
		</View>
	);
}

export function InsightsBody() {
	const { t } = useLingui();
	const router = useRouter();
	const tablet = useIsTablet();
	const insights = useInsights();
	const { applications, figures, online, locale } = insights;

	if (!figures) {
		if (applications.isError)
			return (
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`Couldn't load your applications`}
					description={t`Check your connection and try again.`}
					action={{ label: t`Retry`, onPress: () => void insights.refetch() }}
				/>
			);
		if (!online)
			return (
				<EmptyState
					kind="page"
					icon="cloud-slash"
					title={t`You're offline`}
					description={t`Insights show here once your applications have loaded.`}
				/>
			);
		return <InsightsSkeleton />;
	}

	if (figures.outcomes.sent === 0)
		return (
			<Screen onRefresh={insights.refetch}>
				<EmptyState
					kind="page"
					icon="chart-line-up"
					title={t`Nothing to measure yet`}
					description={t`Once you've sent a few applications, this shows how far they get and how quickly people reply.`}
					action={{ label: t`Open applications`, onPress: () => router.replace(routes.applications("list")) }}
				/>
			</Screen>
		);

	const half = tablet ? "flex-1" : undefined;
	return (
		<Screen onRefresh={insights.refetch} testID="insights">
			{applications.isError ? (
				<Alert status="warning">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Description>{t`Couldn't refresh. These figures are from the last update.`}</Alert.Description>
					</Alert.Content>
					<Button size="sm" variant="secondary" onPress={() => void insights.refetch()}>
						<Button.Label>{t`Retry`}</Button.Label>
					</Button>
				</Alert>
			) : null}
			<ReplyFigures outcomes={figures.outcomes} locale={locale} />
			{insights.knowsTailored ? <TailoredCard outcomes={figures.outcomes} /> : null}
			<FunnelCard outcomes={figures.outcomes} />
			<View className={tablet ? "flex-row items-start gap-4" : "gap-4"}>
				<WeeklyCard timeline={figures.timeline} locale={locale} className={half} />
				<SourcesCard sources={figures.sources} className={half} />
			</View>
			<PipelineFlow {...figures.pipeline} />
		</Screen>
	);
}

/** The figures, the funnel and the chart in their final shape. */
function InsightsSkeleton() {
	const { t } = useLingui();
	return (
		<View accessible accessibilityLabel={t`Loading insights`} className="gap-4 p-4" testID="insights-loading">
			<View className="flex-row gap-4">
				<Skeleton variant="none" className="h-24 flex-1 rounded-2xl" />
				<Skeleton variant="none" className="h-24 flex-1 rounded-2xl" />
			</View>
			<Skeleton variant="none" className="h-44 rounded-2xl" />
			<Skeleton variant="none" className="h-64 rounded-2xl" />
		</View>
	);
}
