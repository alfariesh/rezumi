import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { routes } from "@/routes";
import { EmptyState, Icon, Screen, Spinner, Text, TopBar } from "@/ui";

type PortfolioPageProps = { title: string; children: ReactNode; actions?: ReactNode };
export function PortfolioPage({ title, actions, children }: PortfolioPageProps) {
	const { t } = useLingui();
	const router = useRouter();
	return (
		<View className="flex-1 bg-background">
			<TopBar
				title={title}
				back={{
					label: t`Back`,
					onPress: () => (router.canGoBack() ? router.back() : router.replace(routes.portfolio())),
				}}
				actions={actions}
			/>
			{children}
		</View>
	);
}

type LoadStateProps = { offline?: boolean | undefined; error?: boolean | undefined; retry?: (() => void) | undefined };
export function PortfolioLoadState({ offline, error, retry }: LoadStateProps) {
	const { t } = useLingui();
	return (
		<Screen>
			{offline ? (
				<EmptyState
					kind="page"
					icon="cloud-slash"
					title={t`You're offline`}
					description={t`Connect to load your portfolio.`}
				/>
			) : error ? (
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`Couldn't load your portfolio`}
					action={retry ? { label: t`Retry`, onPress: retry } : undefined}
				/>
			) : (
				<View className="min-h-20 items-center justify-center" accessibilityLabel={t`Loading portfolio`}>
					<Spinner />
				</View>
			)}
		</Screen>
	);
}

export function OfflinePortfolioNotice() {
	const { t } = useLingui();
	return (
		<View className="flex-row items-center gap-2">
			<Icon name="cloud-slash" tone="muted" />
			<Text tone="muted">{t`You're offline`}</Text>
		</View>
	);
}
