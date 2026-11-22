// A titled part of the application detail: a row title with an optional action, then its content.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Typography } from "@/ui";

type DetailSectionProps = { title: string; action?: ReactNode; children: ReactNode; testID?: string | undefined };

export function DetailSection({ title, action, children, testID }: DetailSectionProps) {
	return (
		<View className="gap-2" testID={testID}>
			<View className="min-h-8 flex-row items-center gap-2">
				<Typography.Heading type="h6" accessibilityRole="header" className="flex-1">
					{title}
				</Typography.Heading>
				{action}
			</View>
			{children}
		</View>
	);
}
