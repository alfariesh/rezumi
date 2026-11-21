import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Icon, Text } from "@/ui";

/** Under the status bar above every tab while offline: edits stay on the device and sync later. */
export function OfflineStrip() {
	const { t } = useLingui();
	return (
		<View
			accessibilityRole="alert"
			accessibilityLiveRegion="polite"
			className="flex-row items-center gap-2 bg-accent-soft px-4 py-2"
		>
			<Icon name="cloud-slash" size={16} tone="accent-soft-foreground" />
			<Text size="xs" className="flex-1 text-accent-soft-foreground">
				{t`Offline. Edits are saved on this device and sync when you reconnect.`}
			</Text>
		</View>
	);
}
