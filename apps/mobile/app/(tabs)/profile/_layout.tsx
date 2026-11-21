import { useLingui } from "@lingui/react/macro";
import { Stack } from "expo-router";
import { routes } from "@/routes";
import { useTabRootBack } from "@/shell/tab-root-back";

// A link straight to a page of this tab (Offers, Knowledge) keeps the tab's first screen under it, so Back works.
export const unstable_settings = { initialRouteName: "index" };

export default function ProfileLayout() {
	const { t } = useLingui();
	const back = useTabRootBack(routes.profile(), t`Profile`);
	return (
		<Stack>
			<Stack.Screen name="index" options={{ headerShown: false }} />
			<Stack.Screen name="knowledge" options={(props) => ({ title: t`Knowledge`, ...back(props) })} />
		</Stack>
	);
}
