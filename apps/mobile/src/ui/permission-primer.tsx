// The sentence before a system permission prompt: what the app will use and why, then the platform's own dialog only
// once the person goes on. Never shown at launch; a feature opens it the first time it needs the permission.
import type { IconName } from "./icon";
import { View } from "react-native";
import { Button } from "./button";
import { Icon } from "./icon";
import { Sheet } from "./sheet";
import { Typography } from "./text";
import { size } from "./tokens";

export type PermissionPrimerProps = {
	isOpen: boolean;
	icon: IconName;
	title: string;
	/** What the app does with it, and that it can be changed later in the system settings. */
	description: string;
	/** Goes on to the system prompt. */
	continueLabel: string;
	/** Closes without asking; the feature carries on without the permission. */
	notNowLabel: string;
	onContinue: () => void;
	onNotNow: () => void;
};

export function PermissionPrimer(props: PermissionPrimerProps) {
	const { isOpen, icon, title, description, continueLabel, notNowLabel, onContinue, onNotNow } = props;
	return (
		<Sheet isOpen={isOpen} onOpenChange={(open) => !open && onNotNow()} testID="permission-primer">
			<View className="items-center gap-4 pt-6 pb-2">
				<View className="size-16 items-center justify-center rounded-full bg-accent-soft">
					<Icon name={icon} size={size.icon.lg} tone="accent-soft-foreground" />
				</View>
				<View className="gap-2">
					<Typography.Heading type="h4" accessibilityRole="header" className="text-center">
						{title}
					</Typography.Heading>
					<Typography type="body-sm" color="muted" className="text-center">
						{description}
					</Typography>
				</View>
				<View className="w-full gap-2 pt-2">
					<Button size="lg" onPress={onContinue} testID="permission-primer-continue">
						<Button.Label>{continueLabel}</Button.Label>
					</Button>
					<Button size="lg" variant="ghost" onPress={onNotNow} testID="permission-primer-not-now">
						<Button.Label>{notNowLabel}</Button.Label>
					</Button>
				</View>
			</View>
		</Sheet>
	);
}
