import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { IconButton, Text } from "@/ui";

type PanelBarProps = {
	title: string;
	subtitle?: ReactNode;
	onNew: () => void;
	onHistory: () => void;
	showHistory: boolean;
	onClose: () => void;
	expand?: { expanded: boolean; onPress: () => void } | undefined;
};

export function PanelBar({ title, subtitle, onNew, onHistory, showHistory, onClose, expand }: PanelBarProps) {
	const { t } = useLingui();
	return (
		<View className="border-b border-separator bg-surface px-3 pb-2">
			<View className="min-h-12 flex-row items-center">
				<Text size="base" weight="semibold" accessibilityRole="header" numberOfLines={1} className="flex-1 ps-1">
					{title}
				</Text>
				<IconButton icon="note-pencil" label={t`New conversation`} onPress={onNew} />
				<IconButton
					icon="clock-counter-clockwise"
					label={t`Conversations`}
					isSelected={showHistory}
					onPress={onHistory}
				/>
				{expand ? (
					<IconButton
						icon={expand.expanded ? "arrows-in-simple" : "arrows-out-simple"}
						label={expand.expanded ? t`Collapse Coach` : t`Expand Coach`}
						onPress={expand.onPress}
						testID="coach-expand"
					/>
				) : null}
				<IconButton icon="x" label={t`Close`} onPress={onClose} />
			</View>
			{subtitle}
		</View>
	);
}
