import type { IconName } from "@/ui";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Card, Icon, Typography } from "@/ui";

type CheckSectionProps = {
	icon: IconName;
	title: string;
	/** Beside the title: a count or "not scored". */
	trailing?: ReactNode;
	children: ReactNode;
	testID?: string | undefined;
};

/** A titled card of Check (the web's CheckWidget): Issues, Checks by category, Posting terms, AI review. */
export function CheckSection({ icon, title, trailing, children, testID }: CheckSectionProps) {
	return (
		<View className="gap-2" testID={testID}>
			<View accessibilityRole="header" className="flex-row items-center gap-2 px-1">
				<Icon name={icon} size={16} tone="muted" />
				<Typography.Heading type="h6" className="flex-1">
					{title}
				</Typography.Heading>
				{trailing}
			</View>
			<Card className="gap-3">{children}</Card>
		</View>
	);
}
