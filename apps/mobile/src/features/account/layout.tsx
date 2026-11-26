import type { ReactNode } from "react";
import { Stack } from "expo-router";
import { Screen } from "@/ui";

type SettingsPageProps = {
	title: string;
	children: ReactNode;
	onRefresh?: (() => Promise<unknown>) | undefined;
};

export function SettingsPage({ title, children, onRefresh }: SettingsPageProps) {
	return (
		<Screen edges={["bottom"]} onRefresh={onRefresh}>
			<Stack.Screen options={{ title, headerShown: true }} />
			{children}
		</Screen>
	);
}
