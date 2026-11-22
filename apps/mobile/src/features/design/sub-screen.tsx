// The frame of Design's pushed screens (Typography, Colors and levels, Page, Layout): the native header's title, the
// loading, failed and locked states, and the content once the resume is there.
import type { DesignProps } from "./types";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Stack } from "expo-router";
import { View } from "react-native";
import { designWrite, useDesignDraft } from "./draft";
import { LockedNotice } from "./locked-notice";
import { EmptyState, Screen, Skeleton, SkeletonGroup, cx } from "@/ui";

type DesignSubScreenProps = {
	id: string;
	title: string;
	children: (props: DesignProps) => ReactNode;
	/** Content that scrolls itself (Layout, which stops scrolling while a section is dragged). */
	scroll?: boolean | undefined;
};

export function DesignSubScreen({ id, title, children, scroll = true }: DesignSubScreenProps) {
	const { t } = useLingui();
	const draft = useDesignDraft(id);
	const { data, locked } = draft;
	const header = <Stack.Screen options={{ title }} />;

	if (!data)
		return (
			<Screen>
				{header}
				{draft.status === "error" ? (
					<EmptyState
						kind="page"
						icon="warning-circle"
						title={t`Couldn't load the resume.`}
						action={{ label: t`Retry`, onPress: () => void draft.open(id).catch(() => undefined) }}
					/>
				) : (
					<SkeletonGroup isLoading variant="none" className="gap-3" accessibilityLabel={t`Loading`}>
						<Skeleton className="h-12 w-full rounded-xl" />
						<Skeleton className="h-12 w-full rounded-xl" />
						<Skeleton className="h-12 w-2/3 rounded-xl" />
					</SkeletonGroup>
				)}
			</Screen>
		);

	const content = children({ data, write: designWrite, disabled: locked });
	return (
		<Screen scroll={scroll} bare={!scroll}>
			{header}
			{locked ? (
				<View className={cx(!scroll && "px-4 pt-4")}>
					<LockedNotice id={id} />
				</View>
			) : null}
			{scroll ? <View className={cx("gap-4", locked && "opacity-60")}>{content}</View> : content}
		</Screen>
	);
}
