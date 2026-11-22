// The List's states besides its rows: the loading shape, a failed load, the first visit, a search or filter that
// matched nothing, everything closed, and banners for a failed refresh and for offline (the last list stays).
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Alert, Button, EmptyState, Skeleton } from "@/ui";

export function ListSkeleton() {
	const { t } = useLingui();
	return (
		<View
			accessibilityLabel={t`Loading`}
			accessibilityRole="progressbar"
			className="gap-2"
			testID="applications-loading"
		>
			<Skeleton variant="none" className="mt-4 h-4 w-28 rounded-md" />
			{Array.from({ length: 6 }, (_, index) => (
				<View key={index} className="gap-2 rounded-2xl bg-surface px-4 py-3">
					<Skeleton variant="none" className="h-4 w-2/3 rounded-md" />
					<Skeleton variant="none" className="h-3 w-1/2 rounded-md" />
					<Skeleton variant="none" className="h-3 w-2/5 rounded-md" />
				</View>
			))}
		</View>
	);
}

type RetryProps = { onRetry: () => void };

export function ListLoadFailed({ onRetry }: RetryProps) {
	const { t } = useLingui();
	return (
		<EmptyState
			kind="page"
			icon="warning-circle"
			title={t`Couldn't load your applications`}
			description={t`Check your connection and try again.`}
			action={{ label: t`Try again`, onPress: onRetry }}
		/>
	);
}

type FirstRunProps = { onSaveJob: () => void };

export function ListFirstRun({ onSaveJob }: FirstRunProps) {
	const { t } = useLingui();
	return (
		<EmptyState
			kind="page"
			icon="briefcase"
			title={t`Your job search starts here`}
			description={t`Save a job link, paste a posting, or fill in the details by hand.`}
			action={{ label: t`Save a job`, onPress: onSaveJob }}
		/>
	);
}

type NoMatchesProps = { search: string; onClear: () => void };

export function ListNoMatches({ search, onClear }: NoMatchesProps) {
	const { t } = useLingui();
	const query = search.trim();
	return (
		<EmptyState
			kind="filtered"
			icon="magnifying-glass"
			title={query ? t`No applications match “${query}”` : t`No applications match these filters`}
			description={t`Try other words, or clear the filters.`}
			action={{ label: t`Clear filters`, onPress: onClear }}
		/>
	);
}

type AllClosedProps = { onShowClosed: () => void };

export function ListAllClosed({ onShowClosed }: AllClosedProps) {
	const { t } = useLingui();
	return (
		<EmptyState
			kind="filtered"
			icon="check-circle"
			title={t`All your applications are closed`}
			description={t`Show closed applications to see your past job searches.`}
			action={{ label: t`Show closed`, onPress: onShowClosed }}
		/>
	);
}

export function RefreshFailed({ onRetry }: RetryProps) {
	const { t } = useLingui();
	return (
		<Alert status="warning">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Title>{t`Couldn't refresh your applications.`}</Alert.Title>
				<Alert.Description>{t`Showing the last list on this device.`}</Alert.Description>
			</Alert.Content>
			<Button size="sm" variant="secondary" onPress={onRetry}>
				<Button.Label>{t`Retry`}</Button.Label>
			</Button>
		</Alert>
	);
}

export function OfflineNotice() {
	const { t } = useLingui();
	return (
		<Alert status="default" testID="applications-offline">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Title>{t`You're offline`}</Alert.Title>
				<Alert.Description>{t`Showing the last list on this device. Changes wait until you're back online.`}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}
