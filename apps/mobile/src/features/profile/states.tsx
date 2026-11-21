// The Profile editor's loading and failed-load states, in the shape of what they stand in for.
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { EmptyState, Screen, Skeleton } from "@/ui";

export function ProfileSkeleton() {
	return (
		<Screen scroll={false} testID="profile-loading">
			<Skeleton variant="none" className="h-4 w-48 rounded-md" />
			<Skeleton variant="none" className="h-24 rounded-3xl" />
			<View className="gap-3">
				<Skeleton variant="none" className="h-72 rounded-3xl" />
			</View>
		</Screen>
	);
}

type ProfileLoadErrorProps = { onRetry: () => void };

export function ProfileLoadError({ onRetry }: ProfileLoadErrorProps) {
	const { t } = useLingui();
	return (
		<Screen>
			<EmptyState
				kind="page"
				icon="warning-circle"
				title={t`Couldn't load your Profile`}
				description={t`Check your connection, then try again.`}
				action={{ label: t`Try again`, onPress: onRetry }}
			/>
		</Screen>
	);
}
