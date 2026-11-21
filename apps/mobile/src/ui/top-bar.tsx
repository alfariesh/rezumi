// The bar at the top of a screen that has no native stack header: an optional back button, the page title and up to
// three actions. Tabs get their own bar (title · Coach · Search · avatar) in Phase 03; it builds on this one.
import type { ReactNode } from "react";
import { I18nManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "./button";
import { Typography } from "./text";

export type TopBarProps = {
	title: string;
	/** Shows a back button labelled with this text (translated by the caller). */
	back?: { label: string; onPress: () => void } | undefined;
	/** Icon buttons at the end. */
	actions?: ReactNode;
	/** The page title at 30 pt under the bar row (top-level screens); otherwise a 16 pt title in the row. */
	large?: boolean | undefined;
	/** Pads the status bar inset; off when a native header or sheet already does. */
	safeTop?: boolean | undefined;
};

export function TopBar({ title, back, actions, large = false, safeTop = true }: TopBarProps) {
	const insets = useSafeAreaInsets();
	return (
		<View className="bg-background px-4 pb-2" style={{ paddingTop: safeTop ? insets.top : 0 }}>
			<View className="min-h-11 flex-row items-center gap-2">
				{back ? (
					<IconButton
						icon={I18nManager.isRTL ? "arrow-right" : "arrow-left"}
						label={back.label}
						onPress={back.onPress}
						className="-ms-2"
					/>
				) : null}
				<View className="flex-1">
					{large ? null : (
						<Typography.Heading type="h6" numberOfLines={1}>
							{title}
						</Typography.Heading>
					)}
				</View>
				{actions ? <View className="flex-row items-center gap-1">{actions}</View> : null}
			</View>
			{large ? (
				<Typography.Heading type="h2" numberOfLines={2} className="mt-1">
					{title}
				</Typography.Heading>
			) : null}
		</View>
	);
}
