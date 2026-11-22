import { useLingui } from "@lingui/react/macro";
import { Stack } from "expo-router";
import { routes } from "@/routes";
import { useTabStackOptions } from "@/shell/app-banner";
import { useTabRootBack } from "@/shell/tab-root-back";

// A link straight to a page of this tab (Offers, Profile → Stories) keeps the tab's first screen under it, so Back works.
export const unstable_settings = { initialRouteName: "index" };

export default function ApplicationsLayout() {
	const { t } = useLingui();
	const back = useTabRootBack(routes.applications(), t`Applications`);
	return (
		<Stack screenOptions={useTabStackOptions()}>
			<Stack.Screen name="jobs" options={{ headerShown: false, title: t`Applications`, animation: "fade" }} />
			<Stack.Screen
				name="offers"
				options={(props) => ({ title: t`Offers`, headerLargeTitle: false, ...back(props) })}
			/>
		</Stack>
	);
}
