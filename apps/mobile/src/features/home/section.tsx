// A Home block: an icon and title (with a count when something waits), an optional action at the end, the content
// in a card. Its own error and loading shapes, so one failed read never blanks the page.
import type { IconName } from "@/ui";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Card, EmptyState, Icon, Skeleton, Text, Typography } from "@/ui";

type HomeSectionProps = {
	title: string;
	icon: IconName;
	count?: number | undefined;
	trailing?: ReactNode;
	children: ReactNode;
	testID?: string | undefined;
};

export function HomeSection({ title, icon, count, trailing, children, testID }: HomeSectionProps) {
	return (
		<View className="gap-2" testID={testID}>
			<View className="min-h-11 flex-row items-center gap-2">
				<Icon name={icon} size={20} tone="muted" />
				<Typography.Heading type="h6" accessibilityRole="header" numberOfLines={1} className="shrink">
					{title}
				</Typography.Heading>
				{count ? (
					<View className="h-5 min-w-5 items-center justify-center rounded-full bg-default px-1.5">
						<Text size="xs" weight="semibold" tabular>
							{String(count)}
						</Text>
					</View>
				) : null}
				<View className="flex-1" />
				{trailing}
			</View>
			<Card className="gap-3">{children}</Card>
		</View>
	);
}

type LoadErrorProps = { onRetry: () => void };

export function LoadError({ onRetry }: LoadErrorProps) {
	const { t } = useLingui();
	return (
		<EmptyState
			kind="inline"
			title={t`Couldn't load this. Check your connection.`}
			action={{ label: t`Retry`, onPress: onRetry }}
		/>
	);
}

type RowsSkeletonProps = { rows?: number };

/** Rows in the shape of the content: a tile and two lines each. */
export function RowsSkeleton({ rows = 2 }: RowsSkeletonProps) {
	const { t } = useLingui();
	return (
		<View accessibilityLabel={t`Loading`} accessibilityRole="progressbar" className="gap-4">
			{Array.from({ length: rows }, (_, index) => (
				<View key={index} className="flex-row gap-3">
					<Skeleton variant="none" className="size-10 rounded-xl" />
					<View className="flex-1 gap-2 pt-1">
						<Skeleton variant="none" className="h-3.5 w-2/3 rounded-md" />
						<Skeleton variant="none" className="h-3 w-full rounded-md" />
					</View>
				</View>
			))}
		</View>
	);
}

type RowTileProps = { children: ReactNode };

/** The 40 pt tile beside a row (a notification's kind, a company initial). */
export function RowTile({ children }: RowTileProps) {
	return <View className="size-10 items-center justify-center rounded-xl bg-surface-secondary">{children}</View>;
}
