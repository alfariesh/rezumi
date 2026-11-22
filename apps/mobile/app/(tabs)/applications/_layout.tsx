import { useLingui } from "@lingui/react/macro";
import { Stack } from "expo-router";
import { useTabStackOptions } from "@/shell/app-banner";

// A link straight to a section of this tab (Offers, Jobs) keeps the tab's first screen under it, so Back works.
export const unstable_settings = { initialRouteName: "index" };

/** Applications: All (List, Board, Calendar), Jobs, Insights and Offers swap in place under one title. */
export default function ApplicationsLayout() {
	const { t } = useLingui();
	const options = { headerShown: false, title: t`Applications`, animation: "fade" } as const;
	return (
		<Stack screenOptions={useTabStackOptions()}>
			<Stack.Screen name="index" options={options} />
			<Stack.Screen name="board" options={options} />
			<Stack.Screen name="calendar" options={options} />
			<Stack.Screen name="jobs" options={options} />
			<Stack.Screen name="insights" options={options} />
			<Stack.Screen name="offers" options={options} />
		</Stack>
	);
}
