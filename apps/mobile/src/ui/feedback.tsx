// Feedback: what a screen shows while it loads, when it is empty and when something needs attention. HeroUI's Alert
// (the banner: offline, locked, a failed save), Skeleton and Spinner as shipped, Pro's ProgressBar, and EmptyState on
// Pro's empty-state with the web's three kinds (apps/web/src/components/layout/empty-block.tsx).
import type { IconName } from "./icon";
import type { ProgressBarRootProps } from "heroui-native-pro/progress-bar";
import { Button, Typography } from "heroui-native";
import { EmptyState as ProEmptyState } from "heroui-native-pro/empty-state";
import { ProgressBar as ProProgressBar } from "heroui-native-pro/progress-bar";
import { View } from "react-native";
import { cx } from "./cx";
import { Icon } from "./icon";
import { size } from "./tokens";

export { Alert, Skeleton, SkeletonGroup, Spinner } from "heroui-native";

export type ProgressBarProps = Omit<ProgressBarRootProps, "accessibilityLabel"> & {
	/** What is progressing ("Uploading resume", "Step 2 of 4"); read with the value. */
	accessibilityLabel: string;
};

/**
 * Pro's ProgressBar as one screen-reader element with a required label. With no children it draws the track and fill;
 * a string child adds the label and the value above the track; compound parts (`ProgressBar.Track`, `.Fill`, `.Label`,
 * `.ValueLabel`) compose anything else.
 */
function ProgressBarRoot({ children, ...props }: ProgressBarProps) {
	return (
		<ProProgressBar accessible {...props}>
			{children ?? (
				<ProProgressBar.Track>
					<ProProgressBar.Fill />
				</ProProgressBar.Track>
			)}
		</ProProgressBar>
	);
}

export const ProgressBar = Object.assign(ProgressBarRoot, {
	Track: ProProgressBar.Track,
	TrackBackground: ProProgressBar.TrackBackground,
	Fill: ProProgressBar.Fill,
	Label: ProProgressBar.Label,
	ValueLabel: ProProgressBar.ValueLabel,
});

export type EmptyStateAction = { label: string; onPress: () => void };

/**
 * - `page`: a screen or list with nothing in it yet. An icon, a title naming what goes here, one sentence on what it is
 *   for, and the action that adds the first one. A failed load uses it too: a warning icon, what went wrong, Retry.
 * - `filtered`: a search or filter that matched nothing. Say what was searched, and offer to clear it.
 * - `inline`: a small part of a screen (a card, a sheet) with nothing to show. One line, an optional small action, no
 *   big icon.
 */
export type EmptyStateKind = "page" | "filtered" | "inline";

export type EmptyStateProps = {
	kind: EmptyStateKind;
	/** `page` should have one; `filtered` defaults to the magnifying glass; `inline` has none. */
	icon?: IconName | undefined;
	/** Names what goes here. Never restates the screen title. */
	title: string;
	/** One sentence, ending with a full stop. */
	description?: string | undefined;
	/** `page`: adds the first item (primary). `filtered`: clears the search. `inline`: a small quiet action. */
	action?: EmptyStateAction | undefined;
	/** Only when it helps (for example "Import" beside "New resume"). Ignored for `inline`. */
	secondaryAction?: EmptyStateAction | undefined;
	className?: string | undefined;
};

/** The one empty state the app uses, so every empty list, search and card looks and reads the same. */
export function EmptyState({ kind, icon, title, description, action, secondaryAction, className }: EmptyStateProps) {
	if (kind === "inline")
		return (
			<View
				className={cx(
					"flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-dashed border-border px-4 py-3.5",
					className,
				)}
			>
				<View className="min-w-0 flex-1 gap-0.5">
					<Typography.Heading type="h6">{title}</Typography.Heading>
					{description ? (
						<Typography type="body-sm" color="muted">
							{description}
						</Typography>
					) : null}
				</View>
				{action ? (
					<Button size="sm" variant="tertiary" onPress={action.onPress}>
						{action.label}
					</Button>
				) : null}
			</View>
		);

	const media = icon ?? (kind === "filtered" ? "magnifying-glass" : undefined);
	return (
		<ProEmptyState className={cx("gap-6", kind === "page" ? "py-16" : "py-12", className)}>
			<ProEmptyState.Header>
				{media ? (
					<ProEmptyState.Media variant="icon">
						<Icon name={media} size={size.icon.lg} />
					</ProEmptyState.Media>
				) : null}
				<ProEmptyState.Title>{title}</ProEmptyState.Title>
				{description ? <ProEmptyState.Description className="max-w-sm">{description}</ProEmptyState.Description> : null}
			</ProEmptyState.Header>
			{action || secondaryAction ? (
				// Side by side, wrapping only when the row runs out of room.
				<ProEmptyState.Content className="flex-row flex-wrap justify-center">
					{action ? (
						<Button variant={kind === "page" ? "primary" : "secondary"} onPress={action.onPress}>
							{action.label}
						</Button>
					) : null}
					{secondaryAction ? (
						<Button variant={kind === "page" ? "secondary" : "ghost"} onPress={secondaryAction.onPress}>
							{secondaryAction.label}
						</Button>
					) : null}
				</ProEmptyState.Content>
			) : null}
		</ProEmptyState>
	);
}
