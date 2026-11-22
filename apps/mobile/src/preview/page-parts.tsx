// The controls around the rendered resume pages: notices, the zoom bar (with full screen), the selected entry's bar
// and the "runs onto another page" card with Fit. Shared by the Page pane, the tablet page and the full-screen view.
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Alert, Button, IconButton, Text } from "@/ui";

type PageNoticeProps = { status: "warning" | "danger"; message: string; onRetry?: (() => void) | undefined };

export function PageNotice({ status, message, onRetry }: PageNoticeProps) {
	const { t } = useLingui();
	return (
		<View className="gap-2 px-4 pt-3">
			<Alert status={status}>
				<Alert.Indicator />
				<Alert.Content>
					<Alert.Description>{message}</Alert.Description>
				</Alert.Content>
			</Alert>
			{onRetry ? (
				<Button size="sm" variant="secondary" className="self-start" onPress={onRetry}>
					{t`Retry`}
				</Button>
			) : null}
		</View>
	);
}

type ZoomBarProps = {
	zoom: number | null;
	onStep: (delta: number) => void;
	onReset: () => void;
	currentPage: number;
	pageCount: number;
	/** Opens the pages full screen; leaves full screen when `fullScreen` is set. */
	onFullScreen?: (() => void) | undefined;
	fullScreen?: boolean | undefined;
};

export function ZoomBar({ zoom, onStep, onReset, currentPage, pageCount, onFullScreen, fullScreen }: ZoomBarProps) {
	const { t } = useLingui();
	return (
		<View className="flex-row items-center justify-between border-t border-separator bg-surface px-2 py-1">
			<View className="flex-row items-center">
				<IconButton icon="minus" label={t`Zoom out`} isDisabled={(zoom ?? 1) <= 0.6} onPress={() => onStep(-0.1)} />
				<Button variant="ghost" size="sm" onPress={onReset} accessibilityLabel={t`Fit to width`}>
					{zoom === null ? t`Fit` : t`${Math.round(zoom * 100)}%`}
				</Button>
				<IconButton icon="plus" label={t`Zoom in`} isDisabled={(zoom ?? 1) >= 1.5} onPress={() => onStep(0.1)} />
			</View>
			<Text size="xs" tone="muted" accessibilityLiveRegion="polite" tabular>
				{t`Page ${currentPage} of ${pageCount}`}
			</Text>
			{onFullScreen ? (
				<IconButton
					icon={fullScreen ? "arrows-in-simple" : "arrows-out-simple"}
					label={fullScreen ? t`Exit full screen` : t`Full screen`}
					onPress={onFullScreen}
					testID="page-full-screen"
				/>
			) : (
				<View className="w-11" />
			)}
		</View>
	);
}

type SelectionBarProps = { header: boolean; onEdit: () => void; onClear: () => void };

/** After a tap on the page: what was picked, Edit (opens the entry in Write) and Clear. */
export function SelectionBar({ header, onEdit, onClear }: SelectionBarProps) {
	const { t } = useLingui();
	return (
		<View className="flex-row items-center gap-2 border-t border-separator bg-surface px-4 py-1">
			<Text className="flex-1" numberOfLines={1} weight="medium">
				{header ? t`Basics` : t`Selected entry`}
			</Text>
			<Button variant="secondary" size="sm" onPress={onEdit}>
				{t`Edit entry`}
			</Button>
			<IconButton icon="x" label={t`Clear selection`} onPress={onClear} />
		</View>
	);
}

type OverflowCardProps = {
	authored: number;
	disabled: boolean;
	fitting: boolean;
	onFit: () => void;
	maxWidth: number;
};

/** On page 1 when the content runs past the pages the resume is laid out for. */
export function OverflowCard({ authored, disabled, fitting, onFit, maxWidth }: OverflowCardProps) {
	const { t } = useLingui();
	const width = { maxWidth };
	return (
		<View className="gap-2" style={width}>
			<Text size="sm" tone="warning" weight="medium">{t`Runs onto page ${authored + 1}`}</Text>
			<Button variant="secondary" size="sm" isDisabled={disabled || fitting} onPress={onFit} className="self-start">
				{fitting ? t`Fitting…` : plural(authored, { 1: "Fit to one page", other: "Fit to # pages" })}
			</Button>
		</View>
	);
}
